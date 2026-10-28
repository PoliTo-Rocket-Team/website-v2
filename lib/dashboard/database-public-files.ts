import "server-only";

import { getDb } from "@/db/client";
import type { TeamPageFileWrites } from "@/lib/about/team-page-photos";
import { referencedPublicFiles, unreferenced } from "@/lib/storage/public-references";
import { copyPublicFile, deletePublicFile, publicFileStored, uploadPublicFile } from "@/lib/storage/public-store";

// This deployment's public Blob store as the content editors' photos use it
// (Outreach, projects and the Team page): the store's own calls, and the read
// of which files a row still names (lib/storage/public-references.ts), so an
// editor deletes a file only when no row names it (issue #831).

export const databasePublicFiles: TeamPageFileWrites = {
  upload: uploadPublicFile,
  remove: deletePublicFile,
  copy: copyPublicFile,
  stored: publicFileStored,
  unreferenced: async (pathnames) => unreferenced(pathnames, await referencedPublicFiles(getDb(), pathnames)),
};
