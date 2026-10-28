import type { ContentStore } from "@/lib/content/editor";
import { versionRows, type ContentItem } from "@/lib/content/versioned";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { deleteBestEffort, type DeleteArea } from "@/lib/storage/best-effort-delete";
import { publicFolderOf, publicPathname, publicPathnameOfUrl, type PublicFileKind, type PublicPathname, type PublicStoreHost } from "@/lib/storage/pathname";
import { keepableUpload } from "@/lib/storage/upload-sweep";
import type { OutreachDraft, PhotoSrc, PostItem, PostStore } from "./outreach-types";

// A post's photos as files (issue #291). The Edit post panel uploads a photo
// the moment it is picked, through the outreach editor, so only once the
// site-content gate has admitted the viewer. On the database side the file
// goes to the public Blob store under `post-photos/`; in tests it may be kept
// nowhere. A stored file is deleted once no version of any post uses it, and
// only a file in this deployment's own public store is ever accepted or deleted.
// The project editor's photos (issue #299) take the same path, under
// `project-photos/`.

/** Whether `value` has the shape of a photo's src. Whose file it is, a save checks with `checkPhotoSources`. */
export function isPhotoSrc(value: unknown): value is PhotoSrc {
  return typeof value === "string" && /^(\/outreach\/|\/project-photos\/|https:\/\/|data:image\/)\S+$/.test(value);
}

/** Whether `src` is a file the site itself ships, in public/outreach/ or public/project-photos/: no save uploads it and none deletes it. */
export function isSitePhotoSrc(src: string): boolean {
  return /^\/(outreach|project-photos)\/\S+$/.test(src);
}

/** The largest photo file the panel sends. The panel shrinks a picked photo first, so this is rarely reached. */
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

/** The kinds of photo file the store takes, read from the file's own first bytes. */
export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

const startsWith = (bytes: Uint8Array, at: number, sig: readonly number[]) => sig.every((b, i) => bytes[at + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** What the bytes are: a JPEG, PNG or WebP; null for anything else, whatever the browser called it. */
export function photoTypeOf(bytes: Uint8Array): PhotoType | null {
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, 0, ascii("RIFF")) && startsWith(bytes, 8, ascii("WEBP"))) return "image/webp";
  return null;
}

const EXTENSION: Readonly<Record<PhotoType, string>> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** A photo upload the store can take, typed by its bytes. */
export type CheckedPhoto = { readonly bytes: Uint8Array; readonly contentType: PhotoType; readonly extension: string };

export function checkPhotoUpload(upload: Upload): WriteResult<CheckedPhoto> {
  return checkImageUpload(upload, PHOTO_MAX_BYTES, "photo");
}

/** An image upload the store can take: at most `maxBytes`, and a JPEG, PNG or WebP by its own bytes. `what` names it in a refusal. */
export function checkImageUpload(upload: Upload, maxBytes: number, what: string): WriteResult<CheckedPhoto> {
  if (upload.bytes.byteLength > maxBytes) return refused(`The ${what} must be at most ${Math.round(maxBytes / (1024 * 1024))} MB.`);
  const type = photoTypeOf(upload.bytes);
  if (type === null) return refused(`The ${what} must be a JPEG, PNG or WebP file.`);
  return written({ bytes: upload.bytes, contentType: type, extension: EXTENSION[type] });
}

/** Where uploaded photo files go: the public Blob store, or, in tests, nowhere. */
export interface PhotoFiles {
  /** Stores the file and answers its `src`. */
  put(photo: CheckedPhoto): Promise<PhotoSrc>;
  /** Whether `src` names a file this side stored, so a save may carry it. */
  owns(src: string): src is PhotoSrc;
  /**
   * Deletes the files of these photos that this side stored and no row names
   * any more (lib/storage/public-references.ts); any other src is left
   * alone. A file already gone is not an error.
   */
  drop(srcs: readonly PhotoSrc[]): Promise<void>;
  /**
   * Of these photos, the files this side stored that a save may no longer
   * put on a row (`goneFiles`): no longer in the store, since another save
   * deleted it after the panel opened, or so old that the daily sweep may
   * delete it (lib/storage/upload-sweep.ts). A save that newly carries one is
   * refused (issue #831).
   */
  gone(srcs: readonly PhotoSrc[]): Promise<PhotoSrc[]>;
}

/** Why a save carrying a photo whose file is gone, or soon will be, is refused. */
export const PHOTO_GONE = "A photo in this panel is no longer stored. Reload the page and add it again.";

