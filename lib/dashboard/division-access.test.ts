import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkGiveAccess,
  checkRemoveAccess,
  grantSummary,
  type AccessGrant,
  type AccessPerson,
  type HeldAccess,
} from "./division-access";

const pietro: AccessPerson = { id: 6, name: "Pietro Ricci", standing: "member" };
const sofia: AccessPerson = { id: 3, name: "Sofia Neri", standing: "member" };
const coLead: AccessPerson = { id: 9, name: "Luca Bianchi", standing: "lead" };
const people = [pietro, sofia, coLead];
const grants: AccessGrant[] = [];

function grant(id: number, person: AccessPerson, target: AccessGrant["target"], level: AccessGrant["level"]): AccessGrant {
  return { id, person, target, level, givenBy: null, givenOn: null };
}

test("a lead gives only what they hold, never above the level they hold it", () => {
  const held: HeldAccess[] = [
    { target: "applications", level: "edit" },
    { target: "members", level: "view" },
  ];
  const access = { held, people, grants };
  assert.deepEqual(checkGiveAccess(access, { personId: 6, targets: ["applications"], level: "edit" }), {
    ok: true,
    value: { personId: 6, targets: ["applications"], level: "edit" },
  });
  assert.equal(checkGiveAccess(access, { personId: 6, targets: ["members"], level: "view" }).ok, true);
  assert.equal(checkGiveAccess(access, { personId: 6, targets: ["members"], level: "edit" }).ok, false);
  assert.equal(checkGiveAccess(access, { personId: 6, targets: ["positions"], level: "view" }).ok, false);
});

test("access goes only to someone in the division, for at least one thing", () => {
  const access = { held: [{ target: "positions", level: "edit" }] as HeldAccess[], people, grants };
  assert.equal(checkGiveAccess(access, { personId: 99, targets: ["positions"], level: "view" }).ok, false);
  assert.equal(checkGiveAccess(access, { personId: 6, targets: [], level: "view" }).ok, false);
  assert.equal(checkGiveAccess(access, { personId: "6", targets: ["positions"], level: "view" }).ok, false);
});

test("a lead removes only grants on what they hold, at a level they hold, and never another lead's", () => {
  const held: HeldAccess[] = [
    { target: "applications", level: "edit" },
    { target: "members", level: "view" },
  ];
  const access = {
    held,
    grants: [
      grant(1, sofia, "applications", "edit"),
      grant(2, sofia, "members", "view"),
      grant(3, pietro, "members", "edit"),
      grant(4, pietro, "positions", "view"),
      grant(5, coLead, "applications", "view"),
    ],
  };
  assert.equal(checkRemoveAccess(access, 1).ok, true);
  assert.equal(checkRemoveAccess(access, 2).ok, true);
  assert.equal(checkRemoveAccess(access, 3).ok, false, "an edit grant when the lead holds only view");
  assert.equal(checkRemoveAccess(access, 4).ok, false, "a target the lead does not hold");
  assert.equal(checkRemoveAccess(access, 5).ok, false, "another lead's own access");
  assert.equal(checkRemoveAccess(access, 99).ok, false, "a grant outside the division");
});

test("giving a new level never replaces a grant the lead could not remove", () => {
  const held: HeldAccess[] = [
    { target: "applications", level: "edit" },
    { target: "members", level: "view" },
  ];
  const access = {
    held,
    people,
    grants: [grant(3, pietro, "members", "edit"), grant(5, coLead, "applications", "view"), grant(6, sofia, "applications", "edit")],
  };
  // Downgrading Pietro's edit on Members to view, when the lead holds only view there.
  assert.equal(checkGiveAccess(access, { personId: 6, targets: ["members"], level: "view" }).ok, false);
  // Replacing a co-lead's own access.
  assert.equal(checkGiveAccess(access, { personId: 9, targets: ["applications"], level: "edit" }).ok, false);
  // Downgrading Sofia's Applications grant, which the lead holds at edit.
  assert.equal(checkGiveAccess(access, { personId: 3, targets: ["applications"], level: "view" }).ok, true);
});

test("the drawer says what the person will be able to do", () => {
  assert.equal(
    grantSummary("Pietro Ricci", ["applications"], "view", "Mission Analysis Division"),
    "Pietro Ricci will be able to read applications for Mission Analysis Division roles, but not change their status.",
  );
  assert.equal(grantSummary("Pietro Ricci", [], "view", "Mission Analysis Division"), null);
});
