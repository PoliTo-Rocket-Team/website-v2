import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { applications, applyPositions, divisions, members, roles, scopes, teamJoins, teamLeaves, users } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { publicPathname } from "@/lib/storage/pathname";
import { deletePublicFile, uploadPublicFile } from "@/lib/storage/public-store";
import { alumniMove } from "./alumni-move";
import { DashboardRefused, type TeamWrites } from "./data";
import { promotedNoticesInsert, promotionOf } from "./database-notices";
import { moveApplication } from "./database-recruitment";
import { storedPhotoPathname } from "./database-self";
import type { DashboardIdentity } from "./database";
import { columnsFromMemberDetails, NO_MEMBER_DETAILS, type MemberDetails } from "./details";
import {
  addOutcome,
  checkAddMember,
  checkMemberEdit,
  checkMemberPhoto,
  divisionMembers,
  lookupForAdd,
  type AddLookup,
  type AddStanding,
  type DetailsTarget,
  type WaitingPerson,
} from "./division-members";
import {
  headDepartmentOf,
  homeDivision,
  mayChangeDivision,
  mayLeaveTeam,
  membershipsOfRoles,
  NO_MEMBERS,
  reachesDivision,
  removalFrom,
  standingOfRoles,
  type Departure,
  type EditableRole,
  type Joining,
  type MemberDirectory,
  type MemberEdit,
  type Memberships,
  type OrgChart,
  type PromoteMode,
  type RoleSeat,
  type TeamActor,
} from "./team";
import { departmentMembers, type ClosedDivision } from "./department-members";
import {
  checkDivisionSave,
  closeRefusal,
  planDivisionSave,
  searchTeam,
  type DivisionPlan,
  type DivisionSubject,
  type TeamPerson,
  type TeamSearch,
} from "./division-edit";
import { POSITIONS_CACHE_TAG, PUBLIC_POSITIONS_CACHE_TAG } from "@/app/actions/get-apply-positions";
import { readTeamSnapshot, recordsOf, TEAM_ROSTER_CACHE_TAG, type TeamSnapshot } from "./team-database";
import { refused, written, type Upload, type WriteResult } from "./write";

// The Members page's reads and writes on the database (Dashboard v2 boards 59
// to 59e, issue #172; boards 61e to 61h2, issue #231): who is in the lead's
// division and who is waiting for Confirm NDA, and the page's writes. Every
// write checks on the server what the viewer may do (./team.ts), runs through
// the audit helpers (.patterns/audited-mutations.md), and drops the cached
// roster so the Team pages read the change.

/**
 * The division a lead's Members page opens on; null for anyone else. A lead of
 * several divisions starts on the one their primary role is in.
 */
export function leadDivisionId(identity: DashboardIdentity): number | null {
  if (identity.kind !== "division-lead") return null;
  return identity.role?.divisionId ?? identity.divisionIds[0] ?? null;
}

/**
 * Who the viewer acts as on the Members page (`TeamActor`, ./team.ts): the
 * team for the operations lead or the team leader, a head for their
 * departments, a division lead for the divisions their roles and scopes
 * cover. Null for anyone else.
 */
async function readActor(identity: DashboardIdentity, org: OrgChart): Promise<TeamActor | null> {
  if (identity.memberId === null || identity.kind === "non-member") return null;
  if (identity.kind === "operations-lead") return { kind: "team" };
  const rows = await getDb()
    .select({ type: roles.type, dept_id: roles.deptId, division_id: roles.divisionId })
    .from(roles)
    .where(and(eq(roles.memberId, identity.memberId), isNull(roles.leavedAt)));
  if (rows.some((r) => r.type === "president")) return { kind: "team" };
  const headOf = rows.flatMap((r) => {
    if (r.type !== "head") return [];
    const departmentId = headDepartmentOf({ departmentId: r.dept_id, divisionId: r.division_id }, org);
    return departmentId === null ? [] : [departmentId];
  });
  if (headOf.length > 0) return { kind: "head", departmentIds: [...new Set(headOf)] };
  if (identity.kind !== "division-lead" || identity.divisionIds.length === 0) return null;
  return { kind: "lead", divisionIds: identity.divisionIds };
}

/** The divisions a division lead's Members page lists, the one it opens on first. A head's page is their department's. */
function reachOf(identity: DashboardIdentity, actor: Extract<TeamActor, { kind: "lead" }>, org: OrgChart): number[] {
  const open = (id: number) => org.divisions.some((d) => d.id === id);
  const first = leadDivisionId(identity);
  const unique = [...new Set(actor.divisionIds)].filter(open);
  return first !== null && unique.includes(first) ? [first, ...unique.filter((id) => id !== first)] : unique;
}

function nameOf(row: { first_name: string | null; last_name: string | null; email: string }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
}

/**
 * Accepted applicants to the division's positions who are not members yet
 * (board 59). The application stays accepted; Confirm join, once the signed
 * NDA arrived, makes them a member. Someone already on the team joins from the
 * Applications page (board 58h2, issue #229) or from Add member (#231).
 */
