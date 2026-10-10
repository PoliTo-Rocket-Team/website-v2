// A withdrawn application's files are deleted 30 days after the withdraw
// (issue #178; the rule is in docs/dashboard-rules.md, section 2, and ADR
// 0011, rule 8). The application row stays as it is: its status, its dates and
// the file names the applicant gave. Rules and the run only: the database and
// file-store side is ./database-withdrawn-files.ts, and the daily cron route
// runs it.

import { parsePrivatePathname, type PrivatePathname } from "@/lib/storage/pathname";

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a withdrawn application keeps its files. */
export const WITHDRAWN_FILES_KEPT_DAYS = 30;

/** One application, as far as the cleanup reads it. */
export type CleanupApplication = {
  readonly id: number;
  /** When the applicant withdrew it; null while it is not withdrawn. */
  readonly withdrawnAt: Date | null;
  readonly cvFileId: number | null;
  readonly coverLetterFileId: number | null;
};

/** The latest withdrawal time an application may have and still lose its files at `now`: 30 days before. */
export function withdrawnFilesCutoff(now: Date): Date {
  return new Date(now.getTime() - WITHDRAWN_FILES_KEPT_DAYS * DAY_MS);
}

/** The file ids the application still points at. */
export function heldFileIds(application: CleanupApplication): number[] {
  return [application.cvFileId, application.coverLetterFileId].filter((id) => id !== null);
}

function withdrawnBy(withdrawnAt: Date | null, now: Date): boolean {
  return withdrawnAt !== null && withdrawnAt.getTime() <= withdrawnFilesCutoff(now).getTime();
}

/** Withdrawn 30 or more days before `now`, and still holding a CV or a letter. */
export function dueForFileDeletion(application: CleanupApplication, now: Date): boolean {
  return withdrawnBy(application.withdrawnAt, now) && heldFileIds(application).length > 0;
}

/** One `application_files` row a due application points at. */
export type HeldFile = {
  readonly id: number;
  /** The pathname as stored; it may be one from before the private store. */
  readonly pathname: string;
  /**
   * When each other application that points at this same row was withdrawn,
   * null for one that is not. Each application uploads its own files, so this
   * is empty unless older data shares a row.
   */
  readonly otherHolders: readonly (Date | null)[];
};

/** What happens to one held file. */
export type FileDeletion =
  /** The stored object goes first, then the row. */
  | { readonly kind: "store-and-row"; readonly fileId: number; readonly pathname: PrivatePathname }
  /** The pathname is outside the private store's folders, so it names no file of ours: only the row goes. */
  | { readonly kind: "row-only"; readonly fileId: number }
  /** Another application that is not due still points at the row, so nothing goes. */
  | { readonly kind: "keep"; readonly fileId: number };

export function fileDeletion(file: HeldFile, now: Date): FileDeletion {
  if (!file.otherHolders.every((withdrawnAt) => withdrawnBy(withdrawnAt, now))) return { kind: "keep", fileId: file.id };
  const pathname = parsePrivatePathname(file.pathname);
  return pathname === null
    ? { kind: "row-only", fileId: file.id }
    : { kind: "store-and-row", fileId: file.id, pathname };
}

/** What the cleanup needs from the database and the private file store. */
export interface WithdrawnFilesStore {
  /** Applications withdrawn at or before `cutoff` that still point at a file. */
  withdrawnApplications(cutoff: Date): Promise<readonly CleanupApplication[]>;
  /** The `application_files` rows the application points at. */
  heldFiles(application: CleanupApplication): Promise<readonly HeldFile[]>;
  /** Deletes one object from the private store; deleting one already gone is not an error. */
  deleteStoredFile(pathname: PrivatePathname): Promise<void>;
  /** Deletes one `application_files` row; the foreign keys clear the application's file id. */
  deleteFileRow(fileId: number): Promise<void>;
}

export type WithdrawnFilesRun = {
  /** File ids whose row is gone, with their stored object when they had one. */
  readonly deleted: readonly number[];
  /** File ids left for the next run: their row stays, because a delete failed. */
  readonly failed: readonly number[];
};

/**
 * Deletes the files of every application due at `now`. For each file the
 * stored object goes first and the row second: when the object cannot be
 * deleted the row stays, so the next run finds the file again and no object is
 * left with no row pointing at it.
 */
export async function deleteWithdrawnFiles(now: Date, store: WithdrawnFilesStore): Promise<WithdrawnFilesRun> {
  const deleted: number[] = [];
  const failed: number[] = [];
  const applications = await store.withdrawnApplications(withdrawnFilesCutoff(now));
  for (const application of applications) {
    if (!dueForFileDeletion(application, now)) continue;
    let files: readonly HeldFile[];
    try {
      files = await store.heldFiles(application);
    } catch (error) {
      console.error(`Reading the files of withdrawn application ${application.id} failed; the next run retries it.`, error);
      failed.push(...heldFileIds(application));
      continue;
    }
    for (const file of files) {
      const deletion = fileDeletion(file, now);
      if (deletion.kind === "keep") continue;
      try {
        if (deletion.kind === "store-and-row") await store.deleteStoredFile(deletion.pathname);
        await store.deleteFileRow(deletion.fileId);
        deleted.push(deletion.fileId);
      } catch (error) {
        console.error(`Deleting file ${deletion.fileId} of withdrawn application ${application.id} failed; the next run retries it.`, error);
        failed.push(deletion.fileId);
      }
    }
  }
  return { deleted, failed };
}
