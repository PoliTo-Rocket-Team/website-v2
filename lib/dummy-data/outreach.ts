import { memoryContentStore } from "@/lib/content/memory";
import { refused, written } from "@/lib/dashboard/write";
import { checkNewTag, type OutreachStore, type StoredOutreach } from "@/lib/outreach-editor";
import { featuredAmong, featuredIdsOf, featuring, unfeaturing, type FeaturedIds } from "@/lib/outreach-featured";
import { importedOutreach } from "@/lib/outreach-import";
import type { PhotoFiles } from "@/lib/outreach-photos";
import { outreachDraftOf, outreachPostOf } from "@/lib/outreach-rows";
import type { OutreachDraft, OutreachPhoto, OutreachPost, OutreachTag, PostGallery, PostItem, PostVersions } from "@/lib/outreach-types";
import { contentEditsOf, NO_CONTENT_EDITS, parseContentEdits, PREVIEW_FULL, withContentEdits, type ContentEdits } from "./content-edits";
import { DUMMY_STATE_COOKIE_BYTES } from "./state";

// The Outreach content on previews and in test-developer sessions (issue
// #287), which never touch a database. The dashboard starts from what the
// import carries into the database. A test developer's changes are kept in
// one cookie in their own browser, cleared on sign out: the edits to the
// posts (./content-edits.ts), the tags they add, and the featured posts once
// they feature or unfeature one (issue #496). The public pages never read it.
//
// A post is long, so a whole one or two fill the cookie. The cookie keeps a
// version of a seeded post as the fields that differ from the seed's
// published version; a new post is kept whole.
//
// A photo a test developer uploads is stored nowhere (issue #291): the
// answer carries it as a data URL, so the panel and the page show it until
// the next load, and the cookie keeps the board's warm stand-in in its place.

/** What a test developer changed on the Outreach content. */
export type DummyOutreachEdits = {
  readonly posts: ContentEdits<OutreachPost, OutreachDraft>;
  /** Tags added to the end of the list, in the order they were added. */
  readonly tags: readonly string[];
  /** The featured posts' ids once changed (issue #496), at most two; null while they are the seed's. */
  readonly featured: FeaturedIds | null;
};

export const NO_OUTREACH_EDITS: DummyOutreachEdits = { posts: NO_CONTENT_EDITS, tags: [], featured: null };

export type DummyOutreachEditsStore = {
  readonly current: DummyOutreachEdits;
  save(next: DummyOutreachEdits): Promise<void>;
};

export const NO_OUTREACH_EDITS_STORE: DummyOutreachEditsStore = { current: NO_OUTREACH_EDITS, save: async () => {} };

/** The dashboard's starting content: the import. */
export function dummyOutreachSeed(): StoredOutreach {
  return importedOutreach();
}

const SEED = dummyOutreachSeed();

/** The published post the seed holds under `id`, which a kept version of that post is measured against. */
function seedPost(id: unknown): OutreachPost | undefined {
  const item = SEED.posts.find((p) => p.id === id);
  return item?.version.state === "published" ? item.version.published : undefined;
}

type Shape = Record<string, unknown>;

const isShape = (value: unknown): value is Shape => typeof value === "object" && value !== null && !Array.isArray(value);

/** `value` as the cookie keeps it: whole when there is no base, else `{ patch }`, the fields that differ (null: removed). */
function compact(base: object | undefined, value: object): unknown {
  if (base === undefined) return value;
  const was = base as Shape;
  const now = value as Shape;
  const patch: Shape = {};
  for (const key of new Set([...Object.keys(was), ...Object.keys(now)])) {
    if (JSON.stringify(was[key]) !== JSON.stringify(now[key])) patch[key] = now[key] === undefined ? null : now[key];
  }
  return { patch };
}

/** A kept value back as a whole one. What it reads as is checked by the caller. */
function expand(base: object | undefined, kept: unknown): unknown {
  if (base === undefined || !isShape(kept) || !isShape(kept.patch)) return kept;
  const value: Shape = { ...base, ...kept.patch };
  for (const [key, v] of Object.entries(kept.patch)) if (v === null) delete value[key];
  return value;
}

/** Each version in `version` passed through `f`; anything that is not a version's shape is left for the reader to refuse. */
function eachVersion(version: unknown, f: (value: unknown) => unknown): unknown {
  if (!isShape(version)) return version;
  if (version.state === "draft") return { ...version, draft: f(version.draft) };
  return { ...version, published: f(version.published), draft: version.draft === null ? null : f(version.draft) };
}

export function serializeOutreachEdits(edits: DummyOutreachEdits): string {
  const wire = {
    posts: {
      ...edits.posts,
      saved: edits.posts.saved.map((item) => ({
        ...item,
        version: eachVersion(item.version, (post) => compact(seedPost(item.id), post as OutreachPost)),
      })),
    },
    tags: edits.tags,
    featured: edits.featured,
  };
  return encodeURIComponent(JSON.stringify(wire));
}

/**
 * The featured ids as the cookie keeps them; null while they are the seed's,
 * undefined when they are not ones this code wrote: not ids, one twice, or
 * more than two. A cookie from before featured posts were kept has none.
 */
function featuredOf(value: unknown): FeaturedIds | null | undefined {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || !value.every((id) => Number.isSafeInteger(id))) return undefined;
  return featuredIdsOf(value as number[]) ?? undefined;
}

