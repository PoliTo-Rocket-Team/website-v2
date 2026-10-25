import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import {
  alumniEntries,
  applicationFiles,
  applicationStatuses,
  applications,
  applyPositions,
  betterAuthUsers,
  departments,
  divisions,
  interviewSlots,
  dashboardNotices,
  members,
  roles,
  scopes,
  teamLeaves,
  users,
} from "@/db/schema";
import { positionCode } from "@/lib/apply/positions";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { deleteBestEffort } from "@/lib/storage/best-effort-delete";
import { parsePrivatePathname, parsePublicPathname, publicPathname } from "@/lib/storage/pathname";
import { deletePrivateFile } from "@/lib/storage/private-store";
import { deletePublicFile, uploadPublicFile } from "@/lib/storage/public-store";
import { canReach } from "./access";
import type { DashboardIdentity } from "./database";
import { readHandOverOffer } from "./database-hand-over";
import { memberLeftNoticesFor } from "./database-notices";
import {
  columnsFromDetails,
  detailsEditorOf,
  detailsFromColumns,
  firstDetailError,
  parseDetailsChange,
  type YourDetails,
} from "./details";
import { statusOfStored } from "./application-status";
import { STATUS_COLUMNS, STATUS_JOIN } from "./database-recruitment";
import {
  canWithdraw,
  isShownAt,
  mayOfferInterview,
  OPEN_STATUSES,
  pickableSlot,
  placeOf,
  WITHDRAWABLE_STATUS_KEYS,
  withdrawnOnDelete,
  type ActiveApplication,
  type ApplicationAnswer,
  type ApplicationFile,
  type Interview,
  type InterviewSlot,
  type MyApplications,
  type PastApplication,
  type StoredApplication,
} from "./my-applications";
import { fileSize } from "./recruitment";
import {
  checkPhoto,
  HAND_OVER_FIRST,
  leaveReason,
  normalizeLinkedin,
  profileRolesOf,
  type DeleteAccount,
  type LeaveState,
  type MyAccount,
  type MyProfile,
} from "./self";
import { refreshAfter } from "@/lib/cache-tags";
import { namesThemselves } from "./person-name";
import { hasOwnProfile, isOffTeam } from "./viewer";
import { refused, written, type Upload, type WriteResult } from "./write";

// The viewer's own pages read from and written to the database (boards 50 to
// 55, issue #169, on #145's v1). Writes follow .patterns/audited-mutations.md;
// each one touches only the signed-in person's own rows.

const detailColumns = {
  firstName: users.firstName,
  lastName: users.lastName,
  phone: users.phone,
  politoId: users.politoId,
  program: users.program,
  levelOfStudy: users.levelOfStudy,
  country: users.country,
  dateOfBirth: users.dateOfBirth,
  linkedin: users.linkedin,
};

async function readDetails(userId: string): Promise<YourDetails> {
  const [row] = await getDb().select(detailColumns).from(users).where(eq(users.id, userId)).limit(1);
  return detailsFromColumns(
    row ?? { firstName: null, lastName: null, phone: null, politoId: null, program: null, levelOfStudy: null, country: null, dateOfBirth: null, linkedin: null },
  );
}

/** Left: they had roles on the team and every one has ended (the Alumni page's rule, ./team-database.ts). */
async function readLeaveState(memberId: number): Promise<LeaveState> {
  const rows = await getDb().select({ leaved_at: roles.leavedAt }).from(roles).where(eq(roles.memberId, memberId));
  return rows.length > 0 && rows.every((r) => r.leaved_at !== null) ? "left" : "on-team";
}

