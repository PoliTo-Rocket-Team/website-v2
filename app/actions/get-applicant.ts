import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { applications, users } from "@/db/schema";
import { formDefaults, type FormDefaults } from "@/lib/apply/application-form";
import { applyFormDefaults, detailsFromColumns } from "@/lib/dashboard/details";

/** The signed-in applicant as the position page and the submit read them. */
export type Applicant = {
  id: string;
  /** From the Google account; the form shows it locked. */
  email: string;
  /**
   * What the form starts with: the person's "Your details" (My account, My
   * profile; issue #169), which the last application also saved, and the
   * form's own answers from that application.
   */
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
      country: users.country,
      linkedin: users.linkedin,
      gender: users.gender,
      origin: users.origin,
      referralSource: users.referralSource,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (row === undefined) return null;
  // Gender, origin and referral are the form's own; formDefaults drops a stored value that is no longer an option.
  const own = formDefaults({
    firstName: null,
    lastName: null,
    politoId: null,
    phone: null,
    dateOfBirth: null,
    studyProgramme: null,
    degreeProgramme: null,
    gender: row.gender,
    origin: row.origin,
    referral: row.referralSource,
  });
  return {
    id: userId,
    email: row.email,
    defaults: applyFormDefaults(detailsFromColumns(row), own),
  };
}

/** Whether the user has a live application for the position; a withdrawn one does not count (issue #169). */
export async function hasApplied(userId: string, positionId: number): Promise<boolean> {
  const [row] = await getDb()
    .select({ id: applications.id })
    .from(applications)
    .where(
      and(eq(applications.userId, userId), eq(applications.applyPositionId, positionId), isNull(applications.withdrawnAt)),
    )
    .limit(1);
  return row !== undefined;
}
