import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import { departments, divisions, logs, members, orders, roles, scopes, users } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { deleteBestEffort } from "@/lib/storage/best-effort-delete";
import { parsePrivatePathname, privatePathname, type PrivatePathname } from "@/lib/storage/pathname";
import { deletePrivateFile, uploadPrivateFile } from "@/lib/storage/private-store";
import { attributedName } from "./acting-account";
import { actingTitleIn, actingTitlesOf, readActingSeats, readActingTitles } from "./database-acting-account";
import {
  canGiveApproveOrders,
  checkRemoveAllAccess,
  checkRemoveGrant,
  checkSaveAccess,
  grantRowOf,
  LEAD_ROLE_HELD_ACCESS,
  mergeHeld,
  NO_APPROVE_ORDERS,
  NO_ROLE,
  roleAccessOf,
  roleCovers,
  seatLine,
  UNIT_TARGETS,
  WHOLE_TEAM_PLACE,
  type AccessDepartmentUnit,
  type AccessDivision,
  type AccessGrant,
  type AccessLevel,
  type AccessPage,
  type AccessPerson,
  type AccessPlace,
  type AccessTarget,
  type AccessUnit,
  type AccessWrite,
  type ApproveOrdersHolder,
  type HeldAccess,
  type PersonRole,
  type UnitTarget,
} from "./division-access";
import { headTitleOf } from "./team";
import { fullAccessSeatOf, headDivisionsOf, isOffTeam, isTeamLeader, ledDivisionIds, SEAT_OF_FLAG, seatOf, type FullAccessSeat } from "./viewer";
import {
  canEditOrder,
  checkApproveOrdersChange,
  checkDecision,
  checkMarkOrdered,
  checkNewOrder,
  checkOrderDivision,
  orderActions,
  orderingDivisions,
  ordersPageFor,
  ordersScopeOf,
  orgUnitsOf,
  parseEuros,
  stateAfterEdit,
  type Answer,
  type NewOrder,
  type Order,
  type OrderDecision,
  type OrdersPage,
  type OrdersScope,
  type OrderState,
  type OrderUnit,
  type OrgDepartmentUnits,
  type StoredOrderStatus,
} from "./orders";
import type { DashboardIdentity } from "./database";
import { checkedQuote } from "./upload-bytes";
import { refused, written, type Upload, type WriteResult } from "./write";

// The Access pages of a division lead and a department head, and the Orders
// page, read from and written to the database (boards 43 and 44, issue #145;
// Dashboard v2 boards 60 to 61d, issue #172; boards 65 and 65b, issue #230;
// boards 61 to 67b, issue #233). A lead's Access page covers every division
// they lead by role, in one list (issues #185, #488): a grant they hold in a
// division they do not lead adds no Access page there; a head's
// department is their role's; full access covers the whole team (issue
// #238). Orders shows every order in the team and checks
// each write against the viewer's scope on the server. Reads follow
// .patterns/drizzle-reads.md; writes follow .patterns/audited-mutations.md
// and check the lead's access on the server before they run.

function nameOf(row: { first_name: string | null; last_name: string | null; email: string }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
}

/** Who gives a grant, as its scope row stores it: the viewer, and the acting account behind a View as session (issue #605). */
function givenByOf(identity: DashboardIdentity) {
  return { givenBy: identity.memberId, givenByActingAccount: identity.actingAccountId };
}

/**
 * Every open division a lead's Access page covers (issue #185): only the
 * divisions they lead by role (`ledDivisionIds`, issue #488), the one their
 * primary role sits in first, then the rest by name, each with what the lead
 * holds there; null for anyone else, or a lead with no open division. A grant
 * the lead holds in a division they do not lead gives what it gives a member
 * there and adds no Access page there. Access is no grant area, so no grant
 * opens it to a member (issue #471).
 */
async function leadDivisions(identity: DashboardIdentity): Promise<Extract<AccessUnit, { kind: "division" }> | null> {
  const memberId = identity.memberId;
  if (identity.kind !== "division-lead" || memberId === null) return null;
  const ledIds = ledDivisionIds({ scopes: [], activeRoles: identity.roles });
  if (ledIds.length === 0) return null;
  const db = getDb();
  // The member's division grants are read for every division led at once, beside the divisions (issue #397).
  const [rows, grants] = await Promise.all([
    db
      .select({ id: divisions.id, name: divisions.name })
      .from(divisions)
      .where(and(inArray(divisions.id, ledIds), isNull(divisions.closedAt)))
      .orderBy(asc(divisions.name)),
    db
      .select({ division_id: scopes.divisionId, target: scopes.target, level: scopes.accessLevel })
      .from(scopes)
      .where(and(eq(scopes.memberId, memberId), eq(scopes.scope, "division"), inArray(scopes.divisionId, ledIds))),
  ]);
  const first = identity.role?.divisionId ?? null;
  const ordered = [...rows.filter((r) => r.id === first), ...rows.filter((r) => r.id !== first)];
  // The role gives Positions, Applications, Members and Orders at Can edit in each division led (issues #591, #632); grants there add to it.
  const led = ordered.map((division) => ({
    division,
    held: mergeHeld(LEAD_ROLE_HELD_ACCESS, heldOf(grants.filter((g) => g.division_id === division.id))),
  }));
  const [head, ...rest] = led;
  return head === undefined ? null : { kind: "division", divisions: [head, ...rest] };
}

