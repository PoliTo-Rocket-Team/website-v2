import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { updateTag } from "next/cache";
import { POSITIONS_CACHE_TAG, PUBLIC_POSITIONS_CACHE_TAG } from "@/app/actions/get-apply-positions";
import { getDb } from "@/db/client";
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
  type ApplicationState,
  type JoinChange,
  type LeadMove,
  type Membership,
  type OfferedSlots,
} from "./application-flow";
import { DashboardRefused } from "./data";
import type { DashboardIdentity } from "./database";
import { interviewStateOf, type SlotRow } from "./interview-slots";
import { checkNewPosition, newPositionCode, type CreatedPosition, type DivisionChoice } from "./new-position";
import {
  ago,
  appliedLabels,
  fileSize,
  quietDays,
  quietNote,
  type ApplicationDocument,
  type ApplicationEntry,
  type ApplicationsPage,
  type OtherApplication,
  type PositionRow,
  type PositionsPage,
} from "./recruitment";
import { TEAM_ROSTER_CACHE_TAG } from "./team-database";
import { refused, written, type WriteResult } from "./write";

// The Positions and Applications pages read from and written to the database
// (boards 57 and 58, issue #171, after #142). Reads follow
// .patterns/drizzle-reads.md; writes follow .patterns/audited-mutations.md:
// each checks the viewer reaches the position or application, asks
// ./application-flow.ts whether the move is legal, then writes through
// runAuditQuery or runAuditBatch. Only Confirm join touches the team tables.

type Identity = DashboardIdentity;
type DbStatus = (typeof applications.$inferSelect)["status"];

function isLead(identity: Identity): boolean {
  return identity.kind === "operations-lead" || identity.kind === "division-lead";
}

// Positions -------------------------------------------------------------------

/** The positions a lead reaches, with what the table shows for each. */
async function readPositionRows(identity: Identity, now: Date): Promise<PositionRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: applyPositions.id,
      title: applyPositions.title,
      status: applyPositions.status,
      created_at: applyPositions.createdAt,
      division_id: divisions.id,
      division_name: divisions.name,
      dept_id: departments.id,
      dept_name: departments.name,
    })
    .from(applyPositions)
    .innerJoin(divisions, eq(applyPositions.divisionId, divisions.id))
    .innerJoin(departments, eq(divisions.deptId, departments.id))
    .where(and(eq(applyPositions.isDeleted, false), isNull(divisions.closedAt), isNull(departments.closedAt)))
    .orderBy(desc(applyPositions.createdAt));
  const scoped =
    identity.kind === "operations-lead"
      ? rows
      : rows.filter((r) => identity.divisionIds.includes(r.division_id) || identity.departmentIds.includes(r.dept_id));
  if (scoped.length === 0) return [];

  const tallies = await db
    .select({ position_id: applications.applyPositionId, status: applications.status, n: count(), last: max(applications.appliedAt) })
    .from(applications)
    .where(and(inArray(applications.applyPositionId, scoped.map((r) => r.id)), isNull(applications.withdrawnAt)))
    .groupBy(applications.applyPositionId, applications.status);

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
    };
  });
}

/** The open divisions a viewer may post a role in: every one for the operations lead, else those their figures cover. */
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
    .filter(
      (r) =>
        identity.kind === "operations-lead" || identity.divisionIds.includes(r.id) || identity.departmentIds.includes(r.dept_id),
    )
    .map((r) => ({ id: r.id, name: r.name, department: r.dept_name, deptCode: r.dept_code ?? "", divCode: r.div_code ?? "" }));
}

async function readNextPositionId(): Promise<number> {
  const [row] = await getDb().select({ last: max(applyPositions.id) }).from(applyPositions);
  return (row?.last ?? 0) + 1;
}

async function positionsPage(identity: Identity): Promise<PositionsPage> {
  if (!isLead(identity)) throw new DashboardRefused("positions");
  const [positions, divisionChoices, nextId] = await Promise.all([
    readPositionRows(identity, new Date()),
    readPostableDivisions(identity),
    readNextPositionId(),
  ]);
  const newPosition = { divisions: divisionChoices, nextId };
  if (identity.kind === "operations-lead") return { scope: "team", positions, newPosition };
  return { scope: "division", division: identity.role?.divisionName ?? null, positions, newPosition };
}

async function reachablePositionIds(identity: Identity): Promise<Set<number>> {
  if (!isLead(identity)) return new Set();
  return new Set((await readPositionRows(identity, new Date())).map((p) => p.id));
}

async function setPositionOpen(identity: Identity, positionId: number, open: boolean): Promise<void> {
  if (!(await reachablePositionIds(identity)).has(positionId)) throw new DashboardRefused(`position ${positionId}`);
  await runAuditQuery((db) => db.update(applyPositions).set({ status: open }).where(eq(applyPositions.id, positionId)));
  updateTag(POSITIONS_CACHE_TAG);
  updateTag(PUBLIC_POSITIONS_CACHE_TAG);
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
  updateTag(POSITIONS_CACHE_TAG);
  updateTag(PUBLIC_POSITIONS_CACHE_TAG);
  return written({ id: row.id, code: newPositionCode(division, row.id) });
}

// Applications ----------------------------------------------------------------

type StateRow = {
  status: DbStatus;
  applied_at: string;
  accepted_at: string | null;
  nda_arrived_at: string | null;
  joined_at: string | null;
};

/**
 * Where a stored application stands. "Accepted by another team" reads as
 * Rejected: this team did not take them. An interview row reads as
 * ./interview-slots.ts says.
 */
