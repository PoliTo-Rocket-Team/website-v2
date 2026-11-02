import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDepartmentClose,
  checkDepartmentCreate,
  checkDepartmentSave,
  closingPeople,
  departmentCodeError,
  planDepartmentClose,
  planDepartmentCreate,
  planDepartmentSave,
  type ClosingRecord,
  type DepartmentCreate,
  type PersonMove,
} from "./department-edit";
import { advisingIn, type HandOverOutcome, type Unit } from "./hand-over";
import type { TeamPerson } from "./division-edit";
import { membershipsOf, type OrgChart, type TeamActor } from "./team";

// The department rules of #251 (boards 77d to 77f), as the server runs them on
// both data sources.

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", code: "AE", kind: "technical" },
    { id: 2, name: "Structures", code: "ST", kind: "technical" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
  ],
};

const team: TeamPerson[] = [
  { id: 1, name: "Marco Bianchi", emails: ["marco@prt.it"], memberships: membershipsOf([{ divisionId: 1, role: "lead", since: "2023-10-01" }]), beyond: [] },
  { id: 6, name: "Chiara Rinaldi", emails: ["chiara@prt.it"], memberships: membershipsOf([]), beyond: [{ kind: "head", departmentId: 1, title: "Head of Aerodynamics" }] },
  { id: 7, name: "Alessandro Greco", emails: ["alessandro@prt.it"], memberships: membershipsOf([]), beyond: [{ kind: "team-leader", title: "" }] },
  { id: 8, name: "Giulia Ferri", emails: ["giulia@prt.it"], memberships: membershipsOf([]), beyond: [{ kind: "advisor", departmentId: 1 }] },
  { id: 9, name: "Luca Moretti", emails: ["luca@prt.it"], memberships: membershipsOf([{ divisionId: 3, role: "member", since: "2024-10-01" }]), beyond: [] },
];

const fullAccess: TeamActor = { kind: "team" };
const head: TeamActor = { kind: "head", departmentIds: [1] };
const lead: TeamActor = { kind: "lead", divisionIds: [1], ledDivisionIds: [1] };
const propulsion: DepartmentCreate = { name: "Propulsion", code: "PR", heads: [1] };

const create = (save: Partial<DepartmentCreate>, actor: TeamActor | null = fullAccess) => planDepartmentCreate({ actor, org, save: { ...propulsion, ...save }, team });

test("only the team leader or full access creates, edits or closes a department; a head and a lead never do", () => {
  assert.ok(create({}).ok);
  for (const actor of [head, lead, null]) {
    assert.equal(create({}, actor).ok, false, JSON.stringify(actor));
    assert.equal(planDepartmentSave({ actor, org, departmentId: 1, team, headIds: [6], save: { name: "Aero", code: "AE", head: null } }).ok, false);
    assert.equal(planDepartmentClose({ actor, org, departmentId: 1, close: { people: [] }, people: [], waiting: {} }).ok, false);
  }
});

test("New department needs a name, a 2 or 3 letter code no open department uses, and exactly one head", () => {
  assert.deepEqual(create({ name: "  " }), { ok: false, error: "Write the department's name." });
  assert.match((create({ code: "P" }) as { error: string }).error, /2 or 3 letters/);
  assert.match((create({ code: "PROP" }) as { error: string }).error, /2 or 3 letters/);
  assert.deepEqual(create({ code: "ST" }), { ok: false, error: "Structures already uses ST." });
  assert.deepEqual(create({ heads: [] }), { ok: false, error: "A department needs exactly one head." });
  assert.deepEqual(create({ heads: [1, 7] }), { ok: false, error: "A department needs exactly one head." });
  assert.deepEqual(create({ heads: [99] }), { ok: false, error: "They are not on the team." });
  const typed = checkDepartmentCreate({ name: "Propulsion Department", code: " pr ", heads: [1] });
  assert.ok(typed.ok);
  assert.deepEqual(create(typed.value), { ok: true, value: { name: "Propulsion", code: "PR", headId: 1 } }, "stored without 'Department', code in capitals");
  assert.equal(checkDepartmentCreate({ name: "Propulsion", code: "PR" }).ok, false, "no head list at all is refused in its shape");
});

test("New department's head may hold other seats (issue #837): another department's head, the team leader, an advisor or a division member", () => {
  for (const headId of [6, 7, 8, 9]) {
    assert.deepEqual(create({ heads: [headId] }), { ok: true, value: { name: "Propulsion", code: "PR", headId } }, `person ${headId}`);
  }
});

