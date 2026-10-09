import assert from "node:assert/strict";
import { test } from "node:test";
import { checkGiveAccess, grantSummary, type HeldAccess } from "./division-access";

const people = [{ id: 6, name: "Pietro Ricci", role: "Member" }];

test("a lead gives only what they hold, never above the level they hold it", () => {
  const held: HeldAccess[] = [
    { target: "applications", level: "edit" },
    { target: "members", level: "view" },
  ];
  const access = { held, people };
  assert.deepEqual(checkGiveAccess(access, { personId: 6, targets: ["applications"], level: "edit" }), {
    ok: true,
    value: { personId: 6, targets: ["applications"], level: "edit" },
  });
  assert.equal(checkGiveAccess(access, { personId: 6, targets: ["members"], level: "view" }).ok, true);
  assert.equal(checkGiveAccess(access, { personId: 6, targets: ["members"], level: "edit" }).ok, false);
  assert.equal(checkGiveAccess(access, { personId: 6, targets: ["positions"], level: "view" }).ok, false);
});

test("access goes only to someone in the division, for at least one thing", () => {
  const access = { held: [{ target: "positions", level: "edit" }] as HeldAccess[], people };
  assert.equal(checkGiveAccess(access, { personId: 99, targets: ["positions"], level: "view" }).ok, false);
  assert.equal(checkGiveAccess(access, { personId: 6, targets: [], level: "view" }).ok, false);
  assert.equal(checkGiveAccess(access, { personId: "6", targets: ["positions"], level: "view" }).ok, false);
});

test("the drawer says what the person will be able to do", () => {
  assert.equal(
    grantSummary("Pietro Ricci", ["applications"], "view", "Mission Analysis Division"),
    "Pietro Ricci will be able to read applications for Mission Analysis Division roles, but not change their status.",
  );
  assert.equal(grantSummary("Pietro Ricci", [], "view", "Mission Analysis Division"), null);
});
