import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { TeamPerson } from "./division-edit";
import {
  advising,
  advisingIn,
  advisorAfterDivisionCloses,
  advisorInDestinationDetail,
  advisorOptionDetail,
  advisorsStayLine,
  BECOME_AN_ADVISOR,
  checkTeamLeaderHandOver,
  mayHandOverTeamLeader,
  movesWithAdvisorRoleLine,
  planTeamLeaderHandOver,
  steppingDown,
  steppingDownLine,
  type HandOverViewer,
} from "./hand-over";
import { decideRightOf } from "./orders";
import { divisionRoleOf, isDivisionRole, membershipsOf, membershipsOfRoles, roleBeyondDivisions, type OrgChart } from "./team";
import { isTeamLeader, standingIn, viewerKindOf, viewerStandingOf, viewerUnitsOf, type ActiveRoleRef } from "./viewer";

// Handing over a role (issue #253): the one rule for what becomes of the
// person stepping down, the team leader's hand-over permission, and the
// Advisor role, which leads nothing and heads nothing.

const org: OrgChart = {
  departments: [{ id: 1, name: "Aerodynamics", code: "AE", kind: "technical" }],
  divisions: [{ id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" }],
};

const team: TeamPerson[] = [
  { id: 14, name: "Alessandro Greco", emails: ["alessandro@prt.it"], memberships: membershipsOf([]), beyond: [{ kind: "team-leader" }] },
  { id: 1, name: "Giulia Romano", emails: ["giulia@prt.it"], memberships: membershipsOf([]), beyond: [{ kind: "team", title: "Head of Operations" }] },
  { id: 7, name: "Sara Conti", emails: ["sara@prt.it"], memberships: membershipsOf([{ divisionId: 1, role: "member", since: "2024-10-01" }]), beyond: [] },
];

const teamLeader: HandOverViewer = { seat: "team-leader", selfId: 14 };
const operationsLead: HandOverViewer = { seat: "operations-lead", selfId: 1 };
const itLead: HandOverViewer = { seat: "it-lead", selfId: 2 };

test("every hand-over ends as an advisor in the person's own unit or on Alumni, never as a member", () => {
  assert.deepEqual(steppingDown({ kind: "lead", divisionId: 1 }, "advisor"), { kind: "advisor", place: { kind: "division", divisionId: 1 }, access: "ends" });
  assert.deepEqual(steppingDown({ kind: "head", departmentId: 1 }, "advisor"), { kind: "advisor", place: { kind: "department", departmentId: 1 }, access: "ends" });
  assert.deepEqual(steppingDown({ kind: "team-leader" }, "advisor"), { kind: "advisor", place: { kind: "team" }, access: "keeps-full-access" });
  for (const handed of [{ kind: "lead", divisionId: 1 }, { kind: "head", departmentId: 1 }, { kind: "team-leader" }] as const) {
    assert.deepEqual(steppingDown(handed, "leave"), { kind: "leave" });
  }
});

test("only the current team leader may hand over the Team Leader role: the operations lead and the IT lead are refused", () => {
  assert.equal(mayHandOverTeamLeader(teamLeader, 14), true);
  assert.equal(mayHandOverTeamLeader(operationsLead, 14), false);
  assert.equal(mayHandOverTeamLeader(itLead, 14), false);
  assert.equal(mayHandOverTeamLeader({ seat: null, selfId: 7 }, 14), false);
  assert.equal(mayHandOverTeamLeader({ seat: "team-leader", selfId: 9 }, 14), false, "the seat alone is not the role held now");
  const handOver = { to: 7, outcome: "advisor" } as const;
  for (const viewer of [operationsLead, itLead, { seat: null, selfId: 7 }]) {
    assert.deepEqual(planTeamLeaderHandOver({ viewer, leaderId: 14, handOver, team }), { ok: false, error: "Only the team leader can hand over this role." });
  }
});

test("the team leader hands over to someone else on the team, and picks what they do next", () => {
  assert.deepEqual(planTeamLeaderHandOver({ viewer: teamLeader, leaderId: 14, handOver: { to: 7, outcome: "advisor" }, team }), {
    ok: true,
    value: { from: 14, to: 7, steppingDown: { kind: "advisor", place: { kind: "team" }, access: "keeps-full-access" } },
  });
  const leaves = planTeamLeaderHandOver({ viewer: teamLeader, leaderId: 14, handOver: { to: 7, outcome: "leave" }, team });
  assert.ok(leaves.ok && leaves.value.steppingDown.kind === "leave");
  assert.deepEqual(planTeamLeaderHandOver({ viewer: teamLeader, leaderId: 14, handOver: { to: 14, outcome: "advisor" }, team }), { ok: false, error: "Pick who takes over from you." });
  assert.deepEqual(planTeamLeaderHandOver({ viewer: teamLeader, leaderId: 14, handOver: { to: 99, outcome: "advisor" }, team }), { ok: false, error: "They are not on the team." });
  assert.equal(checkTeamLeaderHandOver({ to: 7, outcome: "member" }).ok, false, "no third option");
  assert.equal(checkTeamLeaderHandOver({ to: 7 }).ok, false, "nothing is picked for them");
});

test("after the hand-over the new person is the team leader seat; the former one, a team advisor, keeps full access but not the seat", () => {
  const role = (type: ActiveRoleRef["type"], divisionId: number | null = null): ActiveRoleRef => ({ type, divisionId, fullAccess: null });
  const newLeader = viewerStandingOf({ scopes: [], activeRoles: [role("core", 1), role("president")] });
  assert.equal(isTeamLeader(newLeader), true);
  assert.equal(decideRightOf({ teamLeader: isTeamLeader(newLeader), approveOrders: false }), "team-leader", "decides orders and gives Approve orders");
  // The former team leader: an Advisor role on the whole team, and the org-wide row their full access stays as.
  const former = viewerStandingOf({ scopes: [{ scope: "org", target: "all", level: "edit" }], activeRoles: [role("advisor")] });
  assert.deepEqual(former, { kind: "operations-lead", seat: null, siteContent: false, approveOrders: false }, "full access, from the access row; no Approve orders grant");
  assert.equal(decideRightOf({ teamLeader: isTeamLeader(former), approveOrders: false }), null, "orders are the new team leader's");
});

// Issue #441 (Owner decision, 2026-10-19): "Become an advisor" ends the lead or
// head role and keeps the person in the same unit with the Advisor role, on
// every path, in one wording; it never touches the Team page's advisory board.

test("Become an advisor is one rule: a lead stays in the division, a head in the department, the team leader team-wide", () => {
  assert.deepEqual(advising({ kind: "lead", divisionId: 1 }), steppingDown({ kind: "lead", divisionId: 1 }, "advisor"));
  assert.deepEqual(advising({ kind: "head", departmentId: 1 }), steppingDown({ kind: "head", departmentId: 1 }, "advisor"));
  assert.deepEqual(advising({ kind: "team-leader" }), steppingDown({ kind: "team-leader" }, "advisor"));
  // A closing division's advisor stays in its department; a closing department's head or lead becomes one in the unit the closer picked.
  assert.deepEqual(advisorAfterDivisionCloses(1), { kind: "department", departmentId: 1 });
  assert.deepEqual(advising({ kind: "head", departmentId: 1 }), advisingIn({ kind: "department", departmentId: 1 }));
  assert.deepEqual(advisingIn({ kind: "division", divisionId: 3 }), { kind: "advisor", place: { kind: "division", divisionId: 3 }, access: "ends" });
});

test("every drawer and dialog words Become an advisor the same way, for the editor or for the person stepping down", () => {
  assert.equal(BECOME_AN_ADVISOR, "Become an advisor");
  assert.equal(advisorOptionDetail({ kind: "lead", divisionId: 1 }, "Mission Analysis", "they"), "Stays in Mission Analysis with the Advisor role; their access ends");
  assert.equal(advisorOptionDetail({ kind: "head", departmentId: 1 }, "Aerodynamics", "they"), "Stays in Aerodynamics with the Advisor role; their access ends");
  assert.equal(advisorOptionDetail({ kind: "lead", divisionId: 1 }, "Mission Analysis", "you"), "Stay in Mission Analysis with the Advisor role; your access ends");
  assert.equal(
    advisorOptionDetail({ kind: "team-leader" }, null, "you"),
    "Stay in the team with the Advisor role and keep your access; the new Team Leader can change it in Access",
  );
  // The confirm line is the same words, in the sentence that names them.
  assert.equal(steppingDownLine(steppingDown({ kind: "head", departmentId: 1 }, "advisor"), "Aerodynamics"), "stays in Aerodynamics with the Advisor role; their access ends");
  assert.equal(advisorsStayLine(["Marco Bianchi"], "Aerodynamics"), "Marco Bianchi stays in Aerodynamics with the Advisor role.");
  assert.equal(advisorsStayLine(["Marco Bianchi", "Sara Conti", "Luca Neri"], "Aerodynamics"), "Marco Bianchi, Sara Conti and Luca Neri stay in Aerodynamics with the Advisor role.");
  // Close department moves them instead: the same phrase, to the destination picked.
  assert.equal(advisorInDestinationDetail("Structures"), "Moves to Structures with the Advisor role; their access ends");
  assert.equal(movesWithAdvisorRoleLine("Structures", true), "moves to Structures with the Advisor role; their access ends");
  assert.equal(movesWithAdvisorRoleLine("Structures", false), "moves to Structures with the Advisor role", "an advisor who moves keeps their access");
});

test("no hand-over, replacement or close path writes the Team page's advisory board: it is edited by hand only", () => {
  // Both data sources' hand-over, replace and close writes live in these two files; the board is `team_page_advisors`.
  for (const file of ["./database-team.ts", "../dummy-data/team-pages.ts"]) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /teamPageAdvisor|team_page_advisor|database-team-advisors|AdvisorStore|advisorEditor/, file);
  }
});

