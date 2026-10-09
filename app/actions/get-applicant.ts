import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { applications, users } from "@/db/schema";
import { formDefaults, type FormDefaults } from "@/lib/apply/application-form";

/** The signed-in applicant as the position page and the submit read them. */
export type Applicant = {
  id: string;
  /** From the Google account; the form shows it locked. */
  email: string;
  /** What the form starts with: the profile the last application saved, or the account's name. */
  defaults: FormDefaults;
};

/** The applicant behind a session's user id, or null when no user row exists for it. */
export async function getApplicant(userId: string): Promise<Applicant | null> {
  const [row] = await getDb()
    .select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      politoId: users.politoId,
      phone: users.phone,
      dateOfBirth: users.dateOfBirth,
      levelOfStudy: users.levelOfStudy,
      program: users.program,
      gender: users.gender,
      origin: users.origin,
      referralSource: users.referralSource,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (row === undefined) return null;
  return {
    id: userId,
    email: row.email,
    defaults: formDefaults({
      firstName: row.firstName,
      lastName: row.lastName,
      politoId: row.politoId,
      phone: row.phone,
      dateOfBirth: row.dateOfBirth,
      studyProgramme: row.levelOfStudy,
      degreeProgramme: row.program,
      gender: row.gender,
      origin: row.origin,
      referral: row.referralSource,
    }),
  };
}

/** Whether the user already applied for the position. */
export async function hasApplied(userId: string, positionId: number): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: applications.id })
    .from(applications)
    .where(and(eq(applications.userId, userId), eq(applications.applyPositionId, positionId)))
    .limit(1);
  return row !== undefined;
}
