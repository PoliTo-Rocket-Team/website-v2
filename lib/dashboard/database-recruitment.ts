import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { refreshAfter } from "@/lib/cache-tags";
import {
  applicationFiles,
  applications,
  applyPositions,
  departments,
  divisions,
  interviewSlots,
  members,
  roles,
  users,
} from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import {
  applyMove,
  joinChange,
  memberStanding,
  NEW_APPLICANT,
  type ApplicantStanding,
  type ApplicationState,
  type JoinChange,
  type LeadMove,
  type OfferedSlots,
} from "./application-flow";
import { membershipsOfRoles } from "./team";
import { DashboardRefused } from "./data";
import type { DashboardIdentity } from "./database";
import { readHeadDepartment } from "./database-division";
import { positionCode } from "@/lib/apply/positions";
import type { SlotRow } from "./interview-slots";
import { storedApplicationState } from "./stored-application";
import { checkNewPosition, checkPositionContent, newPositionCode, type CreatedPosition, type DivisionChoice } from "./new-position";
import {
  ago,
  appliedLabels,
  fileSize,
  quietDays,
  quietNote,
  type ApplicationDocument,
  type ApplicationEntry,
  type ApplicationsPage,
  type ApplicationsScope,
  type DepartmentUnit,
  type OtherApplication,
  type PositionRow,
  type PositionsPage,
} from "./recruitment";
import { mayChange, type DivisionUnit } from "./viewer";
import { mayChangePositionIn } from "./position-access";
import {
  documentHref,
  mayOpenApplication,
  readsRecruitment,
  readsRecruitmentIn,
  type DocumentKind,
  type StoredDocument,
} from "./application-documents";
import { parsePrivatePathname } from "@/lib/storage/pathname";
import { refused, written, type WriteResult } from "./write";

// The Positions and Applications pages read from and written to the database
// (boards 57 and 58, issue #171, after #142). Reads follow
// .patterns/drizzle-reads.md; writes follow .patterns/audited-mutations.md:
// each checks the viewer reaches the position or application, asks
// ./application-flow.ts whether the move is legal, then writes through
// runAuditQuery or runAuditBatch. Only Confirm join touches the team tables.

type Identity = DashboardIdentity;
type DbStatus = (typeof applications.$inferSelect)["status"];

/** Whether the viewer reads the recruitment pages (`readsRecruitment`, ./application-documents.ts). */
const isLead: (identity: Identity) => boolean = readsRecruitment;

