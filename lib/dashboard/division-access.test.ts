import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accessByPerson,
  checkRemoveAllAccess,
  checkSaveAccess,
  placesOf,
  ROLE_HELD_ACCESS,
  type AccessGrant,
  type AccessPerson,
  type AccessPlace,
  type AccessUnit,
  type HeldAccess,
} from "./division-access";

const msa = { id: 1, name: "Mission Analysis Division" };
const aoa = { id: 2, name: "Optimization and Analysis Division" };
const aerodynamics = { id: 1, name: "Aerodynamics" };

const pietro: AccessPerson = { id: 6, name: "Pietro Ricci", standing: "member", division: msa };
const sofia: AccessPerson = { id: 3, name: "Sofia Neri", standing: "member", division: msa };
const coLead: AccessPerson = { id: 9, name: "Luca Bianchi", standing: "lead", division: msa };
const people = [pietro, sofia, coLead];

const divisionUnit: AccessUnit = { kind: "division", division: msa };
const inMsa: AccessPlace = { kind: "division", division: msa };

function grant(id: number, person: AccessPerson, target: AccessGrant["target"], level: AccessGrant["level"], place = inMsa): AccessGrant {
  return { id, person, place, target, level, givenBy: "You", givenOn: "2026-10-02" };
}

const held: HeldAccess[] = [
  { target: "applications", level: "edit" },
  { target: "members", level: "view" },
  { target: "orders", level: "edit" },
];

const lead = (grants: AccessGrant[] = []) => ({ unit: divisionUnit, held, people, grants });

test("one Save gives one person several areas, each at its own level", () => {
  assert.deepEqual(checkSaveAccess(lead(), { personId: 6, areas: { applications: "edit", members: "view", orders: "view" } }), {
    ok: true,
    value: {
      personId: 6,
      place: inMsa,
      changes: [
        { kind: "add", target: "applications", to: "edit" },
        { kind: "add", target: "members", to: "view" },
        { kind: "add", target: "orders", to: "view" },
      ],
    },
  });
});

test("a lead cannot give an area they do not hold, or a level above their own", () => {
  for (const areas of [{ positions: "view" }, { members: "edit" }, { applications: "edit", members: "edit" }]) {
    assert.equal(checkSaveAccess(lead(), { personId: 6, areas }).ok, false, JSON.stringify(areas));
  }
});

test("an edit writes only the difference: adds, level changes and removals", () => {
  const access = lead([grant(1, sofia, "applications", "view"), grant(2, sofia, "members", "view")]);
  assert.deepEqual(checkSaveAccess(access, { personId: 3, areas: { applications: "edit", orders: "edit" } }), {
    ok: true,
    value: {
      personId: 3,
      place: inMsa,
      changes: [
        { kind: "change", target: "applications", from: "view", to: "edit" },
        { kind: "remove", target: "members", from: "view" },
        { kind: "add", target: "orders", to: "edit" },
      ],
    },
  });
});

test("an edit never touches an area held above the lead, nor another lead's access", () => {
  const access = lead([grant(1, pietro, "members", "edit"), grant(2, coLead, "applications", "view")]);
  // Downgrading Pietro's edit on Members, when the lead holds only view there.
  assert.equal(checkSaveAccess(access, { personId: 6, areas: { members: "view" } }).ok, false);
  // Leaving Pietro's Members untouched while adding Orders is fine.
  assert.equal(checkSaveAccess(access, { personId: 6, areas: { members: "edit", orders: "view" } }).ok, true);
  assert.equal(checkSaveAccess(access, { personId: 9, areas: { applications: "edit" } }).ok, false);
});