export async function readJoining(divisionId: number): Promise<Joining[]> {
  const rows = await getDb()
    .select({
      application_id: applications.id,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      position: applyPositions.title,
      nda_arrived_at: applications.ndaArrivedAt,
    })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .innerJoin(users, eq(users.id, applications.userId))
    .where(
      and(
        eq(applyPositions.divisionId, divisionId),
        eq(applyPositions.isDeleted, false),
        eq(applications.status, "accepted"),
        isNull(users.member),
      ),
    )
    .orderBy(applications.appliedAt);
  return rows.map((r) => ({
    applicationId: r.application_id,
    name: nameOf(r),
    position: r.position ?? "a position",
    ndaArrived: r.nda_arrived_at !== null,
  }));
}

const waitingColumns = {
  join_id: teamJoins.id,
  user_id: teamJoins.userId,
  division_id: teamJoins.divisionId,
  title: teamJoins.title,
  prt_email: teamJoins.prtEmail,
  discord: teamJoins.discord,
  email: users.email,
  first_name: users.firstName,
  last_name: users.lastName,
  member_id: users.member,
  phone: users.phone,
  linkedin: users.linkedin,
  polito_id: users.politoId,
  program: users.program,
  level_of_study: users.levelOfStudy,
  country: users.country,
  date_of_birth: users.dateOfBirth,
  gender: users.gender,
};

type WaitingRow = {
  join_id: number;
  user_id: string;
  division_id: number;
  title: string | null;
  prt_email: string | null;
  discord: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  member_id: number | null;
  phone: string | null;
  linkedin: string | null;
  polito_id: string | null;
  program: string | null;
  level_of_study: string | null;
  country: string | null;
  date_of_birth: string | null;
  gender: string | null;
};

function waitingDetails(row: WaitingRow): MemberDetails {
  const filled = (key: keyof MemberDetails, value: string | null) => (value === null ? {} : { [key]: value });
  // Read through the same check the forms use, so a stored value that is no longer valid reads empty.
  const raw = {
    ...NO_MEMBER_DETAILS,
    ...filled("prtEmail", row.prt_email),
    ...filled("phone", row.phone),
    ...filled("discord", row.discord),
    ...filled("linkedin", row.linkedin),
    ...filled("politoId", row.polito_id),
    ...filled("programme", row.program),
    ...filled("level", row.level_of_study),
    ...filled("country", row.country),
    ...filled("birthDate", row.date_of_birth),
    ...filled("gender", row.gender),
  };
  const checked = checkMemberEdit({ title: "", details: raw });
  return checked.ok ? checked.value.details : NO_MEMBER_DETAILS;
}

/** The people added to `divisionId` and waiting for Confirm NDA, oldest first. */
async function readWaiting(divisionId: number): Promise<WaitingRow[]> {
  return getDb()
    .select(waitingColumns)
    .from(teamJoins)
    .innerJoin(users, eq(users.id, teamJoins.userId))
    .where(eq(teamJoins.divisionId, divisionId))
    .orderBy(asc(teamJoins.addedAt));
}

function waitingPerson(row: WaitingRow): WaitingPerson {
  return {
    joinId: row.join_id,
    email: row.email,
    name: [row.first_name, row.last_name].filter(Boolean).join(" ") || null,
    title: row.title,
    details: waitingDetails(row),
  };
}

/** The department's closed divisions, most recently closed first (board 69's Closed tab). */
async function readClosedDivisions(departmentId: number): Promise<ClosedDivision[]> {
  const rows = await getDb()
    .select({ id: divisions.id, name: divisions.name, code: divisions.code, closed_at: divisions.closedAt })
    .from(divisions)
    .where(and(eq(divisions.deptId, departmentId), isNotNull(divisions.closedAt)))
    .orderBy(desc(divisions.closedAt), asc(divisions.id));
  return rows.flatMap((r) => (r.closed_at === null ? [] : [{ id: r.id, name: r.name, code: r.code, closedOn: r.closed_at }]));
}

/**
 * A department head's Members page (boards 69 to 69c, issue #235): every
 * open division of their department, each with the people waiting for
 * Confirm NDA and the accepted applicants joining, and its closed divisions.
 * A head of several departments sees the first.
 */
async function readDepartmentMembers(
  identity: DashboardIdentity,
  actor: Extract<TeamActor, { kind: "head" }>,
  snapshot: TeamSnapshot,
): Promise<MemberDirectory> {
  const [departmentId] = actor.departmentIds;
  if (departmentId === undefined) return NO_MEMBERS;
  const divisionIds = snapshot.org.divisions.filter((d) => d.departmentId === departmentId).map((d) => d.id);
  const [perDivision, closed, openPositions] = await Promise.all([
    Promise.all(divisionIds.map(async (id) => ({ id, joining: await readJoining(id), waiting: await readWaiting(id) }))),
    readClosedDivisions(departmentId),
    readOpenPositions(divisionIds),
  ]);
  const page = departmentMembers({
    records: recordsOf(snapshot),
    org: snapshot.org,
    departmentId,
    actor,
    selfId: identity.memberId,
    waiting: Object.fromEntries(perDivision.map((d) => [d.id, d.waiting.map(waitingPerson)])),
    joining: Object.fromEntries(perDivision.map((d) => [d.id, d.joining])),
    closed,
    openPositions,
  });
  return page === null ? NO_MEMBERS : { scope: "department", ...page };
}

