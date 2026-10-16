import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fullAccessSeatOf,
  headDivisionsOf,
  isTeamLeader,
  ledDivisionIds,
  standingIn,
  testDeveloperStanding,
  viewerKindOf,
  viewerStandingOf,
  viewerUnitsOf,
  userCardRole,
  VIEWER_KIND_LABELS,
  type ActiveRoleRef,
  type FlaggedSeat,
} from "./viewer";
import { decideRightOf } from "./orders";

const role = (type: ActiveRoleRef["type"], divisionId: number | null = null, fullAccess: FlaggedSeat | null = null): ActiveRoleRef => ({
  type,
  divisionId,
  fullAccess,
});

// The three full-access seats as the data holds them (issue #238): the team
// leader's `president` role, and the flagged Operations head and IT lead roles.
const teamLeader = role("president");
const operationsLead = role("head", null, "operations-lead");
const itLead = role("lead", 17, "it-lead");

test("a real account's viewer kind follows its scopes and role", () => {
  assert.equal(viewerKindOf(null), "non-member");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [role("core")] }), "member");
  assert.equal(viewerKindOf({ scopes: ["website"], activeRoles: [role(null)] }), "member");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRoles: [role("core")] }), "division-lead");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [role("lead")] }), "division-lead");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [role("head")] }), "department-head");
  assert.equal(viewerKindOf({ scopes: ["division", "org"], activeRoles: [role("lead")] }), "operations-lead");
  assert.equal(viewerKindOf({ scopes: ["admin"], activeRoles: [role(null)] }), "operations-lead");
});

test("a member row with no active role is a non-member, whatever scope rows remain (issue #201)", () => {
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [] }), "non-member");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRoles: [] }), "non-member");
  assert.equal(viewerKindOf({ scopes: ["org", "admin"], activeRoles: [] }), "non-member");
});

test("with no active role, an Alumni record entry makes an alumnus and none a non-member; an active role keeps its kind (issue #317)", () => {
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [], onAlumniRecord: true }), "alumni");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [], onAlumniRecord: false }), "non-member");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [role("core")], onAlumniRecord: true }), "member");
  assert.equal(VIEWER_KIND_LABELS.alumni, "Alumni");
});

test("the user card reads Alumni for an alumnus, and Applicant or Signed in for a non-member (boards 56, 50e, 50f)", () => {
  const off = (kind: "alumni" | "non-member") => ({ ...testDeveloperStanding(kind), name: "Luca Moretti", role: "Applicant", session: "account" as const });
  assert.equal(userCardRole(off("alumni"), false), "Alumni");
  assert.equal(userCardRole(off("non-member"), true), "Applicant");
  assert.equal(userCardRole(off("non-member"), false), "Signed in");
});

test("an alumnus holds no access, whatever scope rows outlived their roles (issue #317)", () => {
  for (const scope of ["website", "team", "division", "org", "admin"] as const) {
    assert.deepEqual(viewerStandingOf({ scopes: [scope], activeRoles: [], onAlumniRecord: true }), { kind: "alumni", siteContent: false, approveOrders: false }, scope);
  }
});

test("the viewer kind reads every active role: a lead role beside a newer member role still leads (issue #229)", () => {
  // The member role in division 2 is the newer one; the lead role in division 1 still counts.
  const access = { scopes: [], activeRoles: [role("core", 2), role("lead", 1)] };
  assert.equal(viewerKindOf(access), "division-lead");
});

test("someone who leads division A and is a member of division B is a lead for A and a member for B", () => {
  const access = { scopes: [], activeRoles: [role("lead", 1), role("core", 2)] };
  assert.equal(standingIn(access, 1), "lead");
  assert.equal(standingIn(access, 2), "member");
  assert.equal(standingIn(access, 3), null);
  assert.deepEqual(ledDivisionIds(access), [1]);
});

test("a website scope row gives site-content access, but not to someone who left the team (issue #234)", () => {
  assert.deepEqual(viewerStandingOf({ scopes: ["website"], activeRoles: [role("core")] }), { kind: "member", siteContent: true, approveOrders: false });
  assert.deepEqual(viewerStandingOf({ scopes: ["division"], activeRoles: [role("lead")] }), { kind: "division-lead", siteContent: false, approveOrders: false });
  assert.deepEqual(viewerStandingOf({ scopes: ["website"], activeRoles: [] }), { kind: "non-member", siteContent: false, approveOrders: false });
});

test("a head role is a department head, unless org or admin access makes them the operations lead (issue #230)", () => {
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [role("head")] }), "department-head");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRoles: [role("head")] }), "department-head");
  assert.equal(viewerKindOf({ scopes: ["org"], activeRoles: [role("head")] }), "operations-lead");
  assert.equal(viewerKindOf({ scopes: ["department"], activeRoles: [role("core")] }), "division-lead");
});

