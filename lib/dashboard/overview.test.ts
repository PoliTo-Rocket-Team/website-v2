import assert from "node:assert/strict";
import { test } from "node:test";
import { departmentRoster, divisionRoster, ROSTER_LIMIT, type DepartmentRosterRow, type RosterRow } from "./overview";

const division = { title: "Mission Analysis Division", department: "Aerospace", members: "/dashboard/members?division=4" };

test("a member with two active rows in the division is listed and counted once", () => {
  const rows: RosterRow[] = [
    { memberId: 1, name: "Ada Head", type: "head", photoUrl: null },
    { memberId: 1, name: "Ada Head", type: "member", photoUrl: null },
    { memberId: 2, name: "Bo Member", type: "member", photoUrl: null },
    { memberId: 3, name: "Viewer", type: "member", photoUrl: null },
  ];
  const roster = divisionRoster(division, rows, 3);
  assert.deepEqual(
    roster.people.map((p) => [p.name, p.role]),
    [
      ["Ada Head", "Division lead"],
      ["Bo Member", "Member"],
      ["Viewer", "Member"],
    ],
  );
  assert.equal(roster.size, 3);
  assert.equal(roster.detail, "Aerospace · 3 people");
});

test("a member is a division lead when any of their rows is, whatever the row order", () => {
  const rows: RosterRow[] = [
    { memberId: 1, name: "Ada", type: "member", photoUrl: null },
    { memberId: 1, name: "Ada", type: "lead", photoUrl: null },
  ];
  const roster = divisionRoster(division, rows, 9);
  assert.equal(roster.people.length, 1);
  assert.equal(roster.people[0].role, "Division lead");
  assert.equal(roster.size, 1);
});

/** `n` members of the division, member 1 its lead. */
function members(n: number): RosterRow[] {
  return Array.from({ length: n }, (_, i) => ({ memberId: i + 1, name: `Person ${i + 1}`, type: i === 0 ? "lead" : "member", photoUrl: null }));
}

// Board 99b (issue #652): the roster lists a few people and sends the rest to the Members page.
test("a roster lists at most six people, the viewer among them, and links to all of them on Members", () => {
  const roster = divisionRoster(division, members(14), 14);
  assert.equal(ROSTER_LIMIT, 6);
  assert.equal(roster.people.length, 6);
  assert.equal(roster.size, 14);
  assert.deepEqual([roster.people[0].name, roster.people.at(-1)?.name], ["Person 1", "Person 14"], "the lead first, the viewer kept last");
  assert.deepEqual(roster.seeAll, { label: "See all 14 on Members", href: "/dashboard/members?division=4" });
});

test("a lead viewing their own division is listed among the leads, before the members", () => {
  const roster = divisionRoster(division, members(10), 1);
  assert.deepEqual(roster.people.slice(0, 2).map((p) => [p.name, p.self]), [["Person 1", true], ["Person 2", false]]);
  assert.equal(roster.people.length, 6);
});

test("a viewer who does not reach the Members page gets the roster with no See all link", () => {
  assert.equal(divisionRoster({ ...division, members: null }, members(8), 8).seeAll, null);
});

// Issue #652: a department head's roster is their own department, its head first.
test("a department roster lists the head, then division leads, then members, and counts everyone once", () => {
  const rows: DepartmentRosterRow[] = [
    { memberId: 9, name: "Hana Head", type: "head", divisionId: null, photoUrl: null },
    { memberId: 9, name: "Hana Head", type: "lead", divisionId: 1, photoUrl: null },
    ...members(8).map((r) => ({ ...r, divisionId: 1 })),
  ];
  const roster = departmentRoster({ title: "Propulsion Department", divisions: 2, members: "/dashboard/members" }, rows, 9);
  assert.deepEqual(roster.people.slice(0, 2).map((p) => [p.name, p.role]), [["Hana Head", "Department head"], ["Person 1", "Division lead"]]);
  assert.equal(roster.people.length, 6);
  assert.equal(roster.size, 9);
  assert.equal(roster.detail, "2 divisions · 9 people");
});