/** The photos a content editor's panel uploads: Outreach post photos, project photos, and the crops of a project's uploaded background. */
export type PanelPhotoKind = Extract<PublicFileKind, "post-photo" | "project-photo" | "project-background">;

/**
 * The pathname of an uploaded photo of this kind in this deployment's public
 * store, whose files `host` serves; null for anything else: a photo of the
 * site (`/outreach/...`, `/project-photos/...`), a data URL kept nowhere, a file of another kind, or a
 * file on any other host, another Blob store included. Only this answers
 * which URLs a save may carry and which files may be deleted.
 */
export function storedPhotoPathname(src: string, host: PublicStoreHost, kind: PanelPhotoKind): PublicPathname | null {
  const pathname = publicPathnameOfUrl(src, host);
  return pathname !== null && pathname.startsWith(publicFolderOf(kind)) ? pathname : null;
}

/** The writes a public store takes: a new file at a pathname, and a delete. */
export interface PublicFileWrites {
  upload(pathname: PublicPathname, bytes: Uint8Array, contentType: string): Promise<{ url: string }>;
  remove(pathname: PublicPathname): Promise<void>;
}

/** What an editor's photos need of a public store: its writes, and two reads. */
export interface PublicFiles extends PublicFileWrites {
  /** When the store took the file; null when it no longer holds it. */
  uploadedAt(pathname: PublicPathname): Promise<Date | null>;
  /**
   * Of these files, the ones no row names now (lib/storage/public-references.ts):
   * the only ones a drop deletes. A side that keeps no other rows answers them all.
   */
  unreferenced(pathnames: readonly PublicPathname[]): Promise<readonly PublicPathname[]>;
}

/**
 * Of `srcs`, those whose file `pathnameOf` names and a save may no longer put
 * on a row (`keepableUpload`): the store no longer holds it, or it is so old
 * that the daily sweep may delete it while the save is under way.
 */
export async function goneFiles<S extends string>(
  srcs: readonly S[],
  pathnameOf: (src: string) => PublicPathname | null,
  writes: Pick<PublicFiles, "uploadedAt">,
  now: Date = new Date(),
): Promise<S[]> {
  const checked = await Promise.all(
    [...new Set(srcs)].map(async (src) => {
      const pathname = pathnameOf(src);
      return pathname !== null && !keepableUpload(await writes.uploadedAt(pathname), now) ? [src] : [];
    }),
  );
  return checked.flat();
}

/** Deletes each of `pathnames` that no row names, best-effort: the write before it has landed. */
export async function dropUnreferenced(area: DeleteArea, pathnames: readonly PublicPathname[], writes: Pick<PublicFiles, "remove" | "unreferenced">): Promise<void> {
  if (pathnames.length === 0) return;
  const free = await writes.unreferenced(pathnames);
  await Promise.all(free.map((pathname) => deleteBestEffort({ store: "public", area, pathname, remove: writes.remove })));
}

/**
 * Photos of one kind kept in the public store whose files `host` serves;
 * `host` is null while no store is configured, and then no URL is this
 * side's. Each upload gets a new name from `newName`, so nothing is
 * overwritten.
 */
export function publicStorePanelPhotos(
  kind: PanelPhotoKind,
  host: PublicStoreHost | null,
  writes: PublicFiles,
  newName: () => string,
): PhotoFiles {
  const pathnameOf = (src: string) => (host === null ? null : storedPhotoPathname(src, host, kind));
  return {
    async put(photo) {
      const { url } = await writes.upload(publicPathname(kind, `${newName()}.${photo.extension}`), photo.bytes, photo.contentType);
      if (pathnameOf(url) === null) throw new Error(`The public store answered a URL off its own host: ${url}`);
      return url as `https://${string}`;
    },
    owns: (src): src is `https://${string}` => pathnameOf(src) !== null,
    async drop(srcs) {
      // A file left behind costs storage only; the write already landed.
      await dropUnreferenced("post-photo", srcs.flatMap((src) => pathnameOf(src) ?? []), writes);
    },
    gone: (srcs) => goneFiles(srcs, pathnameOf, writes),
  };
}

/** Post photos in the public store, under `post-photos/`. */
export function publicStorePhotoFiles(host: PublicStoreHost | null, writes: PublicFiles, newName: () => string): PhotoFiles {
  return publicStorePanelPhotos("post-photo", host, writes, newName);
}