/**
 * The Members page of a division lead (boards 61e to 61h2): one of the
 * divisions they reach, `divisionId` or the first, with everyone in it, the
 * people waiting for Confirm NDA and the accepted applicants joining. A head
 * gets their department's page instead.
 */
export async function readDivisionMembers(identity: DashboardIdentity, divisionId: number | null): Promise<MemberDirectory> {
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  if (actor === null || actor.kind === "team") return NO_MEMBERS;
  if (actor.kind === "head") return readDepartmentMembers(identity, actor, snapshot);
  const reach = reachOf(identity, actor, snapshot.org);
  const division = reach.find((id) => id === divisionId) ?? reach[0];
  if (division === undefined) return NO_MEMBERS;
  const [joining, waiting] = await Promise.all([readJoining(division), readWaiting(division)]);
  const page = divisionMembers({
    records: recordsOf(snapshot),
    org: snapshot.org,
    divisionId: division,
    actor,
    selfId: identity.memberId,
    reach,
    waiting: waiting.map(waitingPerson),
    joining,
  });
  return page === null ? NO_MEMBERS : { scope: "division", ...page };
}

/** Add member's field (boards 61h, 69c): the team, searched by name or email, and who is waiting here. */
export async function findForAdd(identity: DashboardIdentity, divisionId: number, query: string): Promise<AddLookup> {
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  if (actor === null || !reachesDivision(actor, divisionId, snapshot.org)) return { kind: "none" };
  const team = recordsOf(snapshot).map((r) => ({
    id: r.id,
    name: r.name,
    emails: [r.signInEmail, r.details.prtEmail].filter((e) => e !== ""),
    memberships: r.memberships,
  }));
  const waiting = await readWaiting(divisionId);
  return lookupForAdd(query, team, waiting.map((w) => w.email), divisionId, snapshot.org);
}

type ActiveRole = {
  id: number;
  division_id: number | null;
  dept_id: number | null;
  type: "president" | "head" | "lead" | "core" | null;
  title: string;
  started_at: string;
};

async function activeRoles(memberId: number): Promise<ActiveRole[]> {
  return getDb()
    .select({
      id: roles.id,
      division_id: roles.divisionId,
      dept_id: roles.deptId,
      type: roles.type,
      title: roles.title,
      started_at: roles.startedAt,
    })
    .from(roles)
    .where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt)));
}

function roleSeat(r: ActiveRole): RoleSeat {
  return { type: r.type, divisionId: r.division_id, since: r.started_at, departmentId: r.dept_id, title: r.title };
}

/** The person's division roles as memberships (`membershipsOfRoles`, ./team.ts). */
function membershipsOfActive(active: readonly ActiveRole[]): Memberships {
  return membershipsOfRoles(active.map(roleSeat));
}

/**
 * The person's active roles when the viewer may change them: anyone on the
 * team for the operations lead, someone in the lead's own division for a
 * division lead; never the viewer. Null otherwise.
 */
async function rolesTheViewerChanges(identity: DashboardIdentity, personId: number): Promise<ActiveRole[] | null> {
  if (personId === identity.memberId) return null;
  const active = await activeRoles(personId);
  if (active.length === 0) return null;
  if (identity.kind === "operations-lead") return active;
  const division = leadDivisionId(identity);
  if (division === null) return null;
  const inDivision = active.filter((r) => r.division_id === division);
  return inDivision.length > 0 ? inDivision : null;
}

const ROLE_TYPE: Readonly<Record<EditableRole, "lead" | "core">> = { "division-lead": "lead", member: "core" };

function done(): true {
  updateTag(TEAM_ROSTER_CACHE_TAG);
  return true;
}

const today = () => new Date().toISOString().slice(0, 10);

async function saveMember(identity: DashboardIdentity, personId: number, edit: MemberEdit): Promise<boolean> {
  const active = await rolesTheViewerChanges(identity, personId);
  if (active === null) return false;
  // The panel's role is the role in one division: the lead's own, or for the
  // operations lead the person's home division. Their other divisions keep
  // their roles (issue #229).
  const division = homeDivision(membershipsOfActive(active));
  if (edit.role !== null && division !== null) {
    // Changing who leads a division is the head's, never a division lead's (#231).
    const { org } = await readTeamSnapshot();
    const actor = await readActor(identity, org);
    if (actor === null || !mayChangeDivision(actor, division, org).allowed) return false;
  }
  const divisionRoles = active.filter((r) => r.division_id === division && (r.type === "lead" || r.type === "core"));
  const target = edit.role === null ? active : divisionRoles;
  if (target.length === 0) return false;
  const ids = target.map((r) => r.id);
  await runAuditQuery((db) =>
    db
      .update(roles)
      .set({ title: edit.pageTitle ?? "", ...(edit.role === null ? {} : { type: ROLE_TYPE[edit.role] }) })
      .where(inArray(roles.id, ids)),
  );
  return done();
}

