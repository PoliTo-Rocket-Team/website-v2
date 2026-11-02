import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import sharp from "sharp";
import { checkPhotoUpload, type CheckedPhoto, type PublicFileWrites } from "@/lib/outreach-photos";
import type { PhotoSrc } from "@/lib/outreach-types";
import { publicPathname, publicPathnameOfUrl, publicStoreHost, type PublicStoreHost } from "@/lib/storage/pathname";

// The carousel photos (issue #886). Each is read from the export, shaped as
// the Edit post panel shapes a picked photo before it uploads it
// (components/dashboard/outreach-post-photos.tsx, `shrunkPhoto`): turned
// upright, its longest side at most 2400 px, a JPEG at quality 0.86. It must
// then pass the panel's own upload check (`checkPhotoUpload`), and it is
// stored as the panel stores one: under `post-photos/`, with a new name.

/** The longest side of a stored photo, as the panel's `PHOTO_EDGE`. */
export const PHOTO_EDGE = 2400;
/** The JPEG quality of a stored photo, as the panel's 0.86. */
export const PHOTO_QUALITY = 86;

/** The bytes of one photo of the export, by its path inside it. */
export type PhotoReader = (file: string) => Uint8Array;

/**
 * Reads photos from the export directory, read as data only. A path that
 * leaves the directory, through `..` or a link, is refused, and so is
 * anything but a file.
 */
export function exportPhotos(directory: string): PhotoReader {
  const root = realpathSync(resolve(directory));
  return (file) => {
    const path = join(root, file);
    if (!existsSync(path)) throw new Error(`The export has no file ${file}.`);
    const real = realpathSync(path);
    const inside = relative(root, real);
    if (inside === "" || inside.startsWith(`..${sep}`) || inside === ".." || !statSync(real).isFile()) throw new Error(`${file} is not a file inside the export.`);
    return new Uint8Array(readFileSync(real));
  };
}

/** The photo the panel would store from these bytes, or null when they do not make one. */
export async function shapePhoto(bytes: Uint8Array): Promise<CheckedPhoto | null> {
  try {
    const shaped = await sharp(bytes)
      .rotate()
      .resize({ width: PHOTO_EDGE, height: PHOTO_EDGE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: PHOTO_QUALITY })
      .toBuffer();
    const checked = checkPhotoUpload({ name: "photo.jpg", contentType: "image/jpeg", bytes: new Uint8Array(shaped) });
    return checked.ok ? checked.value : null;
  } catch {
    return null;
  }
}

/** The public store photos go to: the host it serves files from, and its upload. */
export type PhotoStore = { readonly host: PublicStoreHost; readonly writes: Pick<PublicFileWrites, "upload"> };

/** Stores one shaped photo under `post-photos/<newName>.jpg` and answers its URL, which must be the store's own. */
export async function storePhoto(store: PhotoStore, photo: CheckedPhoto, newName: string): Promise<PhotoSrc> {
  const pathname = publicPathname("post-photo", `${newName}.${photo.extension}`);
  const { url } = await store.writes.upload(pathname, photo.bytes, photo.contentType);
  if (publicPathnameOfUrl(url, store.host) !== pathname) throw new Error("The public store answered a URL off its own host or pathname.");
  return url as `https://${string}`;
}

/**
 * The public store a Vercel Blob read-write token opens, as the team data
 * import read one (removed in #847). Its store id is the token's fourth `_`
 * part (`vercel_blob_rw_<storeId>_<secret>`), as the Blob SDK reads it. Each
 * upload passes the token, `access: "public"` and the content type, as
 * `uploadPublicFile` does with the deployment's credential.
 */
export async function blobPhotoStore(token: string): Promise<PhotoStore> {
  const storeId = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token)?.[1];
  if (storeId === undefined) throw new Error("The storage token is not a Vercel Blob read-write token.");
  const { put } = await import("@vercel/blob");
  return {
    host: publicStoreHost(storeId),
    writes: {
      async upload(pathname, bytes, contentType) {
        const { url } = await put(pathname, Buffer.from(bytes), { access: "public", token, contentType });
        return { url };
      },
    },
  };
}
