import { versionRows } from "@/lib/content/versioned";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { publicPathname, publicPathnameOfUrl, type PublicPathname, type PublicStoreHost } from "@/lib/storage/pathname";
import type { OutreachDraft, PhotoSrc, PostItem, PostStore, PostVersions } from "./outreach-types";

// A post's photos as files (issue #291). The Edit post panel uploads a photo
// the moment it is picked, through the outreach editor, so only once the
// site-content gate has admitted the viewer. On the database side the file
// goes to the public Blob store under `post-photos/`; on previews it is kept
// nowhere. A stored file is deleted once no version of any post uses it, and
// only a file in this deployment's own public store is ever accepted or deleted.

/** Whether `value` has the shape of a photo's src. Whose file it is, a save checks with `checkPhotoSources`. */
export function isPhotoSrc(value: unknown): value is PhotoSrc {
  return typeof value === "string" && /^(\/outreach\/|https:\/\/|data:image\/)\S+$/.test(value);
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
  if (upload.bytes.byteLength > PHOTO_MAX_BYTES) return refused("The photo must be at most 4 MB.");
  const type = photoTypeOf(upload.bytes);
  if (type === null) return refused("The photo must be a JPEG, PNG or WebP file.");
  return written({ bytes: upload.bytes, contentType: type, extension: EXTENSION[type] });
}

/** Where uploaded photo files go: the public Blob store, or nowhere on a preview. */
export interface PhotoFiles {
  /** Stores the file and answers its `src`. */
  put(photo: CheckedPhoto): Promise<PhotoSrc>;
  /** Whether `src` names a file this side stored, so a save may carry it. */
  owns(src: string): src is PhotoSrc;
  /** Deletes the files of these photos that this side stored; any other src is left alone. A file already gone is not an error. */
  drop(srcs: readonly PhotoSrc[]): Promise<void>;
}

/** The folder uploaded post photos live in, in the public store (`publicPathname("post-photo", ...)`). */
const POST_PHOTO_FOLDER = "post-photos/";

/**
 * The pathname of an uploaded post photo in this deployment's public store,
 * whose files `host` serves; null for anything else: a photo of the site
 * (`/outreach/...`), a preview's data URL, a file of another kind, or a file
 * on any other host, another Blob store included. Only this answers which
 * URLs a save may carry and which files may be deleted.
 */
export function storedPhotoPathname(src: string, host: PublicStoreHost): PublicPathname | null {
  const pathname = publicPathnameOfUrl(src, host);
  return pathname !== null && pathname.startsWith(POST_PHOTO_FOLDER) ? pathname : null;
}

/** The writes a public store takes: a new file at a pathname, and a delete. */
export interface PublicFileWrites {
  upload(pathname: PublicPathname, bytes: Uint8Array, contentType: string): Promise<{ url: string }>;
  remove(pathname: PublicPathname): Promise<void>;
}

/**
 * Post photos kept in the public store whose files `host` serves; `host` is
 * null while no store is configured, and then no URL is this side's. Each
 * upload gets a new name from `newName`, so nothing is overwritten.
 */
export function publicStorePhotoFiles(host: PublicStoreHost | null, writes: PublicFileWrites, newName: () => string): PhotoFiles {
  const pathnameOf = (src: string) => (host === null ? null : storedPhotoPathname(src, host));
  return {
    async put(photo) {
      const { url } = await writes.upload(publicPathname("post-photo", `${newName()}.${photo.extension}`), photo.bytes, photo.contentType);
      if (pathnameOf(url) === null) throw new Error(`The public store answered a URL off its own host: ${url}`);
      return url as `https://${string}`;
    },
    owns: (src): src is `https://${string}` => pathnameOf(src) !== null,
    async drop(srcs) {
      // A file left behind costs storage only; the write already landed.
      const pathnames = srcs.flatMap((src) => pathnameOf(src) ?? []);
      await Promise.all(pathnames.map((p) => writes.remove(p).catch(() => undefined)));
    },
  };
}

/**
 * The post store, freeing the files a write leaves unshown: after an update
 * or a delete lands, each photo the post had before goes to `files.drop` when
 * no version of any post shows it any more (`photosNoLongerShown`).
 */
export function freeingPhotoFiles(store: PostStore, files: Pick<PhotoFiles, "drop">): PostStore {
  async function thenFree<R>(id: number, write: () => Promise<WriteResult<R>>): Promise<WriteResult<R>> {
    const before = (await store.list()).find((item) => item.id === id) ?? null;
    const result = await write();
    if (result.ok) await files.drop(photosNoLongerShown(photosOf(before?.version ?? null), await store.list()));
    return result;
  }
  return {
    ...store,
    update: (id, version) => thenFree(id, () => store.update(id, version)),
    remove: (id) => thenFree(id, () => store.remove(id)),
  };
}

/** Every photo any version of these posts shows. */
function photosShown(posts: readonly PostItem[]): Set<string> {
  return new Set(posts.flatMap((item) => versionRows(item.version).flatMap((row) => row.content.photos.map((p) => p.src))));
}

/**
 * Of `candidates`, the photos no version of any post in `posts` shows, so
 * their files may go. `posts` is every post as stored after the write: a file
 * two posts share stays while either one shows it. Save, Delete and Remove
 * photo all free files through this one check.
 */
export function photosNoLongerShown(candidates: Iterable<PhotoSrc>, posts: readonly PostItem[]): PhotoSrc[] {
  const shown = photosShown(posts);
  return [...new Set(candidates)].filter((src) => !shown.has(src));
}

/** Every photo a post's versions show: the files a write to that post may free. */
export function photosOf(version: PostVersions | null): PhotoSrc[] {
  return version === null ? [] : versionRows(version).flatMap((row) => row.content.photos.map((p) => p.src));
}

/**
 * The post or draft, or why not: each photo is one the version the panel
 * opened on had (none for a new post), or a file this side stored. A save
 * cannot point a post at a file somewhere else.
 */
export function checkPhotoSources<P extends OutreachDraft>(post: P, had: OutreachDraft | null, files: Pick<PhotoFiles, "owns">): WriteResult<P> {
  const known = new Set((had?.photos ?? []).map((p) => p.src));
  const stray = post.photos.find((p) => !known.has(p.src) && !files.owns(p.src));
  return stray === undefined ? written(post) : refused("A photo was not uploaded. Add it again.");
}