/**
 * Promote (board 59e): the role change and a notice to each head of the
 * division's department (#188), in one batch. No email is sent. Changing a
 * division's leads is its head's (`mayChangeDivision`), so a division lead's
 * Promote is refused (#231).
 */
async function promote(identity: DashboardIdentity, personId: number, mode: PromoteMode): Promise<boolean> {
  const division = leadDivisionId(identity);
  const leadId = identity.memberId;
  if (identity.kind !== "division-lead" || division === null || leadId === null) return false;
  const { org } = await readTeamSnapshot();
  const actor = await readActor(identity, org);
  if (actor === null || !mayChangeDivision(actor, division, org).allowed) return false;
  const active = await rolesTheViewerChanges(identity, personId);
  const theirs = active?.find((r) => r.division_id === division && r.type === "core");
  if (!theirs) return false;
  const mine = (await activeRoles(leadId)).find((r) => r.division_id === division && r.type === "lead");
  if (mode === "hand-over" && !mine) return false;
  const promotion = await promotionOf(personId, division, mode, leadId);
  await runAuditBatch((db) => [
    db.update(roles).set({ type: "lead" }).where(eq(roles.id, theirs.id)),
    ...(mode === "hand-over" && mine ? [db.update(roles).set({ type: "core" }).where(eq(roles.id, mine.id))] : []),
    // The insert reads the department's heads itself, inside this batch (issue #227).
    ...(promotion ? [promotedNoticesInsert(db, promotion)] : []),
  ]);
  return done();
}

/**
 * "Leaves the team" (board 59d, widened by #231): when `mayLeaveTeam` allows
 * it, every open role ends, every access grant goes, and the years and the
 * team_leaves row are written, in one batch. The account and the member row
 * stay.
 */
async function moveToAlumni(identity: DashboardIdentity, personId: number, departure: Departure): Promise<boolean> {
  if (personId === identity.memberId) return false;
  const { org } = await readTeamSnapshot();
  const actor = await readActor(identity, org);
  if (actor === null) return false;
  const active = await activeRoles(personId);
  // Every active role counts, one beyond every division included (a head kept on a division row too):
  // the move ends them all (`standingOfRoles`).
  const standing = standingOfRoles(active.map(roleSeat), org);
  if (actor.kind !== "team" && !standing.memberships.some((m) => reachesDivision(actor, m.divisionId, org))) return false;
  if (!mayLeaveTeam(actor, standing, org).allowed) return false;
  const move = alumniMove(active.map((r) => ({ id: r.id, divisionId: r.division_id })));
  if (move === null) return false;
  const ending = move.ending.map((r) => r.id);
  await runAuditBatch((db) => [
    db.update(roles).set({ leavedAt: today() }).where(and(inArray(roles.id, ending), isNull(roles.leavedAt))),
    db.delete(scopes).where(eq(scopes.memberId, personId)),
    db.update(members).set({ teamFrom: departure.from, teamTo: departure.to }).where(eq(members.memberId, personId)),
    db.insert(teamLeaves).values({ memberId: personId, reason: departure.reason }),
  ]);
  return done();
}

/**
 * Confirm join from the Members page's banner (boards 59, 69m) is the
 * Applications page's Confirm join (58h): the same move, through the same
 * rule, so it waits for the NDA tick, marks the application joined and never
 * gives someone already on the team a second role. Only for a division the
 * viewer's Members page reaches: the lead's own, or the head's department's.
 */
async function confirmJoin(identity: DashboardIdentity, applicationId: number): Promise<boolean> {
  if (identity.memberId === null) return false;
  const [row] = await getDb()
    .select({ division_id: applyPositions.divisionId })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!row || row.division_id === null || (await actingOn(identity, row.division_id)) === null) return false;
  try {
    return (await moveApplication(identity, applicationId, { kind: "confirm-join" })).ok;
  } catch (error) {
    if (error instanceof DashboardRefused) return false;
    throw error;
  }
}

/** The actor and the open org chart, when the viewer's page reaches `divisionId`. */
async function actingOn(identity: DashboardIdentity, divisionId: number): Promise<{ actor: TeamActor; org: OrgChart } | null> {
  const { org } = await readTeamSnapshot();
  const actor = await readActor(identity, org);
  if (actor === null || !org.divisions.some((d) => d.id === divisionId) || !reachesDivision(actor, divisionId, org)) return null;
  return { actor, org };
}

/** Someone with an active role in `divisionId`, never the viewer: the people a row's actions reach. */
async function personIn(identity: DashboardIdentity, personId: number, divisionId: number): Promise<ActiveRole[] | null> {
  if (personId === identity.memberId) return null;
  const active = await activeRoles(personId);
  return active.some((r) => r.division_id === divisionId) ? active : null;
}

/** A new role in the division: a member of it from today, with the title given. */
function memberRole(memberId: number, divisionId: number, title: string | null) {
  return { memberId, divisionId, title: title ?? "", type: "core" as const, startedAt: today() };
}

