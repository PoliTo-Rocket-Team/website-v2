import assert from "node:assert/strict";
import { test } from "node:test";
import { departmentMembers } from "./department-members";
import { NO_MEMBER_DETAILS } from "./details";
import { divisionMembers, type PersonRecord, type WaitingPerson } from "./division-members";
import { MEMBERS_TOOLS, membersModelOf, NO_MEMBERS_FILTER, opensWholeTeam, shownMembers, type MemberEntry, type MembersModel } from "./members-view";
import { membershipsOf, type DivisionRole, type OrgChart, type RoleBeyondDivisions, type TeamActor, type TeamPageEdit } from "./team";
import { wholeTeamMembers } from "./team-members";
import type { ViewerStanding } from "./viewer";

// Issue #408: the team leader, a department head and a division lead open
// one Members view with the same tools; only the rows and the actions their
// data allows differ. Aerodynamics holds Mission Analysis (1) and
// Optimization (2); Structures holds Design & Manufacturing (3).
const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Structures", kind: "technical" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

function record(id: number, name: string, list: readonly (readonly [number, DivisionRole])[], beyond: readonly RoleBeyondDivisions[] = []): PersonRecord {
  return {
    id,
    name,
    signInEmail: `${name.split(" ")[0].toLowerCase()}@gmail.com`,
    photoUrl: null,
    since: 2024,
    memberships: membershipsOf(list.map(([divisionId, role]) => ({ divisionId, role, since: "2024-10-01" }))),
    beyondDivisions: beyond,
    titles: {},
    advising: [],
    details: NO_MEMBER_DETAILS,
    nda: null,
  };
}

const records = [
  record(1, "Marco Bianchi", [[1, "lead"]]),
  record(2, "Lena Fischer", [[1, "member"], [2, "member"]]),
  record(3, "Davide Russo", [[1, "member"], [3, "member"]]),
  record(4, "Laura Greco", [[2, "lead"]]),
  record(5, "Federica Leone", [[3, "lead"]]),
  record(6, "Chiara Ferri", [], [{ kind: "head", departmentId: 1 }]),
  record(7, "Alessandro Greco", [], [{ kind: "team-leader" }]),
];

const elena: WaitingPerson = { joinId: 9, email: "elena@x.it", name: null, title: null, details: NO_MEMBER_DETAILS };

function leaderPage(): MembersModel {
  return membersModelOf({ scope: "whole-team", teamPageEdits: null, ...wholeTeamMembers({ records, org, selfId: 7 }) })!;
}

// The operations lead's and the IT lead's whole team: the Team page panel's edits for each person (board 46b).
const teamPageEdits: readonly TeamPageEdit[] = records.map((r) => ({
  id: r.id,
  pageTitle: null,
  role: r.memberships.length === 0 ? null : r.memberships.some((m) => m.role === "lead") ? "division-lead" : "member",
}));

function seatPage(selfId: number): MembersModel {
  return membersModelOf({ scope: "whole-team", teamPageEdits, ...wholeTeamMembers({ records, org, selfId }) })!;
}

/** Where a row's menu may remove someone from; null where the row offers no division change. */
function removalsOf(entry: MemberEntry) {
  return entry.actions?.kind === "division" ? entry.actions.removals : null;
}

function headPage(): MembersModel {
  const page = departmentMembers({ records, org, departmentId: 1, actor: { kind: "head", departmentIds: [1] }, selfId: 6, waiting: { 1: [elena] }, joining: {} })!;
  return membersModelOf({ scope: "department", ...page })!;
}

function leadPage(actor: TeamActor | null = { kind: "lead", divisionIds: [1] }): MembersModel {
  const page = divisionMembers({ records, org, divisionId: 1, actor, selfId: 1, reach: [1], waiting: [elena], joining: [] })!;
  return membersModelOf({ scope: "division", ...page })!;
}

test("the team leader, a head and a division lead get the same Members tools, the list view included", () => {
  const tools = [leaderPage(), headPage(), leadPage(), leadPage(null)].map((page) => page.tools);
  for (const set of tools) assert.deepEqual(set, MEMBERS_TOOLS);
  assert.ok(MEMBERS_TOOLS.includes("list-view") && MEMBERS_TOOLS.includes("table-view"));
});

test("the operations lead and the IT lead open the whole team like the team leader, with the same tools as a head and a lead (#418)", () => {
  const seats = ["team-leader", "operations-lead", "it-lead", null] as const;
  for (const seat of seats) {
    const viewer: ViewerStanding = { kind: "operations-lead", seat, siteContent: false, approveOrders: false };
    assert.equal(opensWholeTeam(viewer), true, String(seat));
  }
  for (const kind of ["department-head", "division-lead"] as const) {
    assert.equal(opensWholeTeam({ kind, siteContent: false, approveOrders: false }), false, kind);
  }
  const tools = [leaderPage(), seatPage(8), seatPage(9), headPage(), leadPage()].map((page) => page.tools);
  for (const set of tools) assert.deepEqual(set, MEMBERS_TOOLS);
});

