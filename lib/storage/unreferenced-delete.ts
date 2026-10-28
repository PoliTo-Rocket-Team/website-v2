import "server-only";

import { getDb } from "@/db/client";
import { deletePublicFile } from "@/lib/storage/public-store";
import { deleteBestEffort, type DeleteArea } from "./best-effort-delete";
import type { PublicPathname } from "./pathname";
import { referencedPublicFiles, unreferenced, type ReferencedFiles } from "./public-references";

// Every delete of a public-store file goes through here (issue #831): a
// file is deleted only when no row names it (./public-references.ts). The
// write that dropped the reference has already landed, so a failed delete is
// logged and never thrown (./best-effort-delete.ts).

/**
 * Deletes each of `pathnames` that `referenced` does not name: the answer of
 * `referencedPublicFiles`, read in the batch that changed the reference, after
 * the change.
 */
export async function deleteUnreferencedAfter(
  area: DeleteArea,
  pathnames: readonly PublicPathname[],
  referenced: ReferencedFiles,
): Promise<void> {
  const free = unreferenced(pathnames, referenced);
  await Promise.all(free.map((pathname) => deleteBestEffort({ store: "public", area, pathname, remove: deletePublicFile })));
}

/** Deletes each of `pathnames` that no row names now, read right before the delete. */
export async function deleteIfUnreferenced(area: DeleteArea, pathnames: readonly PublicPathname[]): Promise<void> {
  if (pathnames.length === 0) return;
  await deleteUnreferencedAfter(area, pathnames, await referencedPublicFiles(getDb(), pathnames));
}
