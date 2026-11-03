import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { planHeadAdd } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { asksAlias, checkHolderAdd, holdersOfSeat, tieOfSeat, type ActiveRoleRow, type HolderAddPlan, type Seat } from "./seat-holders";
import { membershipsOf, type OrgChart, type TeamActor } from "./team";
import { planSeatHolderAdd, planTeamLeaderAdd, TEAM_LEADER_TITLE } from "./team-seats";
import type { Checked } from "./department-edit";

// Add another holder (epic #861, issue #868): every seat kind takes one more
// holder beside the ones it has, added by the team leader or full access
// only, and never for someone who holds that exact seat already.

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", code: "AE", kind: "technical" },
    { id: 2, name: "Structures", code: "ST", kind: "technical" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

const LEADER = 1;
const PM = 2;
const SAFETY = 3;
const HEAD = 4;
const LEAD = 5;
const MEMBER = 6;
const OPS = 7;

const person = (id: number, name: string): TeamPerson => ({ id, name, emails: [], memberships: membershipsOf([]), beyond: [] });
const team: TeamPerson[] = [
  person(LEADER, "Alessandro Greco"),
  person(PM, "Sara Conti"),
  person(SAFETY, "Paolo Riva"),
  person(HEAD, "Chiara Rinaldi"),
  person(LEAD, "Marco Bianchi"),
  person(MEMBER, "Luca Moretti"),
  person(OPS, "Elena Fontana"),
];

const row = (r: Partial<ActiveRoleRow> & Pick<ActiveRoleRow, "id" | "memberId">): ActiveRoleRow => ({
  type: "core",
  title: "Member",
  fullAccess: null,
  departmentId: null,
  divisionId: null,
  ...r,
});

const LEADER_ROW = 10;
const PM_ROW = 20;
const SAFETY_ROW = 30;
const active: ActiveRoleRow[] = [
  row({ id: LEADER_ROW, memberId: LEADER, type: "president", title: " Team Leader " }),
  row({ id: PM_ROW, memberId: PM, title: "Project Manager", fullAccess: "project-manager" }),
  row({ id: SAFETY_ROW, memberId: SAFETY, title: "Safety Officer" }),
  row({ id: 40, memberId: HEAD, type: "head", title: "Head of Aerodynamics", departmentId: 1 }),
  row({ id: 50, memberId: LEAD, type: "lead", title: "Division Lead", divisionId: 1 }),
  row({ id: 60, memberId: MEMBER, divisionId: 3 }),
  // The operations lead's seat, kept on a lead row in Design & Manufacturing.
  row({ id: 70, memberId: OPS, type: "lead", title: "Division Lead", divisionId: 3, fullAccess: "operations-lead" }),
];

const fullAccess: TeamActor = { kind: "team" };
const headActor: TeamActor = { kind: "head", departmentIds: [1] };
const leadActor: TeamActor = { kind: "lead", divisionIds: [1], ledDivisionIds: [1] };

type Kind = { readonly name: string; readonly plan: (actor: TeamActor | null, personId: number) => Checked<HolderAddPlan> };

const KINDS: readonly Kind[] = [
  { name: "the team leader seat", plan: (actor, personId) => planTeamLeaderAdd({ actor, add: { personId }, team, active, org }) },
  { name: "a full-access seat", plan: (actor, personId) => planSeatHolderAdd({ actor, roleId: PM_ROW, add: { personId }, team, active, org }) },
  { name: "a department's head seat", plan: (actor, personId) => planHeadAdd({ actor, org, departmentId: 1, add: { personId }, team, active }) },
  { name: "an unflagged team-level seat", plan: (actor, personId) => planSeatHolderAdd({ actor, roleId: SAFETY_ROW, add: { personId }, team, active, org }) },
];

describe("who may add another holder", () => {
  for (const { name, plan } of KINDS) {
    test(`the team leader or full access adds a second holder to ${name}`, () => {
      // Full access and the team leader are one actor kind (`mayManageDepartments`): the team.
      assert.equal(plan(fullAccess, MEMBER).ok, true);
    });

    test(`a department head, a division lead and a member are refused on ${name}`, () => {
      for (const actor of [headActor, leadActor, null]) {
        const answer = plan(actor, MEMBER);
        assert.equal(answer.ok, false, JSON.stringify(actor));
      }
    });
  }
});

describe("who may be added", () => {
  test("someone who already holds that exact seat is refused", () => {
    assert.deepEqual(KINDS[0]!.plan(fullAccess, LEADER), { ok: false, error: "Alessandro Greco holds this seat now." });
    assert.deepEqual(KINDS[1]!.plan(fullAccess, PM), { ok: false, error: "Sara Conti holds this seat now." });
    assert.deepEqual(KINDS[2]!.plan(fullAccess, HEAD), { ok: false, error: "Chiara Rinaldi holds this seat now." });
    assert.deepEqual(KINDS[3]!.plan(fullAccess, SAFETY), { ok: false, error: "Paolo Riva holds this seat now." });
  });

  test("a full-access seat is held by its flag, on whatever row carries it", () => {
    // The operations lead's seat on a team-level row too: its holder on the lead row holds it already.
    const opsSeat = [...active, row({ id: 80, memberId: SAFETY, title: "Operations", fullAccess: "operations-lead" })];
    const plan = planSeatHolderAdd({ actor: fullAccess, roleId: 80, add: { personId: OPS }, team, active: opsSeat, org });
    assert.deepEqual(plan, { ok: false, error: "Elena Fontana holds this seat now." });
  });

  test("someone who holds a different seat is allowed, and keeps it", () => {
    // The Project Manager joins the team leader, the team leader joins a head, a head joins the Project Manager.
    for (const [kind, personId] of [
      [KINDS[0]!, PM],
      [KINDS[1]!, HEAD],
      [KINDS[2]!, LEADER],
      [KINDS[3]!, PM],
    ] as const) {
      const answer = kind.plan(fullAccess, personId);
      assert.equal(answer.ok, true, kind.name);
      assert.equal(answer.ok && answer.value.row.personId, personId);
    }
  });

  test("a head of another department may head this one too", () => {
    const answer = planHeadAdd({ actor: fullAccess, org, departmentId: 2, add: { personId: HEAD }, team, active });
    assert.equal(answer.ok, true);
  });

  test("someone off the team, a closed department and a row that is no team-level seat are refused", () => {
    assert.deepEqual(KINDS[0]!.plan(fullAccess, 99), { ok: false, error: "They are not on the team." });
    assert.deepEqual(planHeadAdd({ actor: fullAccess, org, departmentId: 9, add: { personId: MEMBER }, team, active }), { ok: false, error: "That department is closed." });
    for (const roleId of [LEADER_ROW, 40, 50, 999]) {
      assert.deepEqual(planSeatHolderAdd({ actor: fullAccess, roleId, add: { personId: MEMBER }, team, active, org }), { ok: false, error: "That seat is no longer held." }, String(roleId));
    }
  });

  test("the input is one person id", () => {
    assert.deepEqual(checkHolderAdd({ personId: 6 }), { ok: true, value: { personId: 6 } });
    for (const input of [{}, { personId: 0 }, { personId: "6" }, null]) assert.equal(checkHolderAdd(input).ok, false, JSON.stringify(input));
  });
});

describe("the new holder's row copies the seat", () => {
  const planned = (kind: Kind) => {
    const answer = kind.plan(fullAccess, MEMBER);
    assert.ok(answer.ok, kind.name);
    return answer.value;
  };

  test("the team leader seat: a president row with the seat's title and no flag", () => {
    assert.deepEqual(planned(KINDS[0]!), {
      seat: { kind: "team-leader" },
      holders: [LEADER],
      row: { personId: MEMBER, type: "president", title: "Team Leader", fullAccess: null, departmentId: null },
    });
    const untitled = planTeamLeaderAdd({ actor: fullAccess, add: { personId: MEMBER }, team, active: [row({ id: 1, memberId: LEADER, type: "president", title: "" })], org });
    assert.equal(untitled.ok && untitled.value.row.title, TEAM_LEADER_TITLE);
  });

  test("a full-access seat: its type, title and flag", () => {
    assert.deepEqual(planned(KINDS[1]!), {
      seat: { kind: "full-access", seat: "project-manager" },
      holders: [PM],
      row: { personId: MEMBER, type: "core", title: "Project Manager", fullAccess: "project-manager", departmentId: null },
    });
  });

  test("a department's head seat: a head row on the department, titled as a new head's", () => {
    assert.deepEqual(planned(KINDS[2]!), {
      seat: { kind: "head", departmentId: 1 },
      holders: [HEAD],
      row: { personId: MEMBER, type: "head", title: "Head of Aerodynamics", fullAccess: null, departmentId: 1 },
    });
  });

  test("an unflagged team-level seat: its type and title, no flag", () => {
    assert.deepEqual(planned(KINDS[3]!), {
      seat: { kind: "team-level", type: "core", title: "Safety Officer" },
      holders: [SAFETY],
      row: { personId: MEMBER, type: "core", title: "Safety Officer", fullAccess: null, departmentId: null },
    });
  });
});

describe("a seat as its rows share it", () => {
  test("every holder of a seat, each once", () => {
    const two: ActiveRoleRow[] = [...active, row({ id: 90, memberId: MEMBER, type: "president", title: "Team Leader" }), row({ id: 91, memberId: MEMBER, type: "president", title: "Team Leader" })];
    assert.deepEqual(holdersOfSeat({ kind: "team-leader" }, two, org), [LEADER, MEMBER]);
    // A head row kept on a division is its department's head.
    const kept = [row({ id: 1, memberId: HEAD, type: "head", title: "Head", divisionId: 1 })];
    assert.deepEqual(holdersOfSeat({ kind: "head", departmentId: 1 }, kept, org), [HEAD]);
  });

  test("an unflagged team-level seat is its type and trimmed title: another title or a flag is another seat", () => {
    const seat: Seat = { kind: "team-level", type: "core", title: "Safety Officer" };
    const rows = [
      row({ id: 1, memberId: 1, title: " Safety Officer " }),
      row({ id: 2, memberId: 2, title: "Safety Lead" }),
      row({ id: 3, memberId: 3, title: "Safety Officer", fullAccess: "chief-engineer" }),
      row({ id: 4, memberId: 4, title: "Safety Officer", divisionId: 1 }),
    ];
    assert.deepEqual(holdersOfSeat(seat, rows, org), [1]);
  });

  test("what a new holder is owed: the team address tie of the seat, and an alias request as a new team leader or head", () => {
    assert.deepEqual(tieOfSeat({ kind: "team-leader" }), { kind: "team-leader" });
    assert.deepEqual(tieOfSeat({ kind: "full-access", seat: "it-lead" }), { kind: "full-access-seat", seat: "it-lead" });
    assert.deepEqual(tieOfSeat({ kind: "head", departmentId: 2 }), { kind: "department-head", departmentId: 2 });
    assert.equal(tieOfSeat({ kind: "team-level", type: "core", title: "Safety Officer" }), null);
    assert.deepEqual(
      [{ kind: "team-leader" }, { kind: "head", departmentId: 1 }, { kind: "full-access", seat: "it-lead" }, { kind: "team-level", type: "core", title: "x" }].map((s) => asksAlias(s as Seat)),
      [true, true, false, false],
    );
  });
});
