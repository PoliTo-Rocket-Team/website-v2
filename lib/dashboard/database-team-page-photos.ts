import "server-only";

import { randomUUID } from "node:crypto";
import type { TeamPagePhotos } from "@/lib/about/team-page-editor";
import { publicStoreTeamPagePhotos } from "@/lib/about/team-page-photos";
import { ownPublicStoreHost } from "@/lib/storage/public-store";
import { databasePublicFiles } from "./database-public-files";

// The Team page editor's uploaded photos (issue #323) in this deployment's
// public Blob store (lib/about/team-page-photos.ts).

export function blobTeamPagePhotos(): TeamPagePhotos {
  return publicStoreTeamPagePhotos(ownPublicStoreHost(), databasePublicFiles, randomUUID);
}