/**
 * Add member (boards 61h, 61h2; Owner decisions on #231). Someone on the team
 * gets a role in the division at once, keeps every other role and signs no
 * second NDA. Anyone else waits: their `users` row (their account's, or a new
 * one keyed by the email) and a `team_joins` row, with no role, until Confirm
 * NDA. The details a lead fills in now only fill what the person's own
 * account left empty.
 */
async function addMember(identity: DashboardIdentity, input: unknown): Promise<WriteResult<"joined" | "waiting">> {
  const checked = checkAddMember(input);
  if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
  const add = checked.value;
  if ((await actingOn(identity, add.divisionId)) === null) return refused("You can add people only to a division you lead.");

  const [account] =
    add.kind === "email"
      ? await getDb()
          .select({ id: users.id, member: users.member })
          .from(users)
          .where(sql`lower(${users.email}) = ${add.email}`)
          .orderBy(sql`${users.member} is null`)
          .limit(1)
      : [];
  const memberId = add.kind === "member" ? add.personId : (account?.member ?? null);
  const active = memberId === null ? [] : await activeRoles(memberId);
  if (add.kind === "member" && active.length === 0) return refused("They are not on the team.");
  const waiting =
    account !== undefined &&
    (
      await getDb()
        .select({ id: teamJoins.id })
        .from(teamJoins)
        .where(and(eq(teamJoins.userId, account.id), eq(teamJoins.divisionId, add.divisionId)))
        .limit(1)
    ).length > 0;
  const standing: AddStanding =
    active.length > 0 ? { kind: "member", memberships: membershipsOfActive(active) } : waiting ? { kind: "waiting" } : { kind: "not-on-team" };
  const outcome = addOutcome(standing, add.divisionId);
  if (outcome.kind === "refused") return refused(outcome.reason);

  if (outcome.kind === "joins" && memberId !== null) {
    await runAuditQuery((db) => db.insert(roles).values(memberRole(memberId, add.divisionId, add.title)));
    done();
    return written("joined");
  }
  if (add.kind !== "email") return refused("Check the form.");

  const columns = columnsFromMemberDetails(add.details ?? NO_MEMBER_DETAILS);
  const userId = account?.id ?? `added:${randomUUID()}`;
  const keep = <T>(column: T, value: string | null) => sql`coalesce(${column}, ${value})`;
  await runAuditBatch((db) => [
    account
      ? db
          .update(users)
          .set({
            firstName: keep(users.firstName, add.firstName || null),
            lastName: keep(users.lastName, add.lastName || null),
            phone: keep(users.phone, columns.user.phone),
            linkedin: keep(users.linkedin, columns.user.linkedin),
            politoId: keep(users.politoId, columns.user.politoId),
            program: keep(users.program, columns.user.program),
            levelOfStudy: keep(users.levelOfStudy, columns.user.levelOfStudy),
            country: keep(users.country, columns.user.country),
            dateOfBirth: keep(users.dateOfBirth, columns.user.dateOfBirth),
            gender: keep(users.gender, columns.user.gender),
            updatedAt: sql`now()`,
          })
          .where(eq(users.id, account.id))
      : db.insert(users).values({
          id: userId,
          email: add.email,
          firstName: add.firstName || null,
          lastName: add.lastName || null,
          ...columns.user,
        }),
    db.insert(teamJoins).values({
      userId,
      divisionId: add.divisionId,
      title: add.title,
      prtEmail: columns.member.prtEmail,
      discord: columns.member.discord,
      addedBy: identity.memberId,
    }),
  ]);
  return written("waiting");
}

/**
 * Confirm NDA: the person waiting becomes a member of the division, in one
 * batch: a member row that records the NDA date and who confirmed it, their
 * `users` row linked to it, a role in the division, and the wait removed.
 * Someone coming back after leaving keeps their member row, which records the
 * new NDA. Someone who joined the team meanwhile only gets the role: there is
 * one NDA for the whole team (ADR 0014).
 */
async function confirmNda(identity: DashboardIdentity, joinId: number): Promise<boolean> {
  const confirmer = identity.memberId;
  if (confirmer === null) return false;
  const [row] = await getDb()
    .select(waitingColumns)
    .from(teamJoins)
    .innerJoin(users, eq(users.id, teamJoins.userId))
    .where(eq(teamJoins.id, joinId))
    .limit(1);
  if (!row || (await actingOn(identity, row.division_id)) === null) return false;
  const now = new Date().toISOString();
  const nda = { ndaSignedAt: now, ndaConfirmedBy: confirmer };
  const contact = { prtEmail: row.prt_email, discord: row.discord };
  const existing = row.member_id;

  if (existing !== null) {
    const onTeam = (await activeRoles(existing)).length > 0;
    await runAuditBatch((db) => [
      db.insert(roles).values(memberRole(existing, row.division_id, row.title)),
      db.delete(teamJoins).where(eq(teamJoins.id, joinId)),
      ...(onTeam ? [] : [db.update(members).set({ ...nda, ...contact }).where(eq(members.memberId, existing))]),
    ]);
    return done();
  }

  // The batch cannot read one write's result in the next, so the member id is taken first.
  const next = await getDb().execute(sql`select nextval(pg_get_serial_sequence('members', 'member_id'))::int as id`);
  const memberId = Number((next.rows[0] as { id: number }).id);
  await runAuditBatch((db) => [
    db.insert(members).values({ memberId, ...nda, ...contact }),
    db.update(users).set({ member: memberId }).where(and(eq(users.id, row.user_id), isNull(users.member))),
    db.insert(roles).values(memberRole(memberId, row.division_id, row.title)),
    db.delete(teamJoins).where(eq(teamJoins.id, joinId)),
  ]);
  return done();
}

