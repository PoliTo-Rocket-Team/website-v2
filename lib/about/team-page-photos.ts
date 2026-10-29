import { dropUnreferenced, goneFiles, type CheckedPhoto, type PublicFiles, type PublicFileWrites } from "@/lib/outreach-photos";
import { publicFolderOf, publicPathname, publicPathnameOfUrl, type PublicPathname, type PublicStoreHost } from "@/lib/storage/pathname";
import type { OwnsUpload } from "./team-layer";
import type { TeamPagePhotos } from "./team-page-editor";
import type { PersonPhoto } from "./types";

// The Team page editor's uploaded photos (issue #323) in a public Blob store,
// under `photos/` beside the member and alumni photos, each under a new name
// that starts `team-page-`. The URL the store answers is what the layer or
// the advisor row keeps, so it must be on the store's own host. A photo the
// editor picks from another row's file, a member's own picture say, is
// copied under such a name when a save keeps it (Owner decision, issue
// #831), so no two rows share one file and replacing that picture never
// takes the Team page's photo with it. Only a file this editor stored is
// ever deleted, and only once no row names it (`unreferenced`).

const NAME_START = "team-page-";

/** The pathname of a photo the Team page editor uploaded to the store `host` serves; null for any other photo. */
export function teamPagePhotoPathname(src: string, host: PublicStoreHost): PublicPathname | null {
  const pathname = publicPathnameOfUrl(src, host);
  return pathname !== null && pathname.startsWith(publicFolderOf("photo") + NAME_START) ? pathname : null;
}

/** Which URLs are Team page uploads in the store `host` serves; none while no store is configured (`host` null). */
export function ownsTeamPageUpload(host: PublicStoreHost | null): OwnsUpload {
  return (src) => host !== null && teamPagePhotoPathname(src, host) !== null;
}

/** What the Team page's photos need of a public store: a panel's, and a copy of a stored file. */
export interface TeamPageFileWrites extends PublicFiles {
  /** A copy of a stored file under a new pathname; null when the file to copy is gone. */
  copy(from: PublicPathname, to: PublicPathname): Promise<{ url: string } | null>;
}

/** The extension a stored pathname ends in, kept on its copy; none when it has no plain one. */
function extensionOf(pathname: string): string {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(pathname);
  return match === null ? "" : `.${match[1].toLowerCase()}`;
}

/** The URL the store `host` serves `pathname` at, checked: a URL off that host or pathname is an error. */
function checkedUrl(url: string, pathname: PublicPathname, host: PublicStoreHost | null): `https://${string}` {
  if (host === null || teamPagePhotoPathname(url, host) !== pathname) throw new Error(`The public store answered a URL off its own host: ${url}`);
  return url as `https://${string}`;
}

/** Stores a photo under a new Team page name in the store `host` serves, and answers its URL: what `put` does, for the import too. */
export async function putTeamPagePhoto(host: PublicStoreHost | null, writes: Pick<PublicFileWrites, "upload">, newName: () => string, photo: CheckedPhoto) {
  const pathname = publicPathname("photo", `${NAME_START}${newName()}.${photo.extension}`);
  return checkedUrl((await writes.upload(pathname, photo.bytes, photo.contentType)).url, pathname, host);
}

/**
 * Team page photos in the public store whose files `host` serves; `host` is
 * null while no store is configured, and then no photo is this side's.
 */
export function publicStoreTeamPagePhotos(host: PublicStoreHost | null, writes: TeamPageFileWrites, newName: () => string): TeamPagePhotos {
  const pathnameOf = (src: string) => (host === null ? null : teamPagePhotoPathname(src, host));
  return {
    put: (photo) => putTeamPagePhoto(host, writes, newName, photo),
    owns: ownsTeamPageUpload(host),
    async adopt(photo: PersonPhoto) {
      const source = host === null || pathnameOf(photo) !== null ? null : publicPathnameOfUrl(photo, host);
      if (source === null || !source.startsWith(publicFolderOf("photo"))) return photo;
      const copy = publicPathname("photo", `${NAME_START}${newName()}${extensionOf(source)}`);
      const copied = await writes.copy(source, copy);
      return copied === null ? null : checkedUrl(copied.url, copy, host);
    },
    drop: (photos) => dropUnreferenced("team-photo", photos.flatMap((src) => pathnameOf(src) ?? []), writes),
    gone: (photos) => goneFiles(photos, pathnameOf, writes),
  };
}
