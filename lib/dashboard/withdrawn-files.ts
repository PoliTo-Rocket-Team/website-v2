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
   * null for one that is not. An applicant's later applications link the
   * files they already stored (issue #826), so a row is often shared.
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
  /**
   * Deletes one `application_files` row unless an application withdrawn after
   * `cutoff`, or not withdrawn, links it. The check and the delete are one
   * atomic step: a submission that links the row while it runs either lands
   * first, and the row is `"held"`, or fails on the missing row. The foreign
   * keys clear the due applications' file ids.
   */
  deleteUnheldFileRow(fileId: number, cutoff: Date): Promise<"deleted" | "held">;
}

export type WithdrawnFilesRun = {
  /** File ids whose row is gone, with their stored object when they had one. */
  readonly deleted: readonly number[];
  /**
   * File ids the run could not finish. Most keep their row for the next run;
   * one whose row went but whose stored object could not be deleted is also
   * in `deleted`, and its object stays in the store with no row.
   */
  readonly failed: readonly number[];
};

/**
 * Deletes the files of every application due at `now`. For each file the row
 * goes first, through the store's atomic check that no application still
 * needs it, and the stored object second. A file an application linked after
 * its holders were read keeps both (issue #826). An object goes only once no
 * row can point at it, so no saved application ever links a file whose object
 * is gone.
 */
export async function deleteWithdrawnFiles(now: Date, store: WithdrawnFilesStore): Promise<WithdrawnFilesRun> {
  const deleted: number[] = [];
  const failed: number[] = [];
  const cutoff = withdrawnFilesCutoff(now);
  const applications = await store.withdrawnApplications(cutoff);
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
        if ((await store.deleteUnheldFileRow(deletion.fileId, cutoff)) === "held") continue;
      } catch (error) {
        console.error(`Deleting file ${deletion.fileId} of withdrawn application ${application.id} failed; the next run retries it.`, error);
        failed.push(deletion.fileId);
        continue;
      }
      deleted.push(deletion.fileId);
      if (deletion.kind === "row-only") continue;
      try {
        await store.deleteStoredFile(deletion.pathname);
      } catch (error) {
        console.error(`The stored object of file ${deletion.fileId} could not be deleted; its row is gone, so the object stays.`, error);
        failed.push(deletion.fileId);
      }
    }
  }
  return { deleted, failed };
}
