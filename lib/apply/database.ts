import "server-only";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getApplicant, hasApplied } from "@/app/actions/get-applicant";
import { getPositionWithRecruitment, getPublicPositions } from "@/app/actions/get-apply-positions";
import { applicationFiles, applications, users } from "@/db/schema";
import { getCurrentUserId } from "@/lib/current-user";
import { runAuditBatch } from "@/lib/db-audit";
import { deletePrivateFile, uploadPrivateFile } from "@/lib/storage/private-store";
import type { ApplyData } from "./data";
import type { NewApplication } from "./submit";

// The database side of the apply data interface (./data.ts): the reads and
// the write the apply pages and their submit always made, unchanged. With no
// database configured, /apply lists no positions and no position is found.

export const databaseApplyData: ApplyData = {
  publicPositions: async () => {
    const read = await getPublicPositions();
    return read.status === "available" ? read.positions : [];
  },
  position: async (id) => {
    const read = await getPositionWithRecruitment(id);
    return read.status === "found" ? { position: read.position, recruitment: read.recruitment } : null;
  },
  applicant: async () => {
    const userId = await getCurrentUserId();
    return userId === null ? null : getApplicant(userId);
  },
  hasApplied,
  store: {
    putPdf: (key, bytes) => uploadPrivateFile(key, bytes, "application/pdf"),
    deletePdf: deletePrivateFile,
    save: saveApplication,
    newFileName: randomUUID,
  },
};

/** Postgres' unique_violation. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

/**
 * The profile update, the file rows and the application in one batch, which
 * the neon-http driver runs as one transaction: all of it lands or none of it
 * does. The application finds its file rows by their unique pathnames, since a
 * batch cannot pass one insert's ids to the next.
 */
async function saveApplication(application: NewApplication): Promise<"saved" | "already-applied"> {
  const { userId, positionId, profile, answers, cv, motivationLetter } = application;
  const files = motivationLetter ? [cv, motivationLetter] : [cv];
  const fileIdOf = (key: string) =>
    sql`(select ${applicationFiles.id} from ${applicationFiles} where ${applicationFiles.pathname} = ${key})`;
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
      db.insert(applicationFiles).values(
        files.map((f) => ({
          pathname: f.key,
          originalFilename: f.filename,
          mimeType: "application/pdf",
          fileSize: f.size,
          fileHash: f.hash,
          userId,
        })),
      ),
      db.insert(applications).values({
        applyPositionId: positionId,
        userId,
        cvFileId: fileIdOf(cv.key),
        cvName: cv.filename,
        coverLetterFileId: motivationLetter ? fileIdOf(motivationLetter.key) : null,
        mlName: motivationLetter?.filename ?? null,
        customAnswers,
      }),
    ]);
    return "saved";
  } catch (error) {
    if (isUniqueViolation(error)) return "already-applied";
    throw error;
  }
}
