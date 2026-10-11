import assert from "node:assert/strict";
import { test } from "node:test";
import { boardSeatOf, buildTeamTree, homeDivisionOf, inDivisions, type OrgChart, type RosterEntry } from "./team";
import { boxOf, layoutTeamTree, rowWidth } from "./tree-layout";

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

const lead = (divisionId: number) => inDivisions([{ divisionId, role: "lead", since: "2024-10-01" }]);
const member = (divisionId: number) => inDivisions([{ divisionId, role: "member", since: "2024-10-01" }]);

const roster: RosterEntry[] = [
  person(1, "Alessandro Greco", { role: "team-leader" }),
  person(2, "Federica Moretti", { role: "board", seat: "chief-engineer" }),
  person(3, "Lorenzo Gallo", { role: "board", seat: "project-manager" }),
  person(4, "Chiara Rinaldi", { role: "head", departmentId: 1 }),
  person(5, "Marco Bianchi", lead(10)),
  person(6, "Elif Kaya", member(10)),
  person(7, "Sofia Neri", member(10)),
  person(8, "Paolo Conti", lead(11)),
  person(9, "Bruno Valli", lead(20)),
];

/** Someone in two divisions: a member of Safety since 2024, then of Optimization and Analysis since 2025. */
const both = person(10, "Matteo Greco", inDivisions([
  { divisionId: 11, role: "member", since: "2025-10-01" },
  { divisionId: 20, role: "member", since: "2024-10-01" },
]));
/** A member of Mission Analysis since 2023 who leads Safety since 2025. */
const leadsOne = person(11, "Giada Rizzo", inDivisions([
  { divisionId: 10, role: "member", since: "2023-10-01" },
  { divisionId: 20, role: "lead", since: "2025-10-01" },
]));

test("someone in several divisions is drawn under the one they lead, else under their oldest", () => {
  assert.equal(homeDivisionOf(both.placement), 20, "the oldest membership: Safety, from 2024");
  assert.equal(homeDivisionOf(leadsOne.placement), 20, "the division they lead, though Mission Analysis is older");
  const tree = buildTeamTree([...roster.filter((p) => p.id !== 9), both, leadsOne], org, "2026–27", 6);
  const safety = tree.departments.flatMap((d) => d.divisions).find((v) => v.id === 20)!;
  assert.equal(safety.lead?.name, "Giada Rizzo");
  assert.deepEqual(safety.members.map((m) => m.name), ["Matteo Greco"]);
  const mission = tree.departments.flatMap((d) => d.divisions).find((v) => v.id === 10)!;
  assert.deepEqual(mission.elsewhere, [11]);
  assert.ok(!mission.members.some((m) => m.id === 11));
  assert.deepEqual(safety.members[0].also, [{ divisionId: 11, label: "Optimization and Analysis" }]);
});

test("a multi-division person is drawn once, with a dashed line from each other division to them (board 54e)", () => {
  const layout = layoutTeamTree(buildTeamTree([...roster, both], org, "2026–27", 6));
  assert.equal(layout.nodes.filter((n) => n.person?.id === 10).length, 1);
  assert.equal(layout.links.length, 1);
  const [link] = layout.links;
  assert.equal(link.divisionId, 11);
  const me = boxOf(layout, 10)!;
  const end = link.points[link.points.length - 1];
  // Nothing is drawn under Matteo's row, so the line comes straight up into its bottom.
  assert.deepEqual(end, [me.x + me.w / 2, me.y + me.h]);
  // It runs across under every card and row it passes.
  const across = link.points[1][1];
  assert.ok(layout.nodes.every((n) => n.x + n.w <= link.points[0][0] || n.x >= end[0] || n.y + n.h < across));
  assert.ok(layout.height > across);
  // Nobody in two divisions: no lines.
  assert.deepEqual(layoutTeamTree(buildTeamTree(roster, org, "2026–27", 6)).links, []);
});

test("a row's \"also\" tag gets room in the layout and never reaches the next column (board 54e)", () => {
  // In Mission Analysis since 2023 and Optimization and Analysis since 2025: drawn
  // under Mission Analysis, with Optimization and Analysis the column to its right.
  const tagged = person(12, "Anna Villa", inDivisions([
    { divisionId: 10, role: "member", since: "2023-10-01" },
    { divisionId: 11, role: "member", since: "2025-10-01" },
  ]));
  const plain = layoutTeamTree(buildTeamTree(roster, org, "2026–27", 6));
  const layout = layoutTeamTree(buildTeamTree([...roster, tagged], org, "2026–27", 6));
  const row = layout.nodes.find((n) => n.person?.id === 12)!;
  assert.equal(row.kind, "row");
  if (row.kind === "row") assert.ok(row.w >= rowWidth(row.person) && row.w > boxOf(plain, 6)!.w, "the tagged row is drawn wide enough for its tag");
  const nextLead = boxOf(layout, 8)!;
  assert.ok(row.x + row.w < nextLead.x, "it ends before the next division's column starts");
  // No card or row is drawn over another.
  for (const a of layout.nodes) {
    for (const b of layout.nodes) {
      if (a === b) continue;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      assert.ok(apart, `${a.key} overlaps ${b.key}`);
    }
  }
});

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
