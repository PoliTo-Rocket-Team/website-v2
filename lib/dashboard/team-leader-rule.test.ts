import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScopeInfo } from "@/app/actions/get-member-scopes";
import { canSwitchRecruitment } from "@/lib/apply/recruitment-switch";
import { maySiteContent } from "@/lib/content/gate";
import { canReach, type DashboardPageKey } from "./access";
import { mayOpenApplication, readsRecruitmentIn, type RecruitmentReader } from "./application-documents";
import { mayManageDepartments } from "./department-edit";
import { canGiveApproveOrders } from "./division-access";
import { mayManageDivisionsIn } from "./division-edit";
import { opensWholeTeam } from "./members-view";
import { canEditOrder, ordersScopeOf, type OrderUnit, type OrdersScopeRow } from "./orders";
import { mayLeaveTeam, membershipsOf, reachesDivision, removalFrom, type DivisionRole, type OrgChart, type TeamActor, type TeamStanding } from "./team";
import { showsTreeEdit } from "./team-structure";
import {
  isTeamLeader,
  ledDivisionIds,
  mayChange,
  seatOf,
  viewerStandingOf,
  type ActiveRoleRef,
  type ChangeArea,
  type DivisionUnit,
  type ScopedRole,
  type ViewerStanding,
} from "./viewer";

// Issue #444 (Owner decisions, 2026-10-19): the team leader passes every
// dashboard permission check by their seat alone, with no scope row; a
// department head acts on members in their own department only; a division
// lead in their own division(s) only; a member stays as before. Each area's
// rule is checked here for the four of them, each holding no scope row.
// Aerodynamics (1) holds Mission Analysis (1) and Optimization (2);
// Structures (2) holds Design & Manufacturing (3).

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Structures", kind: "technical" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

const MA: DivisionUnit = { divisionId: 1, departmentId: 1 };
const OA: DivisionUnit = { divisionId: 2, departmentId: 1 };
const DM: DivisionUnit = { divisionId: 3, departmentId: 2 };

/** One viewer as the database reads them: their active roles and no scope row. */
type Seat = {
  readonly standing: ViewerStanding;
  readonly roles: readonly ScopedRole[];
  readonly divisionIds: readonly number[];
  readonly departmentIds: readonly number[];
};

function seat(roles: readonly ScopedRole[], divisionIds: readonly number[], departmentIds: readonly number[]): Seat {
  const activeRoles: ActiveRoleRef[] = roles.map((r) => ({ type: r.type, divisionId: r.divisionId, fullAccess: null }));
  return { standing: viewerStandingOf({ scopes: [], activeRoles }), roles, divisionIds, departmentIds };
}

const teamLeader = seat([{ type: "president", divisionId: null, departmentId: null }], [], []);
const head = seat([{ type: "head", divisionId: null, departmentId: 1 }], [], [1]);
const lead = seat([{ type: "lead", divisionId: 1, departmentId: 1 }], [1], []);
const member = seat([{ type: "core", divisionId: 1, departmentId: 1 }], [], []);

const reader = (s: Seat): RecruitmentReader => ({ ...s.standing, roles: s.roles, grants: [] });
const changes = (s: Seat, area: ChangeArea, unit: DivisionUnit) => mayChange({ kind: s.standing.kind, roles: s.roles, grants: [] }, area, unit);

const noScope: ScopeInfo = {
  hasAdminAccess: false,
  hasOrgAccess: false,
  hasAdminEdit: false,
  hasOrgEdit: false,
  departmentIds: new Set(),
  divisionIds: new Set(),
  editableDepartmentIds: new Set(),
  editableDivisionIds: new Set(),
};

test("the team leader is recognised by their seat alone, with no scope row", () => {
  assert.equal(isTeamLeader(teamLeader.standing), true);
  assert.equal(seatOf(teamLeader.standing), "team-leader");
  for (const other of [head, lead, member]) assert.equal(isTeamLeader(other.standing), false);
});

