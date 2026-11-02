import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTeamTree, type OrgChart } from "./team";
import { rosterOf, type TeamSnapshot } from "./team-snapshot";
import { boxOf, layoutTeamTree } from "./tree-layout";

// One person on several seat and head cards (issue #929): the tree is built
// from the team's role rows through `rosterOf`, as the dashboard builds it,
// so every seat and headship a person holds reaches the tree, not only their
// highest-ranked one.

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Operations", kind: "operations" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 20, name: "Safety Division", departmentId: 2 },
  ],
};

const LEADER = 1;
/** The Project Manager and the Chief Engineer, the Chief Engineer's only holder. */
const TWO_SEATS = 2;
/** The Safety Officer seat's only holder and Aerodynamics' only head, who also leads Mission Analysis. */
const SEAT_AND_HEAD = 3;

type Role = TeamSnapshot["roles"][number];
type Person = TeamSnapshot["people"][number];

let rowId = 0;
function role(memberId: number, r: Partial<Omit<Role, "id" | "member_id">>): Role {
  return { id: ++rowId, member_id: memberId, type: "core", title: "", started_at: "2025-10-01", leaved_at: null, dept_id: null, division_id: null, full_access: null, ...r };
}

function person(memberId: number, firstName: string): Person {
  return {
    member_id: memberId,
    user_id: `user-${memberId}`,
    first_name: firstName,
    last_name: "Rossi",
    email: `${memberId}@team.test`,
    program: null,
    level_of_study: null,
    team_from: null,
    team_to: null,
    joined_team_on: null,
    phone: null,
    mobile_number: null,
    discord: null,
    prt_email: null,
    linkedin: null,
    polito_id: null,
    country: null,
    date_of_birth: null,
    gender: null,
    picture: null,
    nda_signed_at: null,
    nda_confirmed_by: null,
    nda_confirmed_by_acting_account: null,
  };
}

const snapshot: TeamSnapshot = {
  org,
  roles: [
    role(LEADER, { type: "president", title: "Team Leader" }),
    // The team leader also heads Operations, its only head.
    role(LEADER, { type: "head", title: "Head of Operations", dept_id: 2 }),
    role(TWO_SEATS, { title: "Project Manager", full_access: "project_manager" }),
    role(TWO_SEATS, { title: "Chief Engineer", full_access: "chief_engineer", started_at: "2026-01-15" }),
    role(SEAT_AND_HEAD, { title: "Safety Officer" }),
    role(SEAT_AND_HEAD, { type: "head", title: "Head of Aerodynamics", dept_id: 1 }),
    role(SEAT_AND_HEAD, { type: "lead", division_id: 10 }),
    role(4, { division_id: 10 }),
    role(5, { division_id: 20 }),
  ],
  people: [person(LEADER, "Lia"), person(TWO_SEATS, "Pia"), person(SEAT_AND_HEAD, "Ugo"), person(4, "Eva"), person(5, "Leo")],
  scopes: [],
};

const tree = (selfId: number | null) => buildTeamTree(rosterOf(snapshot), org, "2026–27", selfId);
const ids = (people: readonly { readonly id: number }[]) => people.map((p) => p.id);
const seat = (title: string) => tree(null).board.find((s) => s.title === title);
const heads = (departmentId: number) => tree(null).departments.find((d) => d.id === departmentId)?.heads;

test("someone holding two team-level seats is a holder on both seat cards, the second one theirs alone (#929)", () => {
  assert.deepEqual(tree(null).board.map((s) => [s.title, ids(s.holders)]), [
    ["Project Manager", [TWO_SEATS]],
    ["Chief Engineer", [TWO_SEATS]],
    ["Safety Officer", [SEAT_AND_HEAD]],
  ]);
});

test("someone holding a seat and a headship is on the seat card and the department's head card (#929)", () => {
  assert.deepEqual(ids(seat("Safety Officer")!.holders), [SEAT_AND_HEAD]);
  assert.deepEqual(heads(1)?.map((h) => [h.id, h.title]), [[SEAT_AND_HEAD, "Head of Aerodynamics"]]);
});

test("the team leader who also heads a department is on the leader card and its head card (#929)", () => {
  assert.deepEqual(ids(tree(null).leaders), [LEADER]);
  assert.deepEqual(heads(2)?.map((h) => [h.id, h.title]), [[LEADER, "Head of Operations"]]);
});

test("Find someone, Show me and the path stay on the person's first place, their highest-ranked role (#929)", () => {
  const firstPlaces = (selfId: number) => {
    const built = tree(selfId);
    const all = [...built.leaders, ...built.board.flatMap((s) => s.holders), ...built.departments.flatMap((d) => d.heads)];
    return { first: all.filter((p) => p.id === selfId && p.first).length, path: built.path };
  };
  assert.deepEqual(firstPlaces(LEADER), { first: 1, path: [{ kind: "leader" }] });
  assert.deepEqual(firstPlaces(TWO_SEATS), { first: 1, path: [{ kind: "board" }] });
  assert.deepEqual(firstPlaces(SEAT_AND_HEAD), { first: 1, path: [{ kind: "board" }, { kind: "division", departmentId: 1, divisionId: 10 }] });

  const layout = layoutTeamTree(tree(TWO_SEATS));
  assert.equal(boxOf(layout, TWO_SEATS), layout.nodes.find((n) => n.key === "board-flag:project-manager"));
  assert.deepEqual(layout.nodes.filter((n) => n.onPath).map((n) => n.key), ["leader-1", "board-flag:project-manager"]);
  assert.equal(new Set(layout.nodes.map((n) => n.key)).size, layout.nodes.length, "one person on two seat cards gives two keys");
});

test("department and team sizes count each person once (#929)", () => {
  const built = tree(null);
  assert.equal(built.size, 5);
  // Ugo heads Aerodynamics and leads Mission Analysis; Eva is in Mission Analysis.
  assert.deepEqual(built.departments.map((d) => [d.id, d.size]), [[1, 2], [2, 2]]);
});