test("Edit department saves a new name or code under the same rules, for an open department", () => {
  const renamed = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: { name: "Aerodynamics and Flight", code: "AF", head: null } });
  assert.deepEqual(renamed, { ok: true, value: { name: "Aerodynamics and Flight", code: "AF", nameChanged: true, codeChanged: true, head: null } });
  const same = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: { name: "Aerodynamics", code: "AE", head: null } });
  assert.ok(same.ok && !same.value.nameChanged && !same.value.codeChanged, "its own code stays allowed");
  assert.equal(planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: { name: "Aerodynamics", code: "ST", head: null } }).ok, false);
  assert.deepEqual(planDepartmentSave({ actor: fullAccess, org, departmentId: 9, team, headIds: [], save: { name: "Gone", code: "GN", head: null } }), { ok: false, error: "That department is closed." });
  assert.equal(departmentCodeError("AE", org.departments, 1), null);
});

// Close department (issue #441, Owner decision, 2026-10-19): every person in
// the department gets a destination, and nobody leaves the team from here.

const DM: Unit = { kind: "division", divisionId: 3 };
const STRUCTURES: Unit = { kind: "department", departmentId: 2 };

const record = (r: Partial<ClosingRecord> & Pick<ClosingRecord, "id" | "name">): ClosingRecord => ({ photoUrl: null, memberships: membershipsOf([]), beyondDivisions: [], advising: [], ...r });

/** Aerodynamics: its head, a lead, a member also in Design & Manufacturing, an advisor in a division and one on the department; and someone only in Structures. */
const records: ClosingRecord[] = [
  record({ id: 7, name: "Sara Conti", memberships: membershipsOf([{ divisionId: 1, role: "member", since: "2024-10-01" }, { divisionId: 3, role: "member", since: "2024-10-01" }]) }),
  record({ id: 1, name: "Marco Bianchi", memberships: membershipsOf([{ divisionId: 1, role: "lead", since: "2023-10-01" }]) }),
  record({ id: 13, name: "Luca Neri", memberships: membershipsOf([{ divisionId: 2, role: "member", since: "2025-10-01" }]), advising: [2] }),
  record({ id: 20, name: "Elena Russo", beyondDivisions: [{ kind: "advisor", departmentId: 1 }] }),
  record({ id: 6, name: "Chiara Rinaldi", beyondDivisions: [{ kind: "head", departmentId: 1, title: "Head of Aerodynamics" }] }),
  record({ id: 30, name: "Paolo Gallo", memberships: membershipsOf([{ divisionId: 3, role: "member", since: "2024-10-01" }]) }),
];

const people = closingPeople(records, org, 1);

/** Everyone in Aerodynamics but Sara, who is in Design & Manufacturing already: the head as an advisor, the lead as a member. */
const allToDesign: PersonMove[] = [
  { personId: 6, to: DM, role: "advisor" },
  { personId: 1, to: DM, role: "member" },
  { personId: 13, to: DM, role: null },
  { personId: 20, to: STRUCTURES, role: null },
];

const closing = (moves: readonly PersonMove[], waiting: Record<number, number> = {}, actor: TeamActor | null = fullAccess) =>
  planDepartmentClose({ actor, org, departmentId: 1, close: { people: moves }, people, waiting });

test("Close department moves everyone in the department: the head, its leads, its advisors and its members, each once", () => {
  assert.deepEqual(
    people.map((p) => [p.id, p.standing]),
    [
      [6, "head"],
      [1, "lead"],
      [20, "advisor"],
      [13, "advisor"],
      [7, "member"],
    ],
    "head first, then leads, advisors and members, by name; someone only in another department is not listed",
  );
  assert.deepEqual(people.find((p) => p.id === 7)?.holds, [DM], "Sara is in Design & Manufacturing already, so it is no destination for her");
  assert.deepEqual(closingPeople(records, org, 2).map((p) => p.id), [30, 7], "the department's own people only");
});

test("Close department needs a destination for every person before it saves; it offers no Leave the team", () => {
  assert.deepEqual(closing(allToDesign), { ok: false, error: "Choose where Sara Conti goes." });
  assert.equal(checkDepartmentClose({ divisions: [], head: "leave" }).ok, false, "the old request shape, with a head who leaves, is refused");
  assert.equal(checkDepartmentClose({ people: [{ personId: 6, to: DM, role: "leave" }] }).ok, false, "no Leave the team for anyone");
  const sent = checkDepartmentClose({ people: [{ personId: 7, to: { kind: "division", divisionId: 2 } }] });
  assert.ok(sent.ok && sent.value.people[0]?.role === null, "a move with no role reads as nothing picked");
  for (const actor of [head, lead, null]) assert.equal(closing([], {}, actor).ok, false, "only the team leader and full access");
});