test("pages: the team leader reaches every dashboard page a team member can, heads and leads theirs, a member none of them", () => {
  const teamPages: DashboardPageKey[] = ["positions", "applications", "members", "division-access", "orders", "team-tree"];
  const contentPages: DashboardPageKey[] = ["projects", "outreach", "partners", "alumni", "faq", "team-page"];
  for (const page of [...teamPages, ...contentPages]) assert.equal(canReach(teamLeader.standing, page), true, page);
  for (const page of teamPages) {
    assert.equal(canReach(head.standing, page), true, `head: ${page}`);
    assert.equal(canReach(lead.standing, page), true, `lead: ${page}`);
  }
  for (const page of contentPages) {
    for (const other of [head, lead, member]) assert.equal(canReach(other.standing, page), false, page);
  }
  for (const page of ["positions", "applications", "members", "division-access", "orders"] as const) {
    assert.equal(canReach(member.standing, page), false, `member: ${page}`);
  }
});

test("positions: the team leader switches recruitment and changes positions anywhere; a head in their department, a lead in their division", () => {
  assert.equal(canSwitchRecruitment(teamLeader.standing, noScope), true);
  for (const other of [head, lead, member]) assert.equal(canSwitchRecruitment(other.standing, noScope), false);
  for (const unit of [MA, OA, DM]) assert.equal(changes(teamLeader, "positions", unit), true);
  assert.deepEqual([MA, OA, DM].map((u) => changes(head, "positions", u)), [true, true, false]);
  assert.deepEqual([MA, OA, DM].map((u) => changes(lead, "positions", u)), [true, false, false]);
  assert.deepEqual([MA, OA, DM].map((u) => changes(member, "positions", u)), [false, false, false]);
});

test("applications: the team leader reads and moves every application; a head their department's, a lead their division's", () => {
  const place = (unit: DivisionUnit) => ({ unit, withdrawn: false });
  for (const unit of [MA, OA, DM]) {
    assert.equal(changes(teamLeader, "applications", unit), true);
    assert.equal(mayOpenApplication(reader(teamLeader), place(unit)), true);
  }
  assert.deepEqual([MA, OA, DM].map((u) => [changes(head, "applications", u), readsRecruitmentIn(reader(head), "applications", u)]), [
    [true, true],
    [true, true],
    [false, false],
  ]);
  assert.deepEqual([MA, OA, DM].map((u) => [changes(lead, "applications", u), readsRecruitmentIn(reader(lead), "applications", u)]), [
    [true, true],
    [false, false],
    [false, false],
  ]);
  assert.deepEqual([MA, OA, DM].map((u) => [changes(member, "applications", u), readsRecruitmentIn(reader(member), "applications", u)]), [
    [false, false],
    [false, false],
    [false, false],
  ]);
});

/** Someone in the divisions listed, holding no seat. */
function person(list: readonly (readonly [number, DivisionRole])[]): TeamStanding {
  return { memberships: membershipsOf(list.map(([divisionId, role]) => ({ divisionId, role, since: "2024-10-01" }))), beyond: [] };
}

const TEAM: TeamActor = { kind: "team" };
const HEAD: TeamActor = { kind: "head", departmentIds: [1] };
const LEAD: TeamActor = { kind: "lead", divisionIds: [1] };

test("members: the team leader edits and removes anyone; a head only in their department; a lead only in their division(s)", () => {
  assert.equal(opensWholeTeam(teamLeader.standing), true, "the whole team, with Edit details on every row");
  for (const unit of [MA, OA, DM]) assert.equal(changes(teamLeader, "members", unit), true);
  assert.deepEqual([MA, OA, DM].map((u) => changes(head, "members", u)), [true, true, false]);
  assert.deepEqual([MA, OA, DM].map((u) => changes(lead, "members", u)), [true, false, false]);
  assert.deepEqual([MA, OA, DM].map((u) => changes(member, "members", u)), [false, false, false]);

  const inMA = person([[1, "member"]]);
  const inMAandOA = person([[1, "member"], [2, "member"]]);
  const inMAandDM = person([[1, "member"], [3, "member"]]);
  const inDM = person([[3, "member"]]);

  // Who reaches whom (Edit details, Remove from <division>).
  assert.deepEqual([1, 2, 3].map((d) => reachesDivision(TEAM, d, org)), [true, true, true]);
  assert.deepEqual([1, 2, 3].map((d) => reachesDivision(HEAD, d, org)), [true, true, false]);
  assert.deepEqual([1, 2, 3].map((d) => reachesDivision(LEAD, d, org)), [true, false, false]);

  // Leaves the team (Move to alumni).
  for (const p of [inMA, inMAandOA, inMAandDM, inDM]) assert.equal(mayLeaveTeam(TEAM, p, org).allowed, true);
  assert.deepEqual([inMA, inMAandOA, inMAandDM, inDM].map((p) => mayLeaveTeam(HEAD, p, org).allowed), [true, true, false, false]);
  assert.deepEqual([inMA, inMAandOA, inMAandDM, inDM].map((p) => mayLeaveTeam(LEAD, p, org).allowed), [true, false, false, false]);

  // Remove from <division>, for someone in two divisions.
  assert.equal(removalFrom(TEAM, inMAandDM, 3, org).kind, "offered");
  assert.equal(removalFrom(HEAD, inMAandOA, 2, org).kind, "offered");
  assert.equal(removalFrom(HEAD, inMAandDM, 3, org).kind, "not-in-reach");
  assert.equal(removalFrom(LEAD, inMAandDM, 1, org).kind, "offered");
  assert.equal(removalFrom(LEAD, inMAandOA, 2, org).kind, "not-in-reach");
});