test("a Save goes only to someone in the division, in the division, with at least one area", () => {
  assert.equal(checkSaveAccess(lead(), { personId: 99, areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, areas: {} }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: "6", areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, areas: { orders: "decide" } }).ok, false);
  // A lead has no department-wide place and no other division.
  assert.equal(checkSaveAccess(lead(), { personId: 6, where: "department", areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, where: 2, areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(lead(), { personId: 6, where: 1, areas: { orders: "view" } }).ok, true);
});

test("Remove all access removes every area, only within the lead's limit", () => {
  const sofiaGrants = [grant(1, sofia, "applications", "edit"), grant(2, sofia, "orders", "view")];
  assert.deepEqual(checkRemoveAllAccess(lead(sofiaGrants), 3), {
    ok: true,
    value: [
      {
        personId: 3,
        place: inMsa,
        changes: [
          { kind: "remove", target: "applications", from: "edit" },
          { kind: "remove", target: "orders", from: "view" },
        ],
      },
    ],
  });
  const above = [...sofiaGrants, grant(3, sofia, "positions", "view")];
  assert.equal(checkRemoveAllAccess(lead(above), 3).ok, false, "Positions is not the lead's");
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

// A department head (boards 65 and 65b, issue #230) ------------------------------

const departmentUnit: AccessUnit = { kind: "department", department: aerodynamics, divisions: [msa, aoa] };
const wholeDepartment: AccessPlace = { kind: "department", department: aerodynamics };
const inAoa: AccessPlace = { kind: "division", division: aoa };
const luca: AccessPerson = { id: 4, name: "Luca Marino", standing: "member", division: aoa };
const laura: AccessPerson = { id: 20, name: "Laura Greco", standing: "lead", division: aoa };
const marco: AccessPerson = { id: 2, name: "Marco Bianchi", standing: "lead", division: msa };
const headPeople = [sofia, luca, laura, marco];
const head = (grants: AccessGrant[] = [], heldByHead: readonly HeldAccess[] = ROLE_HELD_ACCESS) => ({
  unit: departmentUnit,
  held: heldByHead,
  people: headPeople,
  grants,
});

test("a head gives access in the whole department or in one of its divisions", () => {
  assert.deepEqual(
    placesOf(departmentUnit).map((p) => (p.kind === "department" ? "department" : p.division.id)),
    ["department", 1, 2],
  );
  const whole = checkSaveAccess(head(), { personId: 3, where: "department", areas: { members: "view" } });
  assert.deepEqual(whole, { ok: true, value: { personId: 3, place: wholeDepartment, changes: [{ kind: "add", target: "members", to: "view" }] } });
  const one = checkSaveAccess(head(), { personId: 4, where: 2, areas: { applications: "edit" } });
  assert.deepEqual(one, { ok: true, value: { personId: 4, place: inAoa, changes: [{ kind: "add", target: "applications", to: "edit" }] } });
  // With no place sent, Give access starts on the whole department.
  const home = checkSaveAccess(head(), { personId: 3, areas: { orders: "view" } });
  assert.ok(home.ok && home.value.place.kind === "department");
});

test("a head gives only what they hold, at no higher level, inside their department", () => {
  const viewOnly: HeldAccess[] = [{ target: "members", level: "view" }];
  assert.equal(checkSaveAccess(head([], viewOnly), { personId: 3, where: "department", areas: { members: "edit" } }).ok, false);
  assert.equal(checkSaveAccess(head([], viewOnly), { personId: 3, where: "department", areas: { orders: "view" } }).ok, false);
  assert.equal(checkSaveAccess(head([], viewOnly), { personId: 3, where: "department", areas: { members: "view" } }).ok, true);
  // A division of another department, and a person from another department, are refused.
  assert.equal(checkSaveAccess(head(), { personId: 3, where: 4, areas: { members: "view" } }).ok, false);
  assert.equal(checkSaveAccess(head(), { personId: 44, where: "department", areas: { members: "view" } }).ok, false);
});

test("a lead's role access cannot be changed or removed by a head", () => {
  assert.equal(checkSaveAccess(head(), { personId: 20, where: 2, areas: { members: "view" } }).ok, false);
  const marcosGrant = grant(9, marco, "orders", "edit");
  assert.equal(checkRemoveAllAccess(head([marcosGrant]), 2).ok, false);
});

test("a grant in one place leaves the same area in another place alone; Remove all takes every place", () => {
  const grants = [grant(1, sofia, "members", "view", wholeDepartment), grant(2, sofia, "positions", "edit", inMsa)];
  const msaOnly = checkSaveAccess(head(grants), { personId: 3, where: 1, areas: { positions: "view" } });
  assert.deepEqual(msaOnly, {
    ok: true,
    value: { personId: 3, place: inMsa, changes: [{ kind: "change", target: "positions", from: "edit", to: "view" }] },
  });
  const removed = checkRemoveAllAccess(head(grants), 3);
  assert.ok(removed.ok);
  if (removed.ok) {
    assert.deepEqual(
      removed.value.map((w) => [w.place.kind, w.changes.map((c) => c.target)]),
      [
        ["department", ["members"]],
        ["division", ["positions"]],
      ],
    );
  }
});
