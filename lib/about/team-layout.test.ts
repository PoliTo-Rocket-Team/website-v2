import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_DATA, publishedTeamPageLayerOf, teamRolesOf } from "@/db/seed/cases";
import { BOARD_FLAG_TITLES, BOARD_FLAGS, inDivisions, NO_MEMBERSHIPS, type BoardFlag, type Placement } from "@/lib/dashboard/team";
import { applyLayer, layerPhotos, NO_TEAM_LAYER, type TeamPageLayer } from "./team-layer";
import {
  layoutPageOf,
  layoutPhotos,
  parseTeamLayout,
  resolveLayout,
  snapshot,
  withoutGoneSeats,
  withTeamSeatMoved,
  type TeamLayout,
} from "./team-layout";
import type { TeamPerson } from "./team-person";
import { team } from "./team";
import { teamBuildOf, teamPageOf, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

// The Team page layout (issue #849): the snapshot of today's page draws the
// same seats, people follow the team record while the layout does not, a
// seat with no holder is left out in place, a gone seat is dropped, and the
// stored form round-trips.

const since = "2024-10-01";

function person(id: number, name: string, placement: Placement, over: Partial<TeamPerson> = {}): TeamPerson {
  return { id, name, placement, pageTitle: null, photo: null, linkedin: null, teamEmail: null, ...over };
}

const leader = (): Placement => ({ role: "team-leader", memberships: NO_MEMBERSHIPS });
const flagged = (flag: BoardFlag, roleId = BOARD_FLAGS.indexOf(flag) + 1): Placement => ({
  role: "board",
  seat: { roleId, title: BOARD_FLAG_TITLES[flag], flag, since },
  memberships: NO_MEMBERSHIPS,
});
const teamSeat = (roleId: number, title: string, from = "2024-11-01"): Placement => ({
  role: "board",
  seat: { roleId, title, flag: null, since: from },
  memberships: NO_MEMBERSHIPS,
});
const head = (departmentId: number, title = ""): Placement => ({ role: "head", departmentId, title, memberships: NO_MEMBERSHIPS });
const lead = (divisionId: number) => inDivisions([{ divisionId, role: "lead", since }]);
const member = (divisionId: number) => inDivisions([{ divisionId, role: "member", since }]);

const org: TeamRoles["org"] = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Recovery", kind: "technical" },
    { id: 3, name: "Logistics", kind: "operations" },
    { id: 4, name: "Research and Development", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 11, name: "Optimization Division", departmentId: 1 },
    { id: 20, name: "Parachutes Division", departmentId: 2 },
    { id: 30, name: "Procurement Division", departmentId: 3 },
    { id: 31, name: "Events Division", departmentId: 3 },
  ],
};

const people: readonly TeamPerson[] = [
  person(1, "Alessandro Greco", leader(), { pageTitle: "Team Leader", teamEmail: "president@politorocketteam.it" }),
  person(2, "Federica Moretti", flagged("chief-engineer")),
  person(3, "Lorenzo Gallo", flagged("project-manager"), { photo: "/team/lorenzo.jpg" }),
  person(12, "Giulia Fontana", teamSeat(27, "Chief of Safety")),
  person(4, "Chiara Rinaldi", head(1), { teamEmail: "chiara.rinaldi@politorocketteam.it" }),
  person(5, "Pietro Ricci", lead(10)),
  person(6, "Marco Bianchi", lead(11), { pageTitle: "Optimization Lead" }),
  person(7, "Irene Galli", head(2, "Head of Recovery Systems")),
  person(8, "Simone Testa", lead(20)),
  person(13, "Rocco Bellon", head(3)),
  person(14, "Elena Ferraro", lead(30)),
  person(15, "Davide Conti", lead(31)),
  person(16, "Luca Ferri", lead(31)),
  person(17, "Marco Dona", head(4)),
  person(9, "Sofia Neri", member(10), { linkedin: "linkedin.com/in/sofia-neri", teamEmail: "sofia.neri@politorocketteam.it" }),
  person(10, "Kenji Watanabe", member(11)),
  person(11, "Anna Villa", member(20)),
];

const roles = (list: readonly TeamPerson[] = people, chart: TeamRoles["org"] = org): TeamRoles => ({ org: chart, people: list });

