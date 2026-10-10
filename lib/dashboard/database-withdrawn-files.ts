import "server-only";

import { and, eq, inArray, isNotNull, lte, ne, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { applicationFiles, applications } from "@/db/schema";
import { runAuditQuery } from "@/lib/db-audit";
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

async function deleteFileRow(fileId: number): Promise<void> {
  await runAuditQuery((db) => db.delete(applicationFiles).where(eq(applicationFiles.id, fileId)));
}

export const databaseWithdrawnFilesStore: WithdrawnFilesStore = {
  withdrawnApplications,
  heldFiles,
  deleteStoredFile: deletePrivateFile,
  deleteFileRow,
};