function isUnitTarget(value: string): value is UnitTarget {
  return (UNIT_TARGETS as readonly string[]).includes(value);
}

/** What the member's grants in one division hold, area by area: "all" on a division scope covers each area. */
function heldOf(mine: readonly { target: string; level: AccessLevel }[]): HeldAccess[] {
  return UNIT_TARGETS.flatMap((target) => {
    const levels = mine.filter((m) => m.target === target || m.target === "all").map((m) => m.level);
    if (levels.length === 0) return [];
    return [{ target, level: levels.includes("edit") ? ("edit" as const) : ("view" as const) }];
  });
}

/** A department head's department and its open divisions, in tab order (issue #230); null for anyone else. */
export async function readHeadDepartment(identity: DashboardIdentity): Promise<{ id: number; name: string; divisions: AccessDivision[] } | null> {
  if (identity.kind !== "department-head") return null;
  const id = identity.role?.departmentId ?? identity.departmentIds[0] ?? null;
  if (id === null) return null;
  const db = getDb();
  const [[department], rows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(and(eq(departments.id, id), isNull(departments.closedAt)))
      .limit(1),
    db
      .select({ id: divisions.id, name: divisions.name, departmentId: divisions.deptId, closedAt: divisions.closedAt })
      .from(divisions)
      .where(eq(divisions.deptId, id)),
  ]);
  if (!department) return null;
  return { ...department, divisions: headDivisionsOf(id, rows).map((d) => ({ id: d.id, name: d.name })) };
}

/** Every open department with its open divisions, each by name: the team a full-access viewer's Access page covers (issue #238). */
async function readTeamUnit(): Promise<AccessUnit> {
  return { kind: "team", departments: (await readOrgUnits()).map(({ id, name, divisions }) => ({ department: { id, name }, divisions })) };
}

/**
 * The unit the viewer's Access page is about, and with it what they hold
 * (`heldIn`): full access holds every area at Can edit across the team (issue
 * #238), a head's role every unit area across their department (board 65), a
 * lead what they hold in each division; null for anyone with no such page.
 */
async function accessUnitOf(identity: DashboardIdentity): Promise<AccessUnit | null> {
  // Full access by its standing, the break-glass admin's with no member row included (issue #646).
  if (identity.kind === "operations-lead") return readTeamUnit();
  if (identity.memberId === null) return null;
  // A lead or head who holds Content gives it across the whole team (issue #504).
  const content = identity.siteContent ? ({ content: true } as const) : {};
  if (identity.kind === "division-lead") {
    const led = await leadDivisions(identity);
    return led === null ? null : { ...led, ...content };
  }
  const department = await readHeadDepartment(identity);
  if (department === null) return null;
  return { kind: "department", department: { id: department.id, name: department.name }, divisions: department.divisions, ...content };
}

/** A lead or head role leads; so does the team leader's, whose access comes with the role and never changes on Access. */
function isLeadRole(type: string | null): boolean {
  return type === "lead" || type === "head" || type === "president";
}

/** The departments an Access page covers, each with its open divisions: none on a lead's page. */
function unitDepartmentsOf(unit: AccessUnit): readonly AccessDepartmentUnit[] {
  switch (unit.kind) {
    case "division":
      return [];
    case "department":
      return [unit];
    case "team":
      return unit.departments;
  }
}

/**
 * The Access page (boards 60 and 65): the viewer's unit and what they hold,
 * the other leads with the access their role gives, the grants in the unit
 * (each division's, and on a head's or a team page the department-wide
 * ones), and the people the viewer may give access to.
 */