/** `list` with `id` placed at `placement`. */
const moved = (list: readonly TeamPerson[], id: number, placement: Placement) => list.map((p) => (p.id === id ? { ...p, placement } : p));

const layer = (edits: Partial<TeamPageLayer>): TeamPageLayer => ({ ...NO_TEAM_LAYER, ...edits });

const ADDED_LEADERS: Partial<TeamPageLayer> = {
  addedLeaders: [
    { id: 1, person: 13, place: { after: "arc:project-manager:0" }, role: "Head of Operations" },
    { id: 2, person: 17, place: { at: "end" }, role: "Head of R&D" },
    { id: 3, person: 14, place: { at: "start" }, role: "Procurement", photo: "/team/elena.jpg" },
  ],
};

const ADDED_LEADS: Partial<TeamPageLayer> = {
  departments: {
    "1": { leadOrder: ["lead:11:0", "added:4", "lead:10:0"], addedLeads: [{ id: 4, person: 15, division: "Events", linkedin: "davide-c" }] },
    "2": { name: "Recovery and Landing" },
  },
};

const ADDED_DEPARTMENT: Partial<TeamPageLayer> = {
  addedDepartments: [
    {
      id: 5,
      name: "Outreach",
      head: { person: 12, role: "Head of Outreach", photo: "https://store.example/giulia.jpg" },
      leads: [{ id: 6, person: 16, division: "Events", photo: "https://store.example/luca.jpg" }],
    },
  ],
};

const OVERRIDES: Partial<TeamPageLayer> = {
  leader: { name: "Alessandro G.", role: "President", photo: "/team/leader.jpg" },
  spots: {
    "arc:project-manager:0": { name: "Lorenzo G.", linkedin: "lorenzo-g", photo: "https://store.example/lorenzo.jpg" },
    "head:1:0": { role: "Head of Aero", photo: "/team/chiara.jpg" },
    "lead:10:0": { role: "Mission Analysis and Ops", linkedin: "pietro" },
  },
};

/** One layer per kind of edit the editor makes, and all of them at once. */
const LAYERS: Readonly<Record<string, TeamPageLayer>> = {
  "no edit": NO_TEAM_LAYER,
  "a hidden arc spot": layer({ spots: { "arc:chief-engineer:0": { hidden: true } } }),
  "a hidden head spot": layer({ spots: { "head:2:0": { hidden: true } } }),
  "a hidden lead spot": layer({ spots: { "lead:11:0": { hidden: true } } }),
  "a hidden department": layer({ departments: { "1": { hidden: true } } }),
  "person swaps": layer({
    leader: { person: 3 },
    spots: { "arc:role-27:0": { person: 4 }, "head:1:0": { person: 13 }, "lead:20:0": { person: 6 } },
  }),
  "name, role, photo and LinkedIn overrides": layer(OVERRIDES),
  "added leaders": layer(ADDED_LEADERS),
  "added leads, lead order and a renamed department": layer(ADDED_LEADS),
  "an added department": layer(ADDED_DEPARTMENT),
  "every edit": layer({
    ...OVERRIDES,
    ...ADDED_LEADERS,
    ...ADDED_LEADS,
    ...ADDED_DEPARTMENT,
    spots: { ...OVERRIDES.spots, "arc:chief-engineer:0": { hidden: true }, "lead:20:0": { person: 6 } },
  }),
};

/** The seats a page draws: the leader, the arc and every department block. */
function seatsOf(page: TeamPage | null) {
  assert.ok(page, "the page draws every section");
  return { leader: page.orgChart.leader, leaders: page.orgChart.leaders, groups: page.departments.groups };
}

/** What the page draws today: the roles build with the layer laid on. */
function todaysPage(r: TeamRoles, l: TeamPageLayer): TeamPage | null {
  const build = teamBuildOf(r);
  return teamPageOf(build, applyLayer(build, l), team);
}

const seededRoles = teamRolesOf(SEED_DATA);
const seededLayer = publishedTeamPageLayerOf(SEED_DATA);

