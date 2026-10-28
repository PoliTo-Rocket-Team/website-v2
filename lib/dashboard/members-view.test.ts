import assert from "node:assert/strict";
import { test } from "node:test";
import { departmentMembers } from "./department-members";
import { NO_NAME } from "./person-name";
import { NO_MEMBER_DETAILS } from "./details";
import { divisionMembers, positionsOf, type PersonRecord, type WaitingPerson } from "./division-members";
import { MEMBERS_TOOLS, membersModelOf, NO_MEMBERS_FILTER, opensWholeTeam, shownMembers, type MemberEntry, type MembersModel } from "./members-view";
import { membershipsOf, type DivisionQueue, type DivisionRole, type Joining, type OrgChart, type RoleBeyondDivisions, type TeamActor } from "./team";
import type { TeamAddressLine } from "./team-address";
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
    storedName: NO_NAME,
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
  record(6, "Chiara Ferri", [], [{ kind: "head", departmentId: 1, title: "" }]),
  record(7, "Alessandro Greco", [], [{ kind: "team-leader", title: "" }]),
];

const elena: WaitingPerson = { joinId: 9, email: "elena@x.it", correctsSignInEmail: false, name: null, title: null, details: NO_MEMBER_DETAILS, addedOn: "2026-10-20", signedIn: false, addedBy: { kind: "viewer" } };
const giulia: Joining = { applicationId: 41, name: "Giulia Rossi", photoUrl: null, position: "Mission Analyst", ndaArrived: true, canConfirm: true };
const paolo: Joining = { applicationId: 42, name: "Paolo Neri", photoUrl: null, position: "CAD Engineer", ndaArrived: true, canConfirm: false };

/** Every division's queue on the whole team: Elena waits for Design & Manufacturing, Giulia joins Mission Analysis, Paolo Design & Manufacturing. */
const queues: readonly DivisionQueue[] = [
  { divisionId: 1, waiting: [], joining: [giulia], editable: true },
  { divisionId: 2, waiting: [], joining: [], editable: true },
  { divisionId: 3, waiting: [elena], joining: [paolo], editable: true },
];

function leaderPage(): MembersModel {
  return seatPage(7);
}

// Every full-access seat's whole team, the team leader's included (issue #444): the one Edit details panel's position for each person (issue #584).
function seatPage(selfId: number): MembersModel {
  const positions = positionsOf(records, org, { kind: "team" }, selfId);
  return membersModelOf({ scope: "whole-team", positions, queues, correctsSignInEmail: [], ...wholeTeamMembers({ records, org, selfId }) })!;
}

/** Where a row's menu and Edit details may remove someone from; null where the row offers no change. */
function removalsOf(entry: MemberEntry) {
  return entry.actions?.position.removals ?? null;
}

function headPage(): MembersModel {
  const page = departmentMembers({ records, org, departmentId: 1, actor: { kind: "head", departmentIds: [1] }, selfId: 6, waiting: { 1: [elena] }, joining: {} })!;
  return membersModelOf({ scope: "department", ...page })!;
}

