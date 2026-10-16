import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_MEMBER_DETAILS } from "./details";
import type { PersonRecord } from "./division-members";
import { membershipsOf, type OrgChart, type RoleBeyondDivisions, type TeamActor } from "./team";
import { editableDivisionIds, showsTreeEdit, teamStructure } from "./team-structure";

// The Team tree's edit view (#251, boards 77b and 66t-b): who gets pencils and
// Add buttons where. Aerodynamics holds Mission Analysis (1) and Optimization
// (2); Structures holds Design & Manufacturing (3) and Manufacturing (4).
const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", code: "AE" },
    { id: 2, name: "Structures", code: "ST" },
  ],
  divisions: [
    { id: 1, name: "Mission Analysis Division", departmentId: 1, code: "MA" },
    { id: 2, name: "Optimization and Analysis Division", departmentId: 1, code: "OA" },
    { id: 3, name: "Design & Manufacturing Division", departmentId: 2, code: "DM" },
    { id: 4, name: "Manufacturing Division", departmentId: 2, code: "MF" },
  ],
};

function record(id: number, name: string, list: [number, "lead" | "member"][], beyond: RoleBeyondDivisions[] = []): PersonRecord {
  return {
    id,
    name,
    signInEmail: `${id}@prt.it`,
    photoUrl: null,
    since: 2024,
    memberships: membershipsOf(list.map(([divisionId, role]) => ({ divisionId, role, since: "2024-10-01" }))),
    beyondDivisions: beyond,
    titles: {},
    details: NO_MEMBER_DETAILS,
    nda: null,
  };
}

const records = [
  record(1, "Matteo Rinaldi", [], [{ kind: "team-leader" }]),
  record(2, "Chiara Ferri", [[1, "member"]], [{ kind: "head", departmentId: 1 }]),
  record(3, "Marco Bianchi", [[1, "lead"]]),
  record(4, "Sara Conti", [[1, "member"], [3, "member"]]),
  record(5, "Paolo Conti", [[2, "lead"]]),
  record(6, "Andrea Bassi", [[4, "lead"]]),
];

const build = (actor: TeamActor | null) =>
  teamStructure({ records, org, actor, selfId: null, seat: null, waiting: { 1: [{ joinId: 9, email: "new@x.it", name: null, title: null, details: NO_MEMBER_DETAILS }] }, joining: {}, openPositions: { 1: 2 } });

test("the team leader and full access edit every department and division, and add departments (board 77b)", () => {
  const structure = build({ kind: "team" })!;
  assert.equal(structure.departmentsEditable, true);
  assert.equal(structure.leader?.name, "Matteo Rinaldi");
  assert.ok(structure.departments.every((d) => d.divisionsEditable && d.divisions.every((v) => v.page !== null)));
  assert.deepEqual(editableDivisionIds({ kind: "team" }, org), [1, 2, 3, 4]);
});

test("a head edits only their own department's divisions, and no department (board 66t-b)", () => {
  const structure = build({ kind: "head", departmentIds: [1] })!;
  assert.equal(structure.departmentsEditable, false);
  const [aero, structures] = structure.departments;
  assert.equal(aero.divisionsEditable, true);
  assert.ok(aero.divisions.every((v) => v.page !== null));
  assert.equal(structures.divisionsEditable, false);
  assert.ok(structures.divisions.every((v) => v.page === null), "other departments are read-only");
  assert.deepEqual(editableDivisionIds({ kind: "head", departmentIds: [1] }, org), [1, 2]);
});

test("a division lead and anyone else edit no structure, and get no Edit button", () => {
  assert.equal(build({ kind: "lead", divisionIds: [1] }), null);
  assert.equal(build(null), null);
  assert.deepEqual(editableDivisionIds({ kind: "lead", divisionIds: [1] }, org), []);
  assert.equal(showsTreeEdit({ kind: "division-lead", siteContent: false }), false);
  assert.equal(showsTreeEdit({ kind: "member", siteContent: false }), false);
  assert.equal(showsTreeEdit({ kind: "department-head", siteContent: false }), true);
  assert.equal(showsTreeEdit({ kind: "operations-lead", seat: "team-leader", siteContent: false }), true);
});

test("each box counts its people once: the head and someone in two divisions count once in a department", () => {
  const [aero, structures] = build({ kind: "team" })!.departments;
  assert.equal(aero.head?.name, "Chiara Ferri");
  assert.deepEqual(aero.head?.divisions, ["Mission Analysis"]);
  assert.equal(aero.size, 1 + 3, "Chiara, then Marco, Sara and Paolo");
  const mission = aero.divisions[0];
  assert.deepEqual([mission.lead?.name, mission.size, mission.openPositions], ["Marco Bianchi", 3, 2]);
  assert.deepEqual(mission.page?.waiting.map((w) => w.email), ["new@x.it"], "Close division reads who waits for their NDA");
  assert.equal(structures.head, null);
  assert.equal(structures.size, 2);
});