const isPost = (value: unknown): value is OutreachPost => outreachPostOf(value) !== null;
const isDraft = (value: unknown): value is OutreachDraft => outreachDraftOf(value) !== null;

/** The tags added, each one the list could have taken after the ones before it; null otherwise. */
function addedTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const added: OutreachTag[] = [];
  for (const name of value) {
    if (typeof name !== "string") return null;
    const checked = checkNewTag(name, [...SEED.tags, ...added]);
    if (!checked.ok || checked.value !== name) return null;
    added.push({ name, award: false });
  }
  return added.map((t) => t.name);
}

/** The edits in the cookie; none when it is absent or not one this code wrote. */
export function parseOutreachEdits(value: string | undefined): DummyOutreachEdits {
  if (!value) return NO_OUTREACH_EDITS;
  try {
    const wire = JSON.parse(decodeURIComponent(value)) as unknown;
    if (!isShape(wire) || !isShape(wire.posts)) return NO_OUTREACH_EDITS;
    const saved = Array.isArray(wire.posts.saved)
      ? wire.posts.saved.map((item: unknown) =>
          isShape(item) ? { ...item, version: eachVersion(item.version, (post) => expand(seedPost(item.id), post)) } : item,
        )
      : wire.posts.saved;
    const posts = parseContentEdits(encodeURIComponent(JSON.stringify({ ...wire.posts, saved })), isPost, isDraft);
    const tags = addedTags(wire.tags);
    const featured = featuredOf(wire.featured);
    if (tags === null || featured === undefined) return NO_OUTREACH_EDITS;
    return { posts, tags, featured };
  } catch {
    return NO_OUTREACH_EDITS;
  }
}

/**
 * The test developer's Outreach content: the seed with their edits, in a
 * store that keeps each write in their cookie, and refuses one the cookie
 * cannot hold. A refused write changes nothing.
 */
/** What an uploaded photo shows once the page loads again: a preview keeps no file. */
export const PREVIEW_PHOTO_SRC = "/outreach/preview-upload.webp";

function keptPhoto<P extends OutreachPhoto>(photo: P): P {
  return photo.src.startsWith("data:") ? { ...photo, src: PREVIEW_PHOTO_SRC } : photo;
}

/** A gallery the cookie can hold, its uploaded photos replaced as the post's are. */
function keptGallery(gallery: PostGallery): PostGallery {
  const [first, ...rest] = gallery.items;
  return { items: [keptPhoto(first), ...rest.map(keptPhoto)] };
}

/** A version the cookie can hold: an uploaded photo (a data URL) is not kept. */
function keptVersion(version: PostVersions): PostVersions {
  const keep = (post: OutreachPost): OutreachPost => {
    const [cover, ...more] = post.photos;
    return {
      ...post,
      photos: [keptPhoto(cover), ...more.map(keptPhoto)],
      ...(post.gallery !== undefined && { gallery: keptGallery(post.gallery) }),
    };
  };
  const keepDraft = (draft: OutreachDraft): OutreachDraft => ({
    ...draft,
    photos: draft.photos.map(keptPhoto),
    ...(draft.gallery !== undefined && { gallery: keptGallery(draft.gallery) }),
  });
  return version.state === "draft"
    ? { state: "draft", draft: keepDraft(version.draft) }
    : { state: "published", published: keep(version.published), draft: version.draft === null ? null : keep(version.draft) };
}

/** A preview stores no files: an uploaded photo comes back as a data URL, and nothing is written to Blob. */
export const dummyPhotoFiles: PhotoFiles = {
  put: async (photo) => `data:${photo.contentType};base64,${Buffer.from(photo.bytes).toString("base64")}`,
  owns: (src): src is `data:image/${string}` => src.startsWith("data:image/"),
  drop: async () => {},
};

export function dummyOutreachStore(edits: DummyOutreachEditsStore): OutreachStore {
  let current = edits.current;

  async function keep(next: DummyOutreachEdits): Promise<string | null> {
    if (serializeOutreachEdits(next).length > DUMMY_STATE_COOKIE_BYTES) return PREVIEW_FULL;
    current = next;
    await edits.save(next);
    return null;
  }

  // A post removed or unpublished gives up its featured slot in the same
  // cookie write as the post edit (issue #502), as the database's row does.
  const posts = memoryContentStore(withContentEdits(SEED.posts, current.posts), (items: readonly PostItem[]) => {
    const was = current.featured ?? SEED.featured;
    const left = featuredAmong(was, items);
    return keep({
      ...current,
      posts: contentEditsOf(SEED.posts, items, keptVersion),
      featured: left.length === was.length ? current.featured : left,
    });
  });

  async function featured(): Promise<FeaturedIds> {
    return featuredAmong(current.featured ?? SEED.featured, await posts.list());
  }

  async function keepFeatured(next: FeaturedIds) {
    const error = await keep({ ...current, featured: next });
    return error === null ? written(null) : refused(error);
  }

  return {
    posts,

    tags: async () => [...SEED.tags, ...current.tags.map((name) => ({ name, award: false }))],

    async addTag(name) {
      const error = await keep({ ...current, tags: [...current.tags, name] });
      return error === null ? written({ name, award: false }) : refused(error);
    },

    featured,

    // The cookie holds two ids at most: a third is refused here, as the
    // database's two slots refuse it.
    async feature(id) {
      const next = featuring(await featured(), id);
      return next.ok ? keepFeatured(next.value) : next;
    },

    async unfeature(id) {
      return keepFeatured(unfeaturing(await featured(), id));
    },
  };
}