async function readAccessPage(identity: DashboardIdentity): Promise<AccessPage | null> {
  const unit = await accessUnitOf(identity);
  if (unit === null) return null;
  // Null for the break-glass admin, who has no member row and so no grant or role row of their own (issue #646).
  const me = identity.memberId;
  const db = getDb();
  const giver = alias(users, "giver");
  const unitDepartments = unitDepartmentsOf(unit);
  const unitDivisions = unit.kind === "division" ? unit.divisions.map((d) => d.division) : unitDepartments.flatMap((d) => d.divisions);
  const divisionIds = unitDivisions.map((d) => d.id);
  const departmentIds = unitDepartments.map((d) => d.department.id);
  const departmentById = (id: number | null) => unitDepartments.find((d) => d.department.id === id)?.department ?? null;
  const unitTarget = inArray(scopes.target, [...UNIT_TARGETS]);
  const inUnitDivisions = and(eq(scopes.scope, "division"), inArray(scopes.divisionId, divisionIds.length ? divisionIds : [-1]), unitTarget);
  const inUnitDepartments = and(eq(scopes.scope, "department"), inArray(scopes.deptId, departmentIds.length ? departmentIds : [-1]), unitTarget);
  // A lead's or head's page holds the Content grants of the people in the unit when the viewer gives Content (issue #504).
  // The old Alumni `website` rows on `all` were deleted (issues #589, #637: drizzle/0074).
  const contentRows = and(eq(scopes.scope, "website"), eq(scopes.target, "content"));
  // A team page also holds the grants across the whole team, Content and "Approve orders" (issue #247).
  const acrossTeam = or(and(eq(scopes.scope, "team"), or(unitTarget, eq(scopes.target, "approve_orders"))), contentRows);
  const unitRows = unit.kind === "team" ? or(inUnitDivisions, inUnitDepartments, acrossTeam) : unit.content === true ? or(inUnitDivisions, inUnitDepartments, contentRows) : or(inUnitDivisions, inUnitDepartments);
  const listed = me === null ? unitRows : and(unitRows, ne(scopes.memberId, me));
  // When each grant was given and the seats of the acting accounts that gave them are read by the grants' own
  // condition, beside the grants rather than after them: one round trip after the unit, not two (issue #397).
  const listedIds = db.select({ id: sql<string>`${scopes.id}::text` }).from(scopes).where(listed);
  const listedActing = db.select({ id: scopes.givenByActingAccount }).from(scopes).where(listed);

  const [rows, team, mineApproves, given, actingSeats] = await Promise.all([
    db
      .select({
        id: scopes.id,
        member_id: scopes.memberId,
        scope: scopes.scope,
        division_id: scopes.divisionId,
        dept_id: scopes.deptId,
        target: scopes.target,
        level: scopes.accessLevel,
        given_by: scopes.givenBy,
        given_by_acting_account: scopes.givenByActingAccount,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        picture: members.picture,
        giver_first_name: giver.firstName,
        giver_last_name: giver.lastName,
        giver_email: giver.email,
      })
      .from(scopes)
      .innerJoin(users, eq(users.member, scopes.memberId))
      .leftJoin(members, eq(members.memberId, scopes.memberId))
      .leftJoin(giver, eq(giver.member, scopes.givenBy))
      .where(listed)
      .orderBy(desc(scopes.id)),
    db
      .select({
        member_id: roles.memberId,
        type: roles.type,
        title: roles.title,
        full_access: roles.fullAccess,
        division_id: roles.divisionId,
        // What finds the Logistics lead seat (issue #885): the role's division code and the day it closed.
        division_code: divisions.code,
        division_closed_at: divisions.closedAt,
        dept_id: roles.deptId,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        picture: members.picture,
      })
      .from(roles)
      .innerJoin(users, eq(users.member, roles.memberId))
      .leftJoin(members, eq(members.memberId, roles.memberId))
      .leftJoin(divisions, eq(divisions.id, roles.divisionId))
      .where(
        and(
          isNull(roles.leavedAt),
          // A team page holds everyone on the team; a head's, their divisions and the department's heads.
          unit.kind === "team"
            ? undefined
            : departmentIds.length === 0
              ? inArray(roles.divisionId, divisionIds)
              : or(inArray(roles.divisionId, divisionIds.length ? divisionIds : [-1]), and(inArray(roles.deptId, departmentIds), eq(roles.type, "head"))),
        ),
      )
      // Oldest first, so someone in two of a lead's divisions is placed in their older one (issue #185).
      .orderBy(asc(roles.startedAt)),
    // Whether the viewer decides orders: "Your access" on a team page carries the chip (board 71).
    unit.kind === "team" && me !== null
      ? db
          .select({ id: scopes.id })
          .from(scopes)
          .where(and(eq(scopes.memberId, me), eq(scopes.scope, "team"), eq(scopes.target, "approve_orders")))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({ record_id: logs.recordId, changed_at: logs.changedAt })
      .from(logs)
      .where(and(eq(logs.tableName, "scopes"), eq(logs.operation, "INSERT"), inArray(logs.recordId, listedIds))),
    readActingSeats(inArray(users.id, listedActing)),
  ]);

  // The full-access seat each member holds (issues #238, #885): only a team page shows them, each across the whole team.
  const seatByMember = new Map<number, FullAccessSeat>();
  if (unit.kind === "team") {
    for (const id of new Set(team.flatMap((t) => (t.member_id === null ? [] : [t.member_id])))) {
      const seat = fullAccessSeatOf(
        team
          .filter((t) => t.member_id === id)
          .map((t) => ({
            type: t.type,
            divisionId: t.division_id,
            divisionCode: t.division_code,
            divisionClosedAt: t.division_closed_at,
            fullAccess: t.full_access === null ? null : SEAT_OF_FLAG[t.full_access],
          })),
      );
      if (seat !== null) seatByMember.set(id, seat);
    }
  }

  // One person per member, with what their role gives them in the unit (issue #591): a full-access seat, the
  // department they head, else each division of the unit they lead. They are placed in the first division they
  // lead, else the first they are in. A head carries their head role's title as stored (issue #625).
  type Headed = { readonly department: AccessDepartmentUnit; readonly title: string };
  const placements = new Map<number, { name: string; photoUrl: string | null; led: AccessDivision[]; in: AccessDivision[]; headed: Headed | null }>();
  for (const t of team) {
    if (t.member_id === null) continue;
    const seen = placements.get(t.member_id) ?? { name: nameOf(t), photoUrl: t.picture, led: [], in: [], headed: null };
    placements.set(t.member_id, seen);
    if (t.type === "head" && t.division_id === null && seen.headed === null) {
      const department = unitDepartments.find((d) => d.department.id === t.dept_id);
      if (department !== undefined) seen.headed = { department, title: headTitleOf(t.title, department.department.name) };
    }
    const division = unitDivisions.find((d) => d.id === t.division_id);
    if (division === undefined) continue;
    if (!seen.in.some((d) => d.id === division.id)) seen.in.push(division);
    if (isLeadRole(t.type) && !seen.led.some((d) => d.id === division.id)) seen.led.push(division);
  }
  // The line under a seat holder's name: the title stored on the row the seat's flag is on (issue #625).
  const seatTitleOf = (id: number, seat: FullAccessSeat) =>
    seatLine(seat, team.find((t) => t.member_id === id && t.full_access !== null && SEAT_OF_FLAG[t.full_access] === seat)?.title ?? "");
  const byMember = new Map<number, AccessPerson>();
  for (const [id, seen] of placements) {
    const seat = seatByMember.get(id);
    const [firstLed, ...moreLed] = seen.led;
    const role: PersonRole =
      seat !== undefined
        ? { kind: "full", seat, title: seatTitleOf(id, seat) }
        : seen.headed !== null
          ? { kind: "head", department: seen.headed.department, title: seen.headed.title }
          : firstLed !== undefined
            ? { kind: "lead", divisions: [firstLed, ...moreLed] }
            : NO_ROLE;
    byMember.set(id, { id, name: seen.name, photoUrl: seen.photoUrl, role, division: seen.led[0] ?? seen.in[0] ?? null });
  }
  const personOf = (memberId: number, row: { first_name: string | null; last_name: string | null; email: string; picture: string | null }): AccessPerson =>
    byMember.get(memberId) ?? { id: memberId, name: nameOf(row), photoUrl: row.picture, role: NO_ROLE, division: null };

  const roleAccess = [...byMember.values()]
    .flatMap((person) => (person.id === me ? [] : roleAccessOf(person)))
    // Full access first (board 71), then the heads and the leads.
    .sort((a, b) => Number(b.place.kind === "team") - Number(a.place.kind === "team"));

  const actingTitles = actingTitlesOf(rows.map((r) => r.given_by_acting_account), actingSeats);
  const givenOn = new Map(given.map((g) => [g.record_id, g.changed_at.slice(0, 10)]));

  // A grant given while viewing as someone names the acting seat too, even to the person viewed as (issue #605).
  const giverOf = (r: (typeof rows)[number]): string | null => {
    const acting = actingTitleIn(actingTitles, r.given_by_acting_account);
    if (r.given_by === null) return null;
    if (r.given_by === me && acting === null) return "You";
    if (r.giver_email === null) return null;
    return attributedName(nameOf({ first_name: r.giver_first_name, last_name: r.giver_last_name, email: r.giver_email }), acting);
  };

  const holders = rows.flatMap((r): ApproveOrdersHolder[] =>
    r.member_id === null || r.scope !== "team" || r.target !== "approve_orders"
      ? []
      : [{ person: personOf(r.member_id, r), givenBy: giverOf(r), givenOn: givenOn.get(String(r.id)) ?? null }],
  );

  const grants = rows.flatMap((r): AccessGrant[] => {
    if (r.member_id === null) return [];
    const person = personOf(r.member_id, r);
    // Off a team page, a Content row counts only for someone in the unit (issue #504).
    if (r.scope === "website" && unit.kind !== "team" && !byMember.has(r.member_id)) return [];
    // A `website` row is Content on `content`, across the whole team (#247, #504); any other is no grant (#589).
    const target = r.scope === "website" ? (r.target === "content" ? ("content" as const) : null) : isUnitTarget(r.target) ? r.target : null;
    if (target === null) return [];
    const division = unitDivisions.find((d) => d.id === r.division_id);
    const department = r.scope === "department" ? departmentById(r.dept_id) : null;
    const place: AccessPlace | null =
      r.scope === "team" || r.scope === "website"
        ? WHOLE_TEAM_PLACE
        : department !== null
          ? { kind: "department", department }
          : division === undefined
            ? null
            : { kind: "division", division };
    // A lead's or head's grants show beside their role row (issue #591); a stored row their role already gives adds nothing, so it is not one.
    if (place === null || roleCovers(person, place, target)) return [];
    return [{ id: r.id, person, place, target, level: r.level, givenBy: giverOf(r), givenOn: givenOn.get(String(r.id)) ?? null }];
  });

  const people = [...byMember.values()].filter((p) => p.id !== me).sort((a, b) => a.name.localeCompare(b.name));
  const approveOrders =
    unit.kind === "team"
      ? { canGive: canGiveApproveOrders(seatOf(identity)), yours: isTeamLeader(identity) || mineApproves.length > 0, holders }
      : NO_APPROVE_ORDERS;

  return { unit, roleAccess, grants, people, approveOrders };
}

