import type { PublicFileWrites } from "@/lib/outreach-photos";
import { deleteBestEffort } from "@/lib/storage/best-effort-delete";
import { publicFolderOf, publicPathname, publicPathnameOfUrl, type PublicPathname, type PublicStoreHost } from "@/lib/storage/pathname";
import type { TeamPagePhotos } from "./team-page-editor";

// The Team page editor's uploaded photos (issue #323) in a public Blob store,
// under `photos/` beside the member and alumni photos, each under a new name
// that starts `team-page-`. The URL the store answers is what the layer or
// the advisor row keeps, so it must be on the store's own host. Only a file
// this editor uploaded is ever deleted: a member's own picture, which the
// layer may also show, lives in the same folder under another name.

const NAME_START = "team-page-";

/** The pathname of a photo the Team page editor uploaded to the store `host` serves; null for any other photo. */
export function teamPagePhotoPathname(src: string, host: PublicStoreHost): PublicPathname | null {
  const pathname = publicPathnameOfUrl(src, host);
  return pathname !== null && pathname.startsWith(publicFolderOf("photo") + NAME_START) ? pathname : null;
}

/**
 * Team page photos in the public store whose files `host` serves; `host` is
 * null while no store is configured, and then no photo is this side's.
 */
export function publicStoreTeamPagePhotos(host: PublicStoreHost | null, writes: PublicFileWrites, newName: () => string): TeamPagePhotos {
  const pathnameOf = (src: string) => (host === null ? null : teamPagePhotoPathname(src, host));
  return {
    async put(photo) {
      const pathname = publicPathname("photo", `${NAME_START}${newName()}.${photo.extension}`);
      const { url } = await writes.upload(pathname, photo.bytes, photo.contentType);
      if (pathnameOf(url) !== pathname) throw new Error(`The public store answered a URL off its own host: ${url}`);
      return url as `https://${string}`;
    },
    async drop(photos) {
      const pathnames = photos.flatMap((src) => pathnameOf(src) ?? []);
      await Promise.all(pathnames.map((pathname) => deleteBestEffort({ store: "public", area: "team-photo", pathname, remove: writes.remove })));
    },
  };
}