test("the seeded roles and layer: the snapshot draws the seats the page draws today", () => {
  assert.ok(seededLayer, "the seed holds a published layer");
  const layout = snapshot(seededRoles, seededLayer);
  assert.deepEqual(seatsOf(layoutPageOf(seededRoles, layout, seededLayer, team)), seatsOf(todaysPage(seededRoles, seededLayer)));
});

for (const [name, l] of Object.entries(LAYERS)) {
  test(`${name}: the snapshot draws the seats the page draws today`, () => {
    const layout = snapshot(roles(), l);
    assert.deepEqual(seatsOf(layoutPageOf(roles(), layout, l, team)), seatsOf(todaysPage(roles(), l)));
  });
}

test("person swaps: each place is bound to the seat the person shown there holds", () => {
  const layout = snapshot(roles(), LAYERS["person swaps"]);
  assert.deepEqual(layout.leader?.binding, { kind: "full-access-seat", seat: "project-manager" });
  assert.deepEqual(layout.leader?.overrides, { role: "Team Leader" }, "the leader's text is kept, as the bound seat reads another");
  assert.deepEqual(
    layout.arc.map((s) => s.binding),
    [
      { kind: "full-access-seat", seat: "project-manager" },
      { kind: "full-access-seat", seat: "chief-engineer" },
      { kind: "department-head", departmentId: 1 },
    ],
  );
  assert.deepEqual(layout.departments[0].head.binding, { kind: "department-head", departmentId: 3 });
  assert.deepEqual(layout.departments[1].leads[0].binding, { kind: "division-lead", divisionId: 11, place: 0 });
});

test("someone who holds no seat cannot be bound: the snapshot gives their place no page seat, and they are a core member", () => {
  const l = layer({ addedLeaders: [{ id: 1, person: 9, place: { at: "end" }, role: "Ambassador" }] });
  const layout = snapshot(roles(), l);
  assert.equal(layout.arc.length, 3);
  assert.ok(resolveLayout(layout, roles()).core.some((m) => m.name === "Sofia Neri"));
});

test("core members: everyone with an active role no page seat shows, by name, with their title", () => {
  const l = layer({
    addedLeaders: [{ id: 1, person: 17, place: { at: "end" }, role: "Head of R&D" }],
    spots: { "lead:11:0": { hidden: true } },
  });
  const today = teamBuildOf(roles()).core.map((m) => m.name);
  assert.ok(today.includes("Marco Dona") && !today.includes("Marco Bianchi"), "today's list comes from the roles alone");
  const { core } = resolveLayout(snapshot(roles(), l), roles());
  assert.deepEqual(core, [
    { name: "Anna Villa" },
    { name: "Kenji Watanabe" },
    { name: "Marco Bianchi", role: "Optimization Lead" },
    { name: "Sofia Neri", linkedin: "sofia-neri" },
  ]);
});

test("adding, removing, moving or reordering a seat in the roles leaves the page seats and the core members unchanged", () => {
  const layout = snapshot(roles(), layer({ spots: { "lead:11:0": { hidden: true } } }));
  const before = resolveLayout(layout, roles());
  const changes: Readonly<Record<string, TeamRoles>> = {
    "a team-level seat added": roles(moved(people, 10, teamSeat(40, "Chief of Testing"))),
    "a division removed": roles(
      moved(moved(people, 6, inDivisions([])), 10, inDivisions([])),
      { ...org, divisions: org.divisions.filter((d) => d.id !== 11) },
    ),
    "a division moved to another department": roles(people, {
      ...org,
      divisions: org.divisions.map((d) => (d.id === 20 ? { ...d, departmentId: 1 } : d)),
    }),
    "departments, divisions and team-level seats reordered": roles(
      moved(people, 12, teamSeat(27, "Chief of Safety", "2020-01-01")),
      { departments: [...org.departments].reverse(), divisions: [...org.divisions].reverse() },
    ),
  };
  for (const [name, changed] of Object.entries(changes)) {
    assert.deepEqual(resolveLayout(withoutGoneSeats(layout, changed), changed), before, name);
  }
});

