import { memoryContentStore } from "@/lib/content/memory";
import { refused, written } from "@/lib/dashboard/write";
import { checkNewTag, type OutreachStore, type StoredOutreach, type SummitVersions } from "@/lib/outreach-editor";
import { importedOutreach } from "@/lib/outreach-import";
import type { PhotoFiles } from "@/lib/outreach-photos";
import { outreachDraftOf, outreachFeatureOf, outreachPostOf } from "@/lib/outreach-rows";
import type {
  DraftGallery,
  OutreachDraft,
  OutreachFeature,
  OutreachPhoto,
  OutreachPost,
  OutreachTag,
  PostItem,
  PostVersions,
} from "@/lib/outreach-types";
import { contentEditsOf, NO_CONTENT_EDITS, parseContentEdits, PREVIEW_FULL, withContentEdits, type ContentEdits } from "./content-edits";
import { DUMMY_STATE_COOKIE_BYTES } from "./state";

// The Outreach content on previews and in test-developer sessions (issue
// #287), which never touch a database. The dashboard starts from what the
// import carries into the database. A test developer's changes are kept in
// one cookie in their own browser, cleared on sign out: the edits to the
// posts (./content-edits.ts), the summit's versions once they change it, the
// tags they add, and the pinned post once they pin or unpin one. The public
// pages never read it.
//
// A post is long, so a whole one or two fill the cookie. The cookie keeps a
// version of a seeded post or of the summit as the fields that differ from
// the seed's published version; a new post is kept whole.
//
// A photo a test developer uploads is stored nowhere (issue #291): the
// answer carries it as a data URL, so the panel and the page show it until
// the next load, and the cookie keeps the board's warm stand-in in its place.

/** Which post is pinned, once a test developer pinned or unpinned one: its id, or none. */
export type DummyPin = { readonly id: number | null };

/** What a test developer changed on the Outreach content. */
export type DummyOutreachEdits = {
  readonly posts: ContentEdits<OutreachPost, OutreachDraft>;
  /** The summit's versions, once changed; null while it is the seed's. */
  readonly summit: SummitVersions | null;
  /** Tags added to the end of the list, in the order they were added. */
  readonly tags: readonly string[];
  /** The pin, once changed (issue #392); null while it is the seed's. */
  readonly pin: DummyPin | null;
};

export const NO_OUTREACH_EDITS: DummyOutreachEdits = { posts: NO_CONTENT_EDITS, summit: null, tags: [], pin: null };

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
    summit: edits.summit === null ? null : eachVersion(edits.summit, (f) => compact(SEED.summit.published, f as OutreachFeature)),
    tags: edits.tags,
    pin: edits.pin,
  };
  return encodeURIComponent(JSON.stringify(wire));
}

/** The pin as the cookie keeps it; undefined when it is not one this code wrote. A cookie from before pins were kept has none. */
function pinOf(value: unknown): DummyPin | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isShape(value)) return undefined;
  if (value.id === null) return { id: null };
  return Number.isSafeInteger(value.id) ? { id: value.id as number } : undefined;
}

const isPost = (value: unknown): value is OutreachPost => outreachPostOf(value) !== null;
const isDraft = (value: unknown): value is OutreachDraft => outreachDraftOf(value) !== null;

function summitOf(value: unknown): SummitVersions | null {
  if (!isShape(value) || value.state !== "published") return null;
  const published = outreachFeatureOf(value.published);
  const draft = value.draft === null ? null : outreachFeatureOf(value.draft);
  if (published === null || (value.draft !== null && draft === null)) return null;
  return { state: "published", published, draft };
}

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
    const summit = wire.summit === null ? null : summitOf(eachVersion(wire.summit, (f) => expand(SEED.summit.published, f)));
    const tags = addedTags(wire.tags);
    const pin = pinOf(wire.pin);
    if ((wire.summit !== null && summit === null) || tags === null || pin === undefined) return NO_OUTREACH_EDITS;
    return { posts, summit, tags, pin };
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
function keptGallery<G extends DraftGallery>(gallery: G): G {
  return { ...gallery, items: gallery.items.map(keptPhoto) };
}

/** A version the cookie can hold: an uploaded photo (a data URL) is not kept. */
function keptVersion(version: PostVersions): PostVersions {
  const keep = (post: OutreachPost): OutreachPost => {
    const [cover, ...more] = post.photos;
    const { gallery } = post;
    const kept: OutreachPost = { ...post, photos: [keptPhoto(cover), ...more.map(keptPhoto)] };
    if (gallery === undefined) return kept;
    if (!gallery.shown) return { ...kept, gallery: keptGallery(gallery) };
    const [first, ...rest] = gallery.items;
    return { ...kept, gallery: { ...gallery, items: [keptPhoto(first), ...rest.map(keptPhoto)] } };
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

  const posts = memoryContentStore(withContentEdits(SEED.posts, current.posts), (items: readonly PostItem[]) =>
    keep({ ...current, posts: contentEditsOf(SEED.posts, items, keptVersion) }),
  );

  return {
    posts,

    summit: async () => current.summit ?? SEED.summit,

    async saveSummit(versions) {
      const error = await keep({ ...current, summit: versions });
      return error === null ? written(versions) : refused(error);
    },

    tags: async () => [...SEED.tags, ...current.tags.map((name) => ({ name, award: false }))],

    async addTag(name) {
      const error = await keep({ ...current, tags: [...current.tags, name] });
      return error === null ? written({ name, award: false }) : refused(error);
    },

    // A removed post takes its pin with it, as the database's row does.
    async pinned() {
      const id = current.pin === null ? SEED.pinned : current.pin.id;
      return (await posts.list()).some((item) => item.id === id) ? id : null;
    },

    async pin(id) {
      const error = await keep({ ...current, pin: { id } });
      return error === null ? written(null) : refused(error);
    },
  };
}
