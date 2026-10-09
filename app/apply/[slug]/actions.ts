"use server";

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getApplicant, hasApplied } from "@/app/actions/get-applicant";
import { getPositionWithRecruitment } from "@/app/actions/get-apply-positions";
import { applicationFiles, applications, users } from "@/db/schema";
import { submitApplication, type NewApplication, type SubmitResult } from "@/lib/apply/submit";
import { getCurrentUserId } from "@/lib/current-user";
import { runAuditBatch } from "@/lib/db-audit";
import { deletePrivateFile, uploadPrivateFile } from "@/lib/storage/private-store";

/** Sends an application for one position. Every rule is checked here, on the server (lib/apply/submit.ts). */
export async function sendApplication(positionId: number, form: FormData): Promise<SubmitResult> {
  return submitApplication(positionId, form, {
    applicant: async () => {
      const userId = await getCurrentUserId();
      return userId === null ? null : getApplicant(userId);
    },
    position: async (id) => {
      const read = await getPositionWithRecruitment(id);
      if (read.status !== "found") return null;
      const { position, recruitment } = read;
      return {
        position: {
          id: position.id,
          status: position.status,
          is_deleted: position.is_deleted,
          customQuestions: position.custom_questions ?? [],
          requiresMotivationLetter: position.requires_motivation_letter,
        },
        recruitment,
      };
    },
    hasApplied,
    putPdf: (key, bytes) => uploadPrivateFile(key, bytes, "application/pdf"),
    deletePdf: deletePrivateFile,
    save: saveApplication,
    newFileName: randomUUID,
  });
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
