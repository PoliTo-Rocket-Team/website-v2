import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  applicationFiles,
  applications,
  applyPositions,
  betterAuthUsers,
  departments,
  divisions,
  members,
  users,
} from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { parsePrivatePathname, parsePublicPathname, publicPathname } from "@/lib/storage/pathname";
import { deletePrivateFile } from "@/lib/storage/private-store";
import { deletePublicFile, uploadPublicFile } from "@/lib/storage/public-store";
import type { DashboardIdentity } from "./database";
import type { ApplicationStatus } from "./overview";
import {
  canDeleteAccount,
  checkPhoto,
  isOpenApplication,
  normalizeLinkedin,
  type DeleteAccount,
  type MyAccount,
  type MyProfile,
} from "./self";
import { refused, written, type Upload, type WriteResult } from "./write";

// The viewer's own pages read from and written to the database (boards 45
// and 45b, issue #145 with #146 folded in). Writes follow
// .patterns/audited-mutations.md; each one touches only the signed-in
// person's own rows.

const dayMonthYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

async function readProfile(identity: DashboardIdentity): Promise<MyProfile | null> {
  if (identity.kind === "non-member" || identity.memberId === null) return null;
  const [member] = await getDb()
    .select({ prt_email: members.prtEmail })
    .from(members)
    .where(eq(members.memberId, identity.memberId))
    .limit(1);
  const role = identity.role;
  const linkedin = identity.linkedin === null ? null : normalizeLinkedin(identity.linkedin);
  return {
    name: identity.name,
    role: [role?.title ?? "Member", role?.divisionName].filter(Boolean).join(" · "),
    teamEmail: member?.prt_email ?? null,
    linkedin: linkedin === null ? null : linkedin.ok ? linkedin.value : identity.linkedin,
    photoUrl: identity.picture,
    signIn: { provider: "google", email: identity.email },
    // No leave request is stored yet, so a member reads as on the team.
    leave: "on-team",
  };
}

async function saveLinkedin(identity: DashboardIdentity, text: string): Promise<WriteResult<string | null>> {
  if (identity.memberId === null) return refused("This page is for team members.");
  const checked = normalizeLinkedin(text);
  if (!checked.ok) return refused(checked.error);
  const url = checked.value === null ? null : `https://www.${checked.value}`;
  await runAuditQuery((db) => db.update(users).set({ linkedin: url }).where(eq(users.id, identity.userId)));
  return written(checked.value);
}

/** The photo's pathname in the public store, when the stored URL points there. */
function storedPhotoPathname(url: string | null) {
  if (url === null) return null;
  try {
    return parsePublicPathname(new URL(url).pathname.slice(1));
  } catch {
    return null;
  }
}

async function setPhoto(identity: DashboardIdentity, photo: Upload | null): Promise<WriteResult<null>> {
  const memberId = identity.memberId;
  if (memberId === null) return refused("This page is for team members.");
  if (photo !== null) {
    const error = checkPhoto({ type: photo.contentType, size: photo.bytes.byteLength });
    if (error !== null) return refused(error);
  }
  const old = storedPhotoPathname(identity.picture);
  let url: string | null = null;
  if (photo !== null) {
    const ext = photo.contentType === "image/png" ? "png" : "jpg";
    ({ url } = await uploadPublicFile(publicPathname("photo", `${memberId}-${randomUUID()}.${ext}`), photo.bytes, photo.contentType));
  }
  await runAuditQuery((db) => db.update(members).set({ picture: url }).where(eq(members.memberId, memberId)));
  if (old !== null) await deletePublicFile(old).catch(() => undefined);
  return written(null);
}

const statusOf: Readonly<Record<(typeof applications.$inferSelect)["status"], ApplicationStatus>> = {
  received: "received",
  pending: "in-review",
  accepted: "accepted",
  rejected: "declined",
  accepted_by_another_team: "declined",
};

