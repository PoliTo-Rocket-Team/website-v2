import assert from "node:assert/strict";
import { test } from "node:test";
import { viewerKindOf, viewerStandingOf } from "./viewer";

const role = (type: "president" | "head" | "lead" | "core" | null) => ({ type });

test("a real account's viewer kind follows its scopes and role", () => {
  assert.equal(viewerKindOf(null), "non-member");
  assert.equal(viewerKindOf({ scopes: [], activeRole: role("core") }), "member");
  assert.equal(viewerKindOf({ scopes: ["website"], activeRole: role(null) }), "member");
  assert.equal(viewerKindOf({ scopes: ["division"], activeRole: role("core") }), "division-lead");
  assert.equal(viewerKindOf({ scopes: [], activeRole: role("lead") }), "division-lead");
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
