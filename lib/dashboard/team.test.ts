import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildTeamTree,
  canPromote,
  checkDeparture,
  divisionDirectory,
  inMemberTab,
  memberRowsFor,
  pagerItems,
  seasonAt,
  teamDirectory,
  type OrgChart,
  type RosterEntry,
} from "./team";

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics" },
    { id: 2, name: "Operations" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 20, name: "Safety Division", departmentId: 2 },
  ],
};

function person(id: number, name: string, placement: RosterEntry["placement"]): RosterEntry {
  return { id, name, email: `${name.split(" ")[0].toLowerCase()}@prt.it`, placement, pageTitle: null, joined: 2024, program: null, study: null, access: [] };
}

const roster: RosterEntry[] = [
  person(1, "Alessandro Greco", { role: "team-leader" }),
  person(2, "Chiara Rinaldi", { role: "head", departmentId: 1 }),
  person(3, "Marco Bianchi", { role: "division-lead", divisionId: 10 }),
  person(4, "Elif Kaya", { role: "member", divisionId: 10 }),
  person(5, "Bruno Valli", { role: "division-lead", divisionId: 20 }),
  person(6, "Tommaso Galli", { role: "member", divisionId: null }),
];

test("the tree is built from the roster: a person added to it is a node", () => {
  const before = buildTeamTree(roster, org, "2026–27", 4);
  const after = buildTeamTree([...roster, person(7, "Anna Villa", { role: "member", divisionId: 10 })], org, "2026–27", 4);
  const names = (tree: typeof before) => tree.departments[0].divisions[0].members.map((m) => m.name);
  assert.deepEqual(names(before), ["Elif Kaya"]);
  assert.deepEqual(names(after), ["Anna Villa", "Elif Kaya"]);
  assert.equal(after.departments[0].size, before.departments[0].size + 1);
  assert.deepEqual(after.path, { departmentId: 1, divisionId: 10 });
  assert.equal(after.leader?.name, "Alessandro Greco");
});

test("tabs, the department filter and search narrow the members", () => {
  const { rows } = teamDirectory(roster, org);
  const names = (list: typeof rows) => list.map((r) => r.name);
  assert.equal(rows.length, 6);
  assert.deepEqual(names(rows.filter((r) => inMemberTab(r, "leads"))), ["Alessandro Greco", "Chiara Rinaldi", "Bruno Valli", "Marco Bianchi"]);
  assert.deepEqual(names(memberRowsFor(rows, { department: "Aerodynamics", query: "" })), ["Chiara Rinaldi", "Marco Bianchi", "Elif Kaya"]);
  assert.deepEqual(names(memberRowsFor(rows, { department: null, query: "elif" })), ["Elif Kaya"]);
  assert.deepEqual(names(memberRowsFor(rows, { department: "Operations", query: "elif" })), []);
});

test("the pager keeps the first pages, the current one and the last", () => {
  assert.deepEqual(pagerItems(1, 12), [1, 2, 3, null, 12]);
  assert.deepEqual(pagerItems(7, 12), [1, 2, 3, null, 6, 7, 8, null, 12]);
  assert.deepEqual(pagerItems(1, 2), [1, 2]);
});

test("a team year starts in October", () => {
  assert.equal(seasonAt(new Date("2026-10-09T00:00:00Z")), "2026–27");
  assert.equal(seasonAt(new Date("2026-09-30T00:00:00Z")), "2025–26");
});

test("a division's page names its department head, who the lead tells about a promotion", () => {
  const directory = divisionDirectory(roster, org, 10, 3);
  assert.equal(directory.scope, "division");
  if (directory.scope === "division") assert.deepEqual(directory.head, { name: "Chiara Rinaldi", department: "Aerodynamics" });
});

test("only a member of a division can be promoted, never a lead or the viewer", () => {
  const rows = divisionDirectory(roster, org, 10, 3).rows;
  assert.deepEqual(rows.filter(canPromote).map((r) => r.name), ["Elif Kaya"]);
});

test("the years on the team are read as typed, in order and not after this year; the reason is optional", () => {
  assert.deepEqual(checkDeparture({ years: "2024 – 2026", reason: "graduated" }, 2026), {
    ok: true,
    value: { from: 2024, to: 2026, reason: "graduated" },
  });
  assert.deepEqual(checkDeparture({ years: "2025", reason: "" }, 2026), { ok: true, value: { from: 2025, to: 2025, reason: null } });
  assert.equal(checkDeparture({ years: "2026 - 2024", reason: null }, 2026).ok, false);
  assert.equal(checkDeparture({ years: "2024 – 2027", reason: null }, 2026).ok, false);
  assert.equal(checkDeparture({ years: "last year", reason: null }, 2026).ok, false);
  assert.equal(checkDeparture({ years: "2024 – 2026", reason: "fired" }, 2026).ok, false);
});