test("access: the team leader opens the whole team's Access page and gives Approve orders; nobody else gives it", () => {
  assert.equal(canReach(teamLeader.standing, "division-access"), true);
  assert.equal(canGiveApproveOrders(seatOf(teamLeader.standing)), true);
  for (const other of [head, lead, member]) assert.equal(canGiveApproveOrders(seatOf(other.standing)), false);
});

test("orders: the team leader edits every order and decides; a head their department's; a lead their own division's by role (issue #590)", () => {
  const units = org.departments.map((d) => ({
    id: d.id,
    name: d.name,
    divisions: org.divisions.filter((v) => v.departmentId === d.id).map((v) => ({ id: v.id, name: v.name })),
  }));
  const orderIn = (unit: DivisionUnit): { unit: OrderUnit } => ({
    unit: {
      division: { id: unit.divisionId, name: org.divisions.find((v) => v.id === unit.divisionId)!.name },
      department: { id: unit.departmentId, name: org.departments.find((d) => d.id === unit.departmentId)!.name },
    },
  });
  const scopeOf = (s: Seat, rows: readonly OrdersScopeRow[] = []) =>
    ordersScopeOf(
      {
        fullAccess: s.standing.kind === "operations-lead",
        teamLeader: isTeamLeader(s.standing),
        headDepartment: s.standing.kind === "department-head" ? { id: 1, name: "Aerodynamics" } : null,
        ledDivisionIds: ledDivisionIds({ scopes: [], activeRoles: s.roles.map((r) => ({ type: r.type, divisionId: r.divisionId, fullAccess: null })) }),
      },
      rows,
      units,
    );

  const leader = scopeOf(teamLeader)!;
  assert.equal(leader.decides, "team-leader");
  assert.deepEqual([MA, OA, DM].map((u) => canEditOrder(leader, orderIn(u))), [true, true, true]);
  const byHead = scopeOf(head)!;
  assert.deepEqual([MA, OA, DM].map((u) => canEditOrder(byHead, orderIn(u))), [true, true, false]);
  // A lead edits their own division's orders by role, with no grant, and decides nothing.
  const byLead = scopeOf(lead)!;
  assert.equal(byLead.decides, null);
  assert.deepEqual([MA, OA, DM].map((u) => canEditOrder(byLead, orderIn(u))), [true, false, false]);
  assert.equal(scopeOf(member), null);
});

test("structure: the team leader edits every department and division; a head their department's divisions; a lead and a member nothing", () => {
  assert.equal(showsTreeEdit(teamLeader.standing), true);
  assert.equal(mayManageDepartments(TEAM), true);
  assert.deepEqual([1, 2].map((d) => mayManageDivisionsIn(TEAM, d)), [true, true]);
  assert.equal(showsTreeEdit(head.standing), true);
  assert.equal(mayManageDepartments(HEAD), false);
  assert.deepEqual([1, 2].map((d) => mayManageDivisionsIn(HEAD, d)), [true, false]);
  assert.equal(showsTreeEdit(lead.standing), false);
  assert.deepEqual([1, 2].map((d) => mayManageDivisionsIn(LEAD, d)), [false, false]);
  assert.equal(showsTreeEdit(member.standing), false);
});

test("content: the team leader edits site content with no website row; a head, a lead and a member do not", () => {
  assert.equal(maySiteContent(teamLeader.standing), true);
  for (const other of [head, lead, member]) assert.equal(maySiteContent(other.standing), false);
});
