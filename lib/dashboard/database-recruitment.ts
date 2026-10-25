import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, max, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { refreshAfter } from "@/lib/cache-tags";
import {
  applicationFiles,
  applications,
  applicationStatuses,
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
  OPEN_STATUSES,
  type ApplicantStanding,
  type AddedPick,
  type ApproverMove,
  type JoinChange,
  type SlotTime,
} from "./application-flow";
import {
  addedStatusKey,
  deleteRefusal,
  isBuiltInStatusKey,
  managesStatusList,
  maySetStatus,
  statusListOf,
  statusOfStored,
  TEAM_LEADER_ONLY_REFUSAL,
  type BuiltInStatusKey,
  type ListedStatus,
  type StatusListChange,
  type StatusSetterViewer,
} from "./application-status";
import { membershipsOfRoles } from "./team";
import { DashboardRefused } from "./data";
import type { DashboardIdentity } from "./database";
import { readHeadDepartment } from "./database-division";
import { positionCode } from "@/lib/apply/positions";
import type { SlotRow } from "./interview-slots";
import { readsAsNew, statusKeyAfter, storedApplicationState, type StoredApplicationRow } from "./stored-application";
import { checkNewPosition, checkPositionContent, newPositionCode, type CreatedPosition, type DivisionChoice } from "./new-position";
import {
  ago,
  appliedLabels,
  fileSize,
  grantReachOf,
  quietDays,
  quietNote,
  type ApplicationDocument,
  type ApplicationEntry,
  type ApplicationsPage,
  type ApplicationsScope,
  type DepartmentUnit,
  type GrantReach,
  type OtherApplication,
  type PositionRow,
  type PositionsPage,
} from "./recruitment";
import { isTeamLeader, mayChange, type DivisionUnit } from "./viewer";
import { mayChangePositionIn } from "./position-access";
import {
  documentHref,
  managesRecruitment,
  mayOpenApplication,
  readsRecruitment,
  readsRecruitmentIn,
  type DocumentKind,
  type RecruitmentArea,
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

/**
 * The positions the viewer reads in `area`, with what the table shows for
 * each: the Positions page reads them in the Positions area, the
 * Applications page in the Applications area (issue #471). A row's
 * application counts are Applications data: they come only where the viewer
 * reads Applications, so a Positions grant alone gets none (issue #477).
 * Each row keeps the unit it sits in, for the Applications page's change
 * rule (issue #577); `rowOf` drops it before a page carries the row.
 */
async function readPositionRows(identity: Identity, area: RecruitmentArea, now: Date): Promise<ReadPosition[]> {
  const db = getDb();
  // The tallies are read for every position, beside the positions rather than
  // after them, and picked per row below: one round trip, not two (issue #397).
  // Someone who reads Applications nowhere gets no tally read at all.
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
    readsRecruitment(identity, "applications")
      ? db
          .select({ position_id: applications.applyPositionId, ...STATUS_COLUMNS, n: count(), last: max(applications.appliedAt) })
          .from(applications)
          .leftJoin(applicationStatuses, STATUS_JOIN)
          .where(isNull(applications.withdrawnAt))
          .groupBy(applications.applyPositionId, applications.statusKey, applicationStatuses.parentKey)
      : [],
  ]);
  // The same rule the document route checks (`readsRecruitmentIn`, ./application-documents.ts).
  const scoped = rows.filter((r) => readsRecruitmentIn(identity, area, { divisionId: r.division_id, departmentId: r.dept_id }));
  if (scoped.length === 0) return [];

  return scoped.map((r) => {
    const created = new Date(r.created_at);
    const unit = { divisionId: r.division_id, departmentId: r.dept_id };
    const tallied = readsRecruitmentIn(identity, "applications", unit);
    const own = tallies.filter((t) => t.position_id === r.id);
    const latest = own.reduce<string | null>((at, t) => (t.last !== null && (at === null || t.last > at) ? t.last : at), null);
    return {
      unit,
      id: r.id,
      ref: String(r.id),
      title: r.title ?? "Untitled position",
      division: r.division_name,
      department: r.dept_name,
      open: r.status,
      applications: tallied
        ? {
            total: own.reduce((sum, t) => sum + t.n, 0),
            fresh: own.filter(readsAsNew).reduce((sum, t) => sum + t.n, 0),
            quiet: quietNote(quietDays(r.status, latest === null ? created : new Date(latest), now)),
          }
        : null,
      // The rule the open switch's write asks (`setPositionOpen`), so the page never offers what the server refuses (issue #487).
      canChange: mayChangePositionIn(identity, "positions", unit),
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

/** A position as `readPositionRows` reads it: its row, and the unit it sits in. */
type ReadPosition = PositionRow & { readonly unit: DivisionUnit };

/** The row a page carries, without the unit it was read with. */
function rowOf({ unit: _unit, ...row }: ReadPosition): PositionRow {
  return row;
}

/**
 * The open divisions a viewer may post a role in: every one for the operations
 * lead, else those their role or a Positions grant at Can edit lets them
 * change (`mayChange`, issue #160).
 */
async function readPostableDivisions(identity: Identity): Promise<DivisionChoice[]> {
  if (!readsRecruitment(identity, "positions")) return [];
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
  if (!readsRecruitment(identity, "positions")) throw new DashboardRefused("positions");
  // The head's department needs nothing of the positions, so it is read beside them (issue #397).
  const [positions, divisionChoices, nextId, department, reach] = await Promise.all([
    readPositionRows(identity, "positions", new Date()),
    readPostableDivisions(identity),
    readNextPositionId(),
    identity.kind === "operations-lead" ? null : readDepartmentUnit(identity),
    identity.kind === "member" ? readGrantReach(identity, "positions") : null,
  ]);
  const shared = {
    positions: positions.map(rowOf),
    newPosition: { divisions: divisionChoices, nextId },
    readsApplications: readsRecruitment(identity, "applications"),
  };
  if (identity.kind === "operations-lead") return { scope: "team", ...shared };
  if (department !== null) return { scope: "department", department, ...shared };
  if (reach !== null) return { scope: "granted", reach, ...shared };
  return { scope: "division", division: identity.role?.divisionName ?? null, ...shared };
}

/** What a member's grants on `area` cover (`grantReachOf`, issues #487, #577), named from the open departments and divisions. */
async function readGrantReach(identity: Identity, area: "positions" | "applications"): Promise<GrantReach | null> {
  const db = getDb();
  const [openDepartments, openDivisions] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).where(isNull(departments.closedAt)),
    db
      .select({ id: divisions.id, name: divisions.name })
      .from(divisions)
      .innerJoin(departments, eq(divisions.deptId, departments.id))
      .where(and(isNull(divisions.closedAt), isNull(departments.closedAt))),
  ]);
  return grantReachOf(identity, area, { departments: openDepartments, divisions: openDivisions });
}