async function readProfile(identity: DashboardIdentity): Promise<MyProfile | null> {
  if (!hasOwnProfile(identity)) return null;
  const memberId = identity.memberId;
  const [[member], details, leave, handOver] = await Promise.all([
    getDb().select({ prt_email: members.prtEmail }).from(members).where(eq(members.memberId, memberId)).limit(1),
    readDetails(identity.userId),
    readLeaveState(memberId),
    readHandOverOffer(identity),
  ]);
  const linkedin = identity.linkedin === null ? null : normalizeLinkedin(identity.linkedin);
  return {
    name: identity.name,
    detailsEditor: namesThemselves(identity.kind) ? "lead" : "member",
    // Every division they are in, not only the one a single-division page names (issue #185).
    roles: profileRolesOf(identity.role, identity.roles),
    teamEmail: member?.prt_email ?? null,
    linkedin: linkedin === null ? null : linkedin.ok ? linkedin.value : identity.linkedin,
    photoUrl: identity.picture,
    signIn: { provider: "google", email: identity.email },
    leave,
    details,
    handOver,
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
export function storedPhotoPathname(url: string | null) {
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
  if (old !== null) await deleteBestEffort({ store: "public", area: "member-photo", pathname: old, remove: deletePublicFile });
  return written(null);
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "Remove my name from the Alumni page" (boards 55b, 55c, issue #257), run in
 * the batch that leaves or deletes: the member's alumni entry is marked
 * removed, made if they had none, and the page stops listing them.
 */
function removeFromAlumni(db: ReturnType<typeof getDb>, memberId: number) {
  const removedAt = new Date().toISOString();
  return db
    .insert(alumniEntries)
    .values({ kind: "member", memberId, removedAt })
    .onConflictDoUpdate({ target: alumniEntries.memberId, set: { removedAt } });
}

/**
 * Board 55b: every role the member still holds ends today, so the Alumni page
 * lists them, and the reason is kept. Their access grants go, so they come
 * back as an alumnus holding none (issue #317), and the lead of each division they were in gets a
 * notice on their dashboard (issue #201), all in one batch. Their sign-in,
 * users row and member row stay. With the box ticked, the Alumni page stops
 * listing them (issue #257).
 */
async function leaveTeam(identity: DashboardIdentity, reason: string, removeFromAlumniPage: boolean): Promise<WriteResult<null>> {
  const memberId = identity.memberId;
  if (memberId === null) return refused("This page is for team members.");
  if ((await readLeaveState(memberId)) === "left") return refused("You already left the team.");
  // A lead or head leaves through "Hand over your role", which the next level up confirms (issue #262).
  if ((await readHandOverOffer(identity)) !== null) return refused(HAND_OVER_FIRST);
  const why = leaveReason(reason);
  const notices = await memberLeftNoticesFor(memberId, why);
  await runAuditBatch((db) => [
    db.update(roles).set({ leavedAt: today() }).where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt))),
    db.delete(scopes).where(eq(scopes.memberId, memberId)),
    db.insert(teamLeaves).values({ memberId, reason: why }),
    ...(removeFromAlumniPage ? [removeFromAlumni(db, memberId)] : []),
    ...(notices.length > 0
      ? [
          db.insert(dashboardNotices).values(
            notices.map(({ recipientId, notice }) => ({ recipientId, subjectId: memberId, kind: notice.kind, data: notice.data })),
          ),
        ]
      : []),
  ]);
  refreshAfter("team", updateTag);
  return written(null);
}

async function readAccount(identity: DashboardIdentity): Promise<MyAccount | null> {
  if (!isOffTeam(identity.kind)) return null;
  const [details, open] = await Promise.all([
    readDetails(identity.userId),
    getDb()
      .select({ id: applications.id })
      .from(applications)
      .where(
        and(
          eq(applications.userId, identity.userId),
          inArray(applications.status, [...OPEN_STATUSES]),
          isNull(applications.withdrawnAt),
        ),
      ),
  ]);
  return {
    name: identity.name,
    photoUrl: identity.picture,
    signIn: { provider: "google", email: identity.email },
    details,
    openApplications: open.length,
  };
}

/**
 * Someone off the team edits every field on My account; anyone on the team
 * only My profile's, their own name only when they rename themselves
 * (`detailsEditorOf`, issue #668): a member's name sent here is dropped.
 */
async function saveDetails(identity: DashboardIdentity, input: unknown): Promise<WriteResult<YourDetails>> {
  const parsed = parseDetailsChange(input, detailsEditorOf(identity.kind));
  if (!parsed.ok) return refused(firstDetailError(parsed.errors));
  await runAuditQuery((db) =>
    db
      .update(users)
      .set({ ...columnsFromDetails(parsed.value), updatedAt: sql`now()` })
      .where(eq(users.id, identity.userId)),
  );
  // A team member's name is on the Team page and every roster, which read the cached team.
  if (!isOffTeam(identity.kind) && parsed.value.firstName !== undefined) refreshAfter("team", updateTag);
  return written(await readDetails(identity.userId));
}

/**
 * Closes the account: the Better Auth user goes, and with it their sessions
 * and linked Google account, and `users.deleted_at` records when. A member
 * leaves the team with it. The `users` row and the applications stay with the
 * team for at least a year, until the daily job anonymizes them
 * (./anonymize.ts), unless the person ticked the box: then their open
 * applications are withdrawn and those applications' files are deleted.
 */
async function deleteAccount(identity: DashboardIdentity, options: DeleteAccount): Promise<WriteResult<null>> {
  if (typeof options.withdrawOpenApplications !== "boolean" || typeof options.removeFromAlumni !== "boolean") return refused("Check the form.");
  const { userId, memberId } = identity;
  const withdraw = options.withdrawOpenApplications && isOffTeam(identity.kind);
  const { applicationIds, fileIds } = withdraw
    ? withdrawnOnDelete(
        await getDb()
          .select({
            id: applications.id,
            status: applications.status,
            withdrawnAt: applications.withdrawnAt,
            cvFileId: applications.cvFileId,
            coverLetterFileId: applications.coverLetterFileId,
          })
          .from(applications)
          .where(eq(applications.userId, userId)),
      )
    : { applicationIds: [], fileIds: [] };
  const files =
    fileIds.length === 0
      ? []
      : await getDb()
          .select({ pathname: applicationFiles.pathname })
          .from(applicationFiles)
          .where(and(inArray(applicationFiles.id, [...fileIds]), eq(applicationFiles.userId, userId)));

  await runAuditBatch((db) => [
    db.delete(betterAuthUsers).where(eq(betterAuthUsers.id, userId)),
    db.update(users).set({ deletedAt: sql`now()` }).where(eq(users.id, userId)),
    ...(memberId === null
      ? []
      : [db.update(roles).set({ leavedAt: today() }).where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt)))]),
    ...(memberId !== null && options.removeFromAlumni ? [removeFromAlumni(db, memberId)] : []),
    ...(applicationIds.length === 0
      ? []
      : [
          db
            .update(applications)
            .set({ withdrawnAt: sql`now()` })
            .where(
              and(
                inArray(applications.id, [...applicationIds]),
                eq(applications.userId, userId),
                inArray(applications.status, [...OPEN_STATUSES]),
                isNull(applications.withdrawnAt),
              ),
            ),
        ]),
    ...(fileIds.length === 0
      ? []
      : [db.delete(applicationFiles).where(and(inArray(applicationFiles.id, [...fileIds]), eq(applicationFiles.userId, userId)))]),
  ]);
  if (memberId !== null) refreshAfter("team", updateTag);

  for (const file of files) {
    const pathname = parsePrivatePathname(file.pathname);
    if (pathname !== null) await deleteBestEffort({ store: "private", area: "delete-account", pathname, remove: deletePrivateFile });
  }
  return written(null);
}