test("a head sees every open division of their department and none from another", () => {
  const divisions = [
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, closedAt: null },
    { id: 1, name: "Mission Analysis Division", departmentId: 1, closedAt: null },
    { id: 3, name: "Wind Tunnel Division", departmentId: 1, closedAt: "2025-06-30" },
    { id: 4, name: "Structures Analysis Division", departmentId: 2, closedAt: null },
  ];
  assert.deepEqual(
    headDivisionsOf(1, divisions).map((d) => d.id),
    [1, 2],
  );
  assert.deepEqual(
    headDivisionsOf(2, divisions).map((d) => d.id),
    [4],
  );
});

test("a head role covers its department with no department scope row (issues #184, #230)", () => {
  assert.deepEqual(viewerUnitsOf([], [{ type: "head", divisionId: null, departmentId: 1 }]), { divisionIds: [], departmentIds: [1] });
  // A scope row on top adds its unit, each unit once.
  assert.deepEqual(
    viewerUnitsOf(
      [
        { scope: "department", divisionId: null, deptId: 1 },
        { scope: "division", divisionId: 7, deptId: null },
      ],
      [{ type: "head", divisionId: null, departmentId: 1 }],
    ),
    { divisionIds: [7], departmentIds: [1] },
  );
  // A lead covers their division only; a member's role adds nothing.
  assert.deepEqual(viewerUnitsOf([], [{ type: "lead", divisionId: 3, departmentId: 1 }]), { divisionIds: [3], departmentIds: [] });
  assert.deepEqual(viewerUnitsOf([], [{ type: "core", divisionId: 3, departmentId: 1 }]), { divisionIds: [], departmentIds: [] });
  // Every active role counts (issue #229): a lead of two divisions covers both.
  assert.deepEqual(
    viewerUnitsOf(
      [],
      [
        { type: "lead", divisionId: 3, departmentId: 1 },
        { type: "core", divisionId: 5, departmentId: 2 },
        { type: "lead", divisionId: 6, departmentId: 2 },
      ],
    ),
    { divisionIds: [3, 6], departmentIds: [] },
  );
});

test("the team leader, the operations lead and the IT lead get full access from the role, with no scope row (issue #238)", () => {
  const seats = [
    [teamLeader, "team-leader"],
    [operationsLead, "operations-lead"],
    [itLead, "it-lead"],
  ] as const;
  for (const [held, seat] of seats) {
    assert.equal(fullAccessSeatOf([held]), seat);
    assert.deepEqual(viewerStandingOf({ scopes: [], activeRoles: [held] }), { kind: "operations-lead", seat, siteContent: false, approveOrders: false });
  }
});

test("a division lead, a department head and a member hold no full-access seat (issue #238)", () => {
  for (const held of [role("lead", 3), role("head"), role("core", 3), role(null)]) {
    assert.equal(fullAccessSeatOf([held]), null);
    assert.notEqual(viewerKindOf({ scopes: [], activeRoles: [held] }), "operations-lead");
  }
});

test("an admin or org scope row still gives full access, with no seat (issue #238)", () => {
  for (const scope of ["admin", "org"] as const) {
    assert.deepEqual(viewerStandingOf({ scopes: [scope], activeRoles: [role("core", 3)] }), { kind: "operations-lead", seat: null, siteContent: false, approveOrders: false });
  }
});

test("someone in two seats is read as the higher one", () => {
  assert.equal(fullAccessSeatOf([itLead, teamLeader]), "team-leader");
  assert.equal(fullAccessSeatOf([operationsLead, itLead]), "it-lead");
});

test("by default only the team leader decides orders; the operations lead and the IT lead need Approve orders (issue #238)", () => {
  const decides = (held: ActiveRoleRef, approveOrders: boolean) =>
    decideRightOf({ teamLeader: isTeamLeader(viewerStandingOf({ scopes: [], activeRoles: [held] })), approveOrders });
  assert.equal(decides(teamLeader, false), "team-leader");
  assert.equal(decides(operationsLead, false), null);
  assert.equal(decides(itLead, false), null);
  assert.equal(decides(operationsLead, true), "approve-orders");
  assert.equal(decides(itLead, true), "approve-orders");
  // Full access from a scope row alone is not the team leader either.
  assert.equal(isTeamLeader(viewerStandingOf({ scopes: ["admin"], activeRoles: [role("core", 3)] })), false);
  assert.equal(isTeamLeader(testDeveloperStanding("operations-lead")), false);
});
