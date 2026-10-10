import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import {
  applicationFiles,
  applications,
  applyPositions,
  betterAuthUsers,
  departments,
  divisions,
  interviewSlots,
  members,
  roles,
  teamLeaves,
  users,
} from "@/db/schema";
import { positionCode } from "@/lib/apply/positions";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { parsePrivatePathname, parsePublicPathname, publicPathname } from "@/lib/storage/pathname";
import { deletePrivateFile } from "@/lib/storage/private-store";
import { deletePublicFile, uploadPublicFile } from "@/lib/storage/public-store";
import type { DashboardIdentity } from "./database";
import {
  columnsFromDetails,
  detailsFromColumns,
  firstDetailError,
  parseDetailsChange,
  type DetailsEditor,
  type YourDetails,
} from "./details";
import {
  canWithdraw,
  pickableSlot,
  type ActiveApplication,
  type ActiveStage,
  type ApplicationAnswer,
  type ApplicationFile,
  type InterviewSlot,
  type MyApplications,
  type PastApplication,
} from "./my-applications";
import { fileSize } from "./recruitment";
import {
  checkPhoto,
  leaveReason,
  normalizeLinkedin,
  type DeleteAccount,
  type LeaveState,
  type MyAccount,
  type MyProfile,
} from "./self";
import { TEAM_ROSTER_CACHE_TAG } from "./team-database";
import { refused, written, type Upload, type WriteResult } from "./write";

// The viewer's own pages read from and written to the database (boards 50 to
// 55, issue #169, on #145's v1). Writes follow .patterns/audited-mutations.md;
// each one touches only the signed-in person's own rows.

/**
 * The applications a person can still withdraw: received, in review, or at
 * interview (the lead's "Move to interview", issue #171, marks `interview`).
 */
const OPEN_STATUSES = ["received", "pending", "interview"] as const;

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
  const memberId = identity.memberId;
  if (identity.kind === "non-member" || memberId === null) return null;
  const [[member], details, leave] = await Promise.all([
    getDb().select({ prt_email: members.prtEmail }).from(members).where(eq(members.memberId, memberId)).limit(1),
    readDetails(identity.userId),
    readLeaveState(memberId),
  ]);
  const role = identity.role;
  const linkedin = identity.linkedin === null ? null : normalizeLinkedin(identity.linkedin);
  return {
    name: identity.name,
    role: [role?.title ?? "Member", role?.divisionName].filter(Boolean).join(" · "),
    teamEmail: member?.prt_email ?? null,
    linkedin: linkedin === null ? null : linkedin.ok ? linkedin.value : identity.linkedin,
    photoUrl: identity.picture,
    signIn: { provider: "google", email: identity.email },
    leave,
    details,
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

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Board 55b: every role the member still holds ends today, so the Alumni page
 * lists them, and the reason is kept. Their sign-in stays.
 */
async function leaveTeam(identity: DashboardIdentity, reason: string): Promise<WriteResult<null>> {
  const memberId = identity.memberId;
  if (memberId === null) return refused("This page is for team members.");
  if ((await readLeaveState(memberId)) === "left") return refused("You already left the team.");
  await runAuditBatch((db) => [
    db.update(roles).set({ leavedAt: today() }).where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt))),
    db.insert(teamLeaves).values({ memberId, reason: leaveReason(reason) }),
  ]);
  updateTag(TEAM_ROSTER_CACHE_TAG);
  return written(null);
}

async function readAccount(identity: DashboardIdentity): Promise<MyAccount | null> {
  if (identity.kind !== "non-member") return null;
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
    signIn: { provider: "google", email: identity.email },
    details,
    openApplications: open.length,
  };
}

/** An applicant edits every field on My account; anyone on the team edits only My profile's. */
function detailsEditorOf(identity: DashboardIdentity): DetailsEditor {
  return identity.kind === "non-member" ? "applicant" : "member";
}

