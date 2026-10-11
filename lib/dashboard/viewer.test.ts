import assert from "node:assert/strict";
import { test } from "node:test";
import { headDivisionsOf, ledDivisionIds, standingIn, viewerKindOf, viewerStandingOf, viewerUnitsOf, type ActiveRoleRef } from "./viewer";

const role = (type: ActiveRoleRef["type"], divisionId: number | null = null): ActiveRoleRef => ({ type, divisionId });

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
  assert.deepEqual(viewerStandingOf({ scopes: ["website"], activeRoles: [role("core")] }), { kind: "member", siteContent: true });
  assert.deepEqual(viewerStandingOf({ scopes: ["division"], activeRoles: [role("lead")] }), { kind: "division-lead", siteContent: false });
  assert.deepEqual(viewerStandingOf({ scopes: ["website"], activeRoles: [] }), { kind: "non-member", siteContent: false });
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
