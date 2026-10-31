import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTeamTree, homeDivisionOf, inDivisions, NO_MEMBERSHIPS, type BoardFlag, type OrgChart, type RosterEntry } from "./team";
import { boxOf, layoutTeamTree } from "./tree-layout";

const org: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Operations", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 11, name: "Optimization and Analysis Division", departmentId: 1 },
    { id: 20, name: "Safety Division", departmentId: 2 },
  ],
};

function person(id: number, name: string, placement: RosterEntry["placement"]): RosterEntry {
  return { id, name, email: `${id}@prt.it`, photoUrl: null, placement, pageTitle: null, joined: 2024, program: null, study: null, access: [] };
}

const lead = (divisionId: number) => inDivisions([{ divisionId, role: "lead", since: "2024-10-01" }]);
const member = (divisionId: number) => inDivisions([{ divisionId, role: "member", since: "2024-10-01" }]);
/** A team-level seat's placement, from its role row: flagged as `flag`, or a further seat (null). */
const seat = (roleId: number, title: string, flag: BoardFlag | null, since = "2024-10-01"): RosterEntry["placement"] => ({
  role: "board",
  seat: { roleId, title, fullAccess: flag, type: "core", since },
  memberships: NO_MEMBERSHIPS,
});
const head = (departmentId: number, title: string): RosterEntry["placement"] => ({ role: "head", departmentId, title, memberships: NO_MEMBERSHIPS });

