import { contentEditor, type ContentEditor } from "@/lib/content/editor";
import { maySiteContent, SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { textLength } from "@/lib/content/text";
import { editorVersion, publicItems, publicVersion, type PublishStep } from "@/lib/content/versioned";
import { newestFirst, slugOf, todayInRome } from "./outreach";
import { checkFeature, isFeatured, upToTwo, type FeaturedIds } from "./outreach-featured";
import { blankPost, checkPostFields, draftOfFields, postCheckResult, type PostFields } from "./outreach-post-fields";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { checkPhotoSources, checkPhotoUpload, freeingPhotoFiles, photosNoLongerShown, type PhotoFiles } from "./outreach-photos";
import {
  titleOf,
  type OutreachContent,
  type OutreachDraft,
  type OutreachPost,
  type OutreachTag,
  type PhotoSrc,
  type PostItem,
  type PostStore,
} from "./outreach-types";

// The Outreach content as the dashboard keeps it (issue #287): the posts, each
// a content item with a published version and an optional draft
// (lib/content/), the tag list, and which posts are featured at the top of
// /outreach (issue #496, lib/outreach-featured.ts). Each side of the dashboard data interface brings an
// `OutreachStore`: the database (lib/dashboard/database-outreach.ts), or, in
// tests, the dummy data (lib/dummy-data/outreach.ts), and its place for photo files
// (lib/outreach-photos.ts). The editor puts every write and every upload
// behind the site-content gate and keeps a post's tags to the tag list.

export interface OutreachStore {
  readonly posts: PostStore;
  /** The tag list, in its order. */
  tags(): Promise<readonly OutreachTag[]>;
  /** A new tag at the end of the list; never the award one. */
  addTag(name: string): Promise<WriteResult<OutreachTag>>;
  /** The ids of the featured posts (issue #496): none, one or two. */
  featured(): Promise<FeaturedIds>;
  /** The post `id` is featured too; refused with `FEATURED_FULL` while two are, so a third is never written. */
  feature(id: number): Promise<WriteResult<null>>;
  /** The post `id` is no longer featured; nothing changes for a post that is not. */
  unfeature(id: number): Promise<WriteResult<null>>;
}

/** Everything a store holds, as the public read and the import see it. */
export type StoredOutreach = {
  readonly posts: readonly PostItem[];
  readonly tags: readonly OutreachTag[];
  /** The ids of the featured posts (issue #496): at most two, so a third cannot be written down. */
  readonly featured: FeaturedIds;
};

/**
 * What the public pages show: the featured posts while they are published,
 * newest first, every other published post in site order, and the tags. A
 * post with only a draft is not there, and a featured one is not listed.
 */
export function publicOutreach(stored: StoredOutreach): OutreachContent {
  const featuredItems = stored.posts.filter((item) => isFeatured(stored.featured, item.id));
  return {
    featured: upToTwo(newestFirst(publicItems(featuredItems))) ?? [],
    posts: publicItems(stored.posts.filter((item) => !featuredItems.includes(item))),
    tags: stored.tags,
  };
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
  /** The tag list; null for a viewer the gate refuses. */
  tags(): Promise<readonly OutreachTag[] | null>;
  addTag(name: string): Promise<WriteResult<OutreachTag>>;
  /** The ids of the featured posts; none for a viewer the gate refuses. */
  featured(): Promise<FeaturedIds>;
  /**
   * Feature a published post at the top of /outreach (issue #496): it takes
   * a Featured card of its own and leaves the post list. At most two posts
   * are featured at once; a third is refused, and nothing changes.
   */
  feature(id: number): Promise<WriteResult<null>>;
  /** Unfeature a post: it goes back to the list. */
  unfeature(id: number): Promise<WriteResult<null>>;
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

    tags: async () => (allowed ? store.tags() : null),

    async addTag(name) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const checked = checkNewTag(name, await store.tags());
      return checked.ok ? store.addTag(checked.value) : checked;
    },

    featured: async () => (allowed ? store.featured() : []),

    async feature(id) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      const checked = checkFeature(id, await store.posts.list());
      return checked.ok ? store.feature(checked.value) : checked;
    },

    async unfeature(id) {
      if (!allowed) return refused(SITE_CONTENT_REFUSAL);
      return store.unfeature(id);
    },
  };
}
