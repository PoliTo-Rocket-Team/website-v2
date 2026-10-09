import assert from "node:assert/strict";
import { test } from "node:test";
import { boardSeatOf, buildTeamTree, type OrgChart, type RosterEntry } from "./team";
import { boxOf, layoutTeamTree } from "./tree-layout";

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics" },
    { id: 2, name: "Operations" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 11, name: "Optimization and Analysis Division", departmentId: 1 },
    { id: 20, name: "Safety Division", departmentId: 2 },
  ],
};

function person(id: number, name: string, placement: RosterEntry["placement"]): RosterEntry {
  return { id, name, email: `${id}@prt.it`, placement, pageTitle: null, joined: 2024, program: null, study: null, access: [] };
}

const roster: RosterEntry[] = [
  person(1, "Alessandro Greco", { role: "team-leader" }),
  person(2, "Federica Moretti", { role: "board", seat: "chief-engineer" }),
  person(3, "Lorenzo Gallo", { role: "board", seat: "project-manager" }),
  person(4, "Chiara Rinaldi", { role: "head", departmentId: 1 }),
  person(5, "Marco Bianchi", { role: "division-lead", divisionId: 10 }),
  person(6, "Elif Kaya", { role: "member", divisionId: 10 }),
  person(7, "Sofia Neri", { role: "member", divisionId: 10 }),
  person(8, "Paolo Conti", { role: "division-lead", divisionId: 11 }),
  person(9, "Bruno Valli", { role: "division-lead", divisionId: 20 }),
];

test("a board seat is read off a role title, in any case and spacing", () => {
  assert.equal(boardSeatOf(" project  manager "), "project-manager");
  assert.equal(boardSeatOf("Chief Engineer"), "chief-engineer");
  assert.equal(boardSeatOf("Chief Engineer, Cavour"), null);
});

test("the board seats sit under the leader, Project Manager first", () => {
  const tree = buildTeamTree(roster, org, "2026–27", 6);
  assert.deepEqual(
    tree.board.map((b) => [b.seat, b.person.name]),
    [
      ["project-manager", "Lorenzo Gallo"],
      ["chief-engineer", "Federica Moretti"],
    ],
  );
  const layout = layoutTeamTree(tree);
  const [pm, ce] = [boxOf(layout, 3)!, boxOf(layout, 2)!];
  const leader = boxOf(layout, 1)!;
  assert.equal(pm.y, ce.y);
  assert.ok(pm.x < ce.x && pm.y > leader.y);
});

test("every person is drawn once, heads in one row over their leads", () => {
  const layout = layoutTeamTree(buildTeamTree(roster, org, "2026–27", 6));
  const ids = layout.nodes.flatMap((n) => (n.person ? [n.person.id] : []));
  assert.deepEqual([...ids].sort((a, b) => a - b), roster.map((p) => p.id));
  const head = boxOf(layout, 4)!;
  const lead = boxOf(layout, 5)!;
  const otherLead = boxOf(layout, 9)!;
  assert.ok(lead.y > head.y && otherLead.y === lead.y);
  assert.ok(boxOf(layout, 6)!.y > lead.y);
});

test("the viewer's path runs from the leader down to their row, and the canvas opens on their department", () => {
  const layout = layoutTeamTree(buildTeamTree(roster, org, "2026–27", 6));
  const onPath = layout.nodes.filter((n) => n.kind === "card" && n.onPath).map((n) => n.person?.name);
  assert.deepEqual(onPath, ["Alessandro Greco", "Chiara Rinaldi", "Marco Bianchi"]);
  const me = boxOf(layout, 6)!;
  const ends = layout.edges.filter((e) => e.onPath).map((e) => e.points[e.points.length - 1]);
  assert.ok(ends.some(([x, y]) => x === me.x && y === me.y + me.h / 2));
  const head = boxOf(layout, 4)!;
  assert.ok(layout.focus && layout.focus.x <= head.x && layout.focus.y === head.y);
  assert.ok(layout.focus.x + layout.focus.w < boxOf(layout, 9)!.x);
});
