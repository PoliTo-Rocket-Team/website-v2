import "server-only";

import { and, eq, gt, inArray, isNotNull, isNull, lte, ne, notExists, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { applicationFiles, applications } from "@/db/schema";
import { deletePrivateFile } from "@/lib/storage/private-store";
import { heldFileIds, type CleanupApplication, type HeldFile, type WithdrawnFilesStore } from "./withdrawn-files";

// The database and file-store side of ./withdrawn-files.ts. The daily cron
// route runs it with no one signed in, so the audit trigger logs its deletes
// with no `changed_by`.

async function withdrawnApplications(cutoff: Date): Promise<CleanupApplication[]> {
  const rows = await getDb()
    .select({
      id: applications.id,
      withdrawnAt: applications.withdrawnAt,
      cvFileId: applications.cvFileId,
      coverLetterFileId: applications.coverLetterFileId,
    })
    .from(applications)
    .where(
      and(
        isNotNull(applications.withdrawnAt),
        lte(applications.withdrawnAt, cutoff.toISOString()),
        or(isNotNull(applications.cvFileId), isNotNull(applications.coverLetterFileId)),
      ),
    );
  return rows.map((row) => ({ ...row, withdrawnAt: row.withdrawnAt === null ? null : new Date(row.withdrawnAt) }));
}

async function heldFiles(application: CleanupApplication): Promise<HeldFile[]> {
  const ids = heldFileIds(application);
  if (ids.length === 0) return [];
  const db = getDb();
  const [files, others] = await Promise.all([
    db
      .select({ id: applicationFiles.id, pathname: applicationFiles.pathname })
      .from(applicationFiles)
      .where(inArray(applicationFiles.id, ids)),
    db
      .select({
        withdrawnAt: applications.withdrawnAt,
        cvFileId: applications.cvFileId,
        coverLetterFileId: applications.coverLetterFileId,
      })
      .from(applications)
      .where(
        and(
          ne(applications.id, application.id),
          or(inArray(applications.cvFileId, ids), inArray(applications.coverLetterFileId, ids)),
        ),
      ),
  ]);
  return files.map((file) => ({
    ...file,
    otherHolders: others
      .filter((other) => other.cvFileId === file.id || other.coverLetterFileId === file.id)
      .map((other) => (other.withdrawnAt === null ? null : new Date(other.withdrawnAt))),
  }));
}

/**
 * One batch, which the neon-http driver runs as one read-committed
 * transaction. The first statement locks the row; a submission's insert that
 * links it takes a key-share lock on it, so the lock waits for a submission
 * in flight to land, and one that starts later waits for this batch and then
 * fails on the missing row. The delete then reads the holders with a fresh
 * snapshot, after the lock, so it sees every link that landed.
 */
async function deleteUnheldFileRow(fileId: number, cutoff: Date): Promise<"deleted" | "held"> {
  const db = getDb();
  const stillNeeded = db
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(
        or(eq(applications.cvFileId, fileId), eq(applications.coverLetterFileId, fileId)),
        or(isNull(applications.withdrawnAt), gt(applications.withdrawnAt, cutoff.toISOString())),
      ),
    );
  const [, gone] = await db.batch([
    db.select({ id: applicationFiles.id }).from(applicationFiles).where(eq(applicationFiles.id, fileId)).for("update"),
    db
      .delete(applicationFiles)
      .where(and(eq(applicationFiles.id, fileId), notExists(stillNeeded)))
      .returning({ id: applicationFiles.id }),
  ]);
  return gone.length === 0 ? "held" : "deleted";
}

export const databaseWithdrawnFilesStore: WithdrawnFilesStore = {
  withdrawnApplications,
  heldFiles,
  deleteStoredFile: deletePrivateFile,
  deleteUnheldFileRow,
};
