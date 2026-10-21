import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import {
  applications,
  applyPositions,
  dashboardNotices,
  departments,
  divisions,
  handOverRequests,
  members,
  roles,
  scopes,
  teamJoins,
  teamLeaves,
  users,
} from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { deleteBestEffort } from "@/lib/storage/best-effort-delete";
import { publicPathname } from "@/lib/storage/pathname";
import { deletePublicFile, uploadPublicFile } from "@/lib/storage/public-store";
import { alumniMove } from "./alumni-move";
import { DashboardRefused, type TeamWrites } from "./data";
import { readWaitingHandOvers } from "./database-hand-over";
import { promotedNoticesInsert, promotionOf } from "./database-notices";
import { moveApplication } from "./database-recruitment";
import { answerNoticeOf, planHandOverAnswer, type HandOverAnswer, type HandOverAnswerPlan } from "./hand-over-request";
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
  isDivisionRole,
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
  type RoleSeat,
  type RoleType,
  type TeamActor,
} from "./team";
import { departmentMembers } from "./department-members";
import {
  ADVISOR_TITLE,
  advisorAfterDivisionCloses,
  checkTeamLeaderHandOver,
  planTeamLeaderHandOver,
  promotingLead,
  seatHandOver,
  steppingDown,
  type AdvisorPlace,
  type Promotion,
  type SeatMove,
  type SeatRow,
  type SteppingDown,
} from "./hand-over";
import { coveredDivisionIds, FLAG_OF_SEAT, isOffTeam, mayChange, readsArea, readsAreaIn, SEAT_OF_FLAG, seatOf, type FlaggedSeat, type SeatFlag } from "./viewer";
import {
  checkDepartmentClose,
  checkDepartmentCreate,
  checkDepartmentSave,
  closingPeople,
  planDepartmentClose,
  planDepartmentCreate,
  planDepartmentSave,
} from "./department-edit";
import { editableDivisionIds, teamStructure, type TeamStructure } from "./team-structure";
import {
  checkDivisionSave,
  closeRefusal,
  divisionClosing,
  divisionRowWrites,
  planDivisionSave,
  searchTeam,
  type DivisionPlan,
  type DivisionRow,
  type DivisionSubject,
  type TeamPerson,
  type TeamSearch,
} from "./division-edit";
import { refreshAfter } from "@/lib/cache-tags";
import { readTeamSnapshot, recordsOf, teamPeopleOf, type TeamSnapshot } from "./team-database";
import { refused, written, type Upload, type WriteResult } from "./write";

// The Members page's reads and writes on the database (Dashboard v2 boards 59
// to 59e, issue #172; boards 61e to 61h2, issue #231): who is in the lead's
// division and who is waiting for Confirm NDA, and the page's writes. Every
// write checks on the server what the viewer may do (./team.ts), runs through
// the audit helpers (.patterns/audited-mutations.md), and drops the cached
// roster so the Team pages read the change.

/**
 * The division a lead's Members page opens on, or a Members-granted member's;
 * null for anyone else. A lead of several divisions starts on the one their
 * primary role is in.
 */
export function leadDivisionId(identity: DashboardIdentity): number | null {
  if (identity.kind !== "division-lead" && !(identity.kind === "member" && readsArea(identity, "members"))) return null;
  return identity.role?.divisionId ?? identity.divisionIds[0] ?? null;
}

/**
 * Who the viewer changes people as on the Members page (`TeamActor`,
 * ./team.ts): the team for the operations lead or the team leader, a head for
 * their departments, else a division lead over each division where
 * `mayChange` lets them change the Members area: a lead role there, or a
 * Members (or every-area) grant at Can edit that covers it (issue #342); a
 * grant across a department covers each of its divisions (issue #351). A
 * grant at Can view, or on another area, changes nobody. Null for anyone
 * else. Every Members write checks this actor, directly or through
 * `actingOn`.
 */
async function readActor(identity: DashboardIdentity, org: OrgChart | Promise<OrgChart>): Promise<TeamActor | null> {
  return actorOf(identity, org, (divisionId, chart) => {
    const division = chart.divisions.find((d) => d.id === divisionId);
    return division !== undefined && mayChange(identity, "members", { divisionId, departmentId: division.departmentId });
  });
}

/**
 * Who the viewer reads the Members page as: `readActor`, except that it reads
 * every division where they read the Members area (`readsAreaIn`): a lead's
 * own, or one a member's Members grant (or every-area grant) covers, at any
 * level. A grant on another area reads no division here (issue #471).
 * Reading is all it decides; no write takes this actor, and the page's
 * actions follow `readActor` (issue #351).
 */
async function readViewingActor(identity: DashboardIdentity, org: OrgChart | Promise<OrgChart>): Promise<TeamActor | null> {
  return actorOf(identity, org, (divisionId, chart) => {
    const division = chart.divisions.find((d) => d.id === divisionId);
    return division !== undefined && readsAreaIn(identity, "members", { divisionId, departmentId: division.departmentId });
  });
}

/**
 * The team or a head, as their roles say; else a division lead over the
 * divisions their units cover that `leads` keeps. The org chart may still be
 * on its way: the roles are read beside it, since they need nothing of it
 * (issue #397).
 */
