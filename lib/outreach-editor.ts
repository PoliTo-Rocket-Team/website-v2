import { contentEditor, type ContentEditor } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { textLength } from "@/lib/content/text";
import { editorVersion, publicItems, publicVersion, type PublishStep, type Versioned } from "@/lib/content/versioned";
import { slugOf, todayInRome } from "./outreach";
import { blankPost, checkPostFields, draftOfFields, postCheckResult, type PostFields } from "./outreach-post-fields";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { checkPhotoSources, checkPhotoUpload, freeingPhotoFiles, photosNoLongerShown, type PhotoFiles } from "./outreach-photos";
import {
  titleOf,
  type OutreachContent,
  type OutreachDraft,
  type OutreachFeature,
  type OutreachPost,
  type OutreachTag,
  type PhotoSrc,
  type PostItem,
  type PostStore,
} from "./outreach-types";

// The Outreach content as the dashboard keeps it (issue #287): the posts, each
// a content item with a published version and an optional draft
// (lib/content/), the featured summit with the same two versions, the tag
// list, and which post is pinned to the top of /outreach (issue #392). Each side of the dashboard data interface brings an
// `OutreachStore`: the database (lib/dashboard/database-outreach.ts), or the
// dummy data on previews and in test-developer sessions
// (lib/dummy-data/outreach.ts), and its place for photo files
// (lib/outreach-photos.ts). The editor puts every write and every upload
// behind the site-content gate and keeps a post's tags to the tag list.

/**
 * The summit's versions. It is always published (the import publishes it
 * and no step unpublishes it), with an optional draft beside it.
 */
export type SummitVersions = Extract<Versioned<OutreachFeature>, { state: "published" }>;

/** The summit's versions after Save draft or Publish: as `afterStep` (lib/content/versioned.ts), and never unpublished. */
export function summitAfterStep(current: SummitVersions, content: OutreachFeature, step: PublishStep): SummitVersions {
  return step === "publish"
    ? { state: "published", published: content, draft: null }
    : { state: "published", published: current.published, draft: content };
}

export interface OutreachStore {
  readonly posts: PostStore;
  summit(): Promise<SummitVersions>;
  saveSummit(versions: SummitVersions): Promise<WriteResult<SummitVersions>>;
  /** The tag list, in its order. */
  tags(): Promise<readonly OutreachTag[]>;
  /** A new tag at the end of the list; never the award one. */
  addTag(name: string): Promise<WriteResult<OutreachTag>>;
  /** The id of the pinned post (issue #392); null while none is. */
  pinned(): Promise<number | null>;
  /** The post `id` becomes the one pinned post, every other one unpinned in the same write; null unpins every post. */
  pin(id: number | null): Promise<WriteResult<null>>;
}

/** Everything a store holds, as the public read and the import see it. */
export type StoredOutreach = {
  readonly posts: readonly PostItem[];
  readonly summit: SummitVersions;
  readonly tags: readonly OutreachTag[];
  /** The id of the one pinned post (issue #392), or null: one id, so two pinned posts cannot be written down. */
  readonly pinned: number | null;
};

/**
 * What the public pages show: the published summit, the pinned post while it
 * is published, every other published post in site order, and the tags. A
 * post with only a draft is not there, and a pinned one is not listed.
 */
export function publicOutreach(stored: StoredOutreach): OutreachContent {
  const pinnedItem = stored.posts.find((item) => item.id === stored.pinned);
  return {
    feature: stored.summit.published,
    pinned: pinnedItem === undefined ? null : publicVersion(pinnedItem.version),
    posts: publicItems(stored.posts.filter((item) => item !== pinnedItem)),
    tags: stored.tags,
  };
}

/** The post `id` may be pinned, or why not: it must be in the list and on the site (issue #392). */
export function checkPin(id: number, items: readonly PostItem[]): WriteResult<number> {
  const item = items.find((i) => i.id === id);
  if (item === undefined) return refused("This post was removed. Reload the page.");
  if (publicVersion(item.version) === null) return refused("Publish the post before you pin it.");
  return written(id);
}

/** The longest tag name the list takes; the `outreach_tags` table checks the same. */
export const OUTREACH_TAG_MAX = 32;

/** A new tag's name, trimmed, or why the list cannot take it. Names are compared without case, so "award" is Award. */
export function checkNewTag(name: string, tags: readonly OutreachTag[]): WriteResult<string> {
  const trimmed = name.trim();
  if (trimmed === "") return refused("Write the tag.");
  if (textLength(trimmed) > OUTREACH_TAG_MAX) return refused(`${textLength(trimmed)} characters; the limit is ${OUTREACH_TAG_MAX}.`);
  const same = tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase());
  return same === undefined ? written(trimmed) : refused(`${same.name} is already a tag.`);
}

/** The post, or why not: every tag it carries must be on the tag list. */
export function checkPostTags(post: OutreachPost, tags: readonly OutreachTag[]): WriteResult<OutreachPost> {
  const known = new Set(tags.map((t) => t.name));
  const unknown = post.tags.find((name) => !known.has(name));
  return unknown === undefined ? written(post) : refused(`${unknown} is not a tag. Add it to the tag list first.`);
}

/**
 * The address the dashboard's New post page sits at (/dashboard/outreach/new,
 * board 74f): no post may take it, or its edit page could not be opened.
 */
export const NEW_POST_ADDRESS = "new";

/** Both addresses an item holds: the one its editor version makes and, while it is live, the published one. */
function addressesOf(item: PostItem): string[] {
  const published = publicVersion(item.version);
  return [slugOf(editorVersion(item.version)), ...(published === null ? [] : [slugOf(published)])];
}