/** A department head's department as the recruitment pages name it, with its division tabs (issue #230). */
async function readDepartmentUnit(identity: Identity): Promise<DepartmentUnit | null> {
  const department = await readHeadDepartment(identity);
  return department === null ? null : { name: department.name, divisions: department.divisions };
}

async function applicationsScope(identity: Identity): Promise<ApplicationsScope> {
  // The recruitment manager reads every division's applications, as full access does (issue #194).
  if (identity.kind === "operations-lead" || managesRecruitment(identity)) return { kind: "team" };
  const [department, reach] = await Promise.all([
    readDepartmentUnit(identity),
    identity.kind === "member" ? readGrantReach(identity, "applications") : null,
  ]);
  if (department !== null) return { kind: "department", department };
  // A member reads Applications by a grant: the page names what it covers, never their own division (issue #577).
  if (reach !== null) return { kind: "granted", reach };
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

/**
 * The status columns `stateOf` reads, for a select that left-joins
 * `application_statuses` on the application's status reference
 * (`STATUS_JOIN`): the status's key and its parent's (issue #748).
 */
export const STATUS_COLUMNS = {
  status_key: applications.statusKey,
  status_parent_key: applicationStatuses.parentKey,
} as const;

/** The join that reads an application's status row beside it; no reference joins nothing and reads as New. */
export const STATUS_JOIN = eq(applicationStatuses.key, applications.statusKey);

/** The statuses that behave like Interview: the built-in one and every status added under it. */
function interviewStatuses() {
  return getDb()
    .select({ key: applicationStatuses.key })
    .from(applicationStatuses)
    .where(or(eq(applicationStatuses.key, "interview"), eq(applicationStatuses.parentKey, "interview")));
}

/**
 * The applications a lead's list holds, as one condition: those on the given
 * positions, without the withdrawn ones, which leave the list at once (issue
 * #169). The reads after the list name them by it rather than by the ids the
 * list returns, so they run beside the list (issue #397).
 */
function listedOn(positionIds: readonly number[]): SQL {
  return sql`${inArray(applications.applyPositionId, [...positionIds])} and ${isNull(applications.withdrawnAt)}`;
}

/** The stored interview times of the given applications, by application. */
export async function readSlots(applicationIds: readonly number[]): Promise<Map<number, SlotRow[]>> {
  if (applicationIds.length === 0) return new Map();
  return readSlotsWhere(inArray(interviewSlots.applicationId, [...applicationIds]));
}

/** The stored interview times `which` selects, by application. */
async function readSlotsWhere(which: SQL): Promise<Map<number, SlotRow[]>> {
  const bySlot = new Map<number, SlotRow[]>();
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
    .where(which);
  for (const row of rows) bySlot.set(row.application_id, [...(bySlot.get(row.application_id) ?? []), row]);
  return bySlot;
}

/**
 * Every live application, anywhere on the team, of the applicants `listed`
 * selects, and the interview times of all of them, the listed ones included:
 * what each listed application's other roles (`otherApplicationsOf`) and its
 * own state are read from. The applicants are named by the condition rather
 * than by the ids the list returns, so this runs beside the list (issue #397).
 */
async function readApplicantsApplications(listed: SQL): Promise<ApplicantsApplications> {
  const db = getDb();
  const applicants = db.select({ id: applications.userId }).from(applications).where(listed);
  // A withdrawn application leaves every lead's view at once (issue #169).
  const live = and(inArray(applications.userId, applicants), isNull(applications.withdrawnAt));
  const [all, slots] = await Promise.all([
    db
      .select({
        id: applications.id,
        user_id: applications.userId,
        ...STATUS_COLUMNS,
        applied_at: applications.appliedAt,
        accepted_at: applications.acceptedAt,
        nda_arrived_at: applications.ndaArrivedAt,
        joined_at: applications.joinedAt,
        title: applyPositions.title,
        division_name: divisions.name,
        dept_name: departments.name,
      })
      .from(applications)
      .leftJoin(applicationStatuses, STATUS_JOIN)
      .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
      .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
      .innerJoin(departments, eq(divisions.deptId, departments.id))
      .where(and(live, eq(applyPositions.isDeleted, false)))
      .orderBy(desc(applications.appliedAt)),
    readSlotsWhere(
      inArray(
        interviewSlots.applicationId,
        db.select({ id: applications.id }).from(applications).where(and(live, inArray(applications.statusKey, interviewStatuses()))),
      ),
    ),
  ]);
  return { all, slots };
}

/** What `readApplicantsApplications` read: the applicants' live applications, and the interview times by application. */
type ApplicantsApplications = {
  readonly all: readonly (StoredApplicationRow & {
    readonly id: number;
    readonly user_id: string | null;
    readonly title: string | null;
    readonly division_name: string;
    readonly dept_name: string;
  })[];
  readonly slots: ReadonlyMap<number, SlotRow[]>;
};

/** One listed application's applicant's applications to other roles, anywhere on the team, newest first. */
function otherApplicationsOf(row: { id: number; user_id: string | null }, { all, slots }: ApplicantsApplications): OtherApplication[] {
  return all
    .filter((a) => a.user_id !== null && a.user_id === row.user_id && a.id !== row.id)
    .map((a) => ({
      title: a.title ?? "Untitled position",
      department: a.dept_name,
      division: a.division_name,
      status: stateOf(a, slots.get(a.id) ?? []).status,
      listStatus: statusOfStored({ key: a.status_key, parentKey: a.status_parent_key }),
    }));
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

/** The stored status list, in the Status picker's order (board 97c, `statusListOf`). */
async function readStatusList(): Promise<ListedStatus[]> {
  const rows = await getDb()
    .select({
      key: applicationStatuses.key,
      name: applicationStatuses.name,
      colour: applicationStatuses.colour,
      sortOrder: applicationStatuses.sortOrder,
      parentKey: applicationStatuses.parentKey,
    })
    .from(applicationStatuses);
  return statusListOf(rows);
}

/**
 * How many applications use each status, by its key, anywhere on the team:
 * the counts the Statuses editor shows and the in-use rule its delete asks
 * (`deleteRefusal`). An application with no status reference counts as New.
 */
async function readStatusUses(): Promise<Record<string, number>> {
  const rows = await getDb()
    .select({ key: sql<string>`coalesce(${applications.statusKey}, 'new')`, uses: count() })
    .from(applications)
    .groupBy(sql`1`);
  return Object.fromEntries(rows.map((r) => [r.key, Number(r.uses)]));
}

/**
 * Whether the viewer manages the status list (`managesStatusList`): they may
 * move an application on at least one of the positions they read
 * Applications on, by the rule every application move asks.
 */
function managesStatuses(identity: Identity, positions: readonly ReadPosition[]): boolean {
  return managesStatusList(positions, (p) => mayChangePositionIn(identity, "applications", p.unit));
}

async function applicationsPage(identity: Identity): Promise<ApplicationsPage> {
  if (!readsRecruitment(identity, "applications")) throw new DashboardRefused("applications");
  const now = new Date();
  const [positions, scope, statuses] = await Promise.all([readPositionRows(identity, "applications", now), applicationsScope(identity), readStatusList()]);
  const { teamLeader } = setterViewerOf(identity);
  if (positions.length === 0) return { scope, now: now.toISOString(), positions: [], statuses, teamLeader, statusUses: null, applications: [] };

  const db = getDb();
  const cvFiles = alias(applicationFiles, "cv_files");
  const letterFiles = alias(applicationFiles, "letter_files");
  // The list, its applicants' other applications and interview times, and their standings, all in one round
  // trip after the positions: two round trips for the page, not four (issue #397).
  const listed = listedOn(positions.map((p) => p.id));
  const [rows, others, standings, statusUses] = await Promise.all([
    db
      .select({
        id: applications.id,
        user_id: applications.userId,
        position_id: applications.applyPositionId,
        applied_at: applications.appliedAt,
        ...STATUS_COLUMNS,
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
        picture: members.picture,
        cv_file_id: cvFiles.id,
        cv_file_name: cvFiles.originalFilename,
        cv_file_size: cvFiles.fileSize,
        letter_file_id: letterFiles.id,
        letter_file_name: letterFiles.originalFilename,
        letter_file_size: letterFiles.fileSize,
      })
      .from(applications)
      .leftJoin(applicationStatuses, STATUS_JOIN)
      .innerJoin(users, eq(applications.userId, users.id))
      // An applicant with a member record shows its stored photo (issue #656).
      .leftJoin(members, eq(members.memberId, users.member))
      .leftJoin(cvFiles, eq(applications.cvFileId, cvFiles.id))
      .leftJoin(letterFiles, eq(applications.coverLetterFileId, letterFiles.id))
      .where(listed)
      .orderBy(desc(applications.appliedAt), desc(applications.id)),
    readApplicantsApplications(listed),
    readStandings(listed),
    managesStatuses(identity, positions) ? readStatusUses() : null,
  ]);
  const { slots } = others;
  const byId = new Map(positions.map((p) => [p.id, p]));
  return {
    scope,
    now: now.toISOString(),
    positions: positions.map((p) => ({ ref: p.ref, title: p.title, division: p.division, department: p.department })),
    statuses,
    teamLeader,
    statusUses,
    applications: rows.flatMap((r): ApplicationEntry[] => {
      const position = r.position_id === null ? undefined : byId.get(r.position_id);
      if (!position) return [];
      return [
        {
          id: r.id,
          state: stateOf(r, slots.get(r.id) ?? []),
          status: statusOfStored({ key: r.status_key, parentKey: r.status_parent_key }),
          applicant: {
            name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
            photoUrl: r.picture,
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
          otherApplications: otherApplicationsOf(r, others),
          // The rule the move write asks (`moveApplication`), so the panel never offers a step the server refuses.
          canChange: mayChangePositionIn(identity, "applications", position.unit),
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
  if (!readsRecruitment(identity, "applications")) throw new DashboardRefused(`application ${applicationId}`);
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
      ...STATUS_COLUMNS,
      applied_at: applications.appliedAt,
      accepted_at: applications.acceptedAt,
      nda_arrived_at: applications.ndaArrivedAt,
      rejected_at: applications.rejectedAt,
      joined_at: applications.joinedAt,
    })
    .from(applications)
    .leftJoin(applicationStatuses, STATUS_JOIN)
    .where(and(eq(applications.id, applicationId), isNull(applications.withdrawnAt)))
    .limit(1);
  if (!row || row.position_id === null || !(await mayChangePosition(identity, "applications", row.position_id))) {
    throw new DashboardRefused(`application ${applicationId}`);
  }
  return row;
}

/** The application as `readApplicationFor` read it: its old status and its status reference. */
type ReadStatus = { readonly id: number; readonly status: DbStatus; readonly status_key: string | null };

/**
 * The application is still in the status it was read in: the old status
 * column, which every move still writes (issue #748), and the status
 * reference.
 */
function statusAsRead(row: ReadStatus): SQL | undefined {
  return and(
    eq(applications.status, row.status),
    row.status_key === null ? isNull(applications.statusKey) : eq(applications.statusKey, row.status_key),
  );
}

/** The old status column each status writes beside its status reference; it is no longer read for the state (issue #748). */
const statusFor: Readonly<Record<Exclude<BuiltInStatusKey, "withdrawn">, DbStatus>> = {
  new: "received",
  interview: "interview",
  accepted_email_to_be_sent: "accepted",
  accepted_email_sent: "accepted",
  nda_received: "accepted",
  joined: "joined",
  rejected_email_to_be_sent: "rejected",
  rejected_email_sent: "rejected",
  accepted_for_another_position: "accepted_by_another_team",
};

/**
 * One approver move: an action button, or a saved hand pick in the Status
 * picker (issue #750). Both run this one write. ./application-flow.ts says
 * whether the move is legal and which built-in status it sets, and this
 * writes that status beside what it keeps, with the effects of the step that
 * sets it; a hand pick of an added status changes the status reference alone
 * (`pickAddedStatus`).
 */
export async function moveApplication(identity: Identity, applicationId: number, move: ApproverMove): Promise<WriteResult<null>> {
  const row = await readApplicationFor(identity, applicationId);
  const setter = setterViewerOf(identity);
  if (move.kind === "pick-added") return pickAddedStatus(row, move, setter);
  const [slots, standings] = await Promise.all([readSlots([row.id]), readStandings(eq(applications.id, row.id))]);
  const before = stateOf(row, slots.get(row.id) ?? []);
  const standing = standings.get(row.id) ?? NEW_APPLICANT;
  const now = new Date();
  const result = applyMove(before, move, now);
  if (!result.ok) return refused(result.reason);
  const after = result.state;
  const statusKey = statusKeyAfter(row, after, move.kind === "pick" ? "pick" : "button");
  // A move that changes nothing writes nothing: Change times to the same times keeps the booking.
  if (!result.changed && statusKey === row.status_key) return written(null);
  // Only the team leader sets "Accepted · email sent", by Mark email sent or by a hand pick (board 97e).
  if (!maySetStatus(after.status, setter)) return refused(TEAM_LEADER_ONLY_REFUSAL);
  // Every write is guarded on the status it was read in, so two leads acting at once do not both land.
  const unchanged = and(eq(applications.id, row.id), statusAsRead(row), isNull(applications.withdrawnAt));
  const write = async (set: Partial<typeof applications.$inferInsert>) => {
    const changed = await runAuditQuery((db) => db.update(applications).set(set).where(unchanged).returning({ id: applications.id }));
    return changed.length === 0 ? refused(APPLICATION_CHANGED) : written(null);
  };

  switch (after.status) {
    case "withdrawn":
      // A hand pick of Withdrawn has the applicant's Withdraw's effect (issue #169): it leaves the lead's list.
      return write({ statusKey, withdrawnAt: now.toISOString() });

    case "accepted_for_another_position":
      // A hand pick of it writes what Confirm join writes on the person's other open applications.
      return write({ status: statusFor[after.status], statusKey, rejectedAt: now.toISOString() });

    case "interview":
      return (await offerSlots(row, statusKey, after.offered)) ? written(null) : refused(APPLICATION_CHANGED);

    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
    case "nda_received":
      return write({
        status: statusFor[after.status],
        statusKey,
        acceptedAt: after.acceptedAt,
        rejectedAt: null,
        // NDA received records the day the signed NDA arrived; Confirm join reads it.
        ndaArrivedAt: after.status === "nda_received" ? (row.nda_arrived_at ?? now.toISOString()) : null,
      });

    case "joined": {
      if (!result.joinsTeam) return refused("That move does not add anyone to the team.");
      if (!(await confirmJoin(identity, row, after.joinedAt, joinChange(standing)))) return refused(APPLICATION_CHANGED);
      refreshAfter("team", updateTag);
      return written(null);
    }

    case "new":
      // Withdraw acceptance: back to New, with nothing of the acceptance kept.
      return write({ status: statusFor.new, statusKey, acceptedAt: null, ndaArrivedAt: null, rejectedAt: null });

    case "rejected_email_to_be_sent":
      // Reject records when it was decided, the time the applicant's pages count a month from (issue #317).
      return write({ status: statusFor[after.status], statusKey, acceptedAt: null, ndaArrivedAt: null, rejectedAt: now.toISOString() });

    case "rejected_email_sent":
      // Mark email sent keeps the day it was rejected; a hand pick from a status never rejected records it now, as Reject would.
      return write({ status: statusFor[after.status], statusKey, acceptedAt: null, ndaArrivedAt: null, rejectedAt: row.rejected_at ?? now.toISOString() });
  }
}

/**
 * A saved hand pick of an added status (issue #750): the application's
 * status reference becomes that status and nothing else changes, only while
 * the key names a status added under a built-in one and the application is
 * still in the status it was read in. A status added under "Accepted · email
 * sent" is the team leader's to set, as its parent is (`maySetStatus`).
 */
async function pickAddedStatus(row: ReadStatus, pick: AddedPick, setter: StatusSetterViewer): Promise<WriteResult<null>> {
  if (pick.key === row.status_key) return written(null);
  const [added] = await getDb()
    .select({ key: applicationStatuses.key, parentKey: applicationStatuses.parentKey })
    .from(applicationStatuses)
    .where(and(eq(applicationStatuses.key, pick.key), sql`${applicationStatuses.parentKey} is not null`))
    .limit(1);
  if (!added) return refused("That status is not in the list. Reload the page.");
  if (!maySetStatus(statusOfStored({ key: added.key, parentKey: added.parentKey }), setter)) return refused(TEAM_LEADER_ONLY_REFUSAL);
  const changed = await runAuditQuery((db) =>
    db
      .update(applications)
      .set({ statusKey: added.key })
      .where(and(eq(applications.id, row.id), statusAsRead(row), isNull(applications.withdrawnAt)))
      .returning({ id: applications.id }),
  );
  return changed.length === 0 ? refused(APPLICATION_CHANGED) : written(null);
}

// The status list ---------------------------------------------------------------

/** A guarded status list write that changed no row: someone else changed the list first. */
const LIST_CHANGED = "The status list changed. Reload the page.";

/**
 * One change in the Statuses editor (board 97d, issue #752): add a status
 * under a built-in parent, rename and recolour any status, or delete an added
 * one no application uses. Only someone who may move an application manages
 * the list (`managesStatusList`), by the rule the page asks before it offers
 * the editor; anyone else is refused before anything is read or written.
 */
async function changeStatusList(identity: Identity, change: StatusListChange): Promise<WriteResult<null>> {
  if (!readsRecruitment(identity, "applications")) throw new DashboardRefused("the status list");
  if (!managesStatuses(identity, await readPositionRows(identity, "applications", new Date()))) throw new DashboardRefused("the status list");
  switch (change.kind) {
    case "add":
      return addStatus(change);
    case "edit":
      return editStatus(change);
    case "delete":
      return deleteStatus(change.key);
  }
}

/** A new status, last under its built-in parent. */
async function addStatus({ name, colour, parent }: Extract<StatusListChange, { kind: "add" }>): Promise<WriteResult<null>> {
  const key = addedStatusKey(name, randomUUID().slice(0, 8));
  const last = sql<number>`(select coalesce(max(s.sort_order), 0) + 1 from ${applicationStatuses} s where s.parent_key = ${parent})`;
  const added = await runAuditQuery((db) =>
    db.insert(applicationStatuses).values({ key, name, colour, parentKey: parent, sortOrder: last }).onConflictDoNothing().returning({ key: applicationStatuses.key }),
  );
  return added.length === 0 ? refused(LIST_CHANGED) : written(null);
}

/**
 * Rename and recolour: a built-in status and an added one alike. The write is
 * guarded on the name and colour the editor read, so of two people editing
 * one status at once the later is told the list changed instead of silently
 * undoing the earlier.
 */
async function editStatus({ key, was, name, colour }: Extract<StatusListChange, { kind: "edit" }>): Promise<WriteResult<null>> {
  const changed = await runAuditQuery((db) =>
    db
      .update(applicationStatuses)
      .set({ name, colour })
      .where(and(eq(applicationStatuses.key, key), eq(applicationStatuses.name, was.name), eq(applicationStatuses.colour, was.colour)))
      .returning({ key: applicationStatuses.key }),
  );
  return changed.length === 0 ? refused(LIST_CHANGED) : written(null);
}

/**
 * Postgres' answers when a foreign key refuses a delete: restrict_violation
 * for an `on delete restrict` key, as `applications.status_key` is, and
 * foreign_key_violation for a `no action` one.
 */
const FOREIGN_KEY_REFUSALS: ReadonlySet<unknown> = new Set(["23001", "23503"]);

function isForeignKeyRefusal(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (FOREIGN_KEY_REFUSALS.has((e as { code?: unknown }).code)) return true;
  }
  return false;
}

/**
 * Delete an added status, only while no application uses it (`deleteRefusal`).
 * The delete itself is guarded on both, so an application moved to the status
 * a moment earlier keeps it. One moved in while the delete runs is past the
 * guard's reading, and the table's foreign key refuses the delete instead:
 * that is the same in-use answer, read again below, not an error.
 */
async function deleteStatus(key: string): Promise<WriteResult<null>> {
  if (isBuiltInStatusKey(key)) return refused(deleteRefusal({ kind: "built-in", key }, 0)!);
  const deleted = await runAuditQuery((db) =>
    db
      .delete(applicationStatuses)
      .where(
        and(
          eq(applicationStatuses.key, key),
          isNotNull(applicationStatuses.parentKey),
          sql`not exists (select 1 from ${applications} a where a.status_key = ${key})`,
        ),
      )
      .returning({ key: applicationStatuses.key }),
  ).catch((error: unknown) => {
    if (isForeignKeyRefusal(error)) return [];
    throw error;
  });
  if (deleted.length > 0) return written(null);
  const [row] = await getDb().select({ parentKey: applicationStatuses.parentKey }).from(applicationStatuses).where(eq(applicationStatuses.key, key)).limit(1);
  if (!row) return refused(LIST_CHANGED);
  const [{ uses }] = await getDb().select({ uses: count() }).from(applications).where(eq(applications.statusKey, key));
  const status = statusOfStored({ key, parentKey: row.parentKey });
  return refused(deleteRefusal(status, Number(uses)) ?? LIST_CHANGED);
}

/** The viewer as the status list's team-leader rule reads them (`maySetStatus`, ./application-status.ts). */
function setterViewerOf(identity: Identity): StatusSetterViewer {
  return { teamLeader: isTeamLeader(identity) };
}

/** A guarded application write that changed no row: another lead or the applicant moved it first. */
const APPLICATION_CHANGED = "This application changed. Reload the page.";

/**
 * Move to interview (58c) and Change times (58d): the application moves to
 * Interview and its offered times replace the old ones, in one statement and
 * only while it is still in the status it was read in and not withdrawn. The
 * slots are cleared and written only for the row the status update matched,
 * so a move another lead beat changes no slot. An application at Interview is
 * not decided, so no decision day is kept: a hand pick of Interview from a
 * decided status clears them (issue #750). True when the move landed.
 */
async function offerSlots(read: ReadStatus, statusKey: string, offered: readonly SlotTime[]): Promise<boolean> {
  if (offered.length === 0) return false;
  const times = sql.join(
    offered.map((s) => sql`(${s.start}::timestamptz, ${s.end}::timestamptz)`),
    sql`, `,
  );
  const [result] = await runAuditBatch((db) => [
    db.execute(sql`
      with moved as (
        update ${applications}
        set status = 'interview', status_key = ${statusKey}, accepted_at = null, nda_arrived_at = null, rejected_at = null
        where id = ${read.id} and status = ${read.status}
          and status_key is not distinct from ${read.status_key}::text and withdrawn_at is null
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
 * of their NDA. `which` selects the applications; their applicants' roles are
 * read by the same condition, beside them rather than after them (issue #397).
 */
async function readStandings(which: SQL): Promise<Map<number, ApplicantStanding>> {
  const standings = new Map<number, ApplicantStanding>();
  const db = getDb();
  const applicantMembers = db
    .select({ id: users.member })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .where(which);
  const [applicants, active] = await Promise.all([
    db
      .select({ id: applications.id, member_id: users.member, division_id: applyPositions.divisionId, nda_signed_at: members.ndaSignedAt })
      .from(applications)
      .innerJoin(users, eq(users.id, applications.userId))
      .innerJoin(applyPositions, eq(applyPositions.id, applications.applyPositionId))
      .leftJoin(members, eq(members.memberId, users.member))
      .where(which),
    db
      .select({
        member_id: roles.memberId,
        type: roles.type,
        started_at: roles.startedAt,
        division_id: roles.divisionId,
        division_name: divisions.name,
      })
      .from(roles)
      .leftJoin(divisions, eq(divisions.id, roles.divisionId))
      .where(and(inArray(roles.memberId, applicantMembers), isNull(roles.leavedAt))),
  ]);
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
 * application is still in the status it was read in (NDA received, or a
 * status added under it) with the signed NDA's day recorded, whoever the
 * applicant is (ADR 0014, amendment of 2026-10-25): a new `members` row (the
 * NDA date, the name and the confirming lead on it) linked from their `users`
 * row for a new person, a member role titled with the position in its
 * division unless they already hold an active role in that division, then the
 * application marked joined. A member keeps every other role they hold and no
 * NDA date is written for them (issue #229). The guards are repeated in the
 * statement so a person who joined the division meanwhile still gets no
 * second role in it. The person's other open applications (their status
 * behaves like one of `OPEN_STATUSES`, ./application-flow.ts, or they have no
 * status reference, which reads as New) are set to "Accepted for another
 * position", with the join's day as their decision day; their decided and
 * withdrawn ones keep their status (issue #749). True when the application
 * was marked joined.
 */
async function confirmJoin(identity: Identity, read: ReadStatus, joinedAt: string, change: JoinChange): Promise<boolean> {
  const addMember = change === "new-member";
  const addRole = change !== "nothing";
  const open = sql.join(
    OPEN_STATUSES.map((key) => sql`${key}`),
    sql`, `,
  );
  const result = await runAuditQuery((db) =>
    db.execute(sql`
      with app as (
        select a.user_id, u.member as member_id, p.division_id, d.dept_id, p.title, a.nda_arrived_at,
          coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), u.email) as name
        from ${applications} a
        join ${users} u on u.id = a.user_id
        join ${applyPositions} p on p.id = a.apply_position_id
        join ${divisions} d on d.id = p.division_id
        where a.id = ${read.id} and a.status = ${read.status}
          and a.status_key is not distinct from ${read.status_key}::text
          and a.withdrawn_at is null and a.nda_arrived_at is not null
      ),
      new_member as (
        insert into ${members} (nda_signed_at, nda_name, nda_confirmed_by, nda_confirmed_by_acting_account)
        select app.nda_arrived_at, app.name, ${identity.memberId}::int, ${identity.actingAccountId}::text from app where ${addMember}::boolean and app.member_id is null
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
      ),
      taken_elsewhere as (
        update ${applications} other
        set status = 'accepted_by_another_team', status_key = 'accepted_for_another_position', rejected_at = ${joinedAt}
        where other.user_id = (select user_id from app) and other.id <> ${read.id}
          and other.withdrawn_at is null
          and exists (select 1 from the_member)
          and (
            other.status_key is null
            or other.status_key in (${open})
            or exists (select 1 from ${applicationStatuses} s where s.key = other.status_key and s.parent_key in (${open}))
          )
        returning other.id
      )
      update ${applications} set status = 'joined', status_key = 'joined', joined_at = ${joinedAt}
      where id = ${read.id} and exists (select 1 from the_member)
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
    moveApplication: (id: number, move: ApproverMove) => moveApplication(identity, id, move),
    changeStatusList: (change: StatusListChange) => changeStatusList(identity, change),
  };
}