/**
 * The stored grant one area in one place is (`grantRowOf`): a Content grant
 * is the person's `website` row on `content` (issue #504); the old Alumni
 * `website` rows on `all` were deleted (issues #589, #637: drizzle/0074); any other
 * is the row of that scope, place and area.
 */
function grantWhere(personId: number, place: AccessPlace, target: AccessTarget) {
  const row = grantRowOf(place, target);
  const mine = eq(scopes.memberId, personId);
  switch (row.scope) {
    case "website":
      return and(mine, eq(scopes.scope, "website"), eq(scopes.target, row.target));
    case "team":
      return and(mine, eq(scopes.scope, "team"), eq(scopes.target, row.target), isNull(scopes.deptId), isNull(scopes.divisionId));
    case "department":
      return and(mine, eq(scopes.scope, "department"), eq(scopes.target, row.target), eq(scopes.deptId, row.deptId!), isNull(scopes.divisionId));
    case "division":
      return and(mine, eq(scopes.scope, "division"), eq(scopes.target, row.target), eq(scopes.divisionId, row.divisionId!));
  }
}

/**
 * Writes checked changes to one person's access in one audited batch: one
 * grant per person, area and place, so a level change replaces the old grant
 * and a removal deletes it; "Approve orders" is given or removed in the same
 * batch. Answers the person's grants as they now read.
 */