function stateOf(row: StateRow, slots: readonly SlotRow[]): ApplicationState {
  switch (row.status) {
    case "received":
      return { stage: "new" };
    case "pending":
      return { stage: "in-review" };
    case "interview":
      return interviewStateOf(slots);
    case "accepted":
      return { stage: "accepted", acceptedAt: row.accepted_at ?? row.applied_at, ndaArrived: row.nda_arrived_at !== null };
    case "joined":
      return { stage: "joined", joinedAt: row.joined_at ?? row.accepted_at ?? row.applied_at };
    case "rejected":
    case "accepted_by_another_team":
      return { stage: "rejected" };
  }
}

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
  kind: ApplicationDocument["kind"],
  file: { name: string | null; size: number | null; hash: string | null },
  storedName: string | null,
): ApplicationDocument[] {
  const name = file.name ?? storedName;
  if (name === null) return [];
  return [
    {
      kind,
      name,
      size: file.size === null ? null : fileSize(file.size),
      // The file route checks the reader's scope again (app/(legacy)/docs/applications/).
      href: file.hash === null ? null : `/docs/applications/${file.hash}/${encodeURIComponent(name)}`,
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
  const positions = await readPositionRows(identity, now);
  const division = identity.kind === "division-lead" ? (identity.role?.divisionName ?? null) : null;
  if (positions.length === 0) return { division, now: now.toISOString(), positions: [], applications: [] };

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
      gender: users.gender,
      cv_file_name: cvFiles.originalFilename,
      cv_file_size: cvFiles.fileSize,
      cv_file_hash: cvFiles.fileHash,
      letter_file_name: letterFiles.originalFilename,
      letter_file_size: letterFiles.fileSize,
      letter_file_hash: letterFiles.fileHash,
    })
    .from(applications)
    .innerJoin(users, eq(applications.userId, users.id))
    .leftJoin(cvFiles, eq(applications.cvFileId, cvFiles.id))
    .leftJoin(letterFiles, eq(applications.coverLetterFileId, letterFiles.id))
    // A withdrawn application leaves the lead's list at once (issue #169).
    .where(and(inArray(applications.applyPositionId, positions.map((p) => p.id)), isNull(applications.withdrawnAt)))
    .orderBy(desc(applications.appliedAt), desc(applications.id));

  const [slots, others] = await Promise.all([
    readSlots(rows.filter((r) => r.status === "interview").map((r) => r.id)),
    readOtherApplications(rows),
  ]);
  const byId = new Map(positions.map((p) => [p.id, p]));
  return {
    division,
    now: now.toISOString(),
    positions: positions.map((p) => ({ ref: p.ref, title: p.title })),
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
            gender: r.gender,
          },
          studies: { year: r.year, degree: r.degree },
          position: { ref: position.ref, title: position.title, division: position.division },
          applied: appliedLabels(new Date(r.applied_at), now),
          documents: [
            ...documentOf("cv", { name: r.cv_file_name, size: r.cv_file_size, hash: r.cv_file_hash }, r.cv_name),
            ...documentOf(
              "motivation-letter",
              { name: r.letter_file_name, size: r.letter_file_size, hash: r.letter_file_hash },
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
  if (!row || row.position_id === null || !(await reachablePositionIds(identity)).has(row.position_id)) {
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
  const before = stateOf(row, (await readSlots([row.id])).get(row.id) ?? []);
  const now = new Date();
  const result = applyMove(before, move, now);
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
            ndaArrivedAt: after.ndaArrived ? (row.nda_arrived_at ?? now.toISOString()) : null,
          })
          .where(unchanged)
          .returning({ id: applications.id }),
      );
      return changed.length === 0 ? refused(APPLICATION_CHANGED) : written(null);
    }

    case "joined": {
      if (!result.joinsTeam) return refused("That move does not add anyone to the team.");
      const change = joinChange(await membershipOf(row.id));
      if (!(await confirmJoin(identity, row.id, after.joinedAt, change))) return refused(APPLICATION_CHANGED);
      updateTag(TEAM_ROSTER_CACHE_TAG);
      return written(null);
    }

    case "new":
    case "in-review":
    case "rejected": {
      const changed = await runAuditQuery((db) =>
        db.update(applications).set({ status: statusFor[after.stage] }).where(unchanged).returning({ id: applications.id }),
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

/** Where the applicant stands with the team: no member row, a member row with no active role, or an active role. */
async function membershipOf(applicationId: number): Promise<Membership> {
  const [row] = await getDb()
    .select({
      member_id: users.member,
      active_roles: sql<number>`(select count(*) from ${roles} r where r.member_id = ${users.member} and r.leaved_at is null)`.mapWith(Number),
    })
    .from(applications)
    .innerJoin(users, eq(users.id, applications.userId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!row || row.member_id === null) return "applicant";
  return row.active_roles > 0 ? "member" : "alumnus";
}

/**
 * Confirm join (58h, and the Members page's banner, 59): the one write that
 * adds a person to the team, doing what `joinChange` (./application-flow.ts)
 * decided. In one statement, and only while the application is still
 * accepted with the NDA arrived: a new `members` row (the NDA date, the name
 * and the confirming lead on it) linked from their `users` row, a member role
 * titled with the position in its division unless they already hold an
 * active role, then the application marked joined. The guards are repeated
 * in the statement so a person who joined meanwhile still gets no second
 * role. Their other applications are not touched. True when the application
 * was marked joined.
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
        where a.id = ${applicationId} and a.status = 'accepted' and a.nda_arrived_at is not null and a.withdrawn_at is null
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
          and not exists (select 1 from ${roles} r where r.member_id = app.member_id and r.leaved_at is null)
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
    setPositionOpen: (id: number, open: boolean) => setPositionOpen(identity, id, open),
    createPosition: (input: unknown) => createPosition(identity, input),
    moveApplication: (id: number, move: LeadMove) => moveApplication(identity, id, move),
  };
}
