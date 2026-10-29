import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { getApplicant, hasApplied } from "@/app/actions/get-applicant";
import {
  getPositionWithRecruitment,
  getPublicPositions,
  getShownPositionWithRecruitment,
  type PositionWithRecruitment,
} from "@/app/actions/get-apply-positions";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { applicationFiles, applications, users } from "@/db/schema";
import { cachedPublishedFaqs } from "@/lib/dashboard/database-faqs";
import { getCurrentUserId } from "@/lib/current-user";
import { runAuditBatch } from "@/lib/db-audit";
import { parsePrivatePathname } from "@/lib/storage/pathname";
import { deletePrivateFile, uploadPrivateFile } from "@/lib/storage/private-store";
import type { PreviousFile, PreviousFiles } from "./application-form";
import type { ApplyData } from "./data";
import { faqs as faqRecord } from "./page";
import type { ApplicationPdf, NewApplication, OwnFile } from "./submit";

// The database side of the apply data interface (./data.ts): the reads and
// the write the apply pages and their submit make. With no database
// configured, /apply lists no positions and no position is found.

export const databaseApplyData: ApplyData = {
  publicPositions: async () => {
    const read = await getPublicPositions();
    return read.status === "available" ? read.positions : [];
  },
  // The cached read every question write refreshes; the record where there is
  // no database or no FAQ tables yet.
  faqs: async () => (isDatabaseConfigured() ? ((await cachedPublishedFaqs()) ?? faqRecord) : faqRecord),
  position: async (id) => foundOrNull(await getPositionWithRecruitment(id)),
  shownPosition: async (id) => foundOrNull(await getShownPositionWithRecruitment(id)),
  applicant: async () => {
    const userId = await getCurrentUserId();
    return userId === null ? null : getApplicant(userId);
  },
  hasApplied,
  previousFiles,
  store: {
    ownFile: async (userId, fileId) => firstInStore(await ownFileRows(userId, eq(applicationFiles.id, fileId))),
    ownFileWithContent: async (userId, hash, size) =>
      firstInStore(await ownFileRows(userId, and(eq(applicationFiles.fileHash, hash), eq(applicationFiles.fileSize, size)))),
    putPdf: (key, bytes) => uploadPrivateFile(key, bytes, "application/pdf"),
    deletePdf: deletePrivateFile,
    save: saveApplication,
    newFileName: randomUUID,
  },
};

function foundOrNull(read: PositionWithRecruitment): Awaited<ReturnType<ApplyData["position"]>> {
  return read.status === "found" ? { position: read.position, recruitment: read.recruitment } : null;
}

/** The user's own `application_files` rows that match, newest first. Another user's row never matches. */
function ownFileRows(userId: string, match: SQL | undefined) {
  return getDb()
    .select({ id: applicationFiles.id, filename: applicationFiles.originalFilename, pathname: applicationFiles.pathname })
    .from(applicationFiles)
    .where(and(eq(applicationFiles.userId, userId), match))
    .orderBy(desc(applicationFiles.id));
}

/**
 * The first row whose file is in the private store, as an `OwnFile`. A row
 * from before the store names no file the dashboard can open, so it is never
 * linked again or offered.
 */
function firstInStore(rows: readonly { id: number; filename: string; pathname: string }[]): OwnFile | null {
  const row = rows.find((r) => parsePrivatePathname(r.pathname) !== null);
  return row === undefined ? null : { id: row.id, filename: row.filename };
}

/**
 * The CV and the motivation letter of the user's latest application that
 * sent each (issue #826), whatever its status: the form offers them again.
 * Only the user's own files, and only ones still stored.
 */
async function previousFiles(userId: string): Promise<PreviousFiles> {
  const latest = async (fileColumn: typeof applications.cvFileId | typeof applications.coverLetterFileId): Promise<PreviousFile | null> => {
    const rows = await getDb()
      .select({ id: applicationFiles.id, name: applicationFiles.originalFilename, size: applicationFiles.fileSize, pathname: applicationFiles.pathname })
      .from(applications)
      .innerJoin(applicationFiles, eq(applicationFiles.id, fileColumn))
      .where(and(eq(applications.userId, userId), eq(applicationFiles.userId, userId)))
      .orderBy(desc(applications.appliedAt), desc(applications.id));
    const row = rows.find((r) => parsePrivatePathname(r.pathname) !== null);
    return row === undefined ? null : { id: row.id, name: row.name, size: row.size };
  };
  const [cv, motivationLetter] = await Promise.all([latest(applications.cvFileId), latest(applications.coverLetterFileId)]);
  return { cv, motivationLetter };
}

/** Postgres' unique_violation. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

/**
 * The profile update, the new file rows and the application in one batch,
 * which the neon-http driver runs as one transaction: all of it lands or none
 * of it does. The application finds a new file row by its unique pathname,
 * since a batch cannot pass one insert's ids to the next, and links a kept
 * row by its id (issue #826).
 */
async function saveApplication(application: NewApplication): Promise<"saved" | "already-applied"> {
  const { userId, positionId, profile, answers, cv, motivationLetter } = application;
  const newFiles = [cv, motivationLetter].flatMap((f) => (f?.kind === "new" ? [f.pdf] : []));
  const fileIdOf = (f: ApplicationPdf) =>
    f.kind === "kept"
      ? f.fileId
      : sql`(select ${applicationFiles.id} from ${applicationFiles} where ${applicationFiles.pathname} = ${f.pdf.key})`;
  const nameOf = (f: ApplicationPdf) => (f.kind === "kept" ? f.filename : f.pdf.filename);
  const customAnswers =
    answers.length === 0
      ? sql`'{}'::jsonb[]`
      : sql`array[${sql.join(
          answers.map((a) => sql`${JSON.stringify(a)}::jsonb`),
          sql`, `,
        )}]`;

  try {
    await runAuditBatch((db) => [
      db
        .update(users)
        .set({
          firstName: profile.firstName,
          lastName: profile.lastName,
          politoId: profile.politoId,
          phone: profile.phone,
          dateOfBirth: profile.dateOfBirth,
          levelOfStudy: profile.studyProgramme,
          program: profile.degreeProgramme,
          gender: profile.gender,
          origin: profile.origin,
          referralSource: profile.referral,
          updatedAt: sql`now()`,
        })
        .where(eq(users.id, userId)),
      ...(newFiles.length === 0
        ? []
        : [
            db.insert(applicationFiles).values(
              newFiles.map((f) => ({
                pathname: f.key,
                originalFilename: f.filename,
                mimeType: "application/pdf",
                fileSize: f.size,
                fileHash: f.hash,
                userId,
              })),
            ),
          ]),
      db.insert(applications).values({
        applyPositionId: positionId,
        userId,
        cvFileId: fileIdOf(cv),
        cvName: nameOf(cv),
        coverLetterFileId: motivationLetter ? fileIdOf(motivationLetter) : null,
        mlName: motivationLetter ? nameOf(motivationLetter) : null,
        customAnswers,
        // A new application starts at New in the status list (issue #748).
        statusKey: "new",
      }),
    ]);
    return "saved";
  } catch (error) {
    if (isUniqueViolation(error)) return "already-applied";
    throw error;
  }
}