/**
 * Cancel add: the wait is deleted, and nothing else changes. The person never
 * joined, so they hold no role and no member row to end.
 */
async function cancelAdd(identity: DashboardIdentity, joinId: number): Promise<boolean> {
  if (identity.memberId === null) return false;
  const [row] = await getDb().select({ divisionId: teamJoins.divisionId }).from(teamJoins).where(eq(teamJoins.id, joinId)).limit(1);
  if (!row || (await actingOn(identity, row.divisionId)) === null) return false;
  await runAuditQuery((db) => db.delete(teamJoins).where(eq(teamJoins.id, joinId)));
  return done();
}

/**
 * "Remove from <division>": the person's roles in that division end and its
 * division access goes; every other division stays. Refused for someone
 * whose only division it is, and for a lead when a division lead asks
 * (`removalFrom`, ./team.ts).
 */
async function removeFromDivision(identity: DashboardIdentity, personId: number, divisionId: number): Promise<boolean> {
  const acting = await actingOn(identity, divisionId);
  const active = acting && (await personIn(identity, personId, divisionId));
  if (!acting || !active) return false;
  if (removalFrom(acting.actor, membershipsOfActive(active), divisionId, acting.org).kind !== "offered") return false;
  await runAuditBatch((db) => [
    db
      .update(roles)
      .set({ leavedAt: today() })
      .where(and(eq(roles.memberId, personId), eq(roles.divisionId, divisionId), isNull(roles.leavedAt))),
    db.delete(scopes).where(and(eq(scopes.memberId, personId), eq(scopes.scope, "division"), eq(scopes.divisionId, divisionId))),
  ]);
  return done();
}

/**
 * Edit details or Fill details (board 61g): the title of their role in this
 * division (never another division's), and their details, written where each
 * lives (`columnsFromMemberDetails`).
 */
async function saveMemberDetails(
  identity: DashboardIdentity,
  target: DetailsTarget,
  divisionId: number,
  input: unknown,
): Promise<WriteResult<null>> {
  const checked = checkMemberEdit(input);
  if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
  if ((await actingOn(identity, divisionId)) === null) return refused("You can edit only people in a division you lead.");
  const { title, details } = checked.value;
  const columns = columnsFromMemberDetails(details);

  if (target.kind === "waiting") {
    const [join] = await getDb()
      .select({ user_id: teamJoins.userId })
      .from(teamJoins)
      .where(and(eq(teamJoins.id, target.joinId), eq(teamJoins.divisionId, divisionId)))
      .limit(1);
    if (!join) return refused("They are not waiting to join this division.");
    await runAuditBatch((db) => [
      db.update(teamJoins).set({ title, ...columns.member }).where(eq(teamJoins.id, target.joinId)),
      db.update(users).set({ ...columns.user, updatedAt: sql`now()` }).where(eq(users.id, join.user_id)),
    ]);
    return written(null);
  }

  if ((await personIn(identity, target.id, divisionId)) === null) return refused("You can edit only people in your division.");
  await runAuditBatch((db) => [
    db
      .update(roles)
      .set({ title: title ?? "" })
      .where(and(eq(roles.memberId, target.id), eq(roles.divisionId, divisionId), isNull(roles.leavedAt))),
    db.update(users).set({ ...columns.user, updatedAt: sql`now()` }).where(eq(users.member, target.id)),
    db.update(members).set(columns.member).where(eq(members.memberId, target.id)),
  ]);
  done();
  return written(null);
}

/** The photo in Edit details (board 61g): a square JPEG under 500 KB in the public store, or none. */
async function setMemberPhoto(identity: DashboardIdentity, personId: number, divisionId: number, photo: Upload | null): Promise<WriteResult<null>> {
  if ((await actingOn(identity, divisionId)) === null || (await personIn(identity, personId, divisionId)) === null) {
    return refused("You can edit only people in your division.");
  }
  if (photo !== null) {
    const error = checkMemberPhoto({ type: photo.contentType, size: photo.bytes.byteLength });
    if (error !== null) return refused(error);
  }
  const [member] = await getDb().select({ picture: members.picture }).from(members).where(eq(members.memberId, personId)).limit(1);
  const old = storedPhotoPathname(member?.picture ?? null);
  const url =
    photo === null ? null : (await uploadPublicFile(publicPathname("photo", `${personId}-${randomUUID()}.jpg`), photo.bytes, photo.contentType)).url;
  await runAuditQuery((db) => db.update(members).set({ picture: url }).where(eq(members.memberId, personId)));
  if (old !== null) await deletePublicFile(old).catch(() => undefined);
  done();
  return written(null);
}

