import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDepartmentClose,
  checkDepartmentCreate,
  checkDepartmentSave,
  departmentCodeError,
  planDepartmentClose,
  planDepartmentCreate,
  planDepartmentSave,
  type DepartmentClose,
  type DepartmentCreate,
} from "./department-edit";
import type { ClosingHeadOutcome, HandOverOutcome } from "./hand-over";
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
  { id: 6, name: "Chiara Rinaldi", emails: ["chiara@prt.it"], memberships: membershipsOf([]), beyond: [{ kind: "head", departmentId: 1 }] },
  { id: 7, name: "Alessandro Greco", emails: ["alessandro@prt.it"], memberships: membershipsOf([]), beyond: [{ kind: "team-leader" }] },
];

const fullAccess: TeamActor = { kind: "team" };
const head: TeamActor = { kind: "head", departmentIds: [1] };
const lead: TeamActor = { kind: "lead", divisionIds: [1] };
const propulsion: DepartmentCreate = { name: "Propulsion", code: "PR", heads: [1], kind: "technical" };

const create = (save: Partial<DepartmentCreate>, actor: TeamActor | null = fullAccess) => planDepartmentCreate({ actor, org, save: { ...propulsion, ...save }, team });

test("only the team leader or full access creates, edits or closes a department; a head and a lead never do", () => {
  assert.ok(create({}).ok);
  for (const actor of [head, lead, null]) {
    assert.equal(create({}, actor).ok, false, JSON.stringify(actor));
    assert.equal(planDepartmentSave({ actor, org, departmentId: 1, team, headIds: [6], save: { name: "Aero", code: "AE", head: null, kind: "technical" } }).ok, false);
    assert.equal(planDepartmentClose({ actor, org, departmentId: 1, close: { divisions: [], head: "leave" }, inIt: {}, headIds: [6] }).ok, false);
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
  const typed = checkDepartmentCreate({ name: "Propulsion Department", code: " pr ", kind: "technical", heads: [1] });
  assert.ok(typed.ok);
  assert.deepEqual(create(typed.value), { ok: true, value: { name: "Propulsion", code: "PR", kind: "technical", headId: 1 } }, "stored without 'Department', code in capitals");
  assert.equal(checkDepartmentCreate({ name: "Propulsion", code: "PR", kind: "technical" }).ok, false, "no head list at all is refused in its shape");
});

test("a head is someone with no seat yet: another department's head or the team leader stays where they are", () => {
  assert.deepEqual(create({ heads: [6] }), { ok: false, error: "Chiara Rinaldi is already Head of Aerodynamics." });
  assert.deepEqual(create({ heads: [7] }), { ok: false, error: "Alessandro Greco is already Team Leader." });
});

test("Edit department saves a new name or code under the same rules, for an open department", () => {
  const renamed = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: { name: "Aerodynamics and Flight", code: "AF", head: null, kind: "technical" } });
  assert.deepEqual(renamed, { ok: true, value: { name: "Aerodynamics and Flight", code: "AF", kind: "technical", nameChanged: true, codeChanged: true, head: null } });
  const same = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: { name: "Aerodynamics", code: "AE", head: null, kind: "technical" } });
  assert.ok(same.ok && !same.value.nameChanged && !same.value.codeChanged, "its own code stays allowed");
  assert.equal(planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: { name: "Aerodynamics", code: "ST", head: null, kind: "technical" } }).ok, false);
  assert.deepEqual(planDepartmentSave({ actor: fullAccess, org, departmentId: 9, team, headIds: [], save: { name: "Gone", code: "GN", head: null, kind: "technical" } }), { ok: false, error: "That department is closed." });
  assert.equal(departmentCodeError("AE", org.departments, 1), null);
});

const close = (divisions: DepartmentClose["divisions"], inIt: Record<number, number> = { 1: 6, 2: 0 }, head: ClosingHeadOutcome | null = "leave") =>
  planDepartmentClose({ actor: fullAccess, org, departmentId: 1, close: { divisions, head }, inIt, headIds: [6] });

test("Close department needs a choice for every open division before it closes anything", () => {
  assert.deepEqual(close([{ divisionId: 1, action: "move", to: 2 }]), { ok: false, error: "Choose what happens to Optimization and Analysis." });
  assert.deepEqual(close([]), { ok: false, error: "Choose what happens to Mission Analysis." });
  assert.equal(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 1, action: "close" }, { divisionId: 2, action: "close" }]).ok, false, "listed twice");
  assert.equal(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "close" }, { divisionId: 3, action: "close" }]).ok, false, "another department's division");
  const empty: OrgChart = { ...org, departments: [...org.departments, { id: 3, name: "Recovery", code: "RC", kind: "technical" }] };
  assert.ok(planDepartmentClose({ actor: fullAccess, org: empty, departmentId: 3, close: { divisions: [], head: null }, inIt: {}, headIds: [] }).ok, "a department with no division and no head closes at once");
});

