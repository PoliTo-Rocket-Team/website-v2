import assert from "node:assert/strict";
import { test } from "node:test";
import { standingIn } from "./viewer";
import {
  buildTeamTree,
  checkDeparture,
  inDivisions,
  isDivisionRole,
  leadsChangedBy,
  mayChangeDivision,
  mayLeaveDivision,
  mayLeaveTeam,
  membershipsOf,
  membershipsOfRoles,
  NO_MEMBERSHIPS,
  removalFrom,
  roleIn,
  withJoined,
  withoutDivision,
  withRoleIn,
  pagerItems,
  seasonAt,
  roleBeyondDivisions,
  standingOfRoles,
  titledSeatOf,
  type Memberships,
  type RoleBeyondDivisions,
  type OrgChart,
  type RoleSeat,
  type RosterEntry,
  type TeamActor,
} from "./team";

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Operations", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 20, name: "Safety Division", departmentId: 2 },
  ],
};

/** An active role row as the data sources read it; no full-access flag unless one is given. */
let rowIds = 0;
function row(r: Omit<RoleSeat, "id" | "fullAccess"> & Partial<Pick<RoleSeat, "fullAccess">>): RoleSeat {
  return { id: ++rowIds, fullAccess: null, ...r };
}

function person(id: number, name: string, placement: RosterEntry["placement"]): RosterEntry {
  return { id, name, email: `${name.split(" ")[0].toLowerCase()}@prt.it`, placement, pageTitle: null, joined: 2024, program: null, study: null, access: [] };
}

const lead = (divisionId: number, since = "2024-10-01") => inDivisions([{ divisionId, role: "lead", since }]);
const member = (divisionId: number | null, since = "2024-10-01") => inDivisions(divisionId === null ? [] : [{ divisionId, role: "member", since }]);