test("the operations lead and the IT lead keep the Team page panel's edits on every row; the team leader's rows offer none (#418)", () => {
  const ops = seatPage(8);
  assert.equal(ops.panelEdits, true);
  assert.deepEqual(
    ops.everyone.map((p) => [p.name, p.actions?.kind === "team-page" ? p.actions.edit.role : "none"]),
    ops.everyone.map((p) => [p.name, teamPageEdits.find((e) => e.id === p.id)!.role]),
  );
  // Same rows and tools as the team leader: only the actions differ.
  const leader = leaderPage();
  assert.deepEqual(ops.everyone.map((p) => p.id), leader.everyone.map((p) => p.id));
  assert.ok(leader.everyone.every((p) => p.actions === null));
});

test("only the rows differ: the whole team, the department, the division", () => {
  const names = (page: MembersModel) => shownMembers(page, NO_MEMBERS_FILTER).people.map((p) => p.name);
  assert.equal(names(leaderPage()).length, 7);
  assert.deepEqual(names(headPage()), ["Marco Bianchi", "Laura Greco", "Davide Russo", "Lena Fischer"]);
  assert.deepEqual(names(leadPage()), ["Marco Bianchi", "Davide Russo", "Lena Fischer"]);
  assert.deepEqual(headPage().units.map((u) => [u.name, u.divisions.map((d) => d.code)]), [["Aerodynamics", ["MA", "OA"]]]);
});

test("actions are the data's own: what the lead's and head's pages allow, none on the whole team or under Can view", () => {
  const lead = leadPage();
  const lena = lead.everyone.find((p) => p.name === "Lena Fischer")!;
  assert.deepEqual(removalsOf(lena)?.map((r) => [r.short, r.removal.kind]), [["Mission Analysis", "offered"]]);
  assert.deepEqual(lead.add, { kind: "division", division: lead.divisions[0].header });

  const viewOnly = leadPage(null);
  assert.ok(viewOnly.everyone.every((p) => p.actions === null));
  assert.equal(viewOnly.add, null);
  assert.equal(viewOnly.panelEdits, false);

  const leader = leaderPage();
  assert.ok(leader.everyone.every((p) => p.actions === null));
  assert.equal(leader.panelEdits, false);
  assert.equal(leader.add?.kind, "department");

  const head = headPage();
  const lenaHere = head.everyone.find((p) => p.name === "Lena Fischer")!;
  assert.deepEqual(removalsOf(lenaHere)?.map((r) => r.short), ["Mission Analysis", "Optimization and Analysis"]);
});

test("choosing a division lists it as that division does, with the people waiting to join it", () => {
  const head = headPage();
  const oa = shownMembers(head, { ...NO_MEMBERS_FILTER, divisionId: 2 });
  assert.equal(oa.division?.code, "OA");
  assert.deepEqual(oa.people.map((p) => p.name), ["Laura Greco", "Lena Fischer"]);
  assert.deepEqual(removalsOf(oa.people.find((p) => p.name === "Lena Fischer")!)?.map((r) => r.short), ["Optimization and Analysis"]);
  assert.deepEqual(oa.waiting, []);
  assert.deepEqual(shownMembers(head, { ...NO_MEMBERS_FILTER, divisionId: 1 }).waiting.map((w) => w.waiting.email), ["elena@x.it"]);
  assert.deepEqual(shownMembers(head, { ...NO_MEMBERS_FILTER, query: "elena" }).waiting.map((w) => w.division.code), ["MA"]);
});

test("a chosen division shows the same division bar for every role", () => {
  const bar = (page: MembersModel) => shownMembers(page, { ...NO_MEMBERS_FILTER, divisionId: 1 }).division;
  const expected = { id: 1, name: "Mission Analysis Division", code: "MA" };
  for (const page of [leaderPage(), headPage(), leadPage()]) assert.deepEqual(bar(page), expected);
  for (const page of [leaderPage(), headPage(), leadPage()]) assert.equal(shownMembers(page, NO_MEMBERS_FILTER).division, null);
});

test("on the whole team the selects narrow everyone, and a division from another department reads as all", () => {
  const leader = leaderPage();
  const names = (filter: Partial<typeof NO_MEMBERS_FILTER>) => shownMembers(leader, { ...NO_MEMBERS_FILTER, ...filter }).people.map((p) => p.name);
  assert.deepEqual(names({ department: "Structures" }), ["Federica Leone", "Davide Russo"]);
  assert.deepEqual(names({ divisionId: 2 }), ["Chiara Ferri", "Laura Greco", "Lena Fischer"]);
  assert.equal(names({ department: "Structures", divisionId: 2 }).length, 2);
  assert.equal(shownMembers(leader, { ...NO_MEMBERS_FILTER, department: "Structures", divisionId: 2 }).division, null);
  assert.deepEqual(names({ query: "lena" }), ["Lena Fischer"]);
});