async function writeAccess(identity: DashboardIdentity, personId: number, writes: readonly AccessWrite[]): Promise<WriteResult<readonly AccessGrant[]>> {
  const given = givenByOf(identity);
  const touched = writes.filter((w) => w.changes.length > 0 || w.approveOrders !== null);

  if (touched.length > 0) {
    await runAuditBatch((db) => {
      const [first, ...rest] = touched.flatMap(({ place, changes, approveOrders }) => [
        // An added area has no grant yet, so clearing every changed area deletes
        // only the grants a level change or a removal replaces.
        ...changes.map((c) => db.delete(scopes).where(grantWhere(personId, place, c.target))),
        ...changes.flatMap((c) => {
          if (c.kind === "remove") return [];
          const row = grantRowOf(place, c.target);
          return [db.insert(scopes).values({ memberId: personId, ...given, ...row, accessLevel: c.to satisfies AccessLevel })];
        }),
        ...(approveOrders === null
          ? []
          : [
              approveOrders.holds
                ? db.insert(scopes).values({ memberId: personId, ...given, scope: "team", target: "approve_orders", accessLevel: "edit" })
                : db.delete(scopes).where(and(eq(scopes.memberId, personId), eq(scopes.scope, "team"), eq(scopes.target, "approve_orders"))),
            ]),
      ]);
      // Every touched write changes an area or "Approve orders", so the batch is never empty.
      return [first!, ...rest];
    });
  }

  const after = await readAccessPage(identity);
  return written(after?.grants.filter((g) => g.person.id === personId) ?? []);
}

async function saveAccess(identity: DashboardIdentity, input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  const access = await readAccessPage(identity);
  if (access === null) return refused("Only a division lead or a department head gives access here.");
  const checked = checkSaveAccess(access, input);
  return checked.ok ? writeAccess(identity, checked.value.personId, [checked.value]) : refused(checked.error);
}

async function removeAllAccess(identity: DashboardIdentity, personId: number): Promise<WriteResult<null>> {
  const access = await readAccessPage(identity);
  if (access === null) return refused("Only a division lead or a department head removes access here.");
  const checked = checkRemoveAllAccess(access, personId);
  if (!checked.ok) return refused(checked.error);
  const result = await writeAccess(identity, personId, checked.value);
  return result.ok ? written(null) : result;
}

async function removeGrant(identity: DashboardIdentity, input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  const access = await readAccessPage(identity);
  if (access === null) return refused("Only a division lead or a department head removes access here.");
  const checked = checkRemoveGrant(access, input);
  return checked.ok ? writeAccess(identity, checked.value.personId, [checked.value]) : refused(checked.error);
}

/** Every open department in the team's order and its open divisions (`orgUnitsOf`): the Department filter (board 67b) and New order read it. */
async function readOrgUnits(): Promise<OrgDepartmentUnits[]> {
  const db = getDb();
  const [deps, divs] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).where(isNull(departments.closedAt)),
    db
      .select({ id: divisions.id, name: divisions.name, departmentId: divisions.deptId })
      .from(divisions)
      .where(isNull(divisions.closedAt)),
  ]);
  return orgUnitsOf(deps, divs);
}

/**
 * The viewer's Orders scope (`ordersScopeOf`, ./orders.ts), read from their
 * scope rows, a head's department and the divisions they lead by role
 * (`ledDivisionIds`, issue #590); null for someone off the team.
 */
async function readOrdersScope(
  identity: DashboardIdentity,
  org: readonly OrgDepartmentUnits[] | Promise<readonly OrgDepartmentUnits[]>,
): Promise<OrdersScope | null> {
  if (isOffTeam(identity.kind)) return null;
  const memberId = identity.memberId;
  const [rows, headDepartment, units] = await Promise.all([
    // The break-glass admin has no member row, so no scope row of their own (issue #646).
    memberId === null
      ? []
      : getDb()
          .select({ scope: scopes.scope, target: scopes.target, level: scopes.accessLevel, divisionId: scopes.divisionId, deptId: scopes.deptId })
          .from(scopes)
          .where(eq(scopes.memberId, memberId)),
    readHeadDepartment(identity),
    org,
  ]);
  return ordersScopeOf(
    {
      fullAccess: identity.kind === "operations-lead",
      teamLeader: isTeamLeader(identity),
      headDepartment: headDepartment === null ? null : { id: headDepartment.id, name: headDepartment.name },
      ledDivisionIds: ledDivisionIds({ scopes: [], activeRoles: identity.roles }),
    },
    rows,
    units,
  );
}

type DbOrderStatus = (typeof orders.$inferSelect)["status"];

const statusOf: Readonly<Record<DbOrderStatus, StoredOrderStatus>> = {
  pending: "waiting",
  accepted: "approved",
  ordered: "ordered",
  rejected: "rejected",
  changes_requested: "changes-requested",
  cancelled: "cancelled",
};

type OrderRow = {
  id: number;
  status: DbOrderStatus;
  name: string | null;
  reason: string | null;
  description: string | null;
  quantity: number | null;
  price: string | null;
  created_at: string;
  quote_name: string | null;
  review_note: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  division_id: number | null;
  division_name: string | null;
  department_id: number | null;
  department_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
  reviewer_email: string | null;
  /** The acting seat's title when the answer was given while viewing as the reviewer (issue #605); null otherwise. */
  reviewer_acting_title: string | null;
};