// New division, Edit division, Close division and Reopen (issue #232, boards
// 68b to 68e and 69d). `planDivisionSave` and `closeRefusal`
// (./division-edit.ts) decide what may change; each write below runs what
// they allow in one audited batch.

/** Everyone on the team as the division rules read them. */
function teamPeopleOf(snapshot: TeamSnapshot): TeamPerson[] {
  return recordsOf(snapshot).map((r) => ({
    id: r.id,
    name: r.name,
    emails: [r.signInEmail, r.details.prtEmail].filter((e) => e !== ""),
    memberships: r.memberships,
    beyond: r.beyondDivisions,
  }));
}

/** The lead and member pickers (boards 68b2, 69d): the whole team, for whoever manages a division. */
export async function findPeople(identity: DashboardIdentity, query: string): Promise<TeamSearch> {
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  if (actor === null || actor.kind === "lead") return { kind: "none" };
  return searchTeam(query, teamPeopleOf(snapshot), snapshot.org);
}

/** Open positions per division id, for Close division's summary (board 68c). */
async function readOpenPositions(divisionIds: readonly number[]): Promise<Record<number, number>> {
  if (divisionIds.length === 0) return {};
  const rows = await getDb()
    .select({ division_id: applyPositions.divisionId, open: sql<number>`count(*)::int` })
    .from(applyPositions)
    .where(and(inArray(applyPositions.divisionId, [...divisionIds]), eq(applyPositions.status, true), eq(applyPositions.isDeleted, false)))
    .groupBy(applyPositions.divisionId);
  return Object.fromEntries(rows.flatMap((r) => (r.division_id === null ? [] : [[r.division_id, Number(r.open)]])));
}

/** The division a save is about: open on the chart, or closed and being reopened. */
async function savedSubject(divisionId: number, org: OrgChart): Promise<Exclude<DivisionSubject, { kind: "new" }> | null> {
  const open = org.divisions.find((d) => d.id === divisionId);
  if (open) return { kind: "open", division: open };
  const [row] = await getDb()
    .select({ id: divisions.id, name: divisions.name, dept_id: divisions.deptId, code: divisions.code })
    .from(divisions)
    .where(and(eq(divisions.id, divisionId), isNotNull(divisions.closedAt)))
    .limit(1);
  if (!row || row.dept_id === null) return null;
  return { kind: "closed", division: { id: row.id, name: row.name, departmentId: row.dept_id, code: row.code?.trim() || null } };
}

/**
 * Writes a checked plan in one batch: the division row (inserted for New
 * division, `closed_at` cleared on a reopen), each lead change in this
 * division only, old leads who leave it (roles ended, its access removed) or
 * leave the team (every role and access ends, as Leaves the team does), and
 * new members. The emails new to the team wait for Confirm NDA after it, as
 * Add member records them.
 */
async function writeDivisionPlan(
  identity: DashboardIdentity,
  divisionId: number,
  plan: DivisionPlan,
  create: { readonly departmentId: number } | null,
): Promise<WriteResult<null>> {
  const on = today();
  const year = Number(on.slice(0, 4));
  const leavers = await Promise.all(plan.leaveTeam.map(async (memberId) => ({ memberId, active: await activeRoles(memberId) })));
  const newRole = (memberId: number, type: "lead" | "core") => ({ memberId, divisionId, title: "", type, startedAt: on });
  const inDivision = (memberId: number) => and(eq(roles.memberId, memberId), eq(roles.divisionId, divisionId), isNull(roles.leavedAt));
  const joining = [...plan.joinAsLead.map((id) => newRole(id, "lead")), ...plan.joinAsMember.map((id) => newRole(id, "core"))];

  await runAuditBatch((db) => [
    create
      ? db.insert(divisions).values({ id: divisionId, deptId: create.departmentId, name: plan.name, code: plan.code })
      : db
          .update(divisions)
          .set({ name: plan.name, code: plan.code, ...(plan.reopen ? { closedAt: null } : {}) })
          .where(eq(divisions.id, divisionId)),
    ...plan.promote.map((id) => db.update(roles).set({ type: "lead" }).where(inDivision(id))),
    ...(joining.length === 0 ? [] : [db.insert(roles).values(joining)]),
    ...plan.demote.map((id) => db.update(roles).set({ type: "core" }).where(and(inDivision(id), eq(roles.type, "lead")))),
    ...plan.leaveDivision.flatMap((id) => [
      db.update(roles).set({ leavedAt: on }).where(inDivision(id)),
      db.delete(scopes).where(and(eq(scopes.memberId, id), eq(scopes.scope, "division"), eq(scopes.divisionId, divisionId))),
    ]),
    ...leavers.flatMap(({ memberId, active }) => [
      db.update(roles).set({ leavedAt: on }).where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt))),
      db.delete(scopes).where(eq(scopes.memberId, memberId)),
      db
        .update(members)
        .set({ teamFrom: Math.min(year, ...active.map((r) => Number(r.started_at.slice(0, 4)))), teamTo: year })
        .where(eq(members.memberId, memberId)),
      db.insert(teamLeaves).values({ memberId, reason: null }),
    ]),
  ]);
  done();

  for (const email of plan.emails) {
    const added = await addMember(identity, { kind: "email", divisionId, email, firstName: "", lastName: "", title: null, details: null });
    if (!added.ok) return refused(`The division is saved, but ${email} was not added: ${added.error}`);
  }
  return written(null);
}