/**
 * The address the post's title makes (`slugOf`), or why it cannot have it:
 * the New post page's, or one another post holds already, as its draft or
 * as it is live. Two posts with one address would hide one of them.
 */
export function checkPostAddress(post: Pick<OutreachDraft, "title">, id: number | null, items: readonly PostItem[]): WriteResult<string> {
  const slug = slugOf(post);
  if (slug === NEW_POST_ADDRESS) return refused(`The address /outreach/${slug} is kept for the dashboard. Change the title.`);
  const holder = items.find((item) => item.id !== id && addressesOf(item).includes(slug));
  if (holder === undefined) return written(slug);
  return refused(`"${titleOf(editorVersion(holder.version))}" already has the address /outreach/${slug}. Change the title.`);
}

export interface OutreachEditor {
  /** The posts through the shared content editor; a save whose post carries a tag off the list is refused. */
  readonly posts: ContentEditor<OutreachPost, OutreachDraft>;
  /**
   * Save draft or Publish from the Edit post panel (boards 74c to 74h), on a
   * post or, with `id` null, a new one (board 74f). Publish, and Save draft
   * on a published post, need fields that make a whole post
   * (lib/outreach-post-fields.ts); Save draft on a post never published
   * keeps the fields as they are. Either way the title's address must be
   * free (`checkPostAddress`), every tag on the tag list, and each photo
   * one the post had or a file `uploadPhoto` stored.
   */
  savePost(id: number | null, step: PublishStep, fields: PostFields): Promise<WriteResult<PostItem>>;
  /** A photo picked in the panel, stored once the gate admits the viewer; answers its src. */
  uploadPhoto(photo: Upload): Promise<WriteResult<PhotoSrc>>;
  /**
   * A photo removed in the panel before any save used it: its file is
   * deleted, unless a version of a post shows it. Nothing for a photo the
   * store did not upload.
   */
  discardPhoto(src: string): Promise<WriteResult<null>>;
  /** The summit's versions; null for a viewer the gate refuses. */
  summit(): Promise<SummitVersions | null>;
  /** Save draft or Publish on the summit. `prepare` gets the version the panel opened on, once the gate let the viewer through. */
  saveSummit(
    step: PublishStep,
    prepare: (current: OutreachFeature) => Promise<WriteResult<OutreachFeature>>,
  ): Promise<WriteResult<SummitVersions>>;
  /** The tag list; null for a viewer the gate refuses. */
  tags(): Promise<readonly OutreachTag[] | null>;
  addTag(name: string): Promise<WriteResult<OutreachTag>>;
  /** The id of the pinned post; null while none is, and for a viewer the gate refuses. */
  pinned(): Promise<number | null>;
  /**
   * Pin a published post to the top of /outreach (issue #392): it takes the
   * Featured card and leaves the post list, and the post pinned before it,
   * if any, goes back to the list. At most one post is pinned at any time.
   */
  pin(id: number): Promise<WriteResult<null>>;
  /** Unpin the pinned post: it goes back to the list, and the Featured card shows the summit alone. */
  unpin(): Promise<WriteResult<null>>;
}

export function outreachEditor(viewer: ViewerStanding, store: OutreachStore, files: PhotoFiles): OutreachEditor {
  const allowed = maySiteContent(viewer);
  const posts = contentEditor(viewer, freeingPhotoFiles(store.posts, files));
  return {
    posts: {
      ...posts,
      save: (id, step, prepare) =>
        posts.save(id, step, async (current) => {
          const post = await prepare(current);
          return post.ok ? checkPostTags(post.value, await store.tags()) : post;
        }),
    },

    async savePost(id, step, fields) {
      // Checked against the post as the gate let the viewer read it: a post
      // never published (or a new one) takes a draft that is not whole yet.
      const before = id === null ? null : (await store.posts.list()).find((item) => item.id === id);
      const unfinished = step === "save-draft" && (before === null || before?.version.state === "draft");
      const placed = async <P extends OutreachDraft>(content: WriteResult<P>, opened: OutreachDraft | null): Promise<WriteResult<P>> => {
        if (!content.ok) return content;
        const address = checkPostAddress(content.value, id, await store.posts.list());
        return address.ok ? checkPhotoSources(content.value, opened, files) : address;
      };
      const openedOf = (opened: OutreachDraft | null) => opened ?? blankPost(todayInRome());
      if (unfinished) {
        return posts.saveUnfinished(id, async (opened) =>
          placed(draftOfFields(fields, openedOf(opened), await store.tags()), opened),
        );
      }
      return posts.save(id, step, async (opened) =>
        placed(postCheckResult(checkPostFields(fields, openedOf(opened), await store.tags())), opened),
      );
    },

    async uploadPhoto(upload) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const photo = checkPhotoUpload(upload);
      return photo.ok ? written(await files.put(photo.value)) : photo;
    },

    async discardPhoto(src) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      if (!files.owns(src)) return written(null);
      await files.drop(photosNoLongerShown([src], await store.posts.list()));
      return written(null);
    },

    summit: async () => (allowed ? store.summit() : null),

    async saveSummit(step, prepare) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const current = await store.summit();
      const content = await prepare(current.draft ?? current.published);
      return content.ok ? store.saveSummit(summitAfterStep(current, content.value, step)) : content;
    },

    tags: async () => (allowed ? store.tags() : null),

    async addTag(name) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const checked = checkNewTag(name, await store.tags());
      return checked.ok ? store.addTag(checked.value) : checked;
    },

    pinned: async () => (allowed ? store.pinned() : null),

    async pin(id) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const checked = checkPin(id, await store.posts.list());
      return checked.ok ? store.pin(checked.value) : checked;
    },

    async unpin() {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      return store.pin(null);
    },
  };
}