async function saveDetails(identity: DashboardIdentity, input: unknown): Promise<WriteResult<YourDetails>> {
  const parsed = parseDetailsChange(input, detailsEditorOf(identity));
  if (!parsed.ok) return refused(firstDetailError(parsed.errors));
  await runAuditQuery((db) =>
    db
      .update(users)
      .set({ ...columnsFromDetails(parsed.value), updatedAt: sql`now()` })
      .where(eq(users.id, identity.userId)),
  );
  return written(await readDetails(identity.userId));
}

/**
 * Closes the account: the Better Auth user goes, and with it their sessions
 * and linked Google account. A member leaves the team with it. The `users`
 * row and the applications stay with the team, unless the person ticked the
 * box: then their open applications are withdrawn and every file they
 * uploaded is deleted.
 */
async function deleteAccount(identity: DashboardIdentity, options: DeleteAccount): Promise<WriteResult<null>> {
  if (typeof options.withdrawOpenApplications !== "boolean") return refused("Check the form.");
  const { userId, memberId } = identity;
  const withdraw = options.withdrawOpenApplications && identity.kind === "non-member";
  const files = withdraw
    ? await getDb()
        .select({ id: applicationFiles.id, pathname: applicationFiles.pathname })
        .from(applicationFiles)
        .where(eq(applicationFiles.userId, userId))
    : [];

  await runAuditBatch((db) => [
    db.delete(betterAuthUsers).where(eq(betterAuthUsers.id, userId)),
    ...(memberId === null
      ? []
      : [db.update(roles).set({ leavedAt: today() }).where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt)))]),
    ...(withdraw
      ? [
          db
            .update(applications)
            .set({ withdrawnAt: sql`now()` })
            .where(
              and(
                eq(applications.userId, userId),
                inArray(applications.status, [...OPEN_STATUSES]),
                isNull(applications.withdrawnAt),
              ),
            ),
          db.delete(applicationFiles).where(eq(applicationFiles.userId, userId)),
        ]
      : []),
  ]);
  if (memberId !== null) updateTag(TEAM_ROSTER_CACHE_TAG);

  for (const file of files) {
    const pathname = parsePrivatePathname(file.pathname);
    if (pathname !== null) await deletePrivateFile(pathname).catch(() => undefined);
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

async function readMyApplications(identity: DashboardIdentity): Promise<MyApplications | null> {
  if (identity.kind !== "non-member" && identity.kind !== "member") return null;
  const db = getDb();
  const cvFiles = alias(applicationFiles, "cv_files");
  const letterFiles = alias(applicationFiles, "letter_files");
  const [rows, [me]] = await Promise.all([
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
        status: applications.status,
        withdrawn_at: applications.withdrawnAt,
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
      .leftJoin(divisions, eq(applyPositions.divisionId, divisions.id))
      .leftJoin(departments, eq(divisions.deptId, departments.id))
      .leftJoin(cvFiles, eq(applications.cvFileId, cvFiles.id))
      .leftJoin(letterFiles, eq(applications.coverLetterFileId, letterFiles.id))
      .where(eq(applications.userId, identity.userId))
      .orderBy(desc(applications.appliedAt), desc(applications.id)),
    db.select({ first_name: users.firstName }).from(users).where(eq(users.id, identity.userId)).limit(1),
  ]);
  if (rows.length === 0) return { firstName: me?.first_name ?? identity.name, email: identity.email, active: [], past: [] };

  const interviewing = rows.filter((r) => (r.status === "pending" || r.status === "interview") && r.withdrawn_at === null);
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
    const over = (outcome: PastApplication["outcome"]) => past.push({ ...place, outcome });
    if (r.withdrawn_at !== null) {
      over({ kind: "withdrawn" });
      continue;
    }
    let stage: ActiveStage;
    switch (r.status) {
      case "rejected":
      case "accepted_by_another_team":
        over({ kind: "not-selected" });
        continue;
      case "joined":
        // Confirm join (issue #171) put them on the team on `joined_at`.
        over({ kind: "joined", since: (r.joined_at ?? identity.role?.startedAt ?? r.applied_at).slice(0, 10) });
        continue;
      case "accepted":
        if (identity.memberId !== null) {
          over({ kind: "joined", since: identity.role?.startedAt ?? r.applied_at });
          continue;
        }
        stage = { kind: "accepted" };
        break;
      case "received":
        stage = { kind: "received" };
        break;
      case "pending":
      case "interview": {
        const slots: InterviewSlot[] = slotRows
          .filter((s) => s.application_id === r.id)
          .map((s) => ({ id: s.id, start: s.start, end: s.end }));
        const chosenId = slotRows.find((s) => s.application_id === r.id && s.chosen)?.id;
        stage =
          slots.length === 0
            ? { kind: "in-review" }
            : {
                kind: "interview",
                interview: {
                  lead: (r.division_id === null ? undefined : leads.get(r.division_id)) ?? "Your lead",
                  slots,
                  chosen: slots.find((s) => s.id === chosenId) ?? null,
                },
              };
        break;
      }
    }
    active.push({
      ...place,
      code: positionCode({ id: r.position_id, dept_code: r.dept_code ?? "", div_code: r.div_code ?? "" }),
      stage,
      files: [
        ...fileOf({ name: r.cv_file_name, size: r.cv_file_size }, r.cv_name),
        ...fileOf({ name: r.letter_file_name, size: r.letter_file_size }, r.letter_name),
      ],
      answers: answersOf(r.answers),
    });
  }
  return { firstName: me?.first_name ?? identity.name, email: identity.email, active, past };
}

