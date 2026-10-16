import { versionRows, type Versioned } from "@/lib/content/versioned";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { parsePublicPathname, type PublicPathname } from "@/lib/storage/pathname";
import type { OutreachPost, PhotoSrc } from "./outreach-types";

// A post's photos as files (issue #291). The Edit post panel uploads a photo
// the moment it is picked, through the outreach editor, so only once the
// site-content gate has admitted the viewer. On the database side the file
// goes to the public Blob store under `post-photos/`; on previews it is kept
// nowhere. A stored file is deleted once no version of its post uses it.

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
  /** Deletes stored files. A file already gone is not an error. */
  drop(srcs: readonly PhotoSrc[]): Promise<void>;
}

/** The folder uploaded post photos live in, in the public store (`publicPathname("post-photo", ...)`). */
const POST_PHOTO_FOLDER = "post-photos/";

/**
 * The public-store pathname of an uploaded post photo's URL; null for
 * anything else: a photo of the site (`/outreach/...`), a preview's data URL,
 * or a file of another kind in the same store.
 */
export function storedPhotoPathname(src: string): PublicPathname | null {
  if (!src.startsWith("https://")) return null;
  try {
    const url = new URL(src);
    if (!url.hostname.endsWith(".public.blob.vercel-storage.com") || url.search !== "" || url.hash !== "") return null;
    const pathname = parsePublicPathname(url.pathname.slice(1));
    return pathname !== null && pathname.startsWith(POST_PHOTO_FOLDER) ? pathname : null;
  } catch {
    return null;
  }
}

function photosOf(version: Versioned<OutreachPost> | null): Set<string> {
  return new Set(version === null ? [] : versionRows(version).flatMap((row) => row.content.photos.map((p) => p.src)));
}

/**
 * The stored photo files `before` used that `after` no longer does: a photo
 * removed or replaced, once neither the published post nor its draft shows it.
 * A photo of the site is no stored file and is never deleted.
 */
export function unusedPhotoFiles(before: Versioned<OutreachPost> | null, after: Versioned<OutreachPost> | null): PublicPathname[] {
  const kept = photosOf(after);
  return [...photosOf(before)].flatMap((src) => {
    if (kept.has(src)) return [];
    const pathname = storedPhotoPathname(src);
    return pathname === null ? [] : [pathname];
  });
}

/**
 * The post, or why not: each photo is one the version the panel opened on
 * had, or a file this side stored. A save cannot point a post at a file
 * somewhere else.
 */
export function checkPhotoSources(post: OutreachPost, had: OutreachPost, files: Pick<PhotoFiles, "owns">): WriteResult<OutreachPost> {
  const known = new Set(had.photos.map((p) => p.src));
  const stray = post.photos.find((p) => !known.has(p.src) && !files.owns(p.src));
  return stray === undefined ? written(post) : refused("A photo was not uploaded. Add it again.");
}
