import assert from "node:assert/strict";
import { test } from "node:test";
import { ledDivisionIds, standingIn, viewerKindOf, viewerStandingOf, type ActiveRoleRef } from "./viewer";

const role = (type: ActiveRoleRef["type"], divisionId: number | null = null): ActiveRoleRef => ({ type, divisionId });

test("a real account's viewer kind follows its scopes and role", () => {
  assert.equal(viewerKindOf(null), "non-member");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [role("core")] }), "member");
  assert.equal(viewerKindOf({ scopes: ["website"], activeRoles: [role(null)] }), "member");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRoles: [role("core")] }), "division-lead");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [role("lead")] }), "division-lead");
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