async function actorOf(
  identity: DashboardIdentity,
  orgRead: OrgChart | Promise<OrgChart>,
  leads: (divisionId: number, org: OrgChart) => boolean,
): Promise<TeamActor | null> {
  const memberId = identity.memberId;
  const decided: TeamActor | null | undefined =
    memberId === null || isOffTeam(identity.kind) ? null : identity.kind === "operations-lead" ? { kind: "team" } : undefined;
  // The chart is awaited on every path, so a failed read of it never goes unheard.
  const [rows, org] = await Promise.all([
    decided !== undefined || memberId === null
      ? []
      : getDb()
          .select({ type: roles.type, dept_id: roles.deptId, division_id: roles.divisionId })
          .from(roles)
          .where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt))),
    orgRead,
  ]);
  if (decided !== undefined) return decided;
  if (rows.some((r) => r.type === "president")) return { kind: "team" };
  const headOf = rows.flatMap((r) => {
    if (r.type !== "head") return [];
    const departmentId = headDepartmentOf({ departmentId: r.dept_id, divisionId: r.division_id }, org);
    return departmentId === null ? [] : [departmentId];
  });
  if (headOf.length > 0) return { kind: "head", departmentIds: [...new Set(headOf)] };
  // A grant across a department covers each of its divisions (issue #351).
  const divisionIds = coveredDivisionIds(identity, org.divisions).filter((id) => leads(id, org));
  return divisionIds.length === 0 ? null : { kind: "lead", divisionIds };
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

/**
 * A department head's Members page (boards 69 to 69c, issue #235): every
 * open division of their department, each with the people waiting for
 * Confirm NDA and the accepted applicants joining. A head of several
 * departments sees the first.
 */
/** Each division's people joining and people waiting for Confirm NDA, every read at once. */
function readPerDivision(divisionIds: readonly number[]) {
  return Promise.all(
    divisionIds.map(async (id) => {
      const [joining, waiting] = await Promise.all([readJoining(id), readWaiting(id)]);
      return { id, joining, waiting };
    }),
  );
}

async function readDepartmentMembers(
  identity: DashboardIdentity,
  actor: Extract<TeamActor, { kind: "head" }>,
  snapshot: TeamSnapshot,
): Promise<MemberDirectory> {
  const [departmentId] = actor.departmentIds;
  if (departmentId === undefined) return NO_MEMBERS;
  const divisionIds = snapshot.org.divisions.filter((d) => d.departmentId === departmentId).map((d) => d.id);
  const perDivision = await readPerDivision(divisionIds);
  const page = departmentMembers({
    records: recordsOf(snapshot),
    org: snapshot.org,
    departmentId,
    actor,
    selfId: identity.memberId,
    waiting: Object.fromEntries(perDivision.map((d) => [d.id, d.waiting.map(waitingPerson)])),
    joining: Object.fromEntries(perDivision.map((d) => [d.id, d.joining])),
  });
  return page === null ? NO_MEMBERS : { scope: "department", ...page };
}

/**
 * The Team tree's edit view (boards 77b and 66t-b, issue #251): every open
 * department and division, and for each division the viewer may change its
 * page, the people waiting for Confirm NDA, the people joining and its open
 * positions. Null for a viewer who edits no structure.
 */
export async function readTeamStructure(identity: DashboardIdentity): Promise<TeamStructure | null> {
  const snapshotRead = readTeamSnapshot();
  const [snapshot, actor] = await Promise.all([snapshotRead, readActor(identity, snapshotRead.then((s) => s.org))]);
  const ids = editableDivisionIds(actor, snapshot.org);
  if (actor === null || actor.kind === "lead") return null;
  const [perDivision, openPositions] = await Promise.all([readPerDivision(ids), readOpenPositions(ids)]);
  return teamStructure({
    records: recordsOf(snapshot),
    org: snapshot.org,
    actor,
    selfId: identity.memberId,
    seat: seatOf(identity),
    waiting: Object.fromEntries(perDivision.map((d) => [d.id, d.waiting.map(waitingPerson)])),
    joining: Object.fromEntries(perDivision.map((d) => [d.id, d.joining])),
    openPositions,
  });
}

/**
 * The Members page of a division lead (boards 61e to 61h2): one of the
 * divisions they reach, `divisionId` or the first, with everyone in it, the
 * people waiting for Confirm NDA and the accepted applicants joining. A head
 * gets their department's page instead. Which divisions it lists follows the
 * viewing reach; what the page offers to change follows `readActor`, so a
 * grant at Can view shows the people and no action (issue #351).
 */
export async function readDivisionMembers(identity: DashboardIdentity, divisionId: number | null): Promise<MemberDirectory> {
  const snapshotRead = readTeamSnapshot();
  const [snapshot, viewing] = await Promise.all([snapshotRead, readViewingActor(identity, snapshotRead.then((s) => s.org))]);
  if (viewing === null || viewing.kind === "team") return NO_MEMBERS;
  if (viewing.kind === "head") return readDepartmentMembers(identity, viewing, snapshot);
  const reach = reachOf(identity, viewing, snapshot.org);
  const division = reach.find((id) => id === divisionId) ?? reach[0];
  if (division === undefined) return NO_MEMBERS;
  // The accepted applicants joining are applications data: listed only for a
  // viewer who reads the Applications area here (issue #471).
  const departmentId = snapshot.org.divisions.find((d) => d.id === division)?.departmentId;
  const readsJoining = departmentId !== undefined && readsAreaIn(identity, "applications", { divisionId: division, departmentId });
  const [joining, waiting, actor] = await Promise.all([
    readsJoining ? readJoining(division) : [],
    readWaiting(division),
    readActor(identity, snapshot.org),
  ]);
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
  type: RoleType;
  title: string;
  started_at: string;
  /** The full-access seat the row is flagged as (`seatHandOver`, ./hand-over.ts). */
  fullAccess: FlaggedSeat | null;
};

/** The seat a stored `roles.full_access` value flags, or null. */
function seatOfFlag(flag: SeatFlag | null): FlaggedSeat | null {
  return flag === null ? null : SEAT_OF_FLAG[flag];
}

