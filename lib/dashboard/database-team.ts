import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { applications, applyPositions, members, roles, scopes, teamLeaves, users } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { alumniMove, type MoveReach } from "./alumni-move";
import { DashboardRefused, type TeamWrites } from "./data";
import { promotedNoticesInsert, promotionOf } from "./database-notices";
import { moveApplication } from "./database-recruitment";
import type { DashboardIdentity } from "./database";
import {
  homeDivision,
  membershipsOfRoles,
  type Departure,
  type EditableRole,
  type Joining,
  type MemberEdit,
  type Memberships,
  type PromoteMode,
} from "./team";
import { TEAM_ROSTER_CACHE_TAG } from "./team-database";

// The Members page's reads and writes on the database (Dashboard v2 boards 59
// to 59e, issue #172): who is joining the lead's division, and the member
// panel's Save, Promote, Move to alumni and Confirm join (the Applications
// page's own move, ./database-recruitment.ts). Every write checks
// on the server that the person is the viewer's to change, runs through the
// audit helpers (.patterns/audited-mutations.md), and drops the cached
// roster so the Team pages read the change.

/**
 * The division a lead's Members page is about; null for anyone else. A lead of
 * several divisions sees the one their primary role is in, as before; #231
 * gives the page every division they lead.
 */
export function leadDivisionId(identity: DashboardIdentity): number | null {
  if (identity.kind !== "division-lead") return null;
  return identity.role?.divisionId ?? identity.divisionIds[0] ?? null;
}

function nameOf(row: { first_name: string | null; last_name: string | null; email: string }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
}

/**
 * Accepted applicants to the division's positions who are not members yet
 * (board 59). The application stays accepted; Confirm join, once the signed
 * NDA arrived, makes them a member. Someone already on the team joins from the
 * Applications page (board 58h2, issue #229); the banner does not list them
 * until #231.
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

type ActiveRole = { id: number; division_id: number | null; type: "president" | "head" | "lead" | "core" | null; started_at: string };

async function activeRoles(memberId: number): Promise<ActiveRole[]> {
  return getDb()
    .select({ id: roles.id, division_id: roles.divisionId, type: roles.type, started_at: roles.startedAt })
    .from(roles)
    .where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt)));
}

/** The person's division roles as memberships (`membershipsOfRoles`, ./team.ts). */
function membershipsOfActive(active: readonly ActiveRole[]): Memberships {
  return membershipsOfRoles(active.map((r) => ({ type: r.type, divisionId: r.division_id, since: r.started_at })));
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

async function saveMember(identity: DashboardIdentity, personId: number, edit: MemberEdit): Promise<boolean> {
  const active = await rolesTheViewerChanges(identity, personId);
  if (active === null) return false;
  // The panel's role is the role in one division: the lead's own, or for the
  // operations lead the person's home division. Their other divisions keep
  // their roles (issue #229).
  const division = homeDivision(membershipsOfActive(active));
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
 * division's department (#188), in one batch. No email is sent.
 */
async function promote(identity: DashboardIdentity, personId: number, mode: PromoteMode): Promise<boolean> {
  const division = leadDivisionId(identity);
  const leadId = identity.memberId;
  if (identity.kind !== "division-lead" || division === null || leadId === null) return false;
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
 * Move to alumni (board 59d) changes only what the viewer manages, as
 * ./alumni-move.ts decides: the operations lead ends every open role and
 * every access grant; a division lead ends the person's roles in their own
 * division and that division's `division` grants. The years and the
 * team_leaves row are written only when no active role is left. The account
 * and the member row stay.
 */
async function moveToAlumni(identity: DashboardIdentity, personId: number, departure: Departure): Promise<boolean> {
  if (personId === identity.memberId) return false;
  const reach = moveReachOf(identity);
  if (reach === null) return false;
  const active = await activeRoles(personId);
  const move = alumniMove(active.map((r) => ({ id: r.id, divisionId: r.division_id })), reach);
  if (move === null) return false;
  const today = new Date().toISOString().slice(0, 10);
  const grants = move.grants;
  const ending = move.ending.map((r) => r.id);
  await runAuditBatch((db) => [
    db.update(roles).set({ leavedAt: today }).where(and(inArray(roles.id, ending), isNull(roles.leavedAt))),
    db
      .delete(scopes)
      .where(
        grants.kind === "team"
          ? eq(scopes.memberId, personId)
          : and(eq(scopes.memberId, personId), eq(scopes.scope, "division"), eq(scopes.divisionId, grants.divisionId)),
      ),
    ...(move.leavesTeam
      ? [
          db.update(members).set({ teamFrom: departure.from, teamTo: departure.to }).where(eq(members.memberId, personId)),
          db.insert(teamLeaves).values({ memberId: personId, reason: departure.reason }),
        ]
      : []),
  ]);
  return done();
}

/** What the viewer's Move to alumni reaches: the whole team for the operations lead, their division for a division lead. */
function moveReachOf(identity: DashboardIdentity): MoveReach | null {
  if (identity.kind === "operations-lead") return { kind: "team" };
  const division = leadDivisionId(identity);
  return division === null ? null : { kind: "division", divisionId: division };
}

/**
 * Confirm join from the Members page's banner (board 59) is the Applications
 * page's Confirm join (58h): the same move, through the same rule, so it waits
 * for the NDA tick, marks the application joined and never gives someone
 * already on the team a second role. Only for the lead's own division.
 */
async function confirmJoin(identity: DashboardIdentity, applicationId: number): Promise<boolean> {
  const division = leadDivisionId(identity);
  if (division === null || identity.memberId === null) return false;
  const [row] = await getDb()
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .where(and(eq(applications.id, applicationId), eq(applyPositions.divisionId, division)))
    .limit(1);
  if (!row) return false;
  try {
    return (await moveApplication(identity, applicationId, { kind: "confirm-join" })).ok;
  } catch (error) {
    if (error instanceof DashboardRefused) return false;
    throw error;
  }
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
  };
}
