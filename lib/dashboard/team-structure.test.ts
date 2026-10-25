import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_MEMBER_DETAILS } from "./details";
import { NO_NAME } from "./person-name";
import type { PersonRecord } from "./division-members";
import { membershipsOf, type OrgChart, type RoleBeyondDivisions, type TeamActor } from "./team";
import { editableDivisionIds, editViewIntro, showsTreeEdit, teamStructure } from "./team-structure";

// The Team tree's edit view (#251, boards 77b and 66t-b): who gets pencils and
// Add buttons where. Aerodynamics holds Mission Analysis (1) and Optimization
// (2); Structures holds Design & Manufacturing (3) and Manufacturing (4).
const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", code: "AE", kind: "technical" },
    { id: 2, name: "Structures", code: "ST", kind: "technical" },
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
    storedName: NO_NAME,
    signInEmail: `${id}@prt.it`,
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
  record(1, "Matteo Rinaldi", [], [{ kind: "team-leader", title: "" }]),
  record(2, "Chiara Ferri", [[1, "member"]], [{ kind: "head", departmentId: 1, title: "" }]),
  record(3, "Marco Bianchi", [[1, "lead"]]),
  record(4, "Sara Conti", [[1, "member"], [3, "member"]]),
  record(5, "Paolo Conti", [[2, "lead"]]),
  record(6, "Andrea Bassi", [[4, "lead"]]),
];

const build = (actor: TeamActor | null, selfId: number | null = null) =>
  teamStructure({ records, org, actor, selfId, seat: null, waiting: { 1: [{ joinId: 9, email: "new@x.it", correctsSignInEmail: false, name: null, title: null, details: NO_MEMBER_DETAILS }] }, joining: {}, openPositions: { 1: 2 } });

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

test("a division lead edits only the divisions they lead: a pencil there, and no Add division, department pencil or Add department (#594)", () => {
  const lead: TeamActor = { kind: "lead", divisionIds: [1], ledDivisionIds: [1] };
  const structure = build(lead, 3)!;
  assert.ok(structure !== null, "the edit view opens for a lead");
  assert.equal(structure.departmentsEditable, false, "no department pencil and no Add department");
  assert.ok(structure.departments.every((d) => !d.divisionsEditable && d.closing.length === 0), "no Add division and no Close division");
  const pencils = structure.departments.flatMap((d) => d.divisions).filter((v) => v.page !== null);
  assert.deepEqual(pencils.map((v) => v.id), [1]);
  assert.deepEqual(editableDivisionIds(lead, org), [1]);
  assert.equal(editViewIntro(structure), "You can edit Mission Analysis Division. Ask your department head to add or close a division.");
});

test("a lead of two divisions edits both, and the intro names them; a lead's right never comes from a grant alone (#594)", () => {
  const twoLed: TeamActor = { kind: "lead", divisionIds: [1, 3], ledDivisionIds: [1, 3] };
  const structure = build(twoLed)!;
  assert.deepEqual(structure.departments.flatMap((d) => d.divisions).filter((v) => v.page !== null).map((v) => v.id), [1, 3]);
  assert.equal(editViewIntro(structure), "You can edit Mission Analysis Division and Design & Manufacturing Division. Ask your department head to add or close a division.");
  // A Members (Can edit) grant on Optimization and on Manufacturing: they reach both, and lead only Mission Analysis.
  const granted: TeamActor = { kind: "lead", divisionIds: [1, 2, 4], ledDivisionIds: [1] };
  assert.deepEqual(editableDivisionIds(granted, org), [1]);
  const onlyGrant: TeamActor = { kind: "lead", divisionIds: [2], ledDivisionIds: [] };
  assert.equal(build(onlyGrant), null, "a grant alone opens no edit view");
  assert.deepEqual(editableDivisionIds(onlyGrant, org), []);
});

test("who gets the Team tree's Edit button: full access, a head and a division lead; a member gets none (#594)", () => {
  assert.equal(build(null), null);
  assert.equal(showsTreeEdit({ kind: "division-lead", siteContent: false, approveOrders: false }), true);
  assert.equal(showsTreeEdit({ kind: "member", grantedAreas: [], siteContent: false, approveOrders: false }), false);
  assert.equal(showsTreeEdit({ kind: "department-head", siteContent: false, approveOrders: false }), true);
  assert.equal(showsTreeEdit({ kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false }), true);
});

test("the intro line says what the viewer may change: the whole tree, a head's departments", () => {
  assert.equal(editViewIntro(build({ kind: "team" })!), "Click a box to change who holds a seat, rename a unit, change its head or lead, or close it.");
  assert.equal(editViewIntro(build({ kind: "head", departmentIds: [1] })!), "You can edit the divisions of Aerodynamics. Ask the team leader to change a department or a seat.");
});

test("only the viewer's own boxes are marked theirs: the leader's for the leader, a head's department, a lead's division (#405)", () => {
  const yours = (selfId: number | null) => {
    const s = build({ kind: "team" }, selfId)!;
    const divisions = s.departments.flatMap((d) => d.divisions);
    return {
      leader: s.leader?.yours,
      departments: s.departments.filter((d) => d.yours).map((d) => d.id),
      divisions: divisions.filter((v) => v.yours).map((v) => v.id),
    };
  };
  assert.deepEqual(yours(1), { leader: true, departments: [], divisions: [] });
  assert.deepEqual(yours(2), { leader: false, departments: [1], divisions: [] }, "a head's own department, never the leader box");
  assert.deepEqual(yours(5), { leader: false, departments: [], divisions: [2] }, "a lead's own division only");
  assert.deepEqual(yours(null), { leader: false, departments: [], divisions: [] });
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

test("each box carries its person's stored photo: the leader, a seat holder, a head and a lead; null where none is stored (issue #622)", () => {
  const photo = (id: number) => `https://blob.example/members/${id}.jpg`;
  const holder = record(7, "Luca Moretti", [], [{ kind: "board", seat: { roleId: 70, title: "", flag: "chief-engineer", since: "2024-10-01" } }]);
  const pictured = [...records, holder].map((r) => (r.id === 6 ? r : { ...r, photoUrl: photo(r.id) }));
  const structure = teamStructure({ records: pictured, org, actor: { kind: "team" }, selfId: null, seat: null, waiting: {}, joining: {}, openPositions: {} })!;
  const [aero, structures] = structure.departments;
  assert.equal(structure.leader?.photoUrl, photo(1));
  assert.deepEqual(
    structure.board.map((s) => [s.holder.id, s.holder.photoUrl]),
    [[7, photo(7)]],
  );
  assert.equal(aero.head?.photoUrl, photo(2));
  assert.deepEqual(
    aero.divisions.map((v) => v.lead?.photoUrl),
    [photo(3), photo(5)],
  );
  const manufacturing = structures.divisions.find((v) => v.id === 4);
  assert.deepEqual([manufacturing?.lead?.id, manufacturing?.lead?.photoUrl], [6, null], "a lead with no stored photo carries null");
});