test("a hand-over of each seat kind shows the new holder in the same place", () => {
  const layout = snapshot(roles(), NO_TEAM_LAYER);
  const before = resolveLayout(layout, roles());

  const newLeader = resolveLayout(layout, roles(moved(moved(people, 1, member(10)), 9, leader())));
  assert.equal(newLeader.leader?.name, "Sofia Neri");

  const pm = resolveLayout(layout, roles(moved(moved(people, 3, member(10)), 10, flagged("project-manager", 50))));
  assert.deepEqual(
    pm.leaders.map((l) => [l.at, l.shown.name]),
    before.leaders.map((l) => [l.at, l.at === layout.arc[0].id ? "Kenji Watanabe" : l.shown.name]),
  );

  const handedOver = roles(moved(moved(people, 12, member(20)), 11, teamSeat(28, "Chief of Safety")));
  const seat27 = layout.arc.find((s) => s.binding.kind === "team-seat")!;
  assert.ok(!resolveLayout(layout, handedOver).leaders.some((l) => l.at === seat27.id), "the ended row's seat shows nobody");
  const followed = resolveLayout(withTeamSeatMoved(layout, 27, 28), handedOver);
  assert.deepEqual(
    followed.leaders.map((l) => [l.at, l.shown.name]),
    before.leaders.map((l) => [l.at, l.at === seat27.id ? "Anna Villa" : l.shown.name]),
  );

  const newHead = resolveLayout(layout, roles(moved(moved(people, 4, member(10)), 10, head(1))));
  assert.equal(newHead.departments[0].at, before.departments[0].at);
  assert.equal(newHead.departments[0].heads[0].shown.name, "Kenji Watanabe");

  const newLead = resolveLayout(layout, roles(moved(moved(people, 5, member(10)), 9, lead(10))));
  assert.deepEqual(
    newLead.departments[0].leads.map((l) => [l.at, l.shown.name]),
    before.departments[0].leads.map((l, i) => [l.at, i === 0 ? "Sofia Neri" : l.shown.name]),
  );
});

test("a page seat whose bound seat has no holder is not drawn, stays in the layout and is drawn again in place once it has one", () => {
  const layout = snapshot(roles(), NO_TEAM_LAYER);
  const before = resolveLayout(layout, roles());
  const pmSeat = layout.arc[0].id;

  const noPm = roles(moved(people, 3, member(10)));
  assert.ok(!resolveLayout(layout, noPm).leaders.some((l) => l.at === pmSeat));
  assert.deepEqual(withoutGoneSeats(layout, noPm), layout, "the seat keeps its place in the layout");
  const pmAgain = resolveLayout(layout, roles(moved(noPm.people, 10, flagged("project-manager", 50))));
  assert.deepEqual(pmAgain.leaders[0], { at: pmSeat, shown: { name: "Kenji Watanabe", role: "Project Manager" } });

  const noHead = roles(moved(people, 7, member(20)));
  assert.deepEqual(resolveLayout(layout, noHead).departments[1].heads, []);
  assert.ok(!seatsOf(layoutPageOf(noHead, layout, NO_TEAM_LAYER, team)).groups.some((g) => g.members.some((m) => m.name === "Irene Galli")));
  assert.deepEqual(withoutGoneSeats(layout, noHead), layout);
  const headAgain = resolveLayout(layout, roles(moved(noHead.people, 11, head(2))));
  assert.equal(headAgain.departments[1].heads[0].at, before.departments[1].heads[0].at);
  assert.equal(headAgain.departments[1].heads[0].shown.name, "Anna Villa");
});

test("a page seat whose bound seat no longer exists is not drawn, and the drop returns the layout without it", () => {
  const layout = snapshot(roles(), NO_TEAM_LAYER);
  const gone = roles(moved(moved(people, 12, member(20)), 6, inDivisions([])), {
    departments: org.departments.filter((d) => d.id !== 2),
    divisions: org.divisions.filter((d) => d.id !== 11 && d.id !== 20),
  });
  const resolved = resolveLayout(layout, gone);
  assert.deepEqual(
    resolved.leaders.map((l) => l.shown.name),
    ["Lorenzo Gallo", "Federica Moretti"],
  );
  const dropped = withoutGoneSeats(layout, gone);
  assert.deepEqual(dropped, {
    leader: layout.leader,
    arc: layout.arc.filter((s) => s.binding.kind !== "team-seat"),
    departments: layout.departments
      .filter((b) => b.head.binding.kind !== "department-head" || b.head.binding.departmentId !== 2)
      .map((b) => ({ ...b, leads: b.leads.filter((s) => s.binding.kind !== "division-lead" || s.binding.divisionId !== 11) })),
  });
  assert.deepEqual(seatsOf(layoutPageOf(gone, dropped, NO_TEAM_LAYER, team)), seatsOf(layoutPageOf(gone, layout, NO_TEAM_LAYER, team)));
  assert.deepEqual(resolveLayout(dropped, gone).core, resolved.core);
});