test("Close department: a former head or lead picks Advisor or member in their destination, nothing picked; an advisor there follows the one rule", () => {
  // Sara is in Design & Manufacturing already, so she goes to a second division of Structures.
  const orgWithMore: OrgChart = { ...org, divisions: [...org.divisions, { id: 4, name: "Composites Division", departmentId: 2, code: "CO" }] };
  const plan = (moves: readonly PersonMove[]) => planDepartmentClose({ actor: fullAccess, org: orgWithMore, departmentId: 1, close: { people: moves }, people, waiting: {} });
  const composites: Unit = { kind: "division", divisionId: 4 };
  const sara: PersonMove = { personId: 7, to: composites, role: null };
  const planned = plan([...allToDesign, sara]);
  assert.ok(planned.ok, JSON.stringify(planned));
  assert.deepEqual(planned.value.divisions, [1, 2], "every division of the department closes with it");
  assert.deepEqual(planned.value.moves, [
    { personId: 6, to: DM, becomes: { kind: "advisor", access: advisingIn(DM).access } },
    { personId: 1, to: DM, becomes: { kind: "member" } },
    { personId: 20, to: STRUCTURES, becomes: { kind: "advisor", access: "kept" } },
    { personId: 13, to: DM, becomes: { kind: "advisor", access: "kept" } },
    { personId: 7, to: composites, becomes: { kind: "member" } },
  ]);
  assert.equal(advisingIn(DM).access, "ends", "a head or lead who becomes an advisor loses their access, as on every hand-over");

  const unpicked = plan([{ personId: 6, to: DM, role: null }, ...allToDesign.slice(1), { ...sara, to: composites }]);
  assert.deepEqual(unpicked, { ok: false, error: "Choose Chiara Rinaldi's role in Design & Manufacturing: Become an advisor or Member." });
  const leadAsMemberOfDepartment = plan([allToDesign[0]!, { personId: 1, to: STRUCTURES, role: "member" }, ...allToDesign.slice(2), { ...sara, to: composites }]);
  assert.deepEqual(leadAsMemberOfDepartment, { ok: false, error: "A member goes to a division: pick one for Marco Bianchi." });
  const leadAsAdvisorOfDepartment = plan([allToDesign[0]!, { personId: 1, to: STRUCTURES, role: "advisor" }, ...allToDesign.slice(2), { ...sara, to: composites }]);
  assert.ok(leadAsAdvisorOfDepartment.ok, "an Advisor role may sit on a department");
  const memberPicksRole = plan([...allToDesign, { ...sara, to: composites, role: "advisor" }]);
  assert.deepEqual(memberPicksRole, { ok: false, error: "Sara Conti keeps the role they hold: only a head or lead picks one." });
  const memberToDepartment = plan([...allToDesign, { ...sara, to: STRUCTURES }]);
  assert.deepEqual(memberToDepartment, { ok: false, error: "A member goes to a division: pick one for Sara Conti." });
});

test("Close department sends people only to an open unit outside it where they hold no role yet, and waits for nobody's NDA", () => {
  const sara = (to: Unit): PersonMove => ({ personId: 7, to, role: null });
  assert.deepEqual(closing([...allToDesign, sara(DM)]), { ok: false, error: "Sara Conti is already in Design & Manufacturing." });
  assert.deepEqual(closing([...allToDesign, sara({ kind: "division", divisionId: 2 })]), { ok: false, error: "Pick an open department or division outside this one for Sara Conti." });
  assert.equal(closing([...allToDesign, sara({ kind: "division", divisionId: 99 })]).ok, false, "not a closed or unknown division");
  assert.equal(closing([...allToDesign.slice(0, 3), { personId: 20, to: { kind: "department", departmentId: 1 }, role: null }, sara(DM)]).ok, false, "not the department that closes");
  assert.deepEqual(closing([...allToDesign, allToDesign[0]!]), { ok: false, error: "Someone is listed twice." });
  assert.deepEqual(closing([...allToDesign, { personId: 30, to: DM, role: null }]), { ok: false, error: "Only people in this department move when it closes." });
  assert.deepEqual(closing(allToDesign, { 2: 1 }), { ok: false, error: "1 person is waiting for their NDA in Optimization and Analysis. Confirm or cancel them first." });
  const empty: OrgChart = { ...org, departments: [...org.departments, { id: 3, name: "Recovery", code: "RC", kind: "technical" }] };
  assert.deepEqual(planDepartmentClose({ actor: fullAccess, org: empty, departmentId: 3, close: { people: [] }, people: [], waiting: {} }), { ok: true, value: { divisions: [], moves: [] } }, "a department with nobody in it closes at once");
});