test("a division moves only to another open department, and closes only when nobody is in it", () => {
  assert.deepEqual(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "close" }]), { ok: true, value: { move: [{ divisionId: 1, to: 2 }], close: [2], head: { steppingDown: { kind: "leave" }, personIds: [6] } } });
  assert.deepEqual(close([{ divisionId: 1, action: "close" }, { divisionId: 2, action: "close" }]), { ok: false, error: "People are still in Mission Analysis, so it can only move." });
  assert.deepEqual(close([{ divisionId: 1, action: "close" }, { divisionId: 2, action: "close" }], { 1: 0, 2: 1 }), { ok: false, error: "People are still in Optimization and Analysis, so it can only move." }, "someone waiting for their NDA counts");
  assert.equal(close([{ divisionId: 1, action: "move", to: 1 }, { divisionId: 2, action: "close" }]).ok, false, "not to the department that closes");
  assert.equal(close([{ divisionId: 1, action: "move", to: 9 }, { divisionId: 2, action: "close" }]).ok, false, "not to a closed department");
  assert.ok(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "move", to: 2 }]).ok, "an empty division may move too");
  assert.equal(checkDepartmentClose({ divisions: [{ divisionId: 1, action: "reopen" }] }).ok, false, "only move or close");
});

test("Close department needs a head outcome while the department has a head, and the server refuses a request without one", () => {
  const fates: DepartmentClose["divisions"] = [{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "close" }];
  assert.deepEqual(close(fates, undefined, null), { ok: false, error: "Choose what happens to the head: Leave the team." });
  const sent = checkDepartmentClose({ divisions: fates });
  assert.ok(sent.ok && sent.value.head === null, "a request with no head field reads as nothing picked");
  assert.equal(planDepartmentClose({ actor: fullAccess, org, departmentId: 1, close: sent.value, inIt: { 1: 6, 2: 0 }, headIds: [6] }).ok, false);
  assert.equal(checkDepartmentClose({ divisions: fates, head: "member" }).ok, false, "never a member");
});

test("Close department offers its head only Leave the team: no unit is left to stay in as an advisor (#441)", () => {
  const fates: DepartmentClose["divisions"] = [{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "close" }];
  assert.equal(checkDepartmentClose({ divisions: fates, head: "advisor" }).ok, false, "no Advisor role in no department and no division");
  const sent = checkDepartmentClose({ divisions: fates, head: "leave" });
  assert.ok(sent.ok);
  const planned = planDepartmentClose({ actor: fullAccess, org, departmentId: 1, close: sent.value, inIt: { 1: 6, 2: 0 }, headIds: [6] });
  assert.ok(planned.ok);
  assert.deepEqual(planned.value.head, { steppingDown: { kind: "leave" }, personIds: [6] }, "the one rule (`steppingDown`) moves them to Alumni");
});

// Change head (issue #253, board 77e): handing the head role over.

const changeHead = (head: { to: number; outcome: HandOverOutcome | null } | null, headIds: readonly number[] = [6], actor: TeamActor | null = fullAccess) =>
  planDepartmentSave({ actor, org, departmentId: 1, team, headIds, save: { name: "Aerodynamics", code: "AE", head, kind: "technical" } });

test("Change head: the replaced head becomes an advisor in the department or leaves the team; nothing leaves them as a member", () => {
  assert.deepEqual(changeHead({ to: 1, outcome: "advisor" }), {
    ok: true,
    value: {
      name: "Aerodynamics",
      code: "AE",
      kind: "technical",
      nameChanged: false,
      codeChanged: false,
      head: { to: 1, from: [6], steppingDown: { kind: "advisor", place: { kind: "department", departmentId: 1 }, access: "ends" } },
    },
  });
  const leaves = changeHead({ to: 1, outcome: "leave" });
  assert.ok(leaves.ok);
  assert.deepEqual(leaves.value.head?.steppingDown, { kind: "leave" });
  assert.deepEqual(changeHead({ to: 1, outcome: null }), { ok: false, error: "Choose what happens to the head: Become an advisor or Leave the team." });
  assert.equal(checkDepartmentSave({ name: "Aerodynamics", code: "AE", kind: "technical", head: { to: 1, outcome: "member" } }).ok, false, "only advisor or leave");
});

test("Change head picks someone on the team with no seat; a department with no head needs no outcome", () => {
  assert.deepEqual(changeHead({ to: 6, outcome: "advisor" }), { ok: false, error: "Chiara Rinaldi already heads this department." });
  assert.deepEqual(changeHead({ to: 7, outcome: "advisor" }), { ok: false, error: "Alessandro Greco is already Team Leader." });
  assert.deepEqual(changeHead({ to: 99, outcome: "advisor" }), { ok: false, error: "They are not on the team." });
  const first = changeHead({ to: 1, outcome: null }, []);
  assert.ok(first.ok);
  assert.deepEqual(first.value.head, { to: 1, from: [], steppingDown: null });
  for (const actor of [head, lead, null]) assert.equal(changeHead({ to: 1, outcome: "advisor" }, [6], actor).ok, false, "only the team leader and full access");
  const sent = checkDepartmentSave({ name: "Aerodynamics", code: "AE", kind: "technical" });
  assert.ok(sent.ok && sent.value.head === null, "a save with no head field changes no head");
});

test("New department and Edit department carry the kind the team leader picked; a missing or unknown kind is refused (issue #325)", () => {
  const created = create({ kind: "operations" });
  assert.ok(created.ok && created.value.kind === "operations");
  const saved = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, team, headIds: [6], save: { name: "Aerodynamics", code: "AE", head: null, kind: "operations" } });
  assert.ok(saved.ok && saved.value.kind === "operations");
  assert.equal(checkDepartmentCreate({ name: "Propulsion", code: "PR", kind: "outreach", heads: [1] }).ok, false);
  assert.equal(checkDepartmentSave({ name: "Aerodynamics", code: "AE", head: null }).ok, false);
});
