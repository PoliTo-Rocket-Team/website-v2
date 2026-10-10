import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { applications, applyPositions, members, roles, scopes, teamLeaves, users } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import type { TeamWrites } from "./data";
import type { DashboardIdentity } from "./database";
import type { Departure, EditableRole, Joining, MemberEdit, PromoteMode } from "./team";
import { TEAM_ROSTER_CACHE_TAG } from "./team-database";

// The Members page's reads and writes on the database (Dashboard v2 boards 59
// to 59e, issue #172): who is joining the lead's division, and the member
// panel's Save, Promote, Move to alumni and Confirm join. Every write checks
// on the server that the person is the viewer's to change, runs through the
// audit helpers (.patterns/audited-mutations.md), and drops the cached
// roster so the Team pages read the change.

/** The division a lead's Members page is about; null for anyone else. */
export function leadDivisionId(identity: DashboardIdentity): number | null {
  if (identity.kind !== "division-lead") return null;
  return identity.role?.divisionId ?? identity.divisionIds[0] ?? null;
}

function nameOf(row: { first_name: string | null; last_name: string | null; email: string }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
}

/**
 * Accepted applicants to the division's positions who are not members yet
 * (board 59). The application stays accepted; Confirm join makes them a member.
 */
export async function readJoining(divisionId: number): Promise<Joining[]> {
  const rows = await getDb()
    .select({
      application_id: applications.id,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
      position: applyPositions.title,
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
  return rows.map((r) => ({ applicationId: r.application_id, name: nameOf(r), position: r.position ?? "a position" }));
}

type ActiveRole = { id: number; division_id: number | null; type: "president" | "head" | "lead" | "core" | null };

async function activeRoles(memberId: number): Promise<ActiveRole[]> {
  return getDb()
    .select({ id: roles.id, division_id: roles.divisionId, type: roles.type })
    .from(roles)
    .where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt)));
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
  // The panel's role is the division role: a lead or a member of a division.
  const divisionRoles = active.filter((r) => r.division_id !== null && (r.type === "lead" || r.type === "core"));
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

async function promote(identity: DashboardIdentity, personId: number, mode: PromoteMode): Promise<boolean> {
  const division = leadDivisionId(identity);
  if (identity.kind !== "division-lead" || division === null || identity.memberId === null) return false;
  const active = await rolesTheViewerChanges(identity, personId);
  const theirs = active?.find((r) => r.division_id === division && r.type === "core");
  if (!theirs) return false;
  const mine = (await activeRoles(identity.memberId)).find((r) => r.division_id === division && r.type === "lead");
  if (mode === "hand-over" && !mine) return false;
  await runAuditBatch((db) => [
    db.update(roles).set({ type: "lead" }).where(eq(roles.id, theirs.id)),
    ...(mode === "hand-over" && mine ? [db.update(roles).set({ type: "core" }).where(eq(roles.id, mine.id))] : []),
  ]);
  return done();
}

/**
 * Their roles end today and every access grant goes; the account and the
 * member row stay. Why they left goes to team_leaves, like a self-leave.
 */
async function moveToAlumni(identity: DashboardIdentity, personId: number, departure: Departure): Promise<boolean> {
  if ((await rolesTheViewerChanges(identity, personId)) === null) return false;
  const today = new Date().toISOString().slice(0, 10);
  await runAuditBatch((db) => [
    db.update(roles).set({ leavedAt: today }).where(and(eq(roles.memberId, personId), isNull(roles.leavedAt))),
    db.delete(scopes).where(eq(scopes.memberId, personId)),
    db.update(members).set({ teamFrom: departure.from, teamTo: departure.to }).where(eq(members.memberId, personId)),
    db.insert(teamLeaves).values({ memberId: personId, reason: departure.reason }),
  ]);
  return done();
}

/**
 * The accepted applicant becomes a member of the position's division: a
 * member row with the lead as the one who confirmed the NDA, linked to their
 * account, and a member role titled with the position. One statement, so
 * nothing is written unless the account is still not a member.
 */
async function confirmJoin(identity: DashboardIdentity, applicationId: number): Promise<boolean> {
  const division = leadDivisionId(identity);
  if (division === null || identity.memberId === null) return false;
  const [row] = await getDb()
    .select({ user_id: applications.userId, title: applyPositions.title, first_name: users.firstName, last_name: users.lastName, email: users.email })
    .from(applications)
    .innerJoin(applyPositions, eq(applications.applyPositionId, applyPositions.id))
    .innerJoin(users, eq(users.id, applications.userId))
    .where(
      and(
        eq(applications.id, applicationId),
        eq(applications.status, "accepted"),
        eq(applyPositions.divisionId, division),
        isNull(users.member),
      ),
    )
    .limit(1);
  if (!row || row.user_id === null) return false;
  const name = nameOf(row);
  const confirmedBy = identity.memberId;
  const result = await runAuditQuery((db) =>
    db.execute(sql`
      with joiner as (
        insert into ${members} (nda_name, nda_confirmed_by)
        select ${name}, ${confirmedBy}
        where exists (select 1 from ${users} where id = ${row.user_id} and member is null)
        returning member_id
      ),
      linked as (
        update ${users} set member = (select member_id from joiner)
        where id = ${row.user_id} and exists (select 1 from joiner)
        returning member
      ),
      placed as (
        insert into ${roles} (member_id, division_id, title, type)
        select member_id, ${division}, ${row.title ?? ""}, 'core' from joiner
        returning id
      )
      select member_id from joiner
    `),
  );
  return result.rows.length > 0 && done();
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