/**
 * A stored request's state on the page, as `viewer` (a member id) reads it;
 * null for a cancelled one, which the page does not list. An answer with no
 * one on record reads as the team leader's, on the day the request was sent.
 * One given while viewing as the reviewer names the acting seat too, and is
 * never the viewer's own.
 */
function stateOf(r: OrderRow, viewer: number | null): OrderState | null {
  const status = statusOf[r.status];
  const acting = r.reviewer_acting_title;
  const by =
    r.reviewer_email === null
      ? "The team leader"
      : attributedName(nameOf({ first_name: r.reviewer_first_name, last_name: r.reviewer_last_name, email: r.reviewer_email }), acting);
  const answer: Answer = { by, byYou: viewer !== null && r.reviewed_by === viewer && acting === null, on: (r.reviewed_at ?? r.created_at).slice(0, 10) };
  switch (status) {
    case "cancelled":
      return null;
    case "waiting":
      return { status };
    case "approved":
    case "ordered":
      return { status, answer };
    case "rejected":
      return { status, answer, reason: r.review_note };
    case "changes-requested":
      return { status, changes: { reason: r.review_note ?? "", by: answer.by, on: answer.on } };
  }
}

function unitOf(r: OrderRow): OrderUnit | null {
  if (r.division_id === null || r.division_name === null) return null;
  return {
    division: { id: r.division_id, name: r.division_name },
    department: r.department_id === null || r.department_name === null ? null : { id: r.department_id, name: r.department_name },
  };
}

// `orders.description` holds the shop link; `orders.price` the price of one,
// without IVA; `orders.quote_name` the quote's pathname in the private store,
// which no route serves yet, so the quote shows by name only.
function orderOf(r: OrderRow, viewer: number | null): Order[] {
  const state = stateOf(r, viewer);
  if (state === null) return [];
  return [
    {
      ...state,
      id: r.id,
      item: r.name ?? "Unnamed item",
      reason: r.reason,
      link: r.description,
      requestedBy: r.email === null ? "" : nameOf({ first_name: r.first_name, last_name: r.last_name, email: r.email }),
      unit: unitOf(r),
      unitPrice: r.price === null ? 0 : (parseEuros(r.price) ?? 0),
      quantity: r.quantity ?? 1,
      shipping: null,
      requestedOn: r.created_at.slice(0, 10),
      quote: r.quote_name === null ? null : { name: r.quote_name.split("/").pop() ?? r.quote_name, size: null, href: null },
    },
  ];
}

const reviewer = alias(users, "reviewer");

function orderColumns() {
  return {
    id: orders.id,
    status: orders.status,
    name: orders.name,
    reason: orders.reason,
    description: orders.description,
    quantity: orders.quantity,
    price: orders.price,
    created_at: orders.createdAt,
    quote_name: orders.quoteName,
    review_note: orders.reviewNote,
    reviewed_by: orders.reviewedBy,
    reviewed_by_acting_account: orders.reviewedByActingAccount,
    reviewed_at: orders.reviewedAt,
    division_id: divisions.id,
    division_name: divisions.name,
    department_id: departments.id,
    department_name: departments.name,
    first_name: users.firstName,
    last_name: users.lastName,
    email: users.email,
    reviewer_first_name: reviewer.firstName,
    reviewer_last_name: reviewer.lastName,
    reviewer_email: reviewer.email,
  };
}

/** Orders as the page reads them: every order in the team, or only the given divisions', or one order. */
async function readOrderRows(where: { divisionIds?: readonly number[]; orderId?: number } = {}): Promise<OrderRow[]> {
  const rows = await getDb()
    .select(orderColumns())
    .from(orders)
    .leftJoin(users, eq(users.member, orders.requester))
    .leftJoin(reviewer, eq(reviewer.member, orders.reviewedBy))
    .leftJoin(divisions, eq(divisions.id, orders.divisionId))
    .leftJoin(departments, eq(departments.id, divisions.deptId))
    .where(
      and(
        where.divisionIds === undefined ? undefined : inArray(orders.divisionId, where.divisionIds.length ? [...where.divisionIds] : [-1]),
        where.orderId === undefined ? undefined : eq(orders.id, where.orderId),
      ),
    )
    .orderBy(desc(orders.createdAt), desc(orders.id));
  const titles = await readActingTitles(rows.map((r) => r.reviewed_by_acting_account));
  return rows.map(({ reviewed_by_acting_account, ...r }) => ({ ...r, reviewer_acting_title: actingTitleIn(titles, reviewed_by_acting_account) }));
}

/** Every request made for the given divisions: a division lead's and a department head's Overview count the waiting ones (boards 56 and 62). */
export async function readOrdersIn(divisionIds: readonly number[]): Promise<Order[]> {
  return (await readOrderRows({ divisionIds })).flatMap((r) => orderOf(r, null));
}

/** The Orders page (issue #233): every order in the team, for anyone with Orders access; null for anyone else. */
async function readOrdersPage(identity: DashboardIdentity): Promise<OrdersPage | null> {
  // The org, the viewer's scope and the orders are independent reads, so they go out together (issue #397).
  const orgRead = readOrgUnits();
  const [org, scope, rows] = await Promise.all([orgRead, readOrdersScope(identity, orgRead), readOrderRows()]);
  if (scope === null) return null;
  return ordersPageFor(scope, org, rows.flatMap((r) => orderOf(r, identity.memberId)));
}