test("the model has no vacant or unbound state: a layout is its seats, a seat its binding and overrides", () => {
  const layout = snapshot(roles(), LAYERS["every edit"]);
  assert.deepEqual(Object.keys(layout).sort(), ["arc", "departments", "leader"]);
  for (const seat of [layout.leader!, ...layout.arc, ...layout.departments.flatMap((b) => [b.head, ...b.leads])]) {
    assert.deepEqual(Object.keys(seat).sort(), ["binding", "id", "overrides"]);
  }
  assert.equal(parseTeamLayout({ ...layout, vacant: [] }), null);
  assert.equal(parseTeamLayout({ ...layout, arc: [{ ...layout.arc[0], binding: { kind: "unbound" } }] }), null);
});

test("the validator round-trips every layout the snapshot builds", () => {
  const layouts = [snapshot(seededRoles, seededLayer!), ...Object.values(LAYERS).map((l) => snapshot(roles(), l))];
  for (const layout of layouts) assert.deepEqual(parseTeamLayout(JSON.parse(JSON.stringify(layout))), layout);
});

test("the validator refuses anything this code could not have written", () => {
  const layout: TeamLayout = snapshot(roles(), LAYERS["every edit"]);
  const seat = layout.arc[0];
  const malformed: Readonly<Record<string, unknown>> = {
    "not an object": "layout",
    "an array": [],
    null: null,
    "a part missing": { leader: layout.leader, arc: layout.arc },
    "a binding of no known kind": { ...layout, arc: [{ ...seat, binding: { kind: "member", memberId: 9 } }] },
    "a binding missing its reference": { ...layout, arc: [{ ...seat, binding: { kind: "team-seat" } }] },
    "a flag no team-level seat carries": { ...layout, arc: [{ ...seat, binding: { kind: "full-access-seat", seat: "it-lead" } }] },
    "a negative place": { ...layout, arc: [{ ...seat, binding: { kind: "division-lead", divisionId: 10, place: -1 } }] },
    "an id used twice": { ...layout, arc: [seat, seat] },
    "more than eight on the arc": { ...layout, arc: Array.from({ length: 9 }, (_, i) => ({ ...seat, id: 1000 + i })) },
    "a blank name": { ...layout, arc: [{ ...seat, overrides: { name: " " } }] },
    "a photo off any store": { ...layout, arc: [{ ...seat, overrides: { photo: "http://example.com/a.jpg" } }] },
    "a LinkedIn URL for a handle": { ...layout, arc: [{ ...seat, overrides: { linkedin: "linkedin.com/in/x" } }] },
    "an override this code never sets": { ...layout, arc: [{ ...seat, overrides: { hidden: true } }] },
    "a department of no known kind": { ...layout, departments: [{ ...layout.departments[0], kind: "research" }] },
    "a department with no head": { ...layout, departments: [{ ...layout.departments[0], head: null }] },
  };
  for (const [name, value] of Object.entries(malformed)) assert.equal(parseTeamLayout(value), null, name);
});

test("layoutPhotos lists the photos layerPhotos lists for the same edits", () => {
  const sorted = (list: readonly string[]) => [...list].sort();
  for (const name of ["name, role, photo and LinkedIn overrides", "added leaders", "an added department", "every edit"]) {
    const l = LAYERS[name];
    assert.deepEqual(sorted(layoutPhotos(snapshot(roles(), l))), sorted(layerPhotos(l)), name);
  }
  // The group photo stays in the layer's own store, beside the intro text and the figures.
  assert.deepEqual(sorted(layoutPhotos(snapshot(seededRoles, seededLayer!))), sorted(layerPhotos({ ...seededLayer!, groupPhoto: null })));
});
