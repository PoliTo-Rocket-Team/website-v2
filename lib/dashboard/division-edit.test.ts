import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDivisionSave,
  closeRefusal,
  divisionCodeError,
  planDivisionSave,
  searchTeam,
  storedDivisionName,
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

test("only the department's head or the team leader may create, edit, close or reopen a division", () => {
  assert.ok(plan({}).ok);
  assert.ok(plan({}, missionAnalysis, { kind: "team" }).ok);
  assert.equal(plan({}, missionAnalysis, { kind: "lead", divisionIds: [1] }).ok, false, "not even its own lead");
  assert.equal(plan({}, missionAnalysis, { kind: "head", departmentIds: [2] }).ok, false, "not another department's head");
  const create = { name: "Flight Dynamics", code: "FD", newLeads: [3] };
  assert.equal(plan(create, { kind: "new", departmentId: 1 }, { kind: "head", departmentIds: [2] }).ok, false);
  assert.equal(plan(create, { kind: "closed", division: { id: 9, name: "Wind Tunnel Division", departmentId: 1, code: "WT" }, stillIn: [] }, { kind: "lead", divisionIds: [1] }).ok, false);
  assert.equal(closeRefusal({ kind: "lead", divisionIds: [1] }, org, 1, { people: 0, waiting: 0 }), "Leads are changed by the Head of Aerodynamics");
  assert.equal(closeRefusal({ kind: "head", departmentIds: [2] }, org, 1, { people: 0, waiting: 0 }), "Only the team leader can do this");
});

test("an open division always keeps a lead: an edit, a create or a reopen with none is refused", () => {
  const both = plan({ oldLeads: [{ personId: 1, outcome: "member" }, { personId: 2, outcome: "member" }] });
  assert.deepEqual(both, { ok: false, error: "A division needs at least one lead." });
  assert.equal(plan({ name: "Flight Dynamics", code: "FD" }, { kind: "new", departmentId: 1 }).ok, false);
  const windTunnel: DivisionSubject = { kind: "closed", division: { id: 9, name: "Wind Tunnel Division", departmentId: 1, code: "WT" }, stillIn: [] };
  assert.equal(plan({ name: "Wind Tunnel", code: "WT" }, windTunnel).ok, false);
  const reopened = plan({ name: "Wind Tunnel", code: "WT", newLeads: [3] }, windTunnel);
  assert.ok(reopened.ok && reopened.plan.reopen !== null && reopened.plan.joinAsLead.join() === "3" && reopened.plan.joinAsMember.length === 0);
});

test("a reopen ends every role a closed division still holds, but keeps the picked lead's as their lead role", () => {
  // Closed before Close division refused while people were in it: Sara and Davide still hold roles there.
  const held: DivisionSubject = { kind: "closed", division: { id: 9, name: "Wind Tunnel Division", departmentId: 1, code: "WT" }, stillIn: [3, 5] };
  const result = plan({ name: "Wind Tunnel", code: "WT", newLeads: [3, 4], members: [5] }, held);
  assert.ok(result.ok);
  assert.deepEqual(result.plan.reopen, { keep: [3] }, "every other role there ends, Davide's included");
  assert.deepEqual(result.plan.promote, [3], "Sara's role there becomes a lead's, not a second role");
  assert.deepEqual(result.plan.joinAsLead, [4]);
  assert.deepEqual(result.plan.joinAsMember, [5], "a member picked again joins fresh after the old role ends");
  const edit = plan({});
  assert.ok(edit.ok && edit.plan.reopen === null, "an edit of an open division reopens nothing");
});

test("a lead picked from another division joins as a lead; a member here is promoted", () => {
  const result = plan({ newLeads: [4, 3] });
  assert.ok(result.ok);
  assert.deepEqual(result.plan.joinAsLead, [4]);
  assert.deepEqual(result.plan.promote, [3]);
  assert.equal(plan({ newLeads: [6] }).ok, false, "a head is placed by their head role");
  assert.equal(plan({ newLeads: [1] }).ok, false, "already a lead");
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

test("the pickers search the whole team, leave out team roles beyond the divisions, and offer a new email", () => {
  const found = searchTeam("ra", team, org);
  assert.ok(found.kind === "people");
  assert.ok(found.people.some((p) => p.name === "Laura Greco" && p.place === "Aerodynamics · Optimization and Analysis" && p.role === "Lead · Optimization and Analysis"));
  assert.ok(!found.people.some((p) => p.id === 6), "the head is not listed");
  assert.deepEqual(searchTeam("New.Person@studenti.polito.it", team, org), { kind: "new-email", email: "new.person@studenti.polito.it" });
  assert.equal(plan({ name: "Flight Dynamics", code: "FD", newLeads: [3], emails: ["sara@prt.it"] }, { kind: "new", departmentId: 1 }).ok, false, "a team address is a person, not a new email");
});