// My applications -------------------------------------------------------------

/** "Mission Analysis" as stored reads "Mission Analysis Division", as the boards print it. */
function divisionLabel(name: string | null): string | null {
  if (name === null) return null;
  return name.endsWith("Division") ? name : `${name} Division`;
}

function answersOf(raw: unknown[] | null): ApplicationAnswer[] {
  return (raw ?? []).flatMap((a) => {
    if (typeof a !== "object" || a === null) return [];
    const { question, answer } = a as { question?: unknown; answer?: unknown };
    return typeof question === "string" && typeof answer === "string" ? [{ question, answer }] : [];
  });
}

function fileOf(file: { name: string | null; size: number | null }, storedName: string | null): ApplicationFile[] {
  const name = file.name ?? storedName;
  return name === null ? [] : [{ name, size: file.size === null ? null : fileSize(file.size) }];
}

/** The current lead of each division, by division id: who offers its interview times. */
async function leadsOf(divisionIds: readonly number[]): Promise<Map<number, string>> {
  if (divisionIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ division_id: roles.divisionId, first_name: users.firstName, last_name: users.lastName })
    .from(roles)
    .innerJoin(users, eq(users.member, roles.memberId))
    .where(and(inArray(roles.divisionId, [...divisionIds]), eq(roles.type, "lead"), isNull(roles.leavedAt)));
  return new Map(
    rows.flatMap((r) => {
      const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
      return r.division_id === null || name === "" ? [] : [[r.division_id, name] as const];
    }),
  );
}

