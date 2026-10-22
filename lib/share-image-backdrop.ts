import { PHOTO_MAX_BYTES } from "@/lib/outreach-photos";
import { STREAK_TEXTURE, type Backdrop, type RepoFile } from "@/lib/share-image";

// How a post's share image turns its backdrop into a picture (issue #469).
// A file of the site is read from disk. A photo in this deployment's own
// public Blob store is fetched from its URL, within STORED_PHOTO_TIMEOUT_MS;
// when that fetch fails, is not a 200, runs out of time, is too large, or
// its bytes do not decode, the image lies on the streak texture instead, so
// the route still answers with an image. This is the only network request in
// the share-image code. The disk, the network and the decoder are passed in,
// so a test can stub them.

/** How long a post's share image waits for its stored photo before it lies on the streak texture. */
export const STORED_PHOTO_TIMEOUT_MS = 4000;

/** The request the image makes for a stored photo: the global `fetch`, or a test's stub. */
export type PhotoFetch = (url: string, init: { readonly signal: AbortSignal }) => Promise<Response>;

/**
 * The bytes at `url`, or null when the request fails, answers anything but
 * 200, takes longer than `timeoutMs`, or is larger than the largest photo the
 * dashboard uploads (PHOTO_MAX_BYTES).
 */
export async function storedPhotoBytes(url: string, fetchPhoto: PhotoFetch, timeoutMs = STORED_PHOTO_TIMEOUT_MS): Promise<Uint8Array | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    return await Promise.race([read(url, fetchPhoto, controller.signal), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

async function read(url: string, fetchPhoto: PhotoFetch, signal: AbortSignal): Promise<Uint8Array | null> {
  try {
    const response = await fetchPhoto(url, { signal });
    if (response.status !== 200) return null;
    if (Number(response.headers.get("content-length")) > PHOTO_MAX_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > PHOTO_MAX_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

/** What the image draws behind a post's words: a picture (a data URL), shaded as a photo or as a texture. */
export type DrawnBackdrop = { readonly shade: "photo" | "texture"; readonly src: string };

/** What drawing a backdrop reads with: a repo file off disk, the network for a stored photo, and the decoder that sizes bytes into a data URL. */
export interface BackdropReads {
  readonly file: (file: RepoFile) => Promise<Uint8Array>;
  readonly fetch: PhotoFetch;
  readonly picture: (bytes: Uint8Array) => Promise<string>;
}

/** The picture behind a post's words: its stored photo when it loads and decodes, else the streak texture. */
export async function drawnBackdrop(backdrop: Backdrop, reads: BackdropReads, timeoutMs = STORED_PHOTO_TIMEOUT_MS): Promise<DrawnBackdrop> {
  if (backdrop.kind !== "stored-photo") return { shade: backdrop.kind, src: await reads.picture(await reads.file(backdrop.file)) };
  const bytes = await storedPhotoBytes(backdrop.url, reads.fetch, timeoutMs);
  const src = bytes === null ? null : await reads.picture(bytes).catch(() => null);
  return src === null ? drawnBackdrop({ kind: "texture", file: STREAK_TEXTURE }, reads) : { shade: "photo", src };
}
