import assert from "node:assert/strict";
import { test } from "node:test";
import { headDivisionsOf, viewerKindOf, viewerStandingOf, viewerUnitsOf } from "./viewer";

const role = (type: "president" | "head" | "lead" | "core" | null) => ({ type });

test("a real account's viewer kind follows its scopes and role", () => {
  assert.equal(viewerKindOf(null), "non-member");
  assert.equal(viewerKindOf({ scopes: [], activeRole: role("core") }), "member");
  assert.equal(viewerKindOf({ scopes: ["website"], activeRole: role(null) }), "member");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRole: role("core") }), "division-lead");
  assert.equal(viewerKindOf({ scopes: [], activeRole: role("lead") }), "division-lead");
  assert.equal(viewerKindOf({ scopes: [], activeRole: role("head") }), "department-head");
  assert.equal(viewerKindOf({ scopes: ["division", "org"], activeRole: role("lead") }), "operations-lead");
  assert.equal(viewerKindOf({ scopes: ["admin"], activeRole: role(null) }), "operations-lead");
});

test("a member row with no active role is a non-member, whatever scope rows remain (issue #201)", () => {
  assert.equal(viewerKindOf({ scopes: [], activeRole: null }), "non-member");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRole: null }), "non-member");
  assert.equal(viewerKindOf({ scopes: ["org", "admin"], activeRole: null }), "non-member");
});

test("a website scope row gives site-content access, but not to someone who left the team (issue #234)", () => {
  assert.deepEqual(viewerStandingOf({ scopes: ["website"], activeRole: role("core") }), { kind: "member", siteContent: true });
  assert.deepEqual(viewerStandingOf({ scopes: ["division"], activeRole: role("lead") }), { kind: "division-lead", siteContent: false });
  assert.deepEqual(viewerStandingOf({ scopes: ["website"], activeRole: null }), { kind: "non-member", siteContent: false });
});

test("a head role is a department head, unless org or admin access makes them the operations lead (issue #230)", () => {
  assert.equal(viewerKindOf({ scopes: [], activeRole: role("head") }), "department-head");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRole: role("head") }), "department-head");
  assert.equal(viewerKindOf({ scopes: ["org"], activeRole: role("head") }), "operations-lead");
  assert.equal(viewerKindOf({ scopes: ["department"], activeRole: role("core") }), "division-lead");
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
  assert.deepEqual(viewerUnitsOf([], { type: "head", divisionId: null, departmentId: 1 }), { divisionIds: [], departmentIds: [1] });
  // A scope row on top adds its unit, each unit once.
  assert.deepEqual(
    viewerUnitsOf(
      [
        { scope: "department", divisionId: null, deptId: 1 },
        { scope: "division", divisionId: 7, deptId: null },
      ],
      { type: "head", divisionId: null, departmentId: 1 },
    ),
    { divisionIds: [7], departmentIds: [1] },
  );
  // A lead covers their division only; a member's role adds nothing.
  assert.deepEqual(viewerUnitsOf([], { type: "lead", divisionId: 3, departmentId: 1 }), { divisionIds: [3], departmentIds: [] });
  assert.deepEqual(viewerUnitsOf([], { type: "core", divisionId: 3, departmentId: 1 }), { divisionIds: [], departmentIds: [] });
});