/** The division a position is in, with its department; null for a deleted position or a closed unit. */
async function positionUnit(positionId: number): Promise<DivisionUnit | null> {
  const [row] = await getDb()
    .select({ divisionId: divisions.id, departmentId: departments.id })
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(eq(applyPositions.id, positionId), eq(applyPositions.isDeleted, false), isNull(divisions.closedAt), isNull(departments.closedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Whether the viewer may change `area` on the position (issues #160, #461):
 * it is live, in an open division, and the one rule every position and
 * application write asks (`mayChangePositionIn`, ./position-access.ts) lets
 * them change it there. False for a position that no longer exists.
 */
async function mayChangePosition(identity: Identity, area: "positions" | "applications", positionId: number): Promise<boolean> {
  const unit = await positionUnit(positionId);
  return unit !== null && mayChangePositionIn(identity, area, unit);
}

// Positions -------------------------------------------------------------------

/** The positions a lead reaches, with what the table shows for each. */
async function readPositionRows(identity: Identity, now: Date): Promise<PositionRow[]> {
  const db = getDb();
  // The tallies are read for every position, beside the positions rather than
  // after them, and picked per row below: one round trip, not two (issue #397).
  const [rows, tallies] = await Promise.all([
    db
      .select({
        id: applyPositions.id,
        title: applyPositions.title,
        status: applyPositions.status,
        created_at: applyPositions.createdAt,
        description: applyPositions.description,
        required: applyPositions.requiredSkills,
        desirable: applyPositions.desirableSkills,
        questions: applyPositions.customQuestions,
        motivation_letter: applyPositions.requiresMotivationLetter,
        division_id: divisions.id,
        division_name: divisions.name,
        div_code: divisions.code,
        dept_id: departments.id,
        dept_name: departments.name,
        dept_code: departments.code,
      })
      .from(applyPositions)
      .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
      .innerJoin(departments, eq(divisions.deptId, departments.id))
      .where(and(eq(applyPositions.isDeleted, false), isNull(divisions.closedAt), isNull(departments.closedAt)))
      .orderBy(desc(applyPositions.createdAt)),
    db
      .select({ position_id: applications.applyPositionId, status: applications.status, n: count(), last: max(applications.appliedAt) })
      .from(applications)
      .where(isNull(applications.withdrawnAt))
      .groupBy(applications.applyPositionId, applications.status),
  ]);
  // The same rule the document route checks (`readsRecruitmentIn`, ./application-documents.ts).
  const scoped = rows.filter((r) => readsRecruitmentIn(identity, { divisionId: r.division_id, departmentId: r.dept_id }));
  if (scoped.length === 0) return [];

  return scoped.map((r) => {
    const own = tallies.filter((t) => t.position_id === r.id);
    const latest = own.reduce<string | null>((at, t) => (t.last !== null && (at === null || t.last > at) ? t.last : at), null);
    const created = new Date(r.created_at);
    return {
      id: r.id,
      ref: String(r.id),
      title: r.title ?? "Untitled position",
      division: r.division_name,
      department: r.dept_name,
      open: r.status,
      applications: own.reduce((sum, t) => sum + t.n, 0),
      newApplications: own.filter((t) => t.status === "received").reduce((sum, t) => sum + t.n, 0),
      quiet: quietNote(quietDays(r.status, latest === null ? created : new Date(latest), now)),
      // The table has no edit time; a role's creation is the last change it records.
      updated: ago(created, now),
      code: positionCode({ id: r.id, dept_code: r.dept_code ?? "", div_code: r.div_code ?? "" }),
      content: {
        title: r.title ?? "",
        description: r.description ?? "",
        required: r.required ?? [],
        desirable: r.desirable ?? [],
        questions: r.questions ?? [],
        motivationLetter: r.motivation_letter,
      },
    };
  });
}

/**
 * The open divisions a viewer may post a role in: every one for the operations
 * lead, else those their role or a Positions grant at Can edit lets them
 * change (`mayChange`, issue #160).
 */
async function readPostableDivisions(identity: Identity): Promise<DivisionChoice[]> {
  if (!isLead(identity)) return [];
  const rows = await getDb()
    .select({
      id: divisions.id,
      name: divisions.name,
      div_code: divisions.code,
      dept_id: departments.id,
      dept_name: departments.name,
      dept_code: departments.code,
    })
    .from(divisions)
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(isNull(divisions.closedAt), isNull(departments.closedAt)))
    .orderBy(asc(departments.name), asc(divisions.name));
  return rows
    .filter((r) => mayChange(identity, "positions", { divisionId: r.id, departmentId: r.dept_id }))
    .map((r) => ({ id: r.id, name: r.name, department: r.dept_name, deptCode: r.dept_code ?? "", divCode: r.div_code ?? "" }));
}

async function readNextPositionId(): Promise<number> {
  const [row] = await getDb().select({ last: max(applyPositions.id) }).from(applyPositions);
  return (row?.last ?? 0) + 1;
}

async function positionsPage(identity: Identity): Promise<PositionsPage> {
  if (!isLead(identity)) throw new DashboardRefused("positions");
  // The head's department needs nothing of the positions, so it is read beside them (issue #397).
  const [positions, divisionChoices, nextId, department] = await Promise.all([
    readPositionRows(identity, new Date()),
    readPostableDivisions(identity),
    readNextPositionId(),
    identity.kind === "operations-lead" ? null : readDepartmentUnit(identity),
  ]);
  const newPosition = { divisions: divisionChoices, nextId };
  if (identity.kind === "operations-lead") return { scope: "team", positions, newPosition };
  if (department !== null) return { scope: "department", department, positions, newPosition };
  return { scope: "division", division: identity.role?.divisionName ?? null, positions, newPosition };
}

/** A department head's department as the recruitment pages name it, with its division tabs (issue #230). */
async function readDepartmentUnit(identity: Identity): Promise<DepartmentUnit | null> {
  const department = await readHeadDepartment(identity);
  return department === null ? null : { name: department.name, divisions: department.divisions };
}

async function applicationsScope(identity: Identity): Promise<ApplicationsScope> {
  if (identity.kind === "operations-lead") return { kind: "team" };
  const department = await readDepartmentUnit(identity);
  if (department !== null) return { kind: "department", department };
  return { kind: "division", division: identity.role?.divisionName ?? null };
}

async function setPositionOpen(identity: Identity, positionId: number, open: boolean): Promise<void> {
  if (!(await mayChangePosition(identity, "positions", positionId))) throw new DashboardRefused(`position ${positionId}`);
  await runAuditQuery((db) => db.update(applyPositions).set({ status: open }).where(eq(applyPositions.id, positionId)));
  refreshAfter("positions", updateTag);
}

async function createPosition(identity: Identity, input: unknown): Promise<WriteResult<CreatedPosition>> {
  const division = (await readPostableDivisions(identity)).find(
    (d) => d.id === (input as { divisionId?: unknown } | null)?.divisionId,
  );
  if (!division) throw new DashboardRefused("a position in that division");
  const checked = checkNewPosition(input);
  if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
  const { position } = checked;
  const [row] = await runAuditQuery((db) =>
    db
      .insert(applyPositions)
      .values({
        status: position.open,
        divisionId: division.id,
        title: position.title,
        description: position.description,
        requiredSkills: [...position.required],
        desirableSkills: [...position.desirable],
        customQuestions: [...position.questions],
        requiresMotivationLetter: position.motivationLetter,
      })
      .returning({ id: applyPositions.id }),
  );
  refreshAfter("positions", updateTag);
  return written({ id: row.id, code: newPositionCode(division, row.id) });
}

async function editPosition(identity: Identity, positionId: number, input: unknown): Promise<WriteResult<null>> {
  if (!(await mayChangePosition(identity, "positions", positionId))) throw new DashboardRefused(`position ${positionId}`);
  const checked = checkPositionContent(input);
  if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
  const { position } = checked;
  await runAuditQuery((db) =>
    db
      .update(applyPositions)
      .set({
        title: position.title,
        description: position.description,
        requiredSkills: [...position.required],
        desirableSkills: [...position.desirable],
        customQuestions: [...position.questions],
        requiresMotivationLetter: position.motivationLetter,
      })
      .where(eq(applyPositions.id, positionId)),
  );
  refreshAfter("positions", updateTag);
  return written(null);
}

// Applications ----------------------------------------------------------------

/** Where a stored application stands (./stored-application.ts). */
const stateOf = storedApplicationState;

/** The stored interview times of the given applications, by application. */
export async function readSlots(applicationIds: readonly number[]): Promise<Map<number, SlotRow[]>> {
  const bySlot = new Map<number, SlotRow[]>();
  if (applicationIds.length === 0) return bySlot;
  const rows = await getDb()
    .select({
      application_id: interviewSlots.applicationId,
      starts_at: interviewSlots.startsAt,
      ends_at: interviewSlots.endsAt,
      chosen: interviewSlots.chosen,
      chosen_at: interviewSlots.chosenAt,
      created_at: interviewSlots.createdAt,
    })
    .from(interviewSlots)
    .where(inArray(interviewSlots.applicationId, [...applicationIds]));
  for (const row of rows) bySlot.set(row.application_id, [...(bySlot.get(row.application_id) ?? []), row]);
  return bySlot;
}

/** Each applicant's applications to other roles, anywhere on the team, newest first. */
async function readOtherApplications(
  rows: readonly { id: number; user_id: string | null }[],
): Promise<Map<number, OtherApplication[]>> {
  const others = new Map<number, OtherApplication[]>();
  const userIds = [...new Set(rows.flatMap((r) => (r.user_id === null ? [] : [r.user_id])))];
  if (userIds.length === 0) return others;
  const all = await getDb()
    .select({
      id: applications.id,
      user_id: applications.userId,
      status: applications.status,
      applied_at: applications.appliedAt,
      accepted_at: applications.acceptedAt,
      nda_arrived_at: applications.ndaArrivedAt,
      joined_at: applications.joinedAt,
      title: applyPositions.title,
      division_name: divisions.name,
      dept_name: departments.name,
    })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    // A withdrawn application leaves every lead's view at once (issue #169).
    .where(and(inArray(applications.userId, userIds), eq(applyPositions.isDeleted, false), isNull(applications.withdrawnAt)))
    .orderBy(desc(applications.appliedAt));
  const slots = await readSlots(all.filter((a) => a.status === "interview").map((a) => a.id));
  for (const row of rows) {
    others.set(
      row.id,
      all
        .filter((a) => a.user_id === row.user_id && a.id !== row.id)
        .map((a) => ({
          title: a.title ?? "Untitled position",
          department: a.dept_name,
          division: a.division_name,
          stage: stateOf(a, slots.get(a.id) ?? []).stage,
        })),
    );
  }
  return others;
}

function documentOf(
  applicationId: number,
  kind: DocumentKind,
  file: { id: number | null; name: string | null; size: number | null },
  storedName: string | null,
): ApplicationDocument[] {
  const name = file.name ?? storedName;
  if (name === null) return [];
  return [
    {
      kind,
      name,
      size: file.size === null ? null : fileSize(file.size),
      // A stored file opens through the document route, which checks the reader again (issue #406).
      href: file.id === null ? null : documentHref(applicationId, kind),
    },
  ];
}

function answersOf(raw: unknown[] | null): ApplicationEntry["answers"] {
  return (raw ?? []).flatMap((a) => {
    if (typeof a !== "object" || a === null) return [];
    const { question, answer } = a as { question?: unknown; answer?: unknown };
    return typeof question === "string" && typeof answer === "string" ? [{ question, answer }] : [];
  });
}

async function applicationsPage(identity: Identity): Promise<ApplicationsPage> {
  if (!isLead(identity)) throw new DashboardRefused("applications");
  const now = new Date();
  const [positions, scope] = await Promise.all([readPositionRows(identity, now), applicationsScope(identity)]);
  if (positions.length === 0) return { scope, now: now.toISOString(), positions: [], applications: [] };

  const db = getDb();
  const cvFiles = alias(applicationFiles, "cv_files");
  const letterFiles = alias(applicationFiles, "letter_files");
  const rows = await db
    .select({
      id: applications.id,
      user_id: applications.userId,
      position_id: applications.applyPositionId,
      applied_at: applications.appliedAt,
      status: applications.status,
      accepted_at: applications.acceptedAt,
      nda_arrived_at: applications.ndaArrivedAt,
      joined_at: applications.joinedAt,
      answers: applications.customAnswers,
      cv_name: applications.cvName,
      letter_name: applications.mlName,
      email: users.email,
      first_name: users.firstName,
      last_name: users.lastName,
      phone: users.phone,
      polito_id: users.politoId,
      year: users.levelOfStudy,
      degree: users.program,
      birth_date: users.dateOfBirth,
      gender: users.gender,
      country: users.country,
      origin: users.origin,
      linkedin: users.linkedin,
      referral: users.referralSource,
      cv_file_id: cvFiles.id,
      cv_file_name: cvFiles.originalFilename,
      cv_file_size: cvFiles.fileSize,
      letter_file_id: letterFiles.id,
      letter_file_name: letterFiles.originalFilename,
      letter_file_size: letterFiles.fileSize,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    .leftJoin(cvFiles, eq(applications.cvFileId, cvFiles.id))
    .leftJoin(letterFiles, eq(applications.coverLetterFileId, letterFiles.id))
    // A withdrawn application leaves the lead's list at once (issue #169).
    .where(and(inArray(applications.applyPositionId, positions.map((p) => p.id)), isNull(applications.withdrawnAt)))
    .orderBy(desc(applications.appliedAt), desc(applications.id));

  const [slots, others, standings] = await Promise.all([
    readSlots(rows.filter((r) => r.status === "interview").map((r) => r.id)),
    readOtherApplications(rows),
    readStandings(rows.map((r) => r.id)),
  ]);
  const byId = new Map(positions.map((p) => [p.id, p]));
  return {
    scope,
    now: now.toISOString(),
    positions: positions.map((p) => ({ ref: p.ref, title: p.title, division: p.division, department: p.department })),
    applications: rows.flatMap((r): ApplicationEntry[] => {
      const position = r.position_id === null ? undefined : byId.get(r.position_id);
      if (!position) return [];
      return [
        {
          id: r.id,
          state: stateOf(r, slots.get(r.id) ?? []),
          applicant: {
            name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
            email: r.email,
            phone: r.phone,
            politoId: r.polito_id,
            year: r.year,
            degree: r.degree,
            birthDate: r.birth_date,
            gender: r.gender,
            country: r.country,
            origin: r.origin,
            linkedin: r.linkedin,
            referral: r.referral,
          },
          standing: standings.get(r.id) ?? NEW_APPLICANT,
          position: { ref: position.ref, title: position.title, division: position.division },
          applied: appliedLabels(new Date(r.applied_at), now),
          documents: [
            ...documentOf(r.id, "cv", { id: r.cv_file_id, name: r.cv_file_name, size: r.cv_file_size }, r.cv_name),
            ...documentOf(
              r.id,
              "motivation-letter",
              { id: r.letter_file_id, name: r.letter_file_name, size: r.letter_file_size },
              r.letter_name,
            ),
          ],
          answers: answersOf(r.answers),
          otherApplications: others.get(r.id) ?? [],
        },
      ];
    }),
  };
}

/**
 * One document of an application, for the document route (issue #406): only
 * for a viewer whose Applications page lists the application
 * (`mayOpenApplication`, ./application-documents.ts), else DashboardRefused.
 * Null when no file is stored for it, or its stored pathname is not in the
 * private store.
 */
async function applicationDocument(identity: Identity, applicationId: number, kind: DocumentKind): Promise<StoredDocument | null> {
  if (!isLead(identity)) throw new DashboardRefused(`application ${applicationId}`);
  const [row] = await getDb()
    .select({
      division_id: divisions.id,
      dept_id: departments.id,
      withdrawn_at: applications.withdrawnAt,
      pathname: applicationFiles.pathname,
      name: applicationFiles.originalFilename,
    })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .leftJoin(applicationFiles, eq(applicationFiles.id, kind === "cv" ? applications.cvFileId : applications.coverLetterFileId))
    .where(and(eq(applications.id, applicationId), eq(applyPositions.isDeleted, false), isNull(divisions.closedAt), isNull(departments.closedAt)))
    .limit(1);
  const place = row ? { unit: { divisionId: row.division_id, departmentId: row.dept_id }, withdrawn: row.withdrawn_at !== null } : null;
  if (!mayOpenApplication(identity, place)) throw new DashboardRefused(`application ${applicationId}`);
  const pathname = row?.pathname ? parsePrivatePathname(row.pathname) : null;
  return pathname === null || !row?.name ? null : { pathname, name: row.name };
}

/** The application as the move reads it, once the viewer is shown to reach it. */
async function readApplicationFor(identity: Identity, applicationId: number) {
  const [row] = await getDb()
    .select({
      id: applications.id,
      position_id: applications.applyPositionId,
      status: applications.status,
      applied_at: applications.appliedAt,
      accepted_at: applications.acceptedAt,
      nda_arrived_at: applications.ndaArrivedAt,
      joined_at: applications.joinedAt,
    })
    .from(applications)
    .where(and(eq(applications.id, applicationId), isNull(applications.withdrawnAt)))
    .limit(1);
  if (!row || row.position_id === null || !(await mayChangePosition(identity, "applications", row.position_id))) {
    throw new DashboardRefused(`application ${applicationId}`);
  }
  return row;
}

const statusFor: Readonly<Record<Exclude<ApplicationState["stage"], "withdrawn">, DbStatus>> = {
  new: "received",
  "in-review": "pending",
  interview: "interview",
  accepted: "accepted",
  joined: "joined",
  rejected: "rejected",
};

export async function moveApplication(identity: Identity, applicationId: number, move: LeadMove): Promise<WriteResult<null>> {
  const row = await readApplicationFor(identity, applicationId);
  const [slots, standings] = await Promise.all([readSlots([row.id]), readStandings([row.id])]);
  const before = stateOf(row, slots.get(row.id) ?? []);
  const standing = standings.get(row.id) ?? NEW_APPLICANT;
  const now = new Date();
  const result = applyMove(before, move, now, standing);
  if (!result.ok) return refused(result.reason);
  // A move that changes nothing writes nothing: "open" on an interview keeps its times and booking.
  if (!result.changed) return written(null);
  const after = result.state;
  // Every write is guarded on the status it was read in, so two leads acting at once do not both land.
  const unchanged = and(eq(applications.id, row.id), eq(applications.status, row.status), isNull(applications.withdrawnAt));

  switch (after.stage) {
    case "withdrawn":
      // Withdrawing is the applicant's (issue #169), never a lead move.
      return refused("Only the applicant can withdraw an application.");

    case "interview":
      return (await offerSlots(row.id, row.status, after.offered)) ? written(null) : refused(APPLICATION_CHANGED);

    case "accepted": {
      const changed = await runAuditQuery((db) =>
        db
          .update(applications)
          .set({
            status: "accepted",
            acceptedAt: after.acceptedAt,
            rejectedAt: null,
            ndaArrivedAt: after.ndaArrived ? (row.nda_arrived_at ?? now.toISOString()) : null,
          })
          .where(unchanged)
          .returning({ id: applications.id }),
      );
      return changed.length === 0 ? refused(APPLICATION_CHANGED) : written(null);
    }

    case "joined": {
      if (!result.joinsTeam) return refused("That move does not add anyone to the team.");
      const change = joinChange(standing);
      if (!(await confirmJoin(identity, row.id, after.joinedAt, change))) return refused(APPLICATION_CHANGED);
      refreshAfter("team", updateTag);
      return written(null);
    }

    case "new":
    case "in-review":
    case "rejected": {
      // Reject records when it was decided, the time the applicant's pages
      // count a month from (issue #317); moving it back clears it.
      const rejectedAt = after.stage === "rejected" ? now.toISOString() : null;
      const changed = await runAuditQuery((db) =>
        db.update(applications).set({ status: statusFor[after.stage], rejectedAt }).where(unchanged).returning({ id: applications.id }),
      );
      return changed.length === 0 ? refused(APPLICATION_CHANGED) : written(null);
    }
  }
}

/** A guarded application write that changed no row: another lead or the applicant moved it first. */
const APPLICATION_CHANGED = "This application changed. Reload the page.";

/**
 * Move to interview (58c) and Change times (58d): the application moves to
 * Interview and its offered times replace the old ones, in one statement and
 * only while it is still in the status it was read in and not withdrawn. The
 * slots are cleared and written only for the row the status update matched,
 * so a move another lead beat changes no slot. True when the move landed.
 */
async function offerSlots(applicationId: number, readStatus: DbStatus, offered: OfferedSlots): Promise<boolean> {
  const times = sql.join(
    offered.map((s) => sql`(${s.start}::timestamptz, ${s.end}::timestamptz)`),
    sql`, `,
  );
  const [result] = await runAuditBatch((db) => [
    db.execute(sql`
      with moved as (
        update ${applications} set status = 'interview'
        where id = ${applicationId} and status = ${readStatus} and withdrawn_at is null
        returning id
      ),
      cleared as (
        delete from ${interviewSlots} where application_id in (select id from moved)
      ),
      added as (
        insert into ${interviewSlots} (application_id, starts_at, ends_at)
        select moved.id, offered.starts_at, offered.ends_at
        from moved cross join (values ${times}) as offered (starts_at, ends_at)
      )
      select id from moved
    `),
  ]);
  return result.rows.length > 0;
}

/**
 * Where each application's applicant stands with the team: no member row, a
 * member row with no active role, or active roles, read as memberships
 * (`membershipsOfRoles`, ./team.ts) with their divisions' names and the year
 * of their NDA.
 */
async function readStandings(applicationIds: readonly number[]): Promise<Map<number, ApplicantStanding>> {
  const standings = new Map<number, ApplicantStanding>();
  if (applicationIds.length === 0) return standings;
  const db = getDb();
  const applicants = await db
    .select({ id: applications.id, member_id: users.member, division_id: applyPositions.divisionId, nda_signed_at: members.ndaSignedAt })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .innerJoin(applyPositions, eq(applyPositions.id, applications.applyPositionId))
    .leftJoin(members, eq(members.memberId, users.member))
    .where(inArray(applications.id, [...applicationIds]));
  const memberIds = [...new Set(applicants.flatMap((a) => (a.member_id === null ? [] : [a.member_id])))];
  const active =
    memberIds.length === 0
      ? []
      : await db
          .select({
            member_id: roles.memberId,
            type: roles.type,
            started_at: roles.startedAt,
            division_id: roles.divisionId,
            division_name: divisions.name,
          })
          .from(roles)
          .leftJoin(divisions, eq(divisions.id, roles.divisionId))
          .where(and(inArray(roles.memberId, memberIds), isNull(roles.leavedAt)));
  for (const a of applicants) {
    const theirs = active.filter((r) => r.member_id === a.member_id);
    if (a.member_id === null) standings.set(a.id, NEW_APPLICANT);
    else if (theirs.length === 0) standings.set(a.id, { kind: "alumnus" });
    else {
      const memberships = membershipsOfRoles(theirs.map((r) => ({ type: r.type, divisionId: r.division_id, since: r.started_at })));
      const nameOf = (divisionId: number) => theirs.find((r) => r.division_id === divisionId)?.division_name;
      const ndaYear = a.nda_signed_at === null ? null : new Date(a.nda_signed_at).getUTCFullYear();
      standings.set(a.id, memberStanding(memberships, nameOf, a.division_id ?? -1, ndaYear));
    }
  }
  return standings;
}

/**
 * Confirm join (58h and 58h2, and the Members page's banner, 59): the one
 * write that adds a person to the team, doing what `joinChange`
 * (./application-flow.ts) decided. In one statement, and only while the
 * application is still accepted with the NDA arrived, or the applicant is on
 * the team already and so signed the team's one NDA: a new `members` row (the
 * NDA date, the name and the confirming lead on it) linked from their `users`
 * row for a new person, a member role titled with the position in its
 * division unless they already hold an active role in that division, then the
 * application marked joined. A member keeps every other role they hold and no
 * NDA date is written for them (issue #229). The guards are repeated in the
 * statement so a person who joined the division meanwhile still gets no
 * second role in it. Their other applications are not touched. True when the
 * application was marked joined.
 */
async function confirmJoin(identity: Identity, applicationId: number, joinedAt: string, change: JoinChange): Promise<boolean> {
  const addMember = change === "new-member";
  const addRole = change !== "nothing";
  const result = await runAuditQuery((db) =>
    db.execute(sql`
      with app as (
        select a.user_id, u.member as member_id, p.division_id, d.dept_id, p.title, a.nda_arrived_at,
          coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), u.email) as name
        from ${applications} a
        join ${users} u on u.id = a.user_id
        join ${applyPositions} p on p.id = a.apply_position_id
        join ${divisions} d on d.id = p.division_id
        where a.id = ${applicationId} and a.status = 'accepted' and a.withdrawn_at is null
          and (
            a.nda_arrived_at is not null
            or exists (select 1 from ${roles} r where r.member_id = u.member and r.leaved_at is null)
          )
      ),
      new_member as (
        insert into ${members} (nda_signed_at, nda_name, nda_confirmed_by)
        select app.nda_arrived_at, app.name, ${identity.memberId} from app where ${addMember}::boolean and app.member_id is null
        returning member_id
      ),
      linked as (
        update ${users} set member = (select member_id from new_member)
        where id = (select user_id from app) and exists (select 1 from new_member)
        returning id
      ),
      the_member as (
        select member_id from new_member
        union all
        select member_id from app where member_id is not null
      ),
      new_role as (
        insert into ${roles} (member_id, dept_id, division_id, title, type)
        select (select member_id from the_member limit 1), app.dept_id, app.division_id, coalesce(app.title, 'Member'), 'core'
        from app
        where ${addRole}::boolean
          and exists (select 1 from the_member)
          and not exists (
            select 1 from ${roles} r where r.member_id = app.member_id and r.division_id = app.division_id and r.leaved_at is null
          )
        returning id
      )
      update ${applications} set status = 'joined', joined_at = ${joinedAt}
      where id = ${applicationId} and exists (select 1 from the_member)
      returning id
    `),
  );
  return result.rows.length > 0;
}

export function databaseRecruitmentPages(identity: Identity) {
  return {
    positions: () => positionsPage(identity),
    applications: () => applicationsPage(identity),
    applicationDocument: (id: number, kind: DocumentKind) => applicationDocument(identity, id, kind),
    setPositionOpen: (id: number, open: boolean) => setPositionOpen(identity, id, open),
    createPosition: (input: unknown) => createPosition(identity, input),
    editPosition: (id: number, input: unknown) => editPosition(identity, id, input),
    moveApplication: (id: number, move: LeadMove) => moveApplication(identity, id, move),
  };
}