/** The viewer's scope and one stored request, or why there is nothing to act on. */
async function scopedOrder(identity: DashboardIdentity, orderId: number): Promise<{ scope: OrdersScope; order: Order } | string> {
  const scope = await readOrdersScope(identity, await readOrgUnits());
  if (scope === null) return "You do not have access to Orders.";
  const [order] = (await readOrderRows({ orderId })).flatMap((r) => orderOf(r, identity.memberId));
  return order === undefined ? "That request is no longer on the page." : { scope, order };
}

/** The New order or Edit order fields and quote, checked again on the server. */
function checkedOrder(fields: Record<string, string>, quote: Upload | null): { ok: true; value: NewOrder } | { ok: false; error: string } {
  const checked = checkNewOrder({
    item: fields.item ?? "",
    link: fields.link ?? "",
    price: fields.price ?? "",
    quantity: fields.quantity ?? "",
    reason: fields.reason ?? "",
  });
  if (!checked.ok) return { ok: false, error: Object.values(checked.errors)[0] ?? "Check the form." };
  if (quote !== null) {
    const pdf = checkedQuote(quote);
    if (!pdf.ok) return pdf;
  }
  return checked;
}

/** Stores a quote in the private store; null when none was sent. */
async function storeQuote(quote: Upload | null): Promise<PrivatePathname | null> {
  if (quote === null) return null;
  const pathname = privatePathname("order", `${randomUUID()}.pdf`);
  await uploadPrivateFile(pathname, quote.bytes, "application/pdf");
  return pathname;
}

/** Deletes a quote no order names: one stored for a write that did not land, or one an edit replaced. */
async function dropQuote(stored: string | null): Promise<void> {
  const pathname = stored === null ? null : parsePrivatePathname(stored);
  if (pathname !== null) await deleteBestEffort({ store: "private", area: "order-quote", pathname, remove: deletePrivateFile });
}

async function placeOrder(
  identity: DashboardIdentity,
  fields: Record<string, string>,
  quote: Upload | null,
): Promise<WriteResult<Order>> {
  if (identity.memberId === null) return refused("Only a team member sends orders here.");
  const org = await readOrgUnits();
  const scope = await readOrdersScope(identity, org);
  if (scope === null) return refused("You do not have access to Orders.");
  const division = checkOrderDivision(orderingDivisions(scope, org), fields.division);
  if (!division.ok) return refused(division.error);
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);

  const order = checked.value;
  const pathname = await storeQuote(quote);
  const requester = identity.memberId;
  let row: { id: number };
  try {
    [row] = await runAuditQuery((db) =>
      db
        .insert(orders)
        .values({
          requester,
          divisionId: division.value.id,
          name: order.item,
          description: order.link,
          reason: order.reason,
          quantity: order.quantity,
          price: (order.unitPrice / 100).toFixed(2),
          quoteName: pathname,
        })
        .returning({ id: orders.id }),
    );
  } catch (error) {
    // Only a failed insert frees the quote: once the order is in, it names the file (issue #831).
    await dropQuote(pathname);
    throw error;
  }
  const [placed] = (await readOrderRows({ orderId: row.id })).flatMap((r) => orderOf(r, identity.memberId));
  return written(placed);
}

/** A guarded order write that changed no row: the request moved on since the page read it. */
const ORDER_CHANGED = "This request changed. Reload the page.";

const OUT_OF_SCOPE = "This order is outside your division or department, so it is read-only for you.";

async function editOrder(
  identity: DashboardIdentity,
  orderId: number,
  fields: Record<string, string>,
  quote: Upload | null,
): Promise<WriteResult<Order>> {
  const found = await scopedOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  if (!canEditOrder(found.scope, found.order)) return refused(OUT_OF_SCOPE);
  if (stateAfterEdit(found.order.status) === null) return refused("The team leader has answered this request.");
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);

  const order = checked.value;
  const pathname = await storeQuote(quote);
  let changed: { id: number; oldQuote: string | null }[];
  try {
    // Back to waiting for the team leader, with their earlier answer cleared.
    // The row is locked and read in the same statement, so the quote it
    // names before the edit is the one this edit replaces (issue #831).
    changed = await runAuditQuery((db) => {
      const before = db.select({ id: orders.id, quoteName: orders.quoteName }).from(orders).where(eq(orders.id, orderId)).for("update").as("before");
      return db
        .update(orders)
        .set({
          name: order.item,
          description: order.link,
          reason: order.reason,
          quantity: order.quantity,
          price: (order.unitPrice / 100).toFixed(2),
          status: "pending",
          reviewNote: null,
          reviewedBy: null,
          reviewedByActingAccount: null,
          reviewedAt: null,
          ...(pathname === null ? {} : { quoteName: pathname }),
        })
        .from(before)
        .where(and(eq(orders.id, before.id), eq(orders.id, orderId), inArray(orders.status, ["pending", "changes_requested"])))
        .returning({ id: orders.id, oldQuote: before.quoteName });
    });
  } catch (error) {
    await dropQuote(pathname);
    throw error;
  }
  // The team leader answered between the read and the write: nothing saved, so the new quote points nowhere.
  if (changed.length === 0) {
    await dropQuote(pathname);
    return refused(ORDER_CHANGED);
  }
  // A new quote replaced the old one, which no order names any more; each quote is one order's own file.
  if (pathname !== null) await dropQuote(changed[0].oldQuote);
  const [edited] = (await readOrderRows({ orderId })).flatMap((r) => orderOf(r, identity.memberId));
  return edited === undefined ? refused("The team leader has answered this request.") : written(edited);
}

