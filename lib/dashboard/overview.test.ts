import assert from "node:assert/strict";
import { test } from "node:test";
import { divisionRoster, type RosterRow } from "./overview";

const division = { title: "Mission Analysis Division", department: "Aerospace" };

test("a member with two active rows in the division is listed and counted once", () => {
  const rows: RosterRow[] = [
    { memberId: 1, name: "Ada Head", type: "head" },
    { memberId: 1, name: "Ada Head", type: "member" },
    { memberId: 2, name: "Bo Member", type: "member" },
    { memberId: 3, name: "Viewer", type: "member" },
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
    { memberId: 1, name: "Ada", type: "member" },
    { memberId: 1, name: "Ada", type: "lead" },
  ];
  const roster = divisionRoster(division, rows, 9);
  assert.equal(roster.people.length, 1);
  assert.equal(roster.people[0].role, "Division lead");
  assert.equal(roster.size, 1);
});
