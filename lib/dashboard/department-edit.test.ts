import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkDepartmentClose,
  checkDepartmentCreate,
  departmentCodeError,
  planDepartmentClose,
  planDepartmentCreate,
  planDepartmentSave,
  type DepartmentClose,
  type DepartmentCreate,
} from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { membershipsOf, type OrgChart, type TeamActor } from "./team";

// The department rules of #251 (boards 77d to 77f), as the server runs them on
// both data sources.

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", code: "AE" },
    { id: 2, name: "Structures", code: "ST" },
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
const propulsion: DepartmentCreate = { name: "Propulsion", code: "PR", heads: [1] };

const create = (save: Partial<DepartmentCreate>, actor: TeamActor | null = fullAccess) => planDepartmentCreate({ actor, org, save: { ...propulsion, ...save }, team });

test("only the team leader or full access creates, edits or closes a department; a head and a lead never do", () => {
  assert.ok(create({}).ok);
  for (const actor of [head, lead, null]) {
    assert.equal(create({}, actor).ok, false, JSON.stringify(actor));
    assert.equal(planDepartmentSave({ actor, org, departmentId: 1, save: { name: "Aero", code: "AE" } }).ok, false);
    assert.equal(planDepartmentClose({ actor, org, departmentId: 1, close: { divisions: [] }, inIt: {} }).ok, false);
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

test("a head is someone with no seat yet: another department's head or the team leader stays where they are", () => {
  assert.deepEqual(create({ heads: [6] }), { ok: false, error: "Chiara Rinaldi is already Head of Aerodynamics." });
  assert.deepEqual(create({ heads: [7] }), { ok: false, error: "Alessandro Greco is already Team Leader." });
});

test("Edit department saves a new name or code under the same rules, for an open department", () => {
  const renamed = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, save: { name: "Aerodynamics and Flight", code: "AF" } });
  assert.deepEqual(renamed, { ok: true, value: { name: "Aerodynamics and Flight", code: "AF", nameChanged: true, codeChanged: true } });
  const same = planDepartmentSave({ actor: fullAccess, org, departmentId: 1, save: { name: "Aerodynamics", code: "AE" } });
  assert.ok(same.ok && !same.value.nameChanged && !same.value.codeChanged, "its own code stays allowed");
  assert.equal(planDepartmentSave({ actor: fullAccess, org, departmentId: 1, save: { name: "Aerodynamics", code: "ST" } }).ok, false);
  assert.deepEqual(planDepartmentSave({ actor: fullAccess, org, departmentId: 9, save: { name: "Gone", code: "GN" } }), { ok: false, error: "That department is closed." });
  assert.equal(departmentCodeError("AE", org.departments, 1), null);
});

const close = (divisions: DepartmentClose["divisions"], inIt: Record<number, number> = { 1: 6, 2: 0 }) =>
  planDepartmentClose({ actor: fullAccess, org, departmentId: 1, close: { divisions }, inIt });

test("Close department needs a choice for every open division before it closes anything", () => {
  assert.deepEqual(close([{ divisionId: 1, action: "move", to: 2 }]), { ok: false, error: "Choose what happens to Optimization and Analysis." });
  assert.deepEqual(close([]), { ok: false, error: "Choose what happens to Mission Analysis." });
  assert.equal(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 1, action: "close" }, { divisionId: 2, action: "close" }]).ok, false, "listed twice");
  assert.equal(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "close" }, { divisionId: 3, action: "close" }]).ok, false, "another department's division");
  const empty: OrgChart = { ...org, departments: [...org.departments, { id: 3, name: "Recovery", code: "RC" }] };
  assert.ok(planDepartmentClose({ actor: fullAccess, org: empty, departmentId: 3, close: { divisions: [] }, inIt: {} }).ok, "a department with no division closes at once");
});

test("a division moves only to another open department, and closes only when nobody is in it", () => {
  assert.deepEqual(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "close" }]), { ok: true, value: { move: [{ divisionId: 1, to: 2 }], close: [2] } });
  assert.deepEqual(close([{ divisionId: 1, action: "close" }, { divisionId: 2, action: "close" }]), { ok: false, error: "People are still in Mission Analysis, so it can only move." });
  assert.deepEqual(close([{ divisionId: 1, action: "close" }, { divisionId: 2, action: "close" }], { 1: 0, 2: 1 }), { ok: false, error: "People are still in Optimization and Analysis, so it can only move." }, "someone waiting for their NDA counts");
  assert.equal(close([{ divisionId: 1, action: "move", to: 1 }, { divisionId: 2, action: "close" }]).ok, false, "not to the department that closes");
  assert.equal(close([{ divisionId: 1, action: "move", to: 9 }, { divisionId: 2, action: "close" }]).ok, false, "not to a closed department");
  assert.ok(close([{ divisionId: 1, action: "move", to: 2 }, { divisionId: 2, action: "move", to: 2 }]).ok, "an empty division may move too");
  assert.equal(checkDepartmentClose({ divisions: [{ divisionId: 1, action: "reopen" }] }).ok, false, "only move or close");
});
