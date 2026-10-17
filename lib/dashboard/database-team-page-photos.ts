import "server-only";

import { randomUUID } from "node:crypto";
import type { TeamPagePhotos } from "@/lib/about/team-page-editor";
import { publicPathname, publicPathnameOfUrl } from "@/lib/storage/pathname";
import { ownPublicStoreHost, uploadPublicFile } from "@/lib/storage/public-store";

// The Team page editor's uploaded photos (issue #323) in this deployment's
// public Blob store, under `photos/` beside the member and alumni photos, each
// under a new name. The URL the store answers is what the layer or the
// advisor row keeps, so it must be on the store's own host.

export const blobTeamPagePhotos: TeamPagePhotos = {
  async put(photo) {
    const pathname = publicPathname("photo", `team-page-${randomUUID()}.${photo.extension}`);
    const { url } = await uploadPublicFile(pathname, photo.bytes, photo.contentType);
    const host = ownPublicStoreHost();
    if (host === null || publicPathnameOfUrl(url, host) !== pathname) throw new Error(`The public store answered a URL off its own host: ${url}`);
    return url as `https://${string}`;
  },
};
