import assert from "node:assert/strict";
import { test } from "node:test";
import { viewerKindOf } from "./viewer";

test("a real account's viewer kind follows its scopes and role", () => {
  assert.equal(viewerKindOf(null), "non-member");
  assert.equal(viewerKindOf({ scopes: [], roleType: "core" }), "member");
  assert.equal(viewerKindOf({ scopes: ["website"], roleType: null }), "member");
  assert.equal(viewerKindOf({ scopes: ["division"], roleType: "core" }), "division-lead");
  assert.equal(viewerKindOf({ scopes: [], roleType: "lead" }), "division-lead");
  assert.equal(viewerKindOf({ scopes: ["division", "org"], roleType: "lead" }), "operations-lead");
  assert.equal(viewerKindOf({ scopes: ["admin"], roleType: null }), "operations-lead");
});
