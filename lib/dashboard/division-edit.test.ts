import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDivisionSave,
  closeRefusal,
  divisionCodeError,
  divisionRowWrites,
  peopleInDivision,
  planDivisionSave,
  searchTeam,
  storedDivisionName,
  type DivisionRow,
  type DivisionSave,
  type DivisionSubject,
  type TeamPerson,
} from "./division-edit";
import { membershipsOf, type DivisionRole, type OrgChart, type TeamActor } from "./team";

// The division rules of #232, as the server runs them on both data sources.

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics" },
    { id: 2, name: "Structures" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

function person(id: number, name: string, list: readonly (readonly [number, DivisionRole])[], beyond: TeamPerson["beyond"] = []): TeamPerson {
  return {
    id,
    name,
    emails: [`${name.split(" ")[0].toLowerCase()}@prt.it`],
    memberships: membershipsOf(list.map(([divisionId, role]) => ({ divisionId, role, since: "2024-10-01" }))),
    beyond,
  };
}

const team: TeamPerson[] = [
  person(1, "Marco Bianchi", [[1, "lead"]]),
  person(2, "Pietro Ricci", [[1, "lead"], [2, "member"]]),
  person(3, "Sara Conti", [[1, "member"]]),
  person(4, "Laura Greco", [[2, "lead"]]),
  person(5, "Davide Russo", [[1, "member"], [3, "member"]]),
  person(6, "Chiara Rinaldi", [], [{ kind: "head", departmentId: 1 }]),
  person(7, "Alessandro Greco", [], [{ kind: "team-leader" }]),
  person(8, "Federica Moretti", [[3, "member"]], [{ kind: "board", seat: "chief-engineer" }]),
];

const head: TeamActor = { kind: "head", departmentIds: [1] };
const missionAnalysis: DivisionSubject = { kind: "open", division: org.divisions[0] };
const keep: DivisionSave = { name: "Mission Analysis", code: "MA", newLeads: [], oldLeads: [], members: [], emails: [] };

const plan = (save: Partial<DivisionSave>, subject: DivisionSubject = missionAnalysis, actor: TeamActor = head) =>
  planDivisionSave({ actor, org, subject, save: { ...keep, ...save }, team });

test("a division code is 2 or 3 letters, unique among open divisions; its own code stays allowed", () => {
  assert.equal(divisionCodeError("MA", org.divisions, 1), null);
  assert.equal(divisionCodeError("FDX", org.divisions, null), null);
  assert.match(divisionCodeError("M", org.divisions, null)!, /2 or 3 letters/);
  assert.match(divisionCodeError("MAXX", org.divisions, null)!, /2 or 3 letters/);
  assert.match(divisionCodeError("M1", org.divisions, null)!, /2 or 3 letters/);
  assert.match(divisionCodeError("OA", org.divisions, 1)!, /Optimization and Analysis already uses OA/);
  const typed = checkDivisionSave({ ...keep, code: " oa " });
  assert.ok(typed.ok && typed.value.code === "OA");
  assert.equal(plan({ code: typed.value.code }).ok, false, "typed in lower case, still taken");
  assert.equal(plan({ code: "DM" }).ok, false, "unique across departments too");
});

test("only the department's head, the team leader or full access may create, edit or close a division", () => {
  assert.ok(plan({}).ok);
  assert.ok(plan({}, missionAnalysis, { kind: "team" }).ok);
  assert.equal(plan({}, missionAnalysis, { kind: "lead", divisionIds: [1] }).ok, false, "not even its own lead");
  assert.equal(plan({}, missionAnalysis, { kind: "head", departmentIds: [2] }).ok, false, "not another department's head");
  const create = { name: "Flight Dynamics", code: "FD", newLeads: [3] };
  assert.equal(plan(create, { kind: "new", departmentId: 1 }, { kind: "head", departmentIds: [2] }).ok, false);
  assert.ok(plan(create, { kind: "new", departmentId: 1 }).ok, "the head of its own department");
  assert.equal(plan(create, { kind: "new", departmentId: 1 }, { kind: "lead", divisionIds: [1] }).ok, false);
  assert.equal(closeRefusal({ kind: "lead", divisionIds: [1] }, org, 1, { people: 0, waiting: 0 }), "Leads are changed by the Head of Aerodynamics");
  assert.equal(closeRefusal({ kind: "head", departmentIds: [2] }, org, 1, { people: 0, waiting: 0 }), "Only the team leader can do this");
});

test("an open division always keeps a lead: an edit or a create with none is refused", () => {
  const both = plan({ oldLeads: [{ personId: 1, outcome: "member" }, { personId: 2, outcome: "member" }] });
  assert.deepEqual(both, { ok: false, error: "A division needs at least one lead." });
  assert.equal(plan({ name: "Flight Dynamics", code: "FD" }, { kind: "new", departmentId: 1 }).ok, false);
});

test("a closed division never opens again: a save on a division off the chart is refused, even with a lead (#251)", () => {
  const windTunnel: DivisionSubject = { kind: "open", division: { id: 9, name: "Wind Tunnel Division", departmentId: 1, code: "WT" } };
  assert.deepEqual(plan({ name: "Wind Tunnel", code: "WT", newLeads: [3] }, windTunnel), { ok: false, error: "That division is closed." });
  assert.deepEqual(plan({ name: "Wind Tunnel", code: "WT", newLeads: [3] }, windTunnel, { kind: "team" }), { ok: false, error: "That division is closed." });
});

test("a lead picked from another division joins as a lead; a member here is promoted", () => {
  const result = plan({ newLeads: [4, 3] });
  assert.ok(result.ok);
  assert.deepEqual(result.plan.joinAsLead, [4]);
  assert.deepEqual(result.plan.promote, [3]);
  assert.equal(plan({ newLeads: [1] }).ok, false, "already a lead");
  assert.equal(plan({ newLeads: [99] }).ok, false, "not on the team");
});

test("anyone on the team can be picked as a lead: the team leader, a board seat and a head join beside their role", () => {
  const result = plan({ newLeads: [6, 7, 8] });
  assert.ok(result.ok);
  assert.deepEqual(result.plan.joinAsLead, [6, 7, 8]);
  assert.deepEqual(result.plan.leaveTeam, [], "their own role is untouched");
  const created = plan({ name: "Flight Dynamics", code: "FD", newLeads: [7], members: [6] }, { kind: "new", departmentId: 1 });
  assert.ok(created.ok && created.plan.joinAsLead.join() === "7" && created.plan.joinAsMember.join() === "6");
});

test("each outcome for an old lead is planned as chosen, within the rules", () => {
  const result = plan({
    newLeads: [3],
    oldLeads: [
      { personId: 1, outcome: "leave-team" },
      { personId: 2, outcome: "leave-division" },
    ],
  });
  assert.ok(result.ok);
  assert.deepEqual([result.plan.leaveTeam, result.plan.leaveDivision, result.plan.demote], [[1], [2], []]);
  assert.match((plan({ oldLeads: [{ personId: 1, outcome: "leave-division" }] }) as { error: string }).error, /only division/);
  assert.equal(plan({ oldLeads: [{ personId: 3, outcome: "member" }] }).ok, false, "only a lead is an old lead");
});

test("Leaves the team for an old lead follows the shared rule: someone also in another department is the team leader's", () => {
  const away = [...team.slice(0, 1).map((p) => ({ ...p, memberships: membershipsOf([...p.memberships, { divisionId: 3, role: "member", since: "2025-10-01" }]) })), ...team.slice(1)];
  const save = { ...keep, newLeads: [3], oldLeads: [{ personId: 1, outcome: "leave-team" as const }] };
  const refused = planDivisionSave({ actor: head, org, subject: missionAnalysis, save, team: away });
  assert.deepEqual(refused, { ok: false, error: "Also in Design & Manufacturing, so only the team leader can do this" });
  assert.ok(planDivisionSave({ actor: { kind: "team" }, org, subject: missionAnalysis, save, team: away }).ok);
});

// A seat kept on a division row (#232, review round 3): Chiara (6) is Head of
// Aerodynamics with her head row kept on Mission Analysis (row 104) and leads
// it beside the seat (row 105); Alessandro (7), the team leader, has his row
// kept there too (row 106).
const seatRows: readonly DivisionRow[] = [
  { id: 101, memberId: 1, type: "lead" },
  { id: 103, memberId: 3, type: "core" },
  { id: 104, memberId: 6, type: "head" },
  { id: 105, memberId: 6, type: "lead" },
  { id: 106, memberId: 7, type: "president" },
];
const headLeads = [...team.slice(0, 5), person(6, "Chiara Rinaldi", [[1, "lead"]], [{ kind: "head", departmentId: 1 }]), ...team.slice(6)];
const planWithHead = (save: Partial<DivisionSave>, subject: DivisionSubject = missionAnalysis) =>
  planDivisionSave({ actor: { kind: "team" }, org, subject, save: { ...keep, ...save }, team: headLeads });

test("a seat holder who leads a division may leave it, even when it is their only division", () => {
  const result = planWithHead({ newLeads: [3], oldLeads: [{ personId: 6, outcome: "leave-division" }] });
  assert.ok(result.ok);
  assert.deepEqual(result.plan.leaveDivision, [6]);
});

test("every division write touches only lead and member rows: a seat kept on the division stays the seat", () => {
  const leaves = planWithHead({ newLeads: [3], oldLeads: [{ personId: 6, outcome: "leave-division" }] });
  assert.ok(leaves.ok);
  assert.deepEqual(divisionRowWrites(leaves.plan, 1, seatRows), { end: [105], toLead: [103], toMember: [] }, "her lead row ends, her head row stays");

  const stays = planWithHead({ oldLeads: [{ personId: 6, outcome: "member" }] });
  assert.ok(stays.ok);
  assert.deepEqual(divisionRowWrites(stays.plan, 1, seatRows).toMember, [105], "only the lead row becomes a member's");

  // Promote: Chiara's only row here is the seat, so she is no member to promote; she joins as a lead and the seat row is untouched.
  const seatOnly = seatRows.filter((r) => r.id !== 105);
  const team6 = [...team.slice(0, 5), person(6, "Chiara Rinaldi", [], [{ kind: "head", departmentId: 1 }]), ...team.slice(6)];
  const picked = planDivisionSave({ actor: head, org, subject: missionAnalysis, save: { ...keep, newLeads: [6] }, team: team6 });
  assert.ok(picked.ok && picked.plan.joinAsLead.join() === "6");
  assert.deepEqual(divisionRowWrites(picked.plan, 1, seatOnly), { end: [], toLead: [], toMember: [] });
  assert.deepEqual(divisionRowWrites({ ...picked.plan, joinAsLead: [], promote: [6, 7] }, 1, seatRows).toLead, [105], "a seat row never becomes a lead's");
});

test("a code change is planned as one, and the name is kept with 'Division'", () => {
  const result = plan({ name: "Mission Design", code: "MD" });
  assert.ok(result.ok);
  assert.equal(result.plan.code, "MD");
  assert.equal(result.plan.codeChanged, true);
  assert.equal(result.plan.name, "Mission Design Division");
  assert.equal(storedDivisionName("Flight Dynamics Division"), "Flight Dynamics Division");
});

test("Close division is refused while anyone is in it, people waiting for their NDA included", () => {
  assert.match(closeRefusal(head, org, 1, { people: 9, waiting: 0 })!, /9 people are still in Mission Analysis Division/);
  assert.match(closeRefusal(head, org, 1, { people: 0, waiting: 1 })!, /1 person is still/);
  assert.equal(closeRefusal(head, org, 1, { people: 0, waiting: 0 }), null);
});

test("Close counts only lead and member rows as people: a seat kept on the division is nobody in it", () => {
  assert.deepEqual(peopleInDivision(1, seatRows), [1, 3, 6], "the head counts once, by her lead row; the team leader's seat row is nobody");
  // The head left her lead role with "Leaves {division}": only the seat rows are left, so the division closes.
  const seatsOnly = seatRows.filter((r) => r.type === "head" || r.type === "president");
  assert.deepEqual(peopleInDivision(1, seatsOnly), []);
  assert.equal(closeRefusal(head, org, 1, { people: peopleInDivision(1, seatsOnly).length, waiting: 0 }), null);
  const withMember = [...seatsOnly, { id: 107, memberId: 8, type: "core" as const }];
  assert.match(closeRefusal(head, org, 1, { people: peopleInDivision(1, withMember).length, waiting: 0 })!, /1 person is still/);
});

test("the pickers search the whole team, the team leader, board and heads included, and offer a new email", () => {
  const found = searchTeam("ra", team, org);
  assert.ok(found.kind === "people");
  assert.ok(found.people.some((p) => p.name === "Laura Greco" && p.place === "Aerodynamics · Optimization and Analysis" && p.role === "Lead · Optimization and Analysis"));
  assert.ok(found.people.some((p) => p.id === 6 && p.role === "Head of Aerodynamics"), "the head is listed by their role");
  const leader = searchTeam("alessandro@prt.it", team, org);
  assert.ok(leader.kind === "people" && leader.people[0].id === 7 && leader.people[0].role === "Team Leader");
  assert.deepEqual(searchTeam("New.Person@studenti.polito.it", team, org), { kind: "new-email", email: "new.person@studenti.polito.it" });
  assert.equal(plan({ name: "Flight Dynamics", code: "FD", newLeads: [3], emails: ["sara@prt.it"] }, { kind: "new", departmentId: 1 }).ok, false, "a team address is a person, not a new email");
});
