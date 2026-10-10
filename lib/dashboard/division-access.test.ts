import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessByPerson,
  checkRemoveAllAccess,
  checkSaveAccess,
  type AccessGrant,
  type AccessPerson,
  type HeldAccess,
} from "./division-access";

const pietro: AccessPerson = { id: 6, name: "Pietro Ricci", standing: "member" };
const sofia: AccessPerson = { id: 3, name: "Sofia Neri", standing: "member" };
const coLead: AccessPerson = { id: 9, name: "Luca Bianchi", standing: "lead" };
const people = [pietro, sofia, coLead];

function grant(id: number, person: AccessPerson, target: AccessGrant["target"], level: AccessGrant["level"]): AccessGrant {
  return { id, person, target, level, givenBy: "You", givenOn: "2026-10-02" };
}

const held: HeldAccess[] = [
  { target: "applications", level: "edit" },
  { target: "members", level: "view" },
  { target: "orders", level: "edit" },
];

test("one Save gives one person several areas, each at its own level", () => {
  const access = { held, people, grants: [] };
  assert.deepEqual(checkSaveAccess(access, { personId: 6, areas: { applications: "edit", members: "view", orders: "view" } }), {
    ok: true,
    value: {
      personId: 6,
      changes: [
        { kind: "add", target: "applications", to: "edit" },
        { kind: "add", target: "members", to: "view" },
        { kind: "add", target: "orders", to: "view" },
      ],
    },
  });
});

test("a lead cannot give an area they do not hold, or a level above their own", () => {
  const access = { held, people, grants: [] };
  for (const areas of [{ positions: "view" }, { members: "edit" }, { applications: "edit", members: "edit" }]) {
    assert.equal(checkSaveAccess(access, { personId: 6, areas }).ok, false, JSON.stringify(areas));
  }
});

test("an edit writes only the difference: adds, level changes and removals", () => {
  const access = { held, people, grants: [grant(1, sofia, "applications", "view"), grant(2, sofia, "members", "view")] };
  assert.deepEqual(checkSaveAccess(access, { personId: 3, areas: { applications: "edit", orders: "edit" } }), {
    ok: true,
    value: {
      personId: 3,
      changes: [
        { kind: "change", target: "applications", from: "view", to: "edit" },
        { kind: "remove", target: "members", from: "view" },
        { kind: "add", target: "orders", to: "edit" },
      ],
    },
  });
});

test("an edit never touches an area held above the lead, nor another lead's access", () => {
  const access = { held, people, grants: [grant(1, pietro, "members", "edit"), grant(2, coLead, "applications", "view")] };
  // Downgrading Pietro's edit on Members, when the lead holds only view there.
  assert.equal(checkSaveAccess(access, { personId: 6, areas: { members: "view" } }).ok, false);
  // Leaving Pietro's Members untouched while adding Orders is fine.
  assert.equal(checkSaveAccess(access, { personId: 6, areas: { members: "edit", orders: "view" } }).ok, true);
  assert.equal(checkSaveAccess(access, { personId: 9, areas: { applications: "edit" } }).ok, false);
});

test("a Save goes only to someone in the division, with at least one area", () => {
  const access = { held, people, grants: [] };
  assert.equal(checkSaveAccess(access, { personId: 99, areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(access, { personId: 6, areas: {} }).ok, false);
  assert.equal(checkSaveAccess(access, { personId: "6", areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(access, { personId: 6, areas: { orders: "decide" } }).ok, false);
});

test("Remove all access removes every area, only within the lead's limit", () => {
  const sofiaGrants = [grant(1, sofia, "applications", "edit"), grant(2, sofia, "orders", "view")];
  assert.deepEqual(checkRemoveAllAccess({ held, people, grants: sofiaGrants }, 3), {
    ok: true,
    value: {
      personId: 3,
      changes: [
        { kind: "remove", target: "applications", from: "edit" },
        { kind: "remove", target: "orders", from: "view" },
      ],
    },
  });
  const above = [...sofiaGrants, grant(3, sofia, "positions", "view")];
  assert.equal(checkRemoveAllAccess({ held, people, grants: above }, 3).ok, false, "Positions is not the lead's");
});

test("the table shows one row per person, areas in the order given, with the latest giver", () => {
  const rows = accessByPerson([
    { ...grant(5, sofia, "members", "view"), givenOn: "2026-10-04" },
    grant(2, pietro, "positions", "view"),
    grant(1, sofia, "applications", "edit"),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.person.name, r.grants.map((g) => g.target), r.givenOn]),
    [
      ["Sofia Neri", ["applications", "members"], "2026-10-04"],
      ["Pietro Ricci", ["positions"], "2026-10-02"],
    ],
  );
});