/** The columns of one application `storedOf` reads, with its status reference and that status's parent (`STATUS_COLUMNS`). */
type StoredColumns = {
  status_key: string | null;
  status_parent_key: string | null;
  applied_at: string;
  withdrawn_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  joined_at: string | null;
};

/** One application as My applications reads it: its status through the status list (issue #748), never the old status column. */
function storedOf(r: StoredColumns): StoredApplication {
  return {
    status: statusOfStored({ key: r.status_key, parentKey: r.status_parent_key }),
    appliedAt: r.applied_at,
    withdrawnAt: r.withdrawn_at,
    acceptedAt: r.accepted_at,
    rejectedAt: r.rejected_at,
    joinedAt: r.joined_at,
  };
}

async function readMyApplications(identity: DashboardIdentity): Promise<MyApplications | null> {
  if (!canReach(identity, "my-applications")) return null;
  const db = getDb();
  const cvFiles = alias(applicationFiles, "cv_files");
  const letterFiles = alias(applicationFiles, "letter_files");
  const [stored, [me]] = await Promise.all([
    db
      .select({
        id: applications.id,
        position_id: applyPositions.id,
        title: applyPositions.title,
        division_id: divisions.id,
        div_name: divisions.name,
        div_code: divisions.code,
        dept_name: departments.name,
        dept_code: departments.code,
        applied_at: applications.appliedAt,
        ...STATUS_COLUMNS,
        withdrawn_at: applications.withdrawnAt,
        accepted_at: applications.acceptedAt,
        rejected_at: applications.rejectedAt,
        joined_at: applications.joinedAt,
        answers: applications.customAnswers,
        cv_name: applications.cvName,
        letter_name: applications.mlName,
        cv_file_name: cvFiles.originalFilename,
        cv_file_size: cvFiles.fileSize,
        letter_file_name: letterFiles.originalFilename,
        letter_file_size: letterFiles.fileSize,
      })
      .from(applications)
      .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
      .leftJoin(applicationStatuses, STATUS_JOIN)
      .leftJoin(divisions, eq(applyPositions.divisionId, divisions.id))
      .leftJoin(departments, eq(divisions.deptId, departments.id))
      .leftJoin(cvFiles, eq(applications.cvFileId, cvFiles.id))
      .leftJoin(letterFiles, eq(applications.coverLetterFileId, letterFiles.id))
      .where(eq(applications.userId, identity.userId))
      .orderBy(desc(applications.appliedAt), desc(applications.id)),
    db.select({ first_name: users.firstName }).from(users).where(eq(users.id, identity.userId)).limit(1),
  ]);
  // Only what the one-month rule shows (issue #317); the rest stays stored.
  const now = new Date();
  const rows = stored.filter((r) => isShownAt(storedOf(r), now));
  if (rows.length === 0) return { firstName: me?.first_name ?? identity.name, email: identity.email, active: [], past: [] };

  const interviewing = rows.filter((r) => mayOfferInterview(storedOf(r)));
  const [slotRows, leads] = await Promise.all([
    interviewing.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: interviewSlots.id, application_id: interviewSlots.applicationId, start: interviewSlots.startsAt, end: interviewSlots.endsAt, chosen: interviewSlots.chosen })
          .from(interviewSlots)
          .where(inArray(interviewSlots.applicationId, interviewing.map((r) => r.id))),
    leadsOf([...new Set(interviewing.flatMap((r) => (r.division_id === null ? [] : [r.division_id])))]),
  ]);

  const active: ActiveApplication[] = [];
  const past: PastApplication[] = [];
  for (const r of rows) {
    const place = {
      id: r.id,
      title: r.title ?? "Untitled position",
      department: r.dept_name ?? "",
      division: divisionLabel(r.div_name),
      sent: r.applied_at,
    };
    const slots: InterviewSlot[] = slotRows
      .filter((s) => s.application_id === r.id)
      .map((s) => ({ id: s.id, start: s.start, end: s.end }));
    const chosenId = slotRows.find((s) => s.application_id === r.id && s.chosen)?.id;
    const interview: Interview | null =
      slots.length === 0
        ? null
        : {
            lead: (r.division_id === null ? undefined : leads.get(r.division_id)) ?? "Your lead",
            slots,
            chosen: slots.find((s) => s.id === chosenId) ?? null,
          };
    const where = placeOf(
      storedOf(r),
      interview,
      identity.role?.startedAt ?? null,
    );
    if (where.kind === "past") {
      past.push({ ...place, outcome: where.outcome });
      continue;
    }
    active.push({
      ...place,
      code: positionCode({ id: r.position_id, dept_code: r.dept_code ?? "", div_code: r.div_code ?? "" }),
      stage: where.stage,
      files: [
        ...fileOf({ name: r.cv_file_name, size: r.cv_file_size }, r.cv_name),
        ...fileOf({ name: r.letter_file_name, size: r.letter_file_size }, r.letter_name),
      ],
      answers: answersOf(r.answers),
    });
  }
  return { firstName: me?.first_name ?? identity.name, email: identity.email, active, past };
}