async function cancelOrder(identity: DashboardIdentity, orderId: number): Promise<WriteResult<null>> {
  const found = await scopedOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  if (!canEditOrder(found.scope, found.order)) return refused(OUT_OF_SCOPE);
  if (!orderActions(found.scope, found.order).cancel) return refused("The team leader has answered this request.");
  const changed = await runAuditQuery((db) =>
    db
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id }),
  );
  return changed.length === 0 ? refused(ORDER_CHANGED) : written(null);
}

const DB_STATUS_AFTER: Readonly<Record<OrderDecision["kind"], DbOrderStatus>> = {
  approve: "accepted",
  reject: "rejected",
  "ask-for-changes": "changes_requested",
};

/** Approve, reject or ask for changes, checked on the server (`checkDecision`). */
async function decideOrder(identity: DashboardIdentity, orderId: number, input: unknown): Promise<WriteResult<Order>> {
  const found = await scopedOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  const checked = checkDecision(found.scope.decides, found.order.status, input);
  if (!checked.ok) return refused(checked.error);
  const decision = checked.value;
  const changed = await runAuditQuery((db) =>
    db
      .update(orders)
      .set({
        status: DB_STATUS_AFTER[decision.kind],
        // The note the requester reads: what to change, or why it was rejected (boards 70d and 70e).
        reviewNote: decision.kind === "approve" ? null : decision.reason,
        reviewedBy: identity.memberId,
        reviewedByActingAccount: identity.actingAccountId,
        reviewedAt: new Date().toISOString(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id }),
  );
  if (changed.length === 0) return refused(ORDER_CHANGED);
  const [decided] = (await readOrderRows({ orderId })).flatMap((r) => orderOf(r, identity.memberId));
  return decided === undefined ? refused(ORDER_CHANGED) : written(decided);
}

/** Mark as ordered (board 70c), checked on the server (`checkMarkOrdered`): only from Approved, by someone who decides. */
async function markOrdered(identity: DashboardIdentity, orderId: number): Promise<WriteResult<Order>> {
  const found = await scopedOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  const checked = checkMarkOrdered(found.scope.decides, found.order);
  if (!checked.ok) return refused(checked.error);
  // Who approved it stays on the row; the activity log records who marked it.
  const changed = await runAuditQuery((db) =>
    db
      .update(orders)
      .set({ status: "ordered" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "accepted")))
      .returning({ id: orders.id }),
  );
  if (changed.length === 0) return refused(ORDER_CHANGED);
  const [marked] = (await readOrderRows({ orderId })).flatMap((r) => orderOf(r, identity.memberId));
  return marked === undefined ? refused(ORDER_CHANGED) : written(marked);
}

/** Give or remove "Approve orders": only the team leader, any number of holders (`checkApproveOrdersChange`). */
async function setApproveOrders(identity: DashboardIdentity, input: unknown): Promise<WriteResult<null>> {
  const db = getDb();
  const [active, holders] = await Promise.all([
    db.select({ member_id: roles.memberId, type: roles.type }).from(roles).where(isNull(roles.leavedAt)),
    db
      .select({ member_id: scopes.memberId })
      .from(scopes)
      .where(and(eq(scopes.scope, "team"), eq(scopes.target, "approve_orders"))),
  ]);
  const ids = (rows: readonly { member_id: number | null }[]) => [...new Set(rows.flatMap((r) => (r.member_id === null ? [] : [r.member_id])))];
  const checked = checkApproveOrdersChange(
    {
      byTeamLeader: isTeamLeader(identity),
      team: ids(active),
      teamLeaders: ids(active.filter((r) => r.type === "president")),
      holders: ids(holders),
    },
    input,
  );
  if (!checked.ok) return refused(checked.error);
  const { personId, holds } = checked.value;
  const given = givenByOf(identity);
  await runAuditQuery((tx) =>
    holds
      ? tx.insert(scopes).values({ memberId: personId, ...given, scope: "team", target: "approve_orders", accessLevel: "edit" })
      : tx.delete(scopes).where(and(eq(scopes.memberId, personId), eq(scopes.scope, "team"), eq(scopes.target, "approve_orders"))),
  );
  return written(null);
}

/** The Access and Orders methods of the database side of the data interface. */
export function databaseDivisionPages(identity: DashboardIdentity) {
  return {
    divisionAccess: () => readAccessPage(identity),
    saveAccess: (input: unknown) => saveAccess(identity, input),
    removeAllAccess: (personId: number) => removeAllAccess(identity, personId),
    removeGrant: (input: unknown) => removeGrant(identity, input),
    orders: () => readOrdersPage(identity),
    placeOrder: (fields: Record<string, string>, quote: Upload | null) => placeOrder(identity, fields, quote),
    editOrder: (orderId: number, fields: Record<string, string>, quote: Upload | null) =>
      editOrder(identity, orderId, fields, quote),
    cancelOrder: (orderId: number) => cancelOrder(identity, orderId),
    decideOrder: (orderId: number, input: unknown) => decideOrder(identity, orderId, input),
    markOrdered: (orderId: number) => markOrdered(identity, orderId),
    setApproveOrders: (input: unknown) => setApproveOrders(identity, input),
  };
}