/** The database statuses an applicant can still withdraw from. */
const OPEN_STATUSES = ["received", "pending"] as const;

async function readAccount(identity: DashboardIdentity): Promise<MyAccount | null> {
  if (identity.kind !== "non-member") return null;
  const rows = await getDb()
    .select({
      id: applications.id,
      title: applyPositions.title,
      dept_name: departments.name,
      applied_at: applications.appliedAt,
      status: applications.status,
    })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .leftJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .leftJoin(departments, eq(divisions.deptId, departments.id))
    .where(eq(applications.userId, identity.userId))
    .orderBy(desc(applications.appliedAt));
  return {
    name: identity.name,
    applications: rows.map((r) => ({
      id: r.id,
      title: r.title ?? "Untitled position",
      detail: [r.dept_name, `sent ${dayMonthYear.format(new Date(r.applied_at))}`].filter(Boolean).join(" · "),
      status: statusOf[r.status],
    })),
    signIn: { provider: "google", email: identity.email },
  };
}

async function withdrawApplication(identity: DashboardIdentity, applicationId: number): Promise<WriteResult<null>> {
  if (identity.kind !== "non-member") return refused("This page is for applicants.");
  const account = await readAccount(identity);
  const application = account?.applications.find((a) => a.id === applicationId);
  if (!application) return refused("That application is not yours.");
  if (!isOpenApplication(application.status)) return refused("Only an open application can be withdrawn.");
  await runAuditQuery((db) =>
    db
      .delete(applications)
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.userId, identity.userId),
          inArray(applications.status, [...OPEN_STATUSES]),
        ),
      ),
  );
  return written(null);
}

/**
 * Removes the sign-in: the Better Auth user, and with it their sessions and
 * linked Google account. The `users` row and the applications stay with the
 * team, unless the person ticked the box: then their open applications are
 * withdrawn and every file they uploaded is deleted.
 */
async function deleteAccount(identity: DashboardIdentity, options: DeleteAccount): Promise<WriteResult<null>> {
  if (!canDeleteAccount(identity.memberId === null ? null : "on-team")) {
    return refused("Leave the team first. Once your lead confirms, you can delete your account.");
  }
  if (typeof options.withdrawOpenApplications !== "boolean") return refused("Check the form.");
  const userId = identity.userId;
  const files = options.withdrawOpenApplications
    ? await getDb()
        .select({ id: applicationFiles.id, pathname: applicationFiles.pathname })
        .from(applicationFiles)
        .where(eq(applicationFiles.userId, userId))
    : [];

  await runAuditBatch((db) => [
    db.delete(betterAuthUsers).where(eq(betterAuthUsers.id, userId)),
    ...(options.withdrawOpenApplications
      ? [
          db
            .delete(applications)
            .where(and(eq(applications.userId, userId), inArray(applications.status, [...OPEN_STATUSES]))),
          db.delete(applicationFiles).where(eq(applicationFiles.userId, userId)),
        ]
      : []),
  ]);

  for (const file of files) {
    const pathname = parsePrivatePathname(file.pathname);
    if (pathname !== null) await deletePrivateFile(pathname).catch(() => undefined);
  }
  return written(null);
}

/** The My profile and My account methods of the database side of the data interface. */
export function databaseSelfPages(identity: DashboardIdentity) {
  return {
    myProfile: () => readProfile(identity),
    saveLinkedin: (text: string) => saveLinkedin(identity, text),
    setPhoto: (photo: Upload | null) => setPhoto(identity, photo),
    // No leave request can be stored yet: there is no table for it.
    requestLeave: async (): Promise<WriteResult<null>> =>
      refused("Leaving from the dashboard is not open yet. Tell your division lead."),
    myAccount: () => readAccount(identity),
    withdrawApplication: (applicationId: number) => withdrawApplication(identity, applicationId),
    deleteAccount: (options: DeleteAccount) => deleteAccount(identity, options),
  };
}