/**
 * A content store freeing the photo files a write leaves unshown: after an
 * update or a delete lands, each photo the item had before goes to
 * `files.drop` when no version of any item shows it any more
 * (`filesNoLongerShown`). `photosIn` reads the photos one version shows.
 */
export function freeingFiles<T extends D, D>(
  store: ContentStore<T, D>,
  files: Pick<PhotoFiles, "drop" | "gone">,
  photosIn: (content: D) => readonly PhotoSrc[],
): ContentStore<T, D> {
  const photosOf = (item: ContentItem<T, D> | null) => (item === null ? [] : versionRows(item.version).flatMap((row) => photosIn(row.content)));
  async function thenFree<R>(id: number, write: () => Promise<WriteResult<R>>): Promise<WriteResult<R>> {
    const before = (await store.list()).find((item) => item.id === id) ?? null;
    const result = await write();
    if (result.ok) await files.drop(filesNoLongerShown(photosOf(before), await store.list(), photosIn));
    return result;
  }
  /** Refused when a photo the write adds is gone or past the age a save may keep (`files.gone`, issue #831); else `write`. */
  async function keepingOnly<R>(added: readonly PhotoSrc[], write: () => Promise<WriteResult<R>>): Promise<WriteResult<R>> {
    return (await files.gone(added)).length > 0 ? refused(PHOTO_GONE) : write();
  }
  return {
    ...store,
    // A new item's photos are all added by its save.
    create: (version, siteOrder) => keepingOnly(photosOf({ id: 0, siteOrder, version }), () => store.create(version, siteOrder)),
    // The store refuses a write made on versions another save has replaced
    // since; a photo the item did not have is checked like a new item's.
    update: (id, version, expected) =>
      thenFree(id, () => {
        const had = new Set(photosOf({ id, siteOrder: 0, version: expected }));
        const added = photosOf({ id, siteOrder: 0, version }).filter((src) => !had.has(src));
        return keepingOnly(added, () => store.update(id, version, expected));
      }),
    remove: (id) => thenFree(id, () => store.remove(id)),
  };
}

/**
 * Of `candidates`, the photos no version of any item in `items` shows, so
 * their files may go. `items` is every item as stored after the write: a file
 * two items share stays while either one shows it.
 */
export function filesNoLongerShown<T extends D, D>(
  candidates: Iterable<PhotoSrc>,
  items: readonly ContentItem<T, D>[],
  photosIn: (content: D) => readonly PhotoSrc[],
): PhotoSrc[] {
  const shown = new Set(items.flatMap((item) => versionRows(item.version).flatMap((row) => photosIn(row.content))));
  return [...new Set(candidates)].filter((src) => !shown.has(src));
}

/** Every photo a version of a post shows or keeps: its photos, then its gallery's (issue #430), shown or not. */
export const postPhotos = (post: OutreachDraft): PhotoSrc[] => [...post.photos, ...(post.gallery?.items ?? [])].map((p) => p.src);

/**
 * The post store, freeing the files a write leaves unshown: after an update
 * or a delete lands, each photo the post had before goes to `files.drop` when
 * no version of any post shows it any more (`photosNoLongerShown`).
 */
export function freeingPhotoFiles(store: PostStore, files: Pick<PhotoFiles, "drop" | "gone">): PostStore {
  return freeingFiles(store, files, postPhotos);
}

/**
 * Of `candidates`, the photos no version of any post in `posts` shows, so
 * their files may go. `posts` is every post as stored after the write: a file
 * two posts share stays while either one shows it. Save, Delete and Remove
 * photo all free files through this one check.
 */
export function photosNoLongerShown(candidates: Iterable<PhotoSrc>, posts: readonly PostItem[]): PhotoSrc[] {
  return filesNoLongerShown(candidates, posts, postPhotos);
}

/**
 * The post or draft, or why not: each photo is one the version the panel
 * opened on had (none for a new post), or a file this side stored. A save
 * cannot point a post at a file somewhere else.
 */
export function checkPhotoSources<P extends OutreachDraft>(post: P, had: OutreachDraft | null, files: Pick<PhotoFiles, "owns">): WriteResult<P> {
  const known = new Set(had === null ? [] : postPhotos(had));
  const stray = postPhotos(post).find((src) => !known.has(src) && !files.owns(src));
  return stray === undefined ? written(post) : refused("A photo was not uploaded. Add it again.");
}