async function activeRoles(memberId: number): Promise<ActiveRole[]> {
  const rows = await getDb()
    .select({
      id: roles.id,
      division_id: roles.divisionId,
      dept_id: roles.deptId,
      type: roles.type,
      title: roles.title,
      started_at: roles.startedAt,
      full_access: roles.fullAccess,
    })
    .from(roles)
    .where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt)));
  return rows.map(({ full_access, ...r }) => ({ ...r, fullAccess: seatOfFlag(full_access) }));
}

/**
 * The seat a hand-over moves (`seatHandOver`, ./hand-over.ts), as the
 * successor's inserted role row carries it: nothing for anyone else, so a
 * hand-over of a role with no seat inserts what it always did.
 */
function seatFor(seat: SeatMove | null, memberId: number): { fullAccess?: SeatFlag } {
  return seat !== null && seat.to === memberId ? { fullAccess: FLAG_OF_SEAT[seat.seat] } : {};
}

/** The seat a hand-over moves, written onto the successor's existing role row `rowId`, in the caller's batch. */
function seatOnto(db: Tx, seat: SeatMove | null, rowId: number | undefined): BatchItem<"pg">[] {
  if (seat === null || rowId === undefined) return [];
  return [db.update(roles).set({ fullAccess: FLAG_OF_SEAT[seat.seat] }).where(and(eq(roles.id, rowId), isNull(roles.leavedAt)))];
}

function roleSeat(r: ActiveRole): RoleSeat {
  return { type: r.type, divisionId: r.division_id, since: r.started_at, departmentId: r.dept_id, title: r.title };
}

/** The person's lead and member rows in `divisionId` (`isDivisionRole`): never a seat kept on its row. */
function divisionRowsIn(active: readonly ActiveRole[], divisionId: number): ActiveRole[] {
  return active.filter((r) => r.division_id === divisionId && isDivisionRole(roleSeat(r)));
}

/** The person's division roles as memberships (`membershipsOfRoles`, ./team.ts); a seat kept on a division row is none. */
function membershipsOfActive(active: readonly ActiveRole[]): Memberships {
  return membershipsOfRoles(active.map(roleSeat).filter(isDivisionRole));
}

/**
 * The person's active roles in the divisions the viewer changes people in
 * (`actor`, from `readActor`): every role for the team, and for a head or a
 * division lead the roles in the divisions they reach, each division a lead
 * of several included (issues #185, #342); never the viewer. Null when none
 * is left.
 */
async function rolesTheViewerChanges(identity: DashboardIdentity, actor: TeamActor | null, personId: number): Promise<ActiveRole[] | null> {
  if (personId === identity.memberId || actor === null) return null;
  const active = await activeRoles(personId);
  if (active.length === 0) return null;
  if (actor.kind === "team") return active;
  const { org } = await readTeamSnapshot();
  const reached = active.filter((r) => r.division_id !== null && reachesDivision(actor, r.division_id, org));
  return reached.length > 0 ? reached : null;
}

const ROLE_TYPE: Readonly<Record<EditableRole, "lead" | "core">> = { "division-lead": "lead", member: "core" };

function done(): true {
  refreshAfter("team", updateTag);
  return true;
}

const today = () => new Date().toISOString().slice(0, 10);