/**
 * The built-in status an `applications` row's status behaves like, in SQL: its
 * own key or its added status's parent, and New for no reference
 * (./application-status.ts).
 */
const BUILT_IN_STATUS_OF_ROW = sql<string>`coalesce((select coalesce(${applicationStatuses.parentKey}, ${applicationStatuses.key}) from ${applicationStatuses} where ${applicationStatuses.key} = ${applications.statusKey}), 'new')`;

/** Board 50b: marks it withdrawn; the lead's list leaves it out from then on (./database.ts). */
async function withdrawApplication(identity: DashboardIdentity, applicationId: number): Promise<WriteResult<null>> {
  const mine = await readMyApplications(identity);
  const application = mine?.active.find((a) => a.id === applicationId);
  if (!application) return refused("That application is not yours, or it is already over.");
  if (!canWithdraw(application.stage)) return refused("An accepted application cannot be withdrawn.");
  const changed = await runAuditQuery((db) =>
    db
      .update(applications)
      .set({ withdrawnAt: sql`now()` })
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.userId, identity.userId),
          inArray(BUILT_IN_STATUS_OF_ROW, [...WITHDRAWABLE_STATUS_KEYS]),
          isNull(applications.withdrawnAt),
        ),
      )
      .returning({ id: applications.id }),
  );
  // A lead accepted or closed it between the read and the write.
  return changed.length === 0 ? refused("This application changed. Reload the page.") : written(null);
}

/** Board 50c: the picked time becomes the one chosen slot of the application. */
async function chooseInterviewSlot(identity: DashboardIdentity, applicationId: number, slotId: number): Promise<WriteResult<InterviewSlot>> {
  const mine = await readMyApplications(identity);
  const pick = pickableSlot(mine?.active.find((a) => a.id === applicationId), slotId);
  if (!pick.ok) return refused(pick.error);
  // The earlier choice is cleared only while the picked slot still exists: when the lead changed the times
  // in between, the picked slot is gone, nothing changes and the applicant is told to reload.
  const pickedStillOffered = sql`exists (select 1 from ${interviewSlots} picked where picked.id = ${slotId} and picked.application_id = ${applicationId})`;
  const [, chosen] = await runAuditBatch((db) => [
    db
      .update(interviewSlots)
      .set({ chosen: false, chosenAt: null })
      .where(and(eq(interviewSlots.applicationId, applicationId), pickedStillOffered)),
    db
      .update(interviewSlots)
      .set({ chosen: true, chosenAt: sql`now()` })
      .where(and(eq(interviewSlots.id, slotId), eq(interviewSlots.applicationId, applicationId)))
      .returning({ id: interviewSlots.id }),
  ]);
  return chosen.length === 0 ? refused("The interview times changed. Reload the page.") : written(pick.slot);
}

/** The viewer's own pages: the database side of the data interface. */
export function databaseSelfPages(identity: DashboardIdentity) {
  return {
    myProfile: () => readProfile(identity),
    saveLinkedin: (text: string) => saveLinkedin(identity, text),
    setPhoto: (photo: Upload | null) => setPhoto(identity, photo),
    leaveTeam: (reason: string, removeFromAlumniPage: boolean) => leaveTeam(identity, reason, removeFromAlumniPage),
    myAccount: () => readAccount(identity),
    saveDetails: (input: unknown) => saveDetails(identity, input),
    deleteAccount: (options: DeleteAccount) => deleteAccount(identity, options),
    myApplications: () => readMyApplications(identity),
    withdrawApplication: (applicationId: number) => withdrawApplication(identity, applicationId),
    chooseInterviewSlot: (applicationId: number, slotId: number) => chooseInterviewSlot(identity, applicationId, slotId),
  };
}