function leadPage(actor: TeamActor | null = { kind: "lead", divisionIds: [1], ledDivisionIds: [1] }): MembersModel {
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

test("every full-access seat, the team leader included, opens Edit details on every row but their own (#418, #444, #584)", () => {
  const ops = seatPage(8);
  const leader = leaderPage();
  assert.equal(ops.panelEdits, true);
  assert.ok(ops.everyone.every((p) => p.actions?.person.id === p.id));
  assert.equal(leader.everyone.find((p) => p.id === 7)?.actions, null, "never their own row");
  assert.ok(leader.everyone.filter((p) => p.id !== 7).every((p) => p.actions !== null));
  assert.deepEqual(ops.everyone.map((p) => p.id), leader.everyone.map((p) => p.id));
});

test("only the rows differ: the whole team, the department, the division", () => {
  const names = (page: MembersModel) => shownMembers(page, NO_MEMBERS_FILTER).people.map((p) => p.name);
  assert.equal(names(leaderPage()).length, 7);
  assert.deepEqual(names(headPage()), ["Marco Bianchi", "Laura Greco", "Davide Russo", "Lena Fischer"]);
  assert.deepEqual(names(leadPage()), ["Marco Bianchi", "Davide Russo", "Lena Fischer"]);
  assert.deepEqual(headPage().units.map((u) => [u.name, u.divisions.map((d) => d.code)]), [["Aerodynamics", ["MA", "OA"]]]);
});

test("actions are the data's own: what the lead's and head's pages allow, the same panel on the whole team, none under Can view", () => {
  const lead = leadPage();
  const lena = lead.everyone.find((p) => p.name === "Lena Fischer")!;
  assert.deepEqual(removalsOf(lena)?.map((r) => [r.short, r.removal.kind]), [["Mission Analysis", "offered"]]);
  assert.deepEqual(lead.add, { kind: "division", division: lead.divisions[0].header });

  const viewOnly = leadPage(null);
  assert.ok(viewOnly.everyone.every((p) => p.actions === null));
  assert.equal(viewOnly.add, null);
  assert.equal(viewOnly.panelEdits, false);

  const leader = leaderPage();
  assert.deepEqual(removalsOf(leader.everyone.find((p) => p.name === "Davide Russo")!)?.map((r) => r.short), ["Mission Analysis", "Design & Manufacturing"]);
  assert.equal(leader.panelEdits, true);
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
  // Edit details' position covers every division of theirs the head reaches, whichever tab opened it (issue #584).
  assert.deepEqual(removalsOf(oa.people.find((p) => p.name === "Lena Fischer")!)?.map((r) => r.short), ["Mission Analysis", "Optimization and Analysis"]);
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

// Issue #800: the search also finds a person by every PRT email they hold,
// the personal one and each shared team address, on top of the name, the
// sign-in email and the phone.
test("the search matches a held team address and the personal PRT email, not an address someone else holds (#800)", () => {
  const withDetails = records.map((r) =>
    r.id === 3 ? { ...r, details: { ...NO_MEMBER_DETAILS, prtEmail: "davide.russo@team.example", phone: "+39 333 123 4567" } } : r,
  );
  const positions = positionsOf(withDetails, org, { kind: "team" }, 7);
  const leader = membersModelOf({ scope: "whole-team", positions, queues, correctsSignInEmail: [], ...wholeTeamMembers({ records: withDetails, org, selfId: 7 }) })!;
  let nextId = 0;
  const line = (address: string): TeamAddressLine => ({ id: ++nextId, address, purpose: "", movesWith: null, removal: "none" });
  const teamAddresses = {
    rows: {
      2: { lines: [line("logistics@team.example")], requestable: false },
      4: { lines: [line("sponsors@team.example"), line("press@team.example")], requestable: true },
    },
  };
  const names = (query: string) => shownMembers(leader, { ...NO_MEMBERS_FILTER, query }, teamAddresses).people.map((p) => p.name);

  // A shared team address, in full or in part.
  assert.deepEqual(names("logistics@team.example"), ["Lena Fischer"]);
  assert.deepEqual(names("logistics"), ["Lena Fischer"]);
  assert.deepEqual(names("press@"), ["Laura Greco"]);
  // The personal PRT email, in full or in part.
  assert.deepEqual(names("davide.russo@team.example"), ["Davide Russo"]);
  assert.deepEqual(names("davide.russo"), ["Davide Russo"]);
  // An address nobody holds lists no one; a holder of a different address is not listed.
  assert.deepEqual(names("treasury@"), []);
  assert.ok(!names("sponsors").includes("Lena Fischer"));
  // The name, the sign-in email and the phone still match as before.
  assert.deepEqual(names("fischer"), ["Lena Fischer"]);
  assert.deepEqual(names("federica@gmail.com"), ["Federica Leone"]);
  assert.deepEqual(names("3331234"), ["Davide Russo"]);
  // Without the address rows, a team address finds no one: only the page's rows carry them.
  assert.deepEqual(shownMembers(leader, { ...NO_MEMBERS_FILTER, query: "logistics" }).people, []);
});

// Issue #584: one Edit details panel for every viewer who may edit someone.
// Its position part is the data's own, worked out by the rules the server
// checks: lead or member only where the viewer may change a division's leads,
// Remove from each division they reach, Move to alumni where allowed.

function positionIn(page: MembersModel, name: string) {
  return page.everyone.find((p) => p.name === name)?.actions?.position ?? null;
}

test("the lead or member control shows only where the viewer may change who leads the division (#584)", () => {
  const leads = (page: MembersModel, name: string) => positionIn(page, name)?.leads.map((l) => [l.short, l.role]);
  assert.deepEqual(leads(leaderPage(), "Lena Fischer"), [["Mission Analysis", "member"], ["Optimization and Analysis", "member"]]);
  assert.deepEqual(leads(leaderPage(), "Marco Bianchi"), [["Mission Analysis", "lead"]]);
  assert.deepEqual(leads(headPage(), "Davide Russo"), [["Mission Analysis", "member"]], "Design & Manufacturing is not the head's");
  assert.deepEqual(leads(leadPage(), "Lena Fischer"), [["Mission Analysis", "member"]], "a division's own lead changes its leads (#594)");
  assert.deepEqual(leads(leadPage({ kind: "lead", divisionIds: [1], ledDivisionIds: [] }), "Lena Fischer"), [], "a Members grant never does");
});

test("a division lead's panel reaches only their divisions, a head's only their department, the whole team everyone (#584)", () => {
  const removals = (page: MembersModel, name: string) => positionIn(page, name)?.removals.map((r) => r.short);
  assert.deepEqual(removals(leadPage(), "Lena Fischer"), ["Mission Analysis"]);
  assert.deepEqual(removals(headPage(), "Davide Russo"), ["Mission Analysis"]);
  assert.deepEqual(removals(leaderPage(), "Davide Russo"), ["Mission Analysis", "Design & Manufacturing"]);
  assert.deepEqual(positionIn(leadPage(), "Davide Russo")?.leave, { allowed: false, reason: "Also in Design & Manufacturing, so only the team leader can do this" });
  assert.deepEqual(positionIn(leaderPage(), "Davide Russo")?.leave, { allowed: true });
  const lead: TeamActor = { kind: "lead", divisionIds: [1], ledDivisionIds: [1] };
  assert.deepEqual(positionsOf(records, org, lead, 1).map((p) => p.id), [2, 3], "only people in Mission Analysis, never the lead");
  assert.deepEqual(positionsOf(records, org, null, null), [], "no actor, no panel");
});

test("a seat on the whole team opens the same panel, its seat title editable, with no division to change (#584, #626)", () => {
  const head = positionIn(leaderPage(), "Chiara Ferri")!;
  assert.deepEqual(head.title, { kind: "seat", value: "Head of Aerodynamics" }, "a blank head title reads its default");
  assert.deepEqual([head.leads, head.removals], [[], []]);
  assert.deepEqual(head.leave, { allowed: true });
  assert.deepEqual(positionIn(leaderPage(), "Lena Fischer")?.title, { kind: "division", divisionId: 1, short: "Mission Analysis", value: null });
  assert.equal(positionIn(headPage(), "Chiara Ferri"), null, "a head's page does not list their own seat");
});

test("every team-level seat's title is an editable value as stored; only a role with no seat title stays fixed (#626)", () => {
  const seat = (roleId: number, title: string, flag: "project-manager" | "chief-engineer" | null): RoleBeyondDivisions => ({
    kind: "board",
    seat: { roleId, title, flag, since: "2024-10-01" },
  });
  const seats = [
    record(20, "Paola Marino", [], [seat(1, "", "project-manager")]),
    record(21, "Carlo Conti", [], [seat(2, "Chief of Propulsion", "chief-engineer")]),
    record(22, "Irene Gallo", [], [seat(3, "Head of R&D", null)]),
    record(23, "Bruno Sala", [], [{ kind: "head", departmentId: 2, title: "Chief of Structures" }]),
    record(24, "Ugo Fabbri", [], [{ kind: "advisor", departmentId: 1 }]),
  ];
  const titles = positionsOf(seats, org, { kind: "team" }, 7).map((p) => [p.id, p.title]);
  assert.deepEqual(titles, [
    [20, { kind: "seat", value: "Project Manager" }],
    [21, { kind: "seat", value: "Chief of Propulsion" }],
    [22, { kind: "seat", value: "Head of R&D" }],
    [23, { kind: "seat", value: "Chief of Structures" }],
    [24, { kind: "fixed", label: "Advisor" }],
  ]);
});

test("the whole team lists every division's people waiting for their NDA and joining, and the selects narrow them (Owner decision, 2026-10-22, #584)", () => {
  const leader = leaderPage();
  const all = shownMembers(leader, NO_MEMBERS_FILTER);
  assert.deepEqual(all.waiting.map((w) => [w.waiting.email, w.division.code, w.editable]), [["elena@x.it", "DM", true]]);
  assert.deepEqual(all.joining.map((j) => [j.joining.name, j.division]), [["Giulia Rossi", "Mission Analysis Division"], ["Paolo Neri", "Design & Manufacturing Division"]]);
  const aero = shownMembers(leader, { ...NO_MEMBERS_FILTER, department: "Aerodynamics" });
  assert.deepEqual([aero.waiting.length, aero.joining.map((j) => j.joining.name)], [0, ["Giulia Rossi"]]);
  const dm = shownMembers(leader, { ...NO_MEMBERS_FILTER, divisionId: 3 });
  assert.deepEqual([dm.waiting.map((w) => w.waiting.joinId), dm.joining.map((j) => j.joining.name)], [[9], ["Paolo Neri"]]);
  // The selects still narrow the whole team's people, not a division's own list.
  assert.deepEqual(dm.people.map((p) => p.name).sort(), ["Davide Russo", "Federica Leone"]);
});