// Change head (issue #253, board 77e): handing the head role over.

const changeHead = (
  head: { to: number; from?: number | null; outcome: HandOverOutcome | null } | null,
  headIds: readonly number[] = [6],
  actor: TeamActor | null = fullAccess,
) => planDepartmentSave({ actor, org, departmentId: 1, team, headIds, save: { name: "Aerodynamics", code: "AE", head: head === null ? null : { from: null, ...head } } });

test("Change head: the replaced head becomes an advisor in the department or leaves the team; nothing leaves them as a member", () => {
  assert.deepEqual(changeHead({ to: 1, outcome: "advisor" }), {
    ok: true,
    value: {
      name: "Aerodynamics",
      code: "AE",
      nameChanged: false,
      codeChanged: false,
      head: { to: 1, replaces: { memberId: 6, steppingDown: { kind: "advisor", place: { kind: "department", departmentId: 1 }, access: "ends" } } },
    },
  });
  const leaves = changeHead({ to: 1, outcome: "leave" });
  assert.ok(leaves.ok);
  assert.deepEqual(leaves.value.head?.replaces?.steppingDown, { kind: "leave" });
  assert.deepEqual(changeHead({ to: 1, outcome: null }), { ok: false, error: "Choose what happens to the head: Become an advisor or Leave the team." });
  assert.equal(checkDepartmentSave({ name: "Aerodynamics", code: "AE", head: { to: 1, outcome: "member" } }).ok, false, "only advisor or leave");
});

test("Change head picks anyone on the team but the head it has now (issue #837); a department with no head needs no outcome", () => {
  assert.deepEqual(changeHead({ to: 6, outcome: "advisor" }), { ok: false, error: "Chiara Rinaldi already heads this department." });
  assert.deepEqual(changeHead({ to: 99, outcome: "advisor" }), { ok: false, error: "They are not on the team." });
  // Chiara heads Aerodynamics; she takes Structures over from Marco and keeps her head seat there.
  const otherHead = planDepartmentSave({
    actor: fullAccess,
    org,
    departmentId: 2,
    team,
    headIds: [1],
    save: { name: "Structures", code: "ST", head: { to: 6, from: null, outcome: "advisor" } },
  });
  assert.ok(otherHead.ok && otherHead.value.head?.to === 6, "another department's head");
  for (const to of [7, 8, 9]) {
    const changed = changeHead({ to, outcome: "advisor" });
    assert.ok(changed.ok && changed.value.head?.to === to && changed.value.head.replaces?.memberId === 6, `person ${to}: the team leader, an advisor, a division member`);
  }
  const first = changeHead({ to: 1, outcome: null }, []);
  assert.ok(first.ok);
  assert.deepEqual(first.value.head, { to: 1, replaces: null });
  for (const actor of [head, lead, null]) assert.equal(changeHead({ to: 1, outcome: "advisor" }, [6], actor).ok, false, "only the team leader and full access");
  const sent = checkDepartmentSave({ name: "Aerodynamics", code: "AE" });
  assert.ok(sent.ok && sent.value.head === null, "a save with no head field changes no head");
});

test("with two heads, Change head replaces only the head picked; a successor who heads it already is refused (issue #872)", () => {
  const changed = changeHead({ to: 7, from: 9, outcome: "advisor" }, [6, 9]);
  assert.ok(changed.ok);
  assert.equal(changed.value.head?.replaces?.memberId, 9, "only the picked head steps down");
  assert.deepEqual(changeHead({ to: 7, outcome: "advisor" }, [6, 9]), { ok: false, error: "Pick which head the new head replaces." });
  assert.deepEqual(changeHead({ to: 7, from: 8, outcome: "advisor" }, [6, 9]), { ok: false, error: "They do not head this department now." });
  assert.equal(changeHead({ to: 9, from: 6, outcome: "advisor" }, [6, 9]).ok, false, "the other head heads it already");
  assert.equal(changeHead({ to: 7, from: 6, outcome: "advisor" }, []).ok, false, "no head to replace");
});

test("New department and Edit department send no kind, and a kind sent anyway is not kept (issue #856)", () => {
  const created = checkDepartmentCreate({ name: "Propulsion", code: "PR", kind: "operations", heads: [1] });
  assert.ok(created.ok);
  assert.equal("kind" in created.value, false);
  assert.equal("kind" in (create(created.value) as { value: object }).value, false);
  const saved = checkDepartmentSave({ name: "Aerodynamics", code: "AE", head: null, kind: "operations" });
  assert.ok(saved.ok);
  assert.equal("kind" in saved.value, false);
  const planned = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: saved.value });
  assert.ok(planned.ok && !("kind" in planned.value));
});