const roster: RosterEntry[] = [
  person(1, "Alessandro Greco", { role: "team-leader", memberships: NO_MEMBERSHIPS }),
  person(2, "Chiara Rinaldi", { role: "head", departmentId: 1, title: "Head of Aerodynamics", memberships: NO_MEMBERSHIPS }),
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

test("active roles become memberships by the viewer's rule: a lead or head role in a division leads it", () => {
  const held = [
    { type: "head" as const, divisionId: 10, since: "2024-10-01" },
    { type: "core" as const, divisionId: 20, since: "2025-10-01" },
    { type: "president" as const, divisionId: null, since: "2023-10-01" },
  ];
  const memberships = membershipsOfRoles(held);
  const access = { scopes: [], activeRoles: held.map((r) => ({ ...r, fullAccess: null })) };
  for (const divisionId of [10, 20, 30]) assert.equal(roleIn(memberships, divisionId), standingIn(access, divisionId));
  assert.equal(memberships.length, 2);
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

test("the pager keeps the first pages, the current one and the last", () => {
  assert.deepEqual(pagerItems(1, 12), [1, 2, 3, null, 12]);
  assert.deepEqual(pagerItems(7, 12), [1, 2, 3, null, 6, 7, 8, null, 12]);
  assert.deepEqual(pagerItems(1, 2), [1, 2]);
});

test("a team year starts in October", () => {
  assert.equal(seasonAt(new Date("2026-10-09T00:00:00Z")), "2026–27");
  assert.equal(seasonAt(new Date("2026-09-30T00:00:00Z")), "2025–26");
});

test("the team year turns over at midnight on 1 October in Turin, not in UTC (#515)", () => {
  // 30 September 23:59 in Turin (summer time, UTC+2).
  assert.equal(seasonAt(new Date("2026-09-30T21:59:00Z")), "2025–26");
  // 1 October 00:01 in Turin.
  assert.equal(seasonAt(new Date("2026-09-30T22:01:00Z")), "2026–27");
  // Still 30 September in UTC, already 1 October in Turin.
  assert.equal(seasonAt(new Date("2026-09-30T23:30:00Z")), "2026–27");
});

// Who may change whom on the Members page (issue #231). Aerodynamics holds
// Mission Analysis (10) and Optimization (30); Operations holds Safety (20).
const twoDepartments: OrgChart = {
  departments: org.departments,
  divisions: [...org.divisions, { id: 30, name: "Optimization and Analysis Division", departmentId: 1 }],
};
const missionLead: TeamActor = { kind: "lead", divisionIds: [10] };
const aeroHead: TeamActor = { kind: "head", departmentIds: [1] };
const teamLeader: TeamActor = { kind: "team" };
const inMission = membershipsOf([{ divisionId: 10, role: "member", since: "2024-10-01" }]);
const alsoOptimization = membershipsOf([...inMission, { divisionId: 30, role: "member", since: "2025-10-01" }]);
const alsoSafety = membershipsOf([...inMission, { divisionId: 20, role: "member", since: "2025-10-01" }]);

test('"Leaves the team" follows the permission rule for lead, head and team leader (Owner decision on #231)', () => {
  const cases: [TeamActor, typeof inMission, boolean | string][] = [
    [missionLead, inMission, true],
    [missionLead, alsoOptimization, "Also in Optimization and Analysis, so only the Head of Aerodynamics can do this"],
    [missionLead, alsoSafety, "Also in Safety, so only the team leader can do this"],
    [aeroHead, alsoOptimization, true],
    [aeroHead, alsoSafety, "Also in Safety, so only the team leader can do this"],
    [teamLeader, alsoSafety, true],
  ];
  for (const [actor, memberships, expected] of cases) {
    const permission = mayLeaveTeam(actor, { memberships, beyond: [] }, twoDepartments);
    assert.deepEqual(permission, expected === true ? { allowed: true } : { allowed: false, reason: expected });
  }
});

test('"Leaves the team" counts every active role: a role in no division is only the team leader\'s to end (#231)', () => {
  // Rows as the server reads them: each person's one division role is in Mission Analysis.
  const missionRole = row({ type: "core", divisionId: 10, departmentId: 1, title: "Mission Analyst", since: "2024-10-01" });
  const people: [RoleSeat, string][] = [
    [row({ type: "president", divisionId: null, departmentId: null, title: "Team Leader", since: "2025-10-01" }), "the team leader"],
    [row({ type: "head", divisionId: null, departmentId: 1, title: "Head of Aerodynamics", since: "2025-10-01" }), "Head of Aerodynamics"],
    [row({ type: null, divisionId: null, departmentId: null, title: "Chief Engineer", since: "2025-10-01", fullAccess: "chief-engineer" }), "Chief Engineer"],
    // A renamed seat or head is named by its stored title (issue #625).
    [row({ type: "head", divisionId: null, departmentId: 1, title: "Chief of Aerodynamics", since: "2025-10-01" }), "Chief of Aerodynamics"],
    [row({ type: "core", divisionId: null, departmentId: null, title: "Chief of Propulsion", since: "2025-10-01", fullAccess: "chief-engineer" }), "Chief of Propulsion"],
  ];
  for (const [beyond, label] of people) {
    const standing = standingOfRoles([missionRole, beyond], twoDepartments);
    const refused = { allowed: false, reason: `Also ${label}, so only the team leader can do this` };
    assert.deepEqual(mayLeaveTeam(missionLead, standing, twoDepartments), refused);
    assert.deepEqual(mayLeaveTeam(aeroHead, standing, twoDepartments), refused);
    assert.deepEqual(mayLeaveTeam(teamLeader, standing, twoDepartments), { allowed: true });
  }
  assert.deepEqual(mayLeaveTeam(missionLead, standingOfRoles([missionRole], twoDepartments), twoDepartments), { allowed: true });
});

test('"Leaves the team" reads a head role kept on a division row as head of its department (#231, review round 2)', () => {
  // The row the actor reader and the roster both read as Head of Aerodynamics: type head, kept on Mission Analysis.
  const headOnMission = row({ type: "head", divisionId: 10, departmentId: null, title: "Head of Aerodynamics", since: "2025-10-01" });
  const standing = standingOfRoles([headOnMission], twoDepartments);
  const refused = { allowed: false, reason: "Also Head of Aerodynamics, so only the team leader can do this" };
  assert.deepEqual(mayLeaveTeam(missionLead, standing, twoDepartments), refused);
  assert.deepEqual(mayLeaveTeam(aeroHead, standing, twoDepartments), refused);
  assert.deepEqual(mayLeaveTeam(teamLeader, standing, twoDepartments), { allowed: true });
});

test('"Remove from <division>" is not offered for the only division, and a lead cannot take a lead out', () => {
  const only = (memberships: Memberships) => ({ memberships, beyond: [] });
  assert.deepEqual(removalFrom(missionLead, only(inMission), 10, twoDepartments), { kind: "only-division" });
  assert.deepEqual(removalFrom(missionLead, only(alsoSafety), 10, twoDepartments), { kind: "offered" });
  assert.deepEqual(removalFrom(missionLead, only(alsoSafety), 20, twoDepartments), { kind: "not-in-reach" });
  const coLead = withRoleIn(alsoSafety, 10, "lead");
  assert.deepEqual(removalFrom(missionLead, only(coLead), 10, twoDepartments), {
    kind: "locked",
    reason: "Leads are changed by the Head of Aerodynamics",
  });
  assert.deepEqual(removalFrom(aeroHead, only(coLead), 10, twoDepartments), { kind: "offered" });
  assert.deepEqual(withoutDivision(alsoSafety, 10).map((m) => m.divisionId), [20]);
});

test("a seat kept on a division row is the seat, never a lead or member role there (#232, review round 3)", () => {
  const seats: RoleSeat[] = [
    row({ type: "president", divisionId: 10, departmentId: null, title: "Team Leader", since: "2025-10-01" }),
    row({ type: "head", divisionId: 10, departmentId: null, title: "Head", since: "2025-10-01" }),
  ];
  const divisionRows: RoleSeat[] = [
    row({ type: "lead", divisionId: 10, departmentId: null, title: "", since: "2025-10-01" }),
    row({ type: "core", divisionId: 10, departmentId: null, title: "", since: "2025-10-01" }),
    row({ type: null, divisionId: 10, departmentId: null, title: "", since: "2025-10-01" }),
  ];
  for (const role of seats) assert.equal(isDivisionRole(role), false);
  for (const role of divisionRows) assert.equal(isDivisionRole(role), true);
  // The same line the roster draws for every row kept on a division.
  for (const role of [...seats, ...divisionRows]) assert.equal(isDivisionRole(role), roleBeyondDivisions(role, twoDepartments) === null);
  assert.equal(isDivisionRole({ type: "core", divisionId: null }), false);
  // A head whose seat row is kept on Mission Analysis and who leads it beside the seat: one lead membership, from the lead row.
  const [, headOnMission] = seats;
  const [leadRow] = divisionRows;
  const standing = standingOfRoles([headOnMission, leadRow], twoDepartments);
  assert.deepEqual(
    standing.memberships.map((m) => [m.divisionId, m.role]),
    [[10, "lead"]],
  );
  assert.equal(standingOfRoles([headOnMission], twoDepartments).memberships.length, 0);
});

test("a seat holder may leave their only division, since they keep a place on the team (#232, review round 3)", () => {
  const head = { memberships: inMission, beyond: [{ kind: "head" as const, departmentId: 1, title: "" }] };
  const plain = { memberships: inMission, beyond: [] };
  assert.equal(mayLeaveDivision(head, 10), true);
  assert.equal(mayLeaveDivision(plain, 10), false);
  assert.equal(mayLeaveDivision({ memberships: alsoSafety, beyond: [] }, 10), true);
  assert.deepEqual(removalFrom(aeroHead, head, 10, twoDepartments), { kind: "offered" });
  assert.deepEqual(removalFrom(aeroHead, plain, 10, twoDepartments), { kind: "only-division" });
});

test("a lead cannot rename a division, change its code or change its leads; its head can", () => {
  assert.deepEqual(mayChangeDivision(missionLead, 10, twoDepartments), { allowed: false, reason: "Leads are changed by the Head of Aerodynamics" });
  assert.deepEqual(mayChangeDivision(aeroHead, 10, twoDepartments), { allowed: true });
  assert.equal(mayChangeDivision(aeroHead, 20, twoDepartments).allowed, false);
  assert.equal(leadsChangedBy(10, twoDepartments), "Leads are changed by the Head of Aerodynamics");
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

test("the seat whose title Edit details sets: the team leader's, else a head's, else a team-level seat's by seat order; none for an advisor (#626)", () => {
  const board = (roleId: number, flag: "chief-engineer" | null, since: string): RoleBeyondDivisions => ({ kind: "board", seat: { roleId, title: "", flag, since } });
  const head: RoleBeyondDivisions = { kind: "head", departmentId: 1, title: "" };
  const pick = (roles: readonly RoleBeyondDivisions[]) => titledSeatOf(roles, (r) => r)?.seat ?? null;
  assert.deepEqual(pick([board(1, null, "2020-10-01"), head, { kind: "team-leader", title: "" }]), { kind: "team-leader", title: "" });
  assert.deepEqual(pick([board(1, null, "2020-10-01"), head]), head);
  assert.deepEqual(pick([board(1, null, "2020-10-01"), board(2, "chief-engineer", "2024-10-01")]), board(2, "chief-engineer", "2024-10-01"), "a flagged seat first");
  assert.equal(pick([{ kind: "advisor", departmentId: 1 }, { kind: "department", departmentId: 1 }]), null);
});
