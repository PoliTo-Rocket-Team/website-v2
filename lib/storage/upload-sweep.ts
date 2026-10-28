import { deleteFailureLine } from "./best-effort-delete";
import { parsePublicPathname, publicFolderOf, type PublicPathname } from "./pathname";

// The daily sweep of content editor uploads no save kept (issue #831). The
// Team page, Outreach and project panels store a photo the moment it is
// picked, and only a save puts it on a row; a panel closed without saving
// leaves its file behind. Once a file is a day old and no row names it
// (./public-references.ts), the sweep deletes it. A save puts an upload on a
// row only while it is under half that day old (`SAVE_KEEPS_MS`), so no save
// under way keeps a file the sweep deletes.

/**
 * Where the editors' uploads live: the Team page's photos, and Outreach's,
 * the projects' and the partners' folders. A partner logo is stored as its
 * save starts, so a save refused after it leaves one behind too.
 */
export const EDITOR_UPLOAD_PREFIXES: readonly string[] = [
  `${publicFolderOf("photo")}team-page-`,
  publicFolderOf("post-photo"),
  publicFolderOf("project-photo"),
  publicFolderOf("project-background"),
  publicFolderOf("logo"),
];

/** How old an upload must be before the sweep may delete it. */
export const UPLOAD_KEPT_MS = 24 * 60 * 60 * 1000;

/**
 * How old an upload may be when a save first puts it on a row: half the
 * sweep's day. The sweep reads which files no row names and then deletes
 * them, so a save landing between the two would keep a deleted file. A save
 * refuses an upload past this age instead, and the half day between the two
 * ages is longer than any save takes.
 */
export const SAVE_KEEPS_MS = UPLOAD_KEPT_MS / 2;

/** Whether a save may still put an upload on a row: the store holds it (`uploadedAt` not null) and it is younger than `SAVE_KEEPS_MS`. */
export function keepableUpload(uploadedAt: Date | null, now: Date): boolean {
  return uploadedAt !== null && now.getTime() - uploadedAt.getTime() < SAVE_KEEPS_MS;
}

/** How many files one read of the rows asks about. */
const BATCH = 200;

/** One stored file as the store lists it. */
export type ListedUpload = { readonly pathname: string; readonly uploadedAt: Date };

/** What the sweep needs: the store's listing and delete, and which files no row names. */
export interface UploadSweepStore {
  list(prefix: string): Promise<readonly ListedUpload[]>;
  unreferenced(pathnames: readonly PublicPathname[]): Promise<readonly PublicPathname[]>;
  remove(pathname: PublicPathname): Promise<void>;
}

export type UploadSweep = { readonly deleted: number; readonly failed: number };

/** The listed files under `prefixes` uploaded at least `UPLOAD_KEPT_MS` before `now`: the ones the sweep asks about. */
export function oldUploads(files: readonly ListedUpload[], now: Date): PublicPathname[] {
  return files.flatMap((file) => {
    const pathname = parsePublicPathname(file.pathname);
    return pathname !== null && now.getTime() - file.uploadedAt.getTime() >= UPLOAD_KEPT_MS ? [pathname] : [];
  });
}

/** Deletes every editor upload a day old or more that no row names. A failed delete is counted and left for the next run. */
export async function sweepUnusedUploads(now: Date, store: UploadSweepStore): Promise<UploadSweep> {
  let deleted = 0;
  let failed = 0;
  for (const prefix of EDITOR_UPLOAD_PREFIXES) {
    const old = oldUploads(await store.list(prefix), now);
    for (let i = 0; i < old.length; i += BATCH) {
      for (const pathname of await store.unreferenced(old.slice(i, i + BATCH))) {
        try {
          await store.remove(pathname);
          deleted++;
        } catch (error) {
          failed++;
          console.error(deleteFailureLine("public", "unused-upload", pathname, error));
        }
      }
    }
  }
  return { deleted, failed };
}