test("an advisor is never counted as a lead or a head", () => {
  const advisor = (divisionId: number | null): ActiveRoleRef => ({ type: "advisor", divisionId, fullAccess: null });
  assert.equal(divisionRoleOf("advisor"), "member");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [advisor(1)] }), "member", "an advisor in a division is no division lead");
  assert.equal(viewerKindOf({ scopes: [], activeRoles: [advisor(null)] }), "member", "a team advisor is no department head");
  assert.equal(standingIn({ scopes: [], activeRoles: [advisor(1)] }, 1), "member");
  assert.deepEqual(viewerUnitsOf([], [{ type: "advisor", divisionId: 1, departmentId: 1 }, { type: "advisor", divisionId: null, departmentId: 1 }]), { divisionIds: [], departmentIds: [] });
  assert.deepEqual([...membershipsOfRoles([{ type: "advisor", divisionId: 1, since: "2026-10-16" }])], [{ divisionId: 1, role: "member", since: "2026-10-16" }]);
  assert.equal(isDivisionRole({ type: "advisor", divisionId: 1 }), true, "a former lead stays in the division with the Advisor role");
  // A former head's Advisor role sits on their department; a former team leader's on the whole team. Neither is a head.
  const seat = (departmentId: number | null) => roleBeyondDivisions({ type: "advisor", divisionId: null, departmentId, title: "Advisor", since: "2026-10-16" }, org);
  assert.deepEqual(seat(1), { kind: "advisor", departmentId: 1 });
  assert.deepEqual(seat(null), { kind: "advisor", departmentId: null });
});
