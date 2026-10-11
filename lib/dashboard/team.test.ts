import assert from "node:assert/strict";
import { test } from "node:test";
import { promotionNoticeLine } from "./notices";
import {
  buildTeamTree,
  canPromote,
  checkDeparture,
  divisionDirectory,
  inDivisions,
  inMemberTab,
  membershipsOf,
  roleIn,
  withJoined,
  withRoleIn,
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

const lead = (divisionId: number, since = "2024-10-01") => inDivisions([{ divisionId, role: "lead", since }]);
const member = (divisionId: number | null, since = "2024-10-01") => inDivisions(divisionId === null ? [] : [{ divisionId, role: "member", since }]);

const roster: RosterEntry[] = [
  person(1, "Alessandro Greco", { role: "team-leader" }),
  person(2, "Chiara Rinaldi", { role: "head", departmentId: 1 }),
  person(3, "Marco Bianchi", lead(10)),
  person(4, "Elif Kaya", member(10)),
  person(5, "Bruno Valli", lead(20)),
  person(6, "Tommaso Galli", member(null)),
];

test("a person holds a list of division memberships, each with its own role, and never one division twice", () => {
  const memberships = membershipsOf([
    { divisionId: 20, role: "member", since: "2025-10-01" },
    { divisionId: 10, role: "lead", since: "2024-10-01" },
    // Mission Analysis named a second time, as a member from later: one membership, still a lead, from 2024.
    { divisionId: 10, role: "member", since: "2026-10-01" },
  ]);
  assert.deepEqual(
    memberships.map((m) => [m.divisionId, m.role, m.since]),
    [
      [10, "lead", "2024-10-01"],
      [20, "member", "2025-10-01"],
    ],
  );
  assert.equal(roleIn(memberships, 10), "lead");
  assert.equal(roleIn(memberships, 20), "member");
  assert.equal(roleIn(memberships, 30), null);
  // Joining a division they are already in changes nothing.
  assert.deepEqual(withJoined(memberships, 20, "2026-10-09"), memberships);
  assert.equal(withJoined(memberships, 30, "2026-10-09").length, 3);
});

test("picking someone as lead of a division keeps their other divisions", () => {
  const before = membershipsOf([
    { divisionId: 10, role: "member", since: "2024-10-01" },
    { divisionId: 20, role: "member", since: "2025-10-01" },
  ]);
  const after = withRoleIn(before, 20, "lead");
  assert.deepEqual(
    after.map((m) => [m.divisionId, m.role]),
    [
      [10, "member"],
      [20, "lead"],
    ],
  );
  // Someone not in the division is not put in it.
  assert.deepEqual(withRoleIn(before, 30, "lead"), before);
});

test("a division's page lists a multi-division person with their role in that division", () => {
  const both = person(8, "Matteo Greco", inDivisions([
    { divisionId: 10, role: "member", since: "2024-10-01" },
    { divisionId: 20, role: "lead", since: "2025-10-01" },
  ]));
  const inMission = divisionDirectory([...roster, both], org, 10).rows.find((r) => r.id === 8);
  const inSafety = divisionDirectory([...roster, both], org, 20).rows.find((r) => r.id === 8);
  assert.equal(inMission?.role, "member");
  assert.equal(inMission?.division, "Mission Analysis Division");
  assert.equal(inSafety?.role, "division-lead");
  assert.equal(inSafety?.department, "Operations");
});

test("the tree is built from the roster: a person added to it is a node", () => {
  const before = buildTeamTree(roster, org, "2026–27", 4);
  const after = buildTeamTree([...roster, person(7, "Anna Villa", member(10))], org, "2026–27", 4);
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
  if (directory.scope !== "division") return;
  assert.deepEqual(directory.heads, [{ memberId: 2, name: "Chiara Rinaldi", department: "Aerodynamics" }]);
  assert.equal(
    promotionNoticeLine(directory.heads, { personId: 4, leadId: directory.viewerId }),
    "Chiara Rinaldi, head of Aerodynamics, is told on their dashboard.",
  );
});

test("Promote names no head when the department's head is the lead promoting, who is never told", () => {
  // Chiara heads Aerodynamics and promotes in Mission Analysis, one of its divisions.
  const directory = divisionDirectory(roster, org, 10, 2);
  if (directory.scope !== "division") return assert.fail("a division directory");
  assert.equal(promotionNoticeLine(directory.heads, { personId: 4, leadId: directory.viewerId }), null);

  // A second head is still named; the viewer is not.
  const twoHeads = divisionDirectory([...roster, person(8, "Luca Moretti", { role: "head", departmentId: 1 })], org, 10, 2);
  if (twoHeads.scope !== "division") return assert.fail("a division directory");
  assert.equal(
    promotionNoticeLine(twoHeads.heads, { personId: 4, leadId: twoHeads.viewerId }),
    "Luca Moretti, head of Aerodynamics, is told on their dashboard.",
  );
  assert.equal(
    promotionNoticeLine([], { personId: 4, leadId: 2 }),
    "Your department has no head on the roster, so no one else is told.",
  );
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