async function createDivision(identity: DashboardIdentity, departmentId: number, input: unknown): Promise<WriteResult<number>> {
  const checked = checkDivisionSave(input);
  if (!checked.ok) return refused(checked.error);
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  if (actor === null) return refused("Only a department head or the team leader creates a division.");
  const planned = planDivisionSave({ actor, org: snapshot.org, subject: { kind: "new", departmentId }, save: checked.value, team: teamPeopleOf(snapshot) });
  if (!planned.ok) return refused(planned.error);
  // The batch cannot read one write's result in the next, so the division id is taken first.
  const next = await getDb().execute(sql`select nextval(pg_get_serial_sequence('divisions', 'id'))::int as id`);
  const divisionId = Number((next.rows[0] as { id: number }).id);
  const result = await writeDivisionPlan(identity, divisionId, planned.plan, { departmentId });
  return result.ok ? written(divisionId) : refused(result.error);
}

async function saveDivision(identity: DashboardIdentity, divisionId: number, input: unknown): Promise<WriteResult<null>> {
  const checked = checkDivisionSave(input);
  if (!checked.ok) return refused(checked.error);
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  const subject = await savedSubject(divisionId, snapshot.org);
  if (actor === null || subject === null) return refused("That division is not one you manage.");
  const planned = planDivisionSave({ actor, org: snapshot.org, subject, save: checked.value, team: teamPeopleOf(snapshot) });
  if (!planned.ok) return refused(planned.error);
  const result = await writeDivisionPlan(identity, divisionId, planned.plan, null);
  // Position codes are built from the division's code when read, so a new code reaches every position at once.
  if (planned.plan.codeChanged || planned.plan.reopen) refreshPositions();
  return result;
}

function refreshPositions() {
  updateTag(POSITIONS_CACHE_TAG);
  updateTag(PUBLIC_POSITIONS_CACHE_TAG);
}

/**
 * Close division (board 68c): refused while anyone holds a role in it or
 * waits for their NDA there. Otherwise, in one batch: the division closes,
 * its open positions close, and every access given in it is removed.
 */
async function closeDivision(identity: DashboardIdentity, divisionId: number): Promise<WriteResult<null>> {
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  if (actor === null) return refused("Only a department head or the team leader closes a division.");
  const db = getDb();
  const [[people], [waiting]] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${roles.memberId})::int` })
      .from(roles)
      .where(and(eq(roles.divisionId, divisionId), isNull(roles.leavedAt))),
    db.select({ count: sql<number>`count(*)::int` }).from(teamJoins).where(eq(teamJoins.divisionId, divisionId)),
  ]);
  const refusal = closeRefusal(actor, snapshot.org, divisionId, { people: Number(people?.count ?? 0), waiting: Number(waiting?.count ?? 0) });
  if (refusal !== null) return refused(refusal);
  await runAuditBatch((tx) => [
    tx.update(divisions).set({ closedAt: today() }).where(and(eq(divisions.id, divisionId), isNull(divisions.closedAt))),
    tx.update(applyPositions).set({ status: false }).where(and(eq(applyPositions.divisionId, divisionId), eq(applyPositions.status, true))),
    tx.delete(scopes).where(and(eq(scopes.scope, "division"), eq(scopes.divisionId, divisionId))),
  ]);
  done();
  refreshPositions();
  return written(null);
}

/** The Members page's writes on the database. */
export function databaseTeamWrites(identity: DashboardIdentity): TeamWrites {
  return {
    // The schema keeps no "shown on the site" flag for alumni yet.
    setShownOnSite: async () => false,
    saveMember: (personId, edit) => saveMember(identity, personId, edit),
    promote: (personId, mode) => promote(identity, personId, mode),
    moveToAlumni: (personId, departure) => moveToAlumni(identity, personId, departure),
    confirmJoin: (applicationId) => confirmJoin(identity, applicationId),
    addMember: (input) => addMember(identity, input),
    confirmNda: (joinId) => confirmNda(identity, joinId),
    cancelAdd: (joinId) => cancelAdd(identity, joinId),
    removeFromDivision: (personId, divisionId) => removeFromDivision(identity, personId, divisionId),
    saveMemberDetails: (target, divisionId, input) => saveMemberDetails(identity, target, divisionId, input),
    setMemberPhoto: (personId, divisionId, photo) => setMemberPhoto(identity, personId, divisionId, photo),
    createDivision: (departmentId, input) => createDivision(identity, departmentId, input),
    saveDivision: (divisionId, input) => saveDivision(identity, divisionId, input),
    closeDivision: (divisionId) => closeDivision(identity, divisionId),
  };
}