const roster: RosterEntry[] = [
  person(1, "Alessandro Greco", { role: "team-leader", memberships: NO_MEMBERSHIPS }),
  person(2, "Federica Moretti", seat(28, "Chief Engineer", "chief-engineer")),
  person(3, "Lorenzo Gallo", seat(27, "Project Manager", "project-manager")),
  person(4, "Chiara Rinaldi", head(1, "Head of Aerodynamics")),
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

function assertApart(layout: ReturnType<typeof layoutTeamTree>) {
  for (const a of layout.nodes) {
    for (const b of layout.nodes) {
      if (a === b) continue;
      const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
      assert.ok(apart, `${a.key} overlaps ${b.key}`);
    }
  }
}

const divisionsOf = (tree: ReturnType<typeof buildTeamTree>) => tree.departments.flatMap((d) => d.divisions);

test("someone in several divisions is listed under each, with the role they hold there (#398)", () => {
  const tree = buildTeamTree([...roster.filter((p) => p.id !== 9), both, leadsOne], org, "2026–27", 6);
  const safety = divisionsOf(tree).find((v) => v.id === 20)!;
  assert.equal(safety.lead?.name, "Giada Rizzo");
  assert.deepEqual(safety.members.map((m) => m.name), ["Matteo Greco"]);
  const mission = divisionsOf(tree).find((v) => v.id === 10)!;
  assert.deepEqual(mission.members.map((m) => m.name), ["Elif Kaya", "Giada Rizzo", "Sofia Neri"], "a member here, by name, like anyone else");
  const optimization = divisionsOf(tree).find((v) => v.id === 11)!;
  assert.deepEqual(optimization.members.map((m) => m.name), ["Matteo Greco"]);
});

test("a seat holder or head who leads a division is that division's lead card too", () => {
  const leaderLeads = person(1, "Alessandro Greco", { role: "team-leader", memberships: inDivisions([{ divisionId: 20, role: "lead", since: "2025-10-01" }]).memberships });
  const tree = buildTeamTree([leaderLeads, ...roster.filter((p) => p.id !== 1 && p.id !== 9)], org, "2026–27", 6);
  const safety = divisionsOf(tree).find((v) => v.id === 20)!;
  assert.equal(safety.lead?.id, 1);
  assert.equal(safety.lead?.first, false, "their first place is the leader's seat");
  assert.equal(tree.leader?.first, true);
});

test("a multi-division person is drawn in every division, with distinct keys, and nothing overlaps", () => {
  const layout = layoutTeamTree(buildTeamTree([...roster, both, leadsOne], org, "2026–27", 6));
  const matteo = layout.nodes.filter((n) => n.person?.id === 10);
  assert.equal(matteo.length, 2);
  assert.equal(new Set(layout.nodes.map((n) => n.key)).size, layout.nodes.length, "every node key is distinct");
  assertApart(layout);
});

test("Find someone and Show me go to the first place: the highest role, then the earliest division", () => {
  assert.equal(homeDivisionOf(both.placement), 20, "the oldest membership: Safety, from 2024");
  assert.equal(homeDivisionOf(leadsOne.placement), 20, "the division they lead, though Mission Analysis is older");
  const layout = layoutTeamTree(buildTeamTree([...roster.filter((p) => p.id !== 9), both, leadsOne], org, "2026–27", 11));
  const rizzo = layout.nodes.filter((n) => n.person?.id === 11);
  assert.equal(rizzo.filter((n) => n.person?.first).length, 1, "one first place");
  const box = boxOf(layout, 11)!;
  const safetyLead = layout.nodes.find((n) => n.key === "lead-20")!;
  assert.deepEqual([box.x, box.y], [safetyLead.x, safetyLead.y], "her Safety lead card, not her Mission Analysis row");
  // Her path reaches both her places (#862): the Safety card she leads and her Mission Analysis row.
  assert.deepEqual(layout.nodes.filter((n) => n.person?.id === 11 && n.onPath).map((n) => n.key).sort(), ["lead-20", "row-10-11"]);
  const matteo = boxOf(layout, 10)!;
  const safetyRow = layout.nodes.find((n) => n.key === "row-20-10")!;
  assert.deepEqual([matteo.x, matteo.y], [safetyRow.x, safetyRow.y], "Matteo's Safety row, his oldest division");
});

test("a long name or subtitle wraps: its box grows and pushes the rows under it down (#398)", () => {
  const longName = "Maria Alessandra Benedetta Castelnuovo di Sant'Agata";
  const plain = layoutTeamTree(buildTeamTree(roster, org, "2026–27", 6));
  const long = layoutTeamTree(buildTeamTree(roster.map((p) => (p.id === 6 ? { ...p, name: longName } : p.id === 5 ? { ...p, name: longName } : p)), org, "2026–27", null));
  const plainRow = boxOf(plain, 6)!;
  const longRow = boxOf(long, 6)!;
  assert.ok(longRow.h > plainRow.h, "the member row is taller");
  assert.equal(longRow.w, plainRow.w, "and keeps the plain width");
  assert.ok(boxOf(long, 5)!.h > boxOf(plain, 5)!.h, "the lead card is taller");
  assert.ok(boxOf(long, 7)!.y > boxOf(plain, 7)!.y, "the rows under them move down");
  assertApart(long);
});

test("member rows take the plain width and each division column is the lead card's width", () => {
  const layout = layoutTeamTree(buildTeamTree([...roster, both, leadsOne], org, "2026–27", 6));
  const rows = layout.nodes.filter((n) => n.kind === "row");
  assert.ok(rows.every((r) => r.w === rows[0].w));
  const [mission, optimization] = [layout.nodes.find((n) => n.key === "lead-10")!, layout.nodes.find((n) => n.key === "lead-11")!];
  assert.equal(optimization.x - mission.x, mission.w + 12, "the next column starts one gap after the lead card");
});

test("the board seats sit under the leader, Project Manager first", () => {
  const tree = buildTeamTree(roster, org, "2026–27", 6);
  assert.deepEqual(
    tree.board.map((b) => [b.title, b.person.name]),
    [
      ["Project Manager", "Lorenzo Gallo"],
      ["Chief Engineer", "Federica Moretti"],
    ],
  );
  const layout = layoutTeamTree(tree);
  const [pm, ce] = [boxOf(layout, 3)!, boxOf(layout, 2)!];
  const leader = boxOf(layout, 1)!;
  assert.equal(pm.y, ce.y);
  assert.ok(pm.x < ce.x && pm.y > leader.y);
});

/** Each card's level, x and subtitle, by the person on it. */
const cards = (tree: ReturnType<typeof buildTeamTree>) =>
  new Map(layoutTeamTree(tree).nodes.flatMap((n) => (n.kind === "card" && n.person ? [[n.person.id, { level: n.level, x: n.x, subtitle: n.subtitle }] as const] : [])));

test("renaming the Project Manager's or Chief Engineer's title keeps them on the seat row, in the same place (issue #625)", () => {
  const renamed = roster.map((p) =>
    p.id === 2 ? { ...p, placement: seat(28, "Chief of Propulsion", "chief-engineer") } : p.id === 3 ? { ...p, placement: seat(27, "Programme Lead", "project-manager") } : p,
  );
  const [before, after] = [cards(buildTeamTree(roster, org, "2026–27", 6)), cards(buildTeamTree(renamed, org, "2026–27", 6))];
  for (const id of [2, 3]) {
    assert.equal(after.get(id)!.level, "board");
    assert.equal(after.get(id)!.x, before.get(id)!.x, `seat ${id} stays where it was`);
  }
  assert.deepEqual([after.get(3)!.subtitle, after.get(2)!.subtitle], ["Programme Lead", "Chief of Propulsion"]);
});

test("a further team-level seat sits on the seat row after the flagged seats, oldest first (issue #625)", () => {
  const more = [...roster, person(11, "Marco Dona", seat(11, "Head of R&D", null, "2025-10-01")), person(12, "Ada Ferri", seat(40, "Safety Officer", null, "2023-10-01"))];
  assert.deepEqual(
    buildTeamTree(more, org, "2026–27", 6).board.map((b) => [b.title, b.person.name]),
    [
      ["Project Manager", "Lorenzo Gallo"],
      ["Chief Engineer", "Federica Moretti"],
      ["Safety Officer", "Ada Ferri"],
      ["Head of R&D", "Marco Dona"],
    ],
  );
});

test("a head's card shows their stored title; a blank one reads Head of the department (issue #625)", () => {
  const renamed = roster.map((p) => (p.id === 4 ? { ...p, placement: head(1, "Chief of Aerodynamics") } : p));
  assert.equal(cards(buildTeamTree(renamed, org, "2026–27", 6)).get(4)!.subtitle, "Chief of Aerodynamics");
  assert.equal(buildTeamTree(renamed, org, "2026–27", 6).departments[0].head?.title, "Chief of Aerodynamics");
  const blank = roster.map((p) => (p.id === 4 ? { ...p, placement: head(1, " ") } : p));
  assert.equal(cards(buildTeamTree(blank, org, "2026–27", 6)).get(4)!.subtitle, "Head of Aerodynamics");
  assert.equal(cards(buildTeamTree(roster, org, "2026–27", 6)).get(4)!.subtitle, "Head of Aerodynamics", "today's stored title reads as before");
});

test("someone in one place is drawn once, heads in one row over their leads", () => {
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

test("the path of a viewer in three divisions across two departments reaches all three, and nothing else (#862)", () => {
  const three = person(12, "Nadia Russo", inDivisions([
    { divisionId: 11, role: "member", since: "2025-10-01" },
    { divisionId: 10, role: "member", since: "2024-10-01" },
    { divisionId: 20, role: "member", since: "2023-10-01" },
  ]));
  const tree = buildTeamTree([...roster, three], org, "2026–27", 12);
  assert.deepEqual(tree.path, [
    { kind: "division", departmentId: 2, divisionId: 20 },
    { kind: "division", departmentId: 1, divisionId: 10 },
    { kind: "division", departmentId: 1, divisionId: 11 },
  ], "her first place, Safety, first");
  const layout = layoutTeamTree(tree);
  const on = layout.nodes.filter((n) => n.onPath).map((n) => n.key).sort();
  assert.deepEqual(on, ["head-1", "head-2", "lead-10", "lead-11", "lead-20", "leader-1", "row-10-12", "row-11-12", "row-20-12"]);

  // Each accent line ends at a head, a lead card or one of her rows: the trunk to both heads, each head to her divisions, each lead to her row.
  const node = (key: string) => layout.nodes.find((n) => n.key === key)!;
  const top = (key: string) => [node(key).x + node(key).w / 2, node(key).y];
  const rowEnd = (key: string) => [node(key).x, node(key).y + node(key).h / 2];
  const ends = layout.edges.filter((e) => e.onPath).map((e) => [...e.points[e.points.length - 1]]);
  assert.deepEqual(
    ends.map(String).sort(),
    [top("head-1"), top("head-2"), top("lead-10"), top("lead-11"), top("lead-20"), rowEnd("row-10-12"), rowEnd("row-11-12"), rowEnd("row-20-12")].map(String).sort(),
  );

  // The canvas still opens on her first place's department, and Show me still goes to her Safety row.
  const safety = node("head-2");
  assert.ok(layout.focus && layout.focus.x <= safety.x && layout.focus.x + layout.focus.w >= safety.x + safety.w);
  assert.deepEqual(boxOf(layout, 12), node("row-20-12"));
});

test("a seat's path stops at the seat: the leader, a board seat and a head (#862)", () => {
  const onPath = (selfId: number) => layoutTeamTree(buildTeamTree(roster, org, "2026–27", selfId)).nodes.filter((n) => n.onPath).map((n) => n.key);
  assert.deepEqual(onPath(1), ["leader-1"]);
  assert.deepEqual(onPath(2), ["leader-1", "board-2"]);
  assert.deepEqual(onPath(4), ["leader-1", "head-1"]);
});

test("the team leader's canvas opens on the top of the tree down to its lowest row", () => {
  const layout = layoutTeamTree(buildTeamTree(roster, org, "2026–27", 1));
  const lowest = Math.max(...layout.nodes.map((n) => n.y + n.h));
  assert.ok(layout.focus && layout.focus.y === 0 && layout.focus.y + layout.focus.h >= lowest);
});