async function saveMember(identity: DashboardIdentity, personId: number, edit: MemberEdit): Promise<boolean> {
  const { org } = await readTeamSnapshot();
  const actor = await readActor(identity, org);
  const active = await rolesTheViewerChanges(identity, actor, personId);
  if (actor === null || active === null) return false;
  // The panel's role is the role in one division: the home one among those
  // the viewer reaches. Their other divisions keep their roles (issue #229).
  const division = homeDivision(membershipsOfActive(active));
  // Changing who leads a division is the head's, never a division lead's (#231).
  if (edit.role !== null && division !== null && !mayChangeDivision(actor, division, org).allowed) return false;
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
 * Promote is refused (#231). "Hand over the division" is a hand-over (issue
 * #253): the lead becomes an advisor in the division or leaves the team, as
 * `promotingLead` says, never a member.
 */
async function promote(identity: DashboardIdentity, personId: number, promotion: Promotion): Promise<boolean> {
  const leadId = identity.memberId;
  if (identity.kind !== "division-lead" || leadId === null) return false;
  const { org } = await readTeamSnapshot();
  const actor = await readActor(identity, org);
  // Their member role in a division the lead leads, whichever of the lead's divisions it is (issue #185).
  const theirs = (await rolesTheViewerChanges(identity, actor, personId))?.find((r) => r.type === "core");
  const division = theirs?.division_id ?? null;
  if (actor === null || !theirs || division === null || !mayChangeDivision(actor, division, org).allowed) return false;
  const myRoles = await activeRoles(leadId);
  const mine = myRoles.find((r) => r.division_id === division && r.type === "lead");
  const stepping = promotingLead(promotion, division);
  if (stepping !== null && !mine) return false;
  // A seat on the lead row they hand over moves to the person promoted, on the row this promotes (issue #501).
  const handed = stepping !== null && mine ? seatHandOver([mine], [personId]) : null;
  if (handed !== null && !handed.ok) return false;
  const seat = handed?.value ?? null;
  const notice = await promotionOf(personId, division, promotion.mode, leadId);
  const on = today();
  await runAuditBatch((db) => [
    db.update(roles).set({ type: "lead", ...seatFor(seat, personId) }).where(eq(roles.id, theirs.id)),
    ...(stepping !== null && mine ? steppingDownWrites(db, { memberId: leadId, active: myRoles }, stepping, [mine.id], on) : []),
    // The insert reads the department's heads itself, inside this batch (issue #227).
    ...(notice ? [promotedNoticesInsert(db, notice)] : []),
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

/** Someone with a lead or member role in `divisionId`, never the viewer: the people a row's actions reach. */
async function personIn(identity: DashboardIdentity, personId: number, divisionId: number): Promise<ActiveRole[] | null> {
  if (personId === identity.memberId) return null;
  const active = await activeRoles(personId);
  return divisionRowsIn(active, divisionId).length > 0 ? active : null;
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
 * "Remove from <division>": the person's lead and member rows in that
 * division end and its division access goes; every other division stays, and
 * so does a seat kept on its row (`divisionRowsIn`). Refused for someone whose
 * only division it is and who holds no seat, and for a lead when a division
 * lead asks (`removalFrom`, ./team.ts).
 */
async function removeFromDivision(identity: DashboardIdentity, personId: number, divisionId: number): Promise<boolean> {
  const acting = await actingOn(identity, divisionId);
  const active = acting && (await personIn(identity, personId, divisionId));
  if (!acting || !active) return false;
  if (removalFrom(acting.actor, standingOfRoles(active.map(roleSeat), acting.org), divisionId, acting.org).kind !== "offered") return false;
  const ending = divisionRowsIn(active, divisionId).map((r) => r.id);
  await runAuditBatch((db) => [
    db
      .update(roles)
      .set({ leavedAt: today() })
      .where(and(inArray(roles.id, ending), isNull(roles.leavedAt))),
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

  const active = await personIn(identity, target.id, divisionId);
  if (active === null) return refused("You can edit only people in your division.");
  const titled = divisionRowsIn(active, divisionId).map((r) => r.id);
  await runAuditBatch((db) => [
    db
      .update(roles)
      .set({ title: title ?? "" })
      .where(and(inArray(roles.id, titled), isNull(roles.leavedAt))),
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
  if (old !== null) await deleteBestEffort({ store: "public", area: "member-photo", pathname: old, remove: deletePublicFile });
  done();
  return written(null);
}

// New division, Edit division and Close division (issue #232, boards 68b to
// 68c and 69d), from the Team tree's edit view (#251). `planDivisionSave` and
// `closeRefusal` (./division-edit.ts) decide what may change; each write
// below runs what they allow in one audited batch. Nothing here clears a
// division's `closed_at`: a closed division never opens again.

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

/** The division a save is about: open on the chart. A closed one is none, so no save opens it again. */
function savedSubject(divisionId: number, org: OrgChart): Exclude<DivisionSubject, { kind: "new" }> | null {
  const open = org.divisions.find((d) => d.id === divisionId);
  return open ? { kind: "open", division: open } : null;
}

/** An active row kept on a division, with the full-access seat it is flagged as. */
type HeldRow = DivisionRow & SeatRow;

/** Every active row kept on the division, seats included: `divisionRowWrites` picks the ones a plan touches. */
async function heldRows(divisionId: number): Promise<HeldRow[]> {
  const rows = await getDb()
    .select({ id: roles.id, member_id: roles.memberId, type: roles.type, full_access: roles.fullAccess })
    .from(roles)
    .where(and(eq(roles.divisionId, divisionId), isNull(roles.leavedAt)));
  return rows.flatMap((r) => (r.member_id === null ? [] : [{ id: r.id, memberId: r.member_id, type: r.type, fullAccess: seatOfFlag(r.full_access) }]));
}

/**
 * Someone who leaves the team from a structure edit (an old lead's or head's
 * "Leave the team"): every active role ends and every
 * access row goes, their years on the team are set from their roles, and the
 * leave is recorded, so they appear on Alumni.
 */
function leaveTeamWrites(db: Tx, leaver: { readonly memberId: number; readonly active: readonly ActiveRole[] }, on: string) {
  const { memberId, active } = leaver;
  const year = Number(on.slice(0, 4));
  return [
    db.update(roles).set({ leavedAt: on }).where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt))),
    db.delete(scopes).where(eq(scopes.memberId, memberId)),
    db
      .update(members)
      .set({ teamFrom: Math.min(year, ...active.map((r) => Number(r.started_at.slice(0, 4)))), teamTo: year })
      .where(eq(members.memberId, memberId)),
    db.insert(teamLeaves).values({ memberId, reason: null }),
  ];
}

/** The unit a role row is kept on: its division (as every division role, with no department), its department, or neither for an Advisor role on the whole team. */
function advisorUnit(place: AdvisorPlace): { deptId: number | null; divisionId: number | null } {
  switch (place.kind) {
    case "team":
      return { deptId: null, divisionId: null };
    case "department":
      return { deptId: place.departmentId, divisionId: null };
    case "division":
      return { deptId: null, divisionId: place.divisionId };
  }
}

/**
 * What one hand-over writes for the person stepping down (`steppingDown`,
 * ./hand-over.ts), in the caller's batch. "leave" is Leaves the team: every
 * role and access ends and they move to Alumni. "advisor" ends `ending`, the
 * rows of the role they handed over, and starts one Advisor role where the
 * rule puts it. A lead or head then loses every access row. A former team
 * leader keeps theirs, and the full access the team leader role gave them
 * stays as an org-wide row (`viewerKindOf`, ./viewer.ts) that the new team
 * leader can change in Access; it is added only when they hold none.
 */
function steppingDownWrites(
  db: Tx,
  person: { readonly memberId: number; readonly active: readonly ActiveRole[] },
  step: SteppingDown,
  ending: readonly number[],
  on: string,
  /** Org-wide or admin rows they hold now: a former team leader who holds one keeps it, and gets no second. */
  fullAccessRows = 0,
): BatchItem<"pg">[] {
  if (step.kind === "leave") return leaveTeamWrites(db, person, on);
  const { memberId } = person;
  return [
    ...(ending.length === 0 ? [] : [db.update(roles).set({ leavedAt: on }).where(and(inArray(roles.id, [...ending]), isNull(roles.leavedAt)))]),
    db.insert(roles).values({ memberId, ...advisorUnit(step.place), title: ADVISOR_TITLE, type: "advisor", startedAt: on }),
    ...(step.access === "ends"
      ? [db.delete(scopes).where(eq(scopes.memberId, memberId))]
      : fullAccessRows > 0
        ? []
        : [db.insert(scopes).values({ memberId, givenBy: memberId, scope: "org", target: "all", accessLevel: "edit" })]),
  ];
}

/**
 * Writes a checked plan in one batch: the division row (inserted for New
 * division), each lead change in this division only, old leads who leave it
 * (roles ended, its access removed), become an advisor in it (lead row
 * ended, Advisor role started, all their access removed) or leave the team
 * (every role and access ends, as Leaves the team does), and new members. The rows ended or changed
 * in the division are the lead and member rows `divisionRowWrites` picks by
 * id, so a seat kept on a division row stays the seat. A full-access seat on
 * a replaced lead's lead row moves to the one new lead, on the row this save
 * makes a lead's (`seatHandOver`, issue #501); with more than one new lead
 * the save is refused before anything is written. The emails new to the
 * team wait for Confirm NDA after it, as Add member records them.
 */
async function writeDivisionPlan(
  identity: DashboardIdentity,
  divisionId: number,
  plan: DivisionPlan,
  create: { readonly departmentId: number } | null,
): Promise<WriteResult<null>> {
  const on = today();
  const held = create ? [] : await heldRows(divisionId);
  const handed = seatHandOver(
    held.filter((r) => r.type === "lead" && plan.replaced.includes(r.memberId)),
    [...plan.promote, ...plan.joinAsLead],
  );
  if (!handed.ok) return refused(handed.error);
  const seat = handed.value;
  const leavers = await Promise.all(plan.leaveTeam.map(async (memberId) => ({ memberId, active: await activeRoles(memberId) })));
  const newRole = (memberId: number, type: "lead" | "core") => ({ memberId, divisionId, title: "", type, startedAt: on });
  const rows = divisionRowWrites(plan, divisionId, held);
  const open = (ids: readonly number[]) => and(inArray(roles.id, [...ids]), isNull(roles.leavedAt));
  const joining = [...plan.joinAsLead.map((id) => ({ ...newRole(id, "lead"), ...seatFor(seat, id) })), ...plan.joinAsMember.map((id) => newRole(id, "core"))];
  // A new lead promoted from a member takes the seat on the row that becomes a lead's.
  const seatRow = held.find((r) => seat !== null && r.memberId === seat.to && rows.toLead.includes(r.id))?.id;

  await runAuditBatch((db) => [
    create
      ? db.insert(divisions).values({ id: divisionId, deptId: create.departmentId, name: plan.name, code: plan.code })
      : db
          .update(divisions)
          .set({ name: plan.name, code: plan.code })
          .where(and(eq(divisions.id, divisionId), isNull(divisions.closedAt))),
    ...(rows.end.length === 0 ? [] : [db.update(roles).set({ leavedAt: on }).where(open(rows.end))]),
    ...(rows.toLead.length === 0 ? [] : [db.update(roles).set({ type: "lead" }).where(open(rows.toLead))]),
    ...seatOnto(db, seat, seatRow),
    ...(joining.length === 0 ? [] : [db.insert(roles).values(joining)]),
    ...(rows.toMember.length === 0 ? [] : [db.update(roles).set({ type: "core" }).where(open(rows.toMember))]),
    ...plan.leaveDivision.map((id) =>
      db.delete(scopes).where(and(eq(scopes.memberId, id), eq(scopes.scope, "division"), eq(scopes.divisionId, divisionId))),
    ),
    // A replaced lead's lead row ends with `rows.end`; the Advisor role starts here (issue #253).
    ...plan.advise.flatMap((memberId) =>
      steppingDownWrites(db, { memberId, active: [] }, steppingDown({ kind: "lead", divisionId }, "advisor"), [], on),
    ),
    ...leavers.flatMap((leaver) => leaveTeamWrites(db, leaver, on)),
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
  const subject = savedSubject(divisionId, snapshot.org);
  if (actor === null || subject === null) return refused("That division is not one you manage.");
  const planned = planDivisionSave({ actor, org: snapshot.org, subject, save: checked.value, team: teamPeopleOf(snapshot) });
  if (!planned.ok) return refused(planned.error);
  const result = await writeDivisionPlan(identity, divisionId, planned.plan, null);
  // Position codes are built from the division's code when read, so a new code reaches every position at once.
  if (planned.plan.codeChanged) refreshPositions();
  return result;
}

function refreshPositions() {
  refreshAfter("positions", updateTag);
}

/**
 * Close division (board 68c): refused while anyone holds a lead or member role
 * in it (`divisionClosing`: a seat row kept on it is not a person in it, as the
 * dialog counts, and neither is an Advisor role) or waits for their NDA there.
 * Otherwise, in one batch: the division closes, its open positions close,
 * every access given in it is removed, and each Advisor role in it ends and
 * starts again on the division's department (issue #441), so the advisor
 * stays there with the Advisor role.
 */
async function closeDivision(identity: DashboardIdentity, divisionId: number): Promise<WriteResult<null>> {
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  if (actor === null) return refused("Only a department head or the team leader closes a division.");
  const db = getDb();
  const [held, [waiting]] = await Promise.all([
    heldRows(divisionId),
    db.select({ count: sql<number>`count(*)::int` }).from(teamJoins).where(eq(teamJoins.divisionId, divisionId)),
  ]);
  const { people, advisors } = divisionClosing(divisionId, held);
  const refusal = closeRefusal(actor, snapshot.org, divisionId, { people: people.length, waiting: Number(waiting?.count ?? 0) });
  if (refusal !== null) return refused(refusal);
  const departmentId = snapshot.org.divisions.find((d) => d.id === divisionId)!.departmentId;
  const on = today();
  await runAuditBatch((tx) => [
    ...closeDivisionWrites(tx, divisionId, on),
    ...(advisors.length === 0
      ? []
      : [
          tx
            .update(roles)
            .set({ leavedAt: on })
            .where(and(inArray(roles.id, advisors.map((r) => r.id)), isNull(roles.leavedAt))),
          tx.insert(roles).values(
            advisors.map(({ memberId }) => ({ memberId, ...advisorUnit(advisorAfterDivisionCloses(departmentId)), title: ADVISOR_TITLE, type: "advisor" as const, startedAt: on })),
          ),
        ]),
  ]);
  done();
  refreshPositions();
  return written(null);
}

type Tx = Parameters<Parameters<typeof runAuditBatch>[0]>[0];

/** What closing one empty division writes: the division closes, its open positions close, and the access given in it goes. */
function closeDivisionWrites(tx: Tx, divisionId: number, on: string): [BatchItem<"pg">, ...BatchItem<"pg">[]] {
  return [
    tx.update(divisions).set({ closedAt: on }).where(and(eq(divisions.id, divisionId), isNull(divisions.closedAt))),
    tx.update(applyPositions).set({ status: false }).where(and(eq(applyPositions.divisionId, divisionId), eq(applyPositions.status, true))),
    tx.delete(scopes).where(and(eq(scopes.scope, "division"), eq(scopes.divisionId, divisionId))),
  ];
}

// New department, Edit department and Close department (issue #251, boards
// 77d to 77f). `planDepartmentCreate`, `planDepartmentSave` and
// `planDepartmentClose` (./department-edit.ts) decide what may change; each
// write below runs what they allow in one audited batch.

/** The title a head's role carries, as every head row holds it: "Head of Aerodynamics". */
const headTitle = (department: string) => `Head of ${department}`;

/** New department (board 77d): the department and its head's role, in one batch. The head keeps every role they hold. */
async function createDepartment(identity: DashboardIdentity, input: unknown): Promise<WriteResult<number>> {
  const checked = checkDepartmentCreate(input);
  if (!checked.ok) return refused(checked.error);
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  const planned = planDepartmentCreate({ actor, org: snapshot.org, save: checked.value, team: teamPeopleOf(snapshot) });
  if (!planned.ok) return refused(planned.error);
  const { name, code, kind, headId } = planned.value;
  // The batch cannot read one write's result in the next, so the department id is taken first.
  const next = await getDb().execute(sql`select nextval(pg_get_serial_sequence('departments', 'id'))::int as id`);
  const departmentId = Number((next.rows[0] as { id: number }).id);
  await runAuditBatch((db) => [
    db.insert(departments).values({ id: departmentId, name, code, kind }),
    db.insert(roles).values({ memberId: headId, deptId: departmentId, divisionId: null, title: headTitle(name), type: "head", startedAt: today() }),
  ]);
  done();
  return written(departmentId);
}

/** Edit department's Save changes (board 77e): the name, the code and the kind; a new name reaches the head's title too. */
async function saveDepartment(identity: DashboardIdentity, departmentId: number, input: unknown): Promise<WriteResult<null>> {
  const checked = checkDepartmentSave(input);
  if (!checked.ok) return refused(checked.error);
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  const isHeadRow = headRowOf(departmentId, snapshot.org);
  const headIds = [...new Set(snapshot.roles.filter((r) => r.leaved_at === null && isHeadRow(r)).map((r) => r.member_id))];
  const planned = planDepartmentSave({ actor, org: snapshot.org, departmentId, save: checked.value, team: teamPeopleOf(snapshot), headIds });
  if (!planned.ok) return refused(planned.error);
  const { name, code, kind, nameChanged, head } = planned.value;
  const on = today();
  const stepping = head?.steppingDown ?? null;
  const replaced = head === null || stepping === null ? [] : await Promise.all(head.from.map(async (memberId) => ({ memberId, active: await activeRoles(memberId) })));
  // A seat on a head row they hand over moves to the new head's row (issue #501).
  const handed = head === null ? null : seatHandOver(replaced.flatMap((person) => person.active.filter(isHeadRow)), [head.to]);
  if (handed !== null && !handed.ok) return refused(handed.error);
  const seat = handed?.value ?? null;
  await runAuditBatch((db) => [
    db
      .update(departments)
      .set({ name, code, kind })
      .where(and(eq(departments.id, departmentId), isNull(departments.closedAt))),
    ...(nameChanged
      ? [
          db
            .update(roles)
            .set({ title: headTitle(name) })
            .where(and(eq(roles.deptId, departmentId), eq(roles.type, "head"), isNull(roles.leavedAt))),
        ]
      : []),
    // Change head (issue #253): the head they replace steps down as the editor picked, then the new head's role starts.
    ...(stepping === null ? [] : replaced.flatMap((person) => steppingDownWrites(db, person, stepping, person.active.filter(isHeadRow).map((r) => r.id), on))),
    ...(head === null
      ? []
      : [db.insert(roles).values({ memberId: head.to, deptId: departmentId, divisionId: null, title: headTitle(name), type: "head", startedAt: on, ...seatFor(seat, head.to) })]),
  ]);
  done();
  return written(null);
}

/** Whether an active row is a head role of the department, wherever it is kept (`headDepartmentOf`). */
function headRowOf(departmentId: number, org: OrgChart) {
  return (r: { type: RoleType; dept_id: number | null; division_id: number | null }) =>
    r.type === "head" && headDepartmentOf({ departmentId: r.dept_id, divisionId: r.division_id }, org) === departmentId;
}

/**
 * Close department (Owner decision, 2026-10-19), in one batch:
 * - the department closes and its department access goes;
 * - every division of it closes as Close division closes it: its open
 *   positions close and the access given in it goes;
 * - every person in it moves where the closer picked (`planDepartmentClose`):
 *   each role they held in the department ends (its head role wherever the
 *   row is kept, every lead, member and Advisor row in its divisions, and any
 *   role kept on the department), and one role starts in the destination, a
 *   member's or an Advisor role. A former head or lead who becomes an advisor
 *   there loses every access row (`advisingIn`); everyone else keeps the
 *   access they hold elsewhere.
 * Nobody leaves the team from here. A seat kept on one of its division rows
 * (the team leader's, another department's head) is not a role in the
 * department, so it stays.
 */
async function closeDepartment(identity: DashboardIdentity, departmentId: number, input: unknown): Promise<WriteResult<null>> {
  const checked = checkDepartmentClose(input);
  if (!checked.ok) return refused(checked.error);
  const snapshot = await readTeamSnapshot();
  const actor = await readActor(identity, snapshot.org);
  const divisionIds = snapshot.org.divisions.filter((d) => d.departmentId === departmentId).map((d) => d.id);
  const waiting =
    divisionIds.length === 0
      ? []
      : await getDb()
          .select({ division_id: teamJoins.divisionId, count: sql<number>`count(*)::int` })
          .from(teamJoins)
          .where(inArray(teamJoins.divisionId, divisionIds))
          .groupBy(teamJoins.divisionId);
  const planned = planDepartmentClose({
    actor,
    org: snapshot.org,
    departmentId,
    close: checked.value,
    people: closingPeople(recordsOf(snapshot), snapshot.org, departmentId),
    waiting: Object.fromEntries(waiting.flatMap((w) => (w.division_id === null ? [] : [[w.division_id, Number(w.count)]]))),
  });
  if (!planned.ok) return refused(planned.error);

  const on = today();
  const { moves } = planned.value;
  const memberIds = moves.map((m) => m.personId);
  const held =
    memberIds.length === 0
      ? []
      : await getDb()
          .select({ id: roles.id, type: roles.type, dept_id: roles.deptId, division_id: roles.divisionId })
          .from(roles)
          .where(and(inArray(roles.memberId, memberIds), isNull(roles.leavedAt)));
  // Every role held in the department: its head rows wherever kept (`headDepartmentOf`), its division roles, and roles kept on it.
  const isHeadRow = headRowOf(departmentId, snapshot.org);
  const ending = held
    .filter(
      (r) =>
        isHeadRow(r) ||
        (r.division_id !== null && divisionIds.includes(r.division_id) && isDivisionRole({ type: r.type, divisionId: r.division_id })) ||
        (r.division_id === null && r.dept_id === departmentId),
    )
    .map((r) => r.id);

  await runAuditBatch((tx) => [
    tx.update(departments).set({ closedAt: on }).where(and(eq(departments.id, departmentId), isNull(departments.closedAt))),
    ...divisionIds.flatMap((divisionId) => closeDivisionWrites(tx, divisionId, on)),
    tx.delete(scopes).where(and(eq(scopes.scope, "department"), eq(scopes.deptId, departmentId), isNull(scopes.divisionId))),
    ...(ending.length === 0 ? [] : [tx.update(roles).set({ leavedAt: on }).where(and(inArray(roles.id, ending), isNull(roles.leavedAt)))]),
    ...(moves.length === 0
      ? []
      : [
          tx.insert(roles).values(
            moves.map(({ personId, to, becomes }) => ({
              memberId: personId,
              ...advisorUnit(to),
              title: becomes.kind === "advisor" ? ADVISOR_TITLE : "",
              type: becomes.kind === "advisor" ? ("advisor" as const) : ("core" as const),
              startedAt: on,
            })),
          ),
        ]),
    ...moves.flatMap(({ personId, becomes }) => (becomes.kind === "advisor" && becomes.access === "ends" ? [tx.delete(scopes).where(eq(scopes.memberId, personId))] : [])),
  ]);
  done();
  refreshPositions();
  return written(null);
}

/**
 * "Hand over the role" on the Team Leader box (board 77i, issue #253), in one
 * batch: the new person's team leader role starts, so the team leader's
 * powers (deciding orders, giving "Approve orders", handing the role over)
 * move with it (`seatOf`, ./viewer.ts); the former team leader's role ends,
 * and they become a team-level advisor who keeps their access, or leave the
 * team (`steppingDown`). Only the current team leader may: the server refuses
 * everyone else, the operations lead and the IT lead included.
 */
async function handOverTeamLeader(identity: DashboardIdentity, input: unknown): Promise<WriteResult<null>> {
  const checked = checkTeamLeaderHandOver(input);
  if (!checked.ok) return refused(checked.error);
  const snapshot = await readTeamSnapshot();
  const leaders = new Set(snapshot.roles.filter((r) => r.leaved_at === null && r.type === "president").map((r) => r.member_id));
  const leaderId = identity.memberId !== null && leaders.has(identity.memberId) ? identity.memberId : null;
  const planned = planTeamLeaderHandOver({
    viewer: { seat: seatOf(identity), selfId: identity.memberId },
    leaderId,
    handOver: checked.value,
    team: teamPeopleOf(snapshot),
  });
  if (!planned.ok) return refused(planned.error);
  const { from, to, steppingDown: step } = planned.value;
  const [active, [held]] = await Promise.all([
    activeRoles(from),
    getDb()
      .select({ count: sql<number>`count(*)::int` })
      .from(scopes)
      .where(and(eq(scopes.memberId, from), inArray(scopes.scope, ["admin", "org"]))),
  ]);
  const seat = active.filter((r) => r.type === "president");
  const on = today();
  await runAuditBatch((db) => [
    db.insert(roles).values({ memberId: to, deptId: null, divisionId: null, title: seat[0]?.title.trim() || "Team Leader", type: "president", startedAt: on }),
    ...steppingDownWrites(db, { memberId: from, active }, step, seat.map((r) => r.id), on, Number(held?.count ?? 0)),
  ]);
  done();
  return written(null);
}

/**
 * What Confirm writes beyond the notice (board 62c, issue #262): the
 * successor takes the role, then the sender steps down as they chose
 * (`steppingDownWrites`). A lead's successor leads the division (their rows in
 * it become lead rows, unless they lead it already); a head's successor gets a
 * head role on the department and keeps every role they hold. A seat on the
 * role handed over moves to the successor's row (`seatHandOver`, issue #501).
 */
async function confirmedHandOverWrites(
  plan: Extract<HandOverAnswerPlan, { answer: "confirm" }>,
  org: OrgChart,
  on: string,
): Promise<(db: Tx) => BatchItem<"pg">[]> {
  const { request, steppingDown: step } = plan;
  const { fromId, toId, role } = request;
  const active = await activeRoles(fromId);
  const ending = active.filter(
    role.kind === "lead" ? (r) => r.division_id === role.divisionId && r.type === "lead" : headRowOf(role.departmentId, org),
  );
  const handed = seatHandOver(ending, [toId]);
  // Never refused: a hand-over request names one successor.
  if (!handed.ok) throw new Error(handed.error);
  const seat = handed.value;
  const endingIds = ending.map((r) => r.id);
  if (role.kind === "lead") {
    const theirs = (await heldRows(role.divisionId)).filter((r) => r.memberId === toId);
    const promote = theirs.some((r) => r.type === "lead" || r.type === "head") ? [] : theirs.map((r) => r.id);
    const seatRow = promote[0] ?? theirs.find((r) => r.type === "lead")?.id ?? theirs[0]?.id;
    return (db) => [
      ...(promote.length === 0 ? [] : [db.update(roles).set({ type: "lead" }).where(and(inArray(roles.id, promote), isNull(roles.leavedAt)))]),
      ...seatOnto(db, seat, seatRow),
      ...steppingDownWrites(db, { memberId: fromId, active }, step, endingIds, on),
    ];
  }
  const department = org.departments.find((d) => d.id === role.departmentId)?.name ?? "";
  return (db) => [
    db.insert(roles).values({ memberId: toId, deptId: role.departmentId, divisionId: null, title: headTitle(department), type: "head", startedAt: on, ...seatFor(seat, toId) }),
    ...steppingDownWrites(db, { memberId: fromId, active }, step, endingIds, on),
  ];
}

/**
 * Confirm or Decline on a hand-over sent from My profile (board 62c, issue
 * #262), checked by `planHandOverAnswer`: only the next level up answers.
 * The request is marked answered first, so a second answer finds it gone;
 * then one batch writes the sender's notice and, on Confirm, the hand-over.
 * If that batch fails, the request waits again.
 */
export async function answerHandOver(identity: DashboardIdentity, requestId: number, answer: HandOverAnswer): Promise<WriteResult<null>> {
  const viewerId = identity.memberId;
  const [request] = await readWaitingHandOvers({ id: requestId });
  if (!request || viewerId === null) return refused("This hand-over was already answered.");
  const snapshot = await readTeamSnapshot();
  const team = teamPeopleOf(snapshot);
  const planned = planHandOverAnswer({ viewerId, request, answer, team, org: snapshot.org });
  if (!planned.ok) return refused(planned.error);
  const plan = planned.value;
  const { recipientId, notice } = answerNoticeOf(plan, team, snapshot.org);
  const on = today();
  const claimed = await runAuditQuery((db) =>
    db
      .update(handOverRequests)
      .set({ decision: answer === "confirm" ? "confirmed" : "declined", decidedBy: viewerId, decidedAt: new Date().toISOString() })
      .where(and(eq(handOverRequests.id, requestId), isNull(handOverRequests.decision)))
      .returning({ id: handOverRequests.id }),
  );
  if (claimed.length === 0) return refused("This hand-over was already answered.");
  try {
    const writes = plan.answer === "confirm" ? await confirmedHandOverWrites(plan, snapshot.org, on) : () => [];
    await runAuditBatch((db) => [
      db.insert(dashboardNotices).values({ recipientId, subjectId: viewerId, kind: notice.kind, data: notice.data }),
      ...writes(db),
    ]);
  } catch (error) {
    await runAuditQuery((db) =>
      db.update(handOverRequests).set({ decision: null, decidedBy: null, decidedAt: null }).where(eq(handOverRequests.id, requestId)),
    );
    throw error;
  }
  done();
  return written(null);
}

/** The Members page's writes on the database. */
export function databaseTeamWrites(
  identity: DashboardIdentity,
): Omit<TeamWrites, "setAlumnusShown" | "fixAlumnus" | "setAlumnusPhoto" | "addAdvisor"> {
  return {
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
    createDepartment: (input) => createDepartment(identity, input),
    saveDepartment: (departmentId, input) => saveDepartment(identity, departmentId, input),
    closeDepartment: (departmentId, input) => closeDepartment(identity, departmentId, input),
    handOverTeamLeader: (input) => handOverTeamLeader(identity, input),
  };
}