/** Board 50b: marks it withdrawn; the lead's list leaves it out from then on (./database.ts). */
async function withdrawApplication(identity: DashboardIdentity, applicationId: number): Promise<WriteResult<null>> {
  const mine = await readMyApplications(identity);
  const application = mine?.active.find((a) => a.id === applicationId);
  if (!application) return refused("That application is not yours, or it is already over.");
  if (!canWithdraw(application.stage)) return refused("An accepted application cannot be withdrawn.");
  await runAuditQuery((db) =>
    db
      .update(applications)
      .set({ withdrawnAt: sql`now()` })
      .where(
        and(
          eq(applications.id, applicationId),
          eq(applications.userId, identity.userId),
          inArray(applications.status, [...OPEN_STATUSES]),
          isNull(applications.withdrawnAt),
        ),
      ),
  );
  return written(null);
}

/** Board 50c: the picked time becomes the one chosen slot of the application. */
async function chooseInterviewSlot(identity: DashboardIdentity, applicationId: number, slotId: number): Promise<WriteResult<InterviewSlot>> {
  const mine = await readMyApplications(identity);
  const pick = pickableSlot(mine?.active.find((a) => a.id === applicationId), slotId);
  if (!pick.ok) return refused(pick.error);
  await runAuditBatch((db) => [
    db.update(interviewSlots).set({ chosen: false, chosenAt: null }).where(eq(interviewSlots.applicationId, applicationId)),
    db
      .update(interviewSlots)
      .set({ chosen: true, chosenAt: sql`now()` })
      .where(and(eq(interviewSlots.id, slotId), eq(interviewSlots.applicationId, applicationId))),
  ]);
  return written(pick.slot);
}

/** The viewer's own pages: the database side of the data interface. */
export function databaseSelfPages(identity: DashboardIdentity) {
  return {
    myProfile: () => readProfile(identity),
    saveLinkedin: (text: string) => saveLinkedin(identity, text),
    setPhoto: (photo: Upload | null) => setPhoto(identity, photo),
    leaveTeam: (reason: string) => leaveTeam(identity, reason),
    myAccount: () => readAccount(identity),
    saveDetails: (input: unknown) => saveDetails(identity, input),
    deleteAccount: (options: DeleteAccount) => deleteAccount(identity, options),
    myApplications: () => readMyApplications(identity),
    withdrawApplication: (applicationId: number) => withdrawApplication(identity, applicationId),
    chooseInterviewSlot: (applicationId: number, slotId: number) => chooseInterviewSlot(identity, applicationId, slotId),
  };
}
