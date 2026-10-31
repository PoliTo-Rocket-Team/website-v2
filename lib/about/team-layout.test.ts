import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_DATA, publishedTeamPageLayerOf, teamRolesOf } from "@/db/seed/cases";
import { BOARD_FLAG_TITLES, BOARD_FLAGS, inDivisions, NO_MEMBERSHIPS, type BoardFlag, type DepartmentKind, type Placement } from "@/lib/dashboard/team";
import { applyLayer, isTeamPageLayer, layerPhotos, NO_TEAM_LAYER, NO_UPLOADS, TEAM_PAGE_TEXT_MAX, type TeamPageLayer } from "./team-layer";
import {
  isGroupedLayout,
  layoutPageOf,
  layoutPhotos,
  parseStoredLayout,
  parseTeamLayout,
  resolveLayout,
  snapshot,
  teamLayoutOf,
  teamRecordLayout,
  withoutGoneSeats,
  withTeamSeatMoved,
  type DepartmentBlock,
  type KindBlock,
  type KindLayout,
  type TeamLayout,
} from "./team-layout";
import { headFieldsOf, layoutWithHead, newDepartmentFields, pickedHead, withHeadPerson } from "./team-page-add";
import type { TeamPerson } from "./team-person";
import { team } from "./team";
import { teamBuildOf, teamPageOf, todaysDrawnTeam, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

// The Team page layout (issue #849): the snapshot of today's page draws the
// same seats and names what it does not carry, people follow the team record
// while the layout does not, a person-bound place follows its person only, a
// seat with no holder is left out in place, a gone seat is dropped, and the
// stored form round-trips.

const since = "2024-10-01";

function person(id: number, name: string, placement: Placement, over: Partial<TeamPerson> = {}): TeamPerson {
  return { id, name, placement, furtherSeats: [], pageTitle: null, photo: null, linkedin: null, teamEmail: null, ...over };
}

const leader = (): Placement => ({ role: "team-leader", memberships: NO_MEMBERSHIPS });
const flagged = (flag: BoardFlag, roleId = BOARD_FLAGS.indexOf(flag) + 1): Placement => ({
  role: "board",
  seat: { roleId, title: BOARD_FLAG_TITLES[flag], fullAccess: flag, type: "core", since },
  memberships: NO_MEMBERSHIPS,
});
const teamSeat = (roleId: number, title: string, from = "2024-11-01"): Placement => ({
  role: "board",
  seat: { roleId, title, fullAccess: null, type: "core", since: from },
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
/** `list` without `id`: they hold no active role any more. */
const without = (list: readonly TeamPerson[], id: number) => list.filter((p) => p.id !== id);

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

/** A name at the text limit: "Head of" it is longer than any text a layer or a layout stores. */
const LONG_NAME = "O".repeat(TEAM_PAGE_TEXT_MAX);

/** One layer per kind of edit the editor makes, all of them at once, and the people and texts that test the binding's edges. */
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
  "people who hold no seat, swapped in and added": layer({
    leader: { person: 10 },
    spots: { "arc:role-27:0": { person: 11 }, "head:2:0": { person: 11 }, "lead:30:0": { person: 10 } },
    addedLeaders: [{ id: 1, person: 9, place: { at: "end" }, role: "Ambassador" }],
    departments: { "1": { addedLeads: [{ id: 2, person: 11, division: "Wind Tunnel" }] } },
    addedDepartments: [{ id: 3, name: "Outreach", head: { person: 10, name: "Kenji W." }, leads: [{ id: 4, person: 9, division: "Social" }] }],
  }),
  "an added department at the text limit, its head's role unset": layer({
    addedDepartments: [
      { id: 1, name: LONG_NAME, head: { person: 12 }, leads: [] },
      { id: 2, name: LONG_NAME, head: { person: 9 }, leads: [{ id: 3, person: 11, division: LONG_NAME }] },
    ],
  }),
  "a department renamed at the text limit, its head swapped": layer({
    departments: { "1": { name: LONG_NAME }, "3": { name: LONG_NAME } },
    spots: { "head:1:0": { person: 12 }, "arc:chief-engineer:0": { role: LONG_NAME } },
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
  return teamPageOf(build, todaysDrawnTeam(applyLayer(build, l)), team);
}

const seededRoles = teamRolesOf(SEED_DATA);
const seededLayer = publishedTeamPageLayerOf(SEED_DATA);

test("the seeded roles and layer: the snapshot draws the seats the page draws today", () => {
  assert.ok(seededLayer, "the seed holds a published layer");
  const { layout } = snapshot(seededRoles, seededLayer);
  assert.deepEqual(seatsOf(layoutPageOf(seededRoles, layout, seededLayer, team)), seatsOf(todaysPage(seededRoles, seededLayer)));
});

for (const [name, l] of Object.entries(LAYERS)) {
  test(`${name}: the snapshot draws the seats the page draws today, and leaves out only hidden places`, () => {
    assert.ok(isTeamPageLayer(l, NO_UPLOADS), "the editor could have saved this layer");
    const { layout, left } = snapshot(roles(), l);
    assert.deepEqual(seatsOf(layoutPageOf(roles(), layout, l, team)), seatsOf(todaysPage(roles(), l)));
    assert.deepEqual(
      left.filter((gap) => gap.why !== "hidden"),
      [],
    );
  });
}

test("a place the roles' holder shows keeps its own seat; a person swapped in or added is bound to that person", () => {
  const { layout } = snapshot(roles(), LAYERS["person swaps"]);
  assert.deepEqual(layout.leader?.binding, { kind: "person", memberId: 3 });
  assert.deepEqual(layout.leader?.overrides, { role: "Team Leader" }, "the leader's text is kept, as the person has no title of their own");
  assert.deepEqual(
    layout.arc.map((s) => s.binding),
    [
      { kind: "full-access-seat", seat: "project-manager" },
      { kind: "full-access-seat", seat: "chief-engineer" },
      { kind: "person", memberId: 4 },
    ],
  );
  assert.deepEqual(layout.departments[0].head.binding, { kind: "person", memberId: 13 });
  assert.deepEqual(layout.departments[0].head.overrides, {}, "a person on a head place reads Head of the block");
  assert.deepEqual(layout.departments[1].leads[0].binding, { kind: "person", memberId: 6 });
  assert.deepEqual(layout.departments[2].head.binding, { kind: "department-head", departmentId: 3 });
});

test("a person-bound place shows that person while they hold an active role, passes to no one, and waits in place once they leave", () => {
  const l = layer({ addedLeaders: [{ id: 1, person: 9, place: { at: "end" }, role: "Ambassador" }], spots: { "head:1:0": { person: 13 } } });
  const { layout } = snapshot(roles(), l);
  const sofia = layout.arc[3];
  assert.deepEqual(sofia.binding, { kind: "person", memberId: 9 });
  assert.deepEqual(sofia.overrides, { role: "Ambassador" });
  const before = resolveLayout(layout, roles());
  assert.deepEqual(before.leaders.at(-1), { at: sofia.id, shown: { name: "Sofia Neri", role: "Ambassador", linkedin: "sofia-neri", email: "sofia.neri@politorocketteam.it" } });
  assert.ok(!before.core.some((m) => m.name === "Sofia Neri"), "a person a place shows is no core member");

  const seated = resolveLayout(layout, roles(moved(people, 9, lead(11))));
  assert.equal(seated.leaders.find((l) => l.at === sofia.id)?.shown.name, "Sofia Neri", "a seat taken changes nothing");

  const handedOver = roles(moved(moved(people, 13, member(30)), 10, head(3)));
  const after = resolveLayout(layout, handedOver);
  assert.equal(after.departments[0].heads[0].shown.name, "Rocco Bellon", "the person's place stays theirs when they hand their seat over");
  assert.equal(after.departments[2].heads[0].shown.name, "Kenji Watanabe", "the seat's own place passes to the successor");

  const gone = roles(without(without(people, 9), 13));
  const away = resolveLayout(layout, gone);
  assert.ok(!away.leaders.some((l) => l.at === sofia.id), "not drawn once she holds no active role");
  assert.deepEqual(away.departments[0].heads, []);
  assert.deepEqual(withoutGoneSeats(layout, gone), layout, "the place keeps its spot in the layout");
  assert.equal(resolveLayout(layout, roles()).leaders.at(-1)?.at, sofia.id, "and shows her again in place when she is back");
});

test("the snapshot names every part of the layer the layout does not carry, and why", () => {
  const l = layer({
    spots: { "arc:chief-engineer:0": { hidden: true }, "lead:20:0": { person: 99 }, "lead:11:5": { role: "Gone Row" } },
    departments: { "3": { hidden: true }, "9": { name: "Closed" } },
    addedLeaders: [{ id: 1, person: 99, place: { at: "end" }, role: "Ambassador" }],
  });
  const twoHeads = roles(moved(people, 10, head(1)));
  const { layout, left } = snapshot(twoHeads, l);
  assert.deepEqual(left, [
    { at: "head:1:1", why: "second-head" },
    { at: "lead:20:0", why: "left-team" },
    { at: "arc:chief-engineer:0", why: "hidden" },
    { at: "lead:11:5", why: "not-shown" },
    { at: "added:1", why: "left-team" },
    { at: "department:3", why: "hidden" },
    { at: "department:9", why: "not-shown" },
  ]);
  assert.equal(resolveLayout(layout, twoHeads).departments[1].leads[0].shown.name, "Simone Testa", "a swap to someone who left shows the roles' holder, as today");
});

test("core members: everyone with an active role no page seat shows, by name, with their title", () => {
  const l = layer({
    addedLeaders: [{ id: 1, person: 17, place: { at: "end" }, role: "Head of R&D" }],
    spots: { "lead:11:0": { hidden: true } },
  });
  const today = teamBuildOf(roles()).core.map((m) => m.name);
  assert.ok(today.includes("Marco Dona") && !today.includes("Marco Bianchi"), "today's list comes from the roles alone");
  const { core } = resolveLayout(snapshot(roles(), l).layout, roles());
  assert.deepEqual(core, [
    { name: "Anna Villa" },
    { name: "Kenji Watanabe" },
    { name: "Marco Bianchi", role: "Optimization Lead" },
    { name: "Sofia Neri", linkedin: "sofia-neri" },
  ]);
});

test("adding, removing, moving or reordering a seat in the roles leaves the page seats and the core members unchanged", () => {
  const { layout } = snapshot(roles(), layer({ spots: { "lead:11:0": { hidden: true } } }));
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
  const { layout } = snapshot(roles(), NO_TEAM_LAYER);
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
  const { layout } = snapshot(roles(), NO_TEAM_LAYER);
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
  const { layout } = snapshot(roles(), NO_TEAM_LAYER);
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
    groups: layout.groups,
    departments: layout.departments
      .filter((b) => b.head.binding.kind !== "department-head" || b.head.binding.departmentId !== 2)
      .map((b) => ({ ...b, leads: b.leads.filter((s) => s.binding.kind !== "division-lead" || s.binding.divisionId !== 11) })),
  });
  assert.deepEqual(seatsOf(layoutPageOf(gone, dropped, NO_TEAM_LAYER, team)), seatsOf(layoutPageOf(gone, layout, NO_TEAM_LAYER, team)));
  assert.deepEqual(resolveLayout(dropped, gone).core, resolved.core);
});

test("the model has no vacant or unbound state: a layout is its seats and groups, a seat its binding and overrides", () => {
  const { layout } = snapshot(roles(), LAYERS["every edit"]);
  assert.deepEqual(Object.keys(layout).sort(), ["arc", "departments", "groups", "leader"]);
  for (const seat of [layout.leader!, ...layout.arc, ...layout.departments.flatMap((b) => [b.head, ...b.leads])]) {
    assert.deepEqual(Object.keys(seat).sort(), ["binding", "id", "overrides"]);
  }
  assert.equal(parseTeamLayout({ ...layout, vacant: [] }), null);
  assert.equal(parseTeamLayout({ ...layout, arc: [{ ...layout.arc[0], binding: { kind: "unbound" } }] }), null);
});

test("the validator round-trips every layout the snapshot builds", () => {
  const layouts = [snapshot(seededRoles, seededLayer!).layout, ...Object.values(LAYERS).map((l) => snapshot(roles(), l).layout)];
  for (const layout of layouts) assert.deepEqual(parseTeamLayout(JSON.parse(JSON.stringify(layout))), layout);
});

test("an added department at the text limit with its head's role unset stores no role longer than the validator takes", () => {
  const { layout } = snapshot(roles(), LAYERS["an added department at the text limit, its head's role unset"]);
  const heads = layout.departments.slice(-2).map((b) => b.head);
  assert.deepEqual(
    heads.map((h) => [h.binding, h.overrides]),
    [
      [{ kind: "person", memberId: 12 }, {}],
      [{ kind: "person", memberId: 9 }, {}],
    ],
  );
  assert.equal(resolveLayout(layout, roles()).departments.at(-1)?.heads[0].shown.role, `Head of ${LONG_NAME}`);
  assert.deepEqual(parseTeamLayout(JSON.parse(JSON.stringify(layout))), layout);
});

test("the validator refuses anything this code could not have written", () => {
  const { layout }: { layout: TeamLayout } = snapshot(roles(), LAYERS["every edit"]);
  const seat = layout.arc[0];
  const malformed: Readonly<Record<string, unknown>> = {
    "not an object": "layout",
    "an array": [],
    null: null,
    "a part missing": { leader: layout.leader, arc: layout.arc },
    "a binding of no known kind": { ...layout, arc: [{ ...seat, binding: { kind: "member", memberId: 9 } }] },
    "a binding missing its reference": { ...layout, arc: [{ ...seat, binding: { kind: "team-seat" } }] },
    "a person binding with no member": { ...layout, arc: [{ ...seat, binding: { kind: "person" } }] },
    "a person binding with a seat beside it": { ...layout, arc: [{ ...seat, binding: { kind: "person", memberId: 9, roleId: 27 } }] },
    "a flag no team-level seat carries": { ...layout, arc: [{ ...seat, binding: { kind: "full-access-seat", seat: "it-lead" } }] },
    "a negative place": { ...layout, arc: [{ ...seat, binding: { kind: "division-lead", divisionId: 10, place: -1 } }] },
    "an id used twice": { ...layout, arc: [seat, seat] },
    "more than eight on the arc": { ...layout, arc: Array.from({ length: 9 }, (_, i) => ({ ...seat, id: 1000 + i })) },
    "a blank name": { ...layout, arc: [{ ...seat, overrides: { name: " " } }] },
    "a role past the text limit": { ...layout, arc: [{ ...seat, overrides: { role: `Head of ${LONG_NAME}` } }] },
    "a photo off any store": { ...layout, arc: [{ ...seat, overrides: { photo: "http://example.com/a.jpg" } }] },
    "a LinkedIn URL for a handle": { ...layout, arc: [{ ...seat, overrides: { linkedin: "linkedin.com/in/x" } }] },
    "an override this code never sets": { ...layout, arc: [{ ...seat, overrides: { hidden: true } }] },
    "a department with a kind beside its group": { ...layout, departments: [{ ...layout.departments[0], kind: "technical" }] },
    "a department with no head": { ...layout, departments: [{ ...layout.departments[0], head: null }] },
    "a department with no group": { ...layout, departments: [{ ...layout.departments[0], group: undefined }] },
    "a department in a group the list lacks": { ...layout, departments: [{ ...layout.departments[0], group: 99 }] },
    "a department that draws its leads no known way": { ...layout, departments: [{ ...layout.departments[0], leadsDrawn: "around" }] },
    "no group list": { leader: layout.leader, arc: layout.arc, departments: layout.departments },
    "no group at all": { ...layout, groups: [], departments: [] },
    "a group id used twice": { ...layout, groups: [layout.groups[0], { ...layout.groups[1], id: layout.groups[0].id }] },
    "a blank group name": { ...layout, groups: [{ ...layout.groups[0], name: " " }, layout.groups[1]] },
    "a kind on a stored block with a group list": { ...layout, departments: layout.departments.map(({ group: _g, leadsDrawn: _l, ...b }) => ({ ...b, kind: "technical" })) },
    "a department with no department reference": { ...layout, departments: [{ ...layout.departments[0], department: undefined }] },
    "a department reference that is no id": { ...layout, departments: [{ ...layout.departments[0], department: 0 }] },
    "two blocks showing one department": {
      ...layout,
      departments: [layout.departments[0], { ...layout.departments[1], department: layout.departments[0].department }],
    },
  };
  for (const [name, value] of Object.entries(malformed)) assert.equal(parseTeamLayout(value), null, name);
});

// Department groups (issue #856): the layout's own groups replace the kind.

/** The slides a page draws, by heading and the names on each. */
const slidesOf = (page: TeamPage) => page.departments.groups.map((g) => [g.name, g.members.map((m) => m.name)]);

test("the snapshot of the seeded team holds two groups, Technical Departments then Operations, each department where its kind puts it, and draws the same slides", () => {
  const { layout } = snapshot(seededRoles, seededLayer!);
  assert.deepEqual(
    layout.groups.map((g) => g.name),
    ["Technical Departments", "Operations"],
  );
  const kindOf = new Map(seededRoles.org.departments.map((d) => [d.id, d.kind]));
  for (const block of layout.departments) {
    if (block.head.binding.kind !== "department-head") continue;
    const kind = kindOf.get(block.head.binding.departmentId);
    assert.equal(block.group, layout.groups[kind === "operations" ? 1 : 0].id, block.name);
    assert.equal(block.leadsDrawn, kind === "operations" ? "beside" : "under", block.name);
  }
  assert.ok(layout.departments.some((b) => b.group === layout.groups[1].id), "the seed has an Operations department");
  assert.deepEqual(slidesOf(layoutPageOf(seededRoles, layout, seededLayer!, team)), slidesOf(todaysPage(seededRoles, seededLayer!)!));
});

test("three or more groups draw in stored order with stored names; an empty group draws nothing", () => {
  const { layout } = snapshot(roles(), NO_TEAM_LAYER);
  const [aero, recovery, logistics] = layout.departments;
  const grouped: TeamLayout = {
    ...layout,
    groups: [
      { id: 7, name: "Ground" },
      { id: 8, name: "Nobody here" },
      { id: 9, name: "Flight" },
      { id: 3, name: "Air" },
    ],
    departments: [
      { ...aero, group: 3 },
      { ...recovery, group: 9 },
      { ...logistics, group: 7 },
    ],
  };
  assert.deepEqual(parseTeamLayout(JSON.parse(JSON.stringify(grouped))), grouped);
  assert.deepEqual(slidesOf(layoutPageOf(roles(), grouped, NO_TEAM_LAYER, team)), [
    ["Ground", ["Rocco Bellon", "Elena Ferraro", "Davide Conti", "Luca Ferri"]],
    ["Flight", ["Irene Galli"]],
    ["Air", ["Chiara Rinaldi"]],
  ]);
  const flight = layoutPageOf(roles(), grouped, NO_TEAM_LAYER, team).departments.groups[1]?.members[0];
  assert.ok(flight?.kind === "head" && flight.leads.map((l) => l.name).join() === "Simone Testa", "a block drawing its leads under its head keeps them under");
});

test("a group fills slides of up to ten places, and the carousel keeps five slides", () => {
  const departments = Array.from({ length: 56 }, (_, i) => ({ id: 1000 + i, name: `Department ${i}`, kind: "technical" as const }));
  const many = roles(
    [...people, ...departments.map((d, i) => person(2000 + i, `Head ${String(i).padStart(2, "0")}`, head(d.id)))],
    { departments: [...org.departments, ...departments], divisions: [...org.divisions, ...departments.map((d) => ({ id: d.id, name: `${d.name} Division`, departmentId: d.id }))] },
  );
  const { layout } = snapshot(many, NO_TEAM_LAYER);
  const split: TeamLayout = { ...layout, groups: [...layout.groups, { id: 3, name: "Third" }], departments: layout.departments.map((b, i) => ({ ...b, group: i % 2 === 0 ? 3 : b.group })) };
  const page = layoutPageOf(many, split, NO_TEAM_LAYER, team);
  assert.equal(page.departments.groups.length, 5);
  assert.ok(page.departments.groups.every((g) => g.members.length <= 10));
});

/** A block as a layout stored before groups held it: `kind` in place of its group, lead drawing and department. */
const kinded = ({ department: _d, group: _g, leadsDrawn: _l, ...block }: DepartmentBlock, kind: DepartmentKind): KindBlock => ({ ...block, kind });

/** A stored layout read back, as storage reads it. */
const readBack = (layout: unknown) => parseStoredLayout(JSON.parse(JSON.stringify(layout)));

test("a layout stored before groups reads as today's two groups and saves with the group list", () => {
  const { layout } = snapshot(roles(), LAYERS["every edit"]);
  const kindOf = (groupId: number) => (groupId === layout.groups[1].id ? "operations" : "technical");
  const stored: KindLayout = { leader: layout.leader, arc: layout.arc, departments: layout.departments.map((b) => kinded(b, kindOf(b.group))) };
  const read = readBack(stored);
  assert.deepEqual(read, stored, "storage keeps the form before groups until a save");
  assert.equal(parseTeamLayout(JSON.parse(JSON.stringify(stored))), null, "the browser never sends that form");
  const opened = teamLayoutOf(read!, roles(), LAYERS["every edit"]);
  assert.deepEqual(opened, layout, "the same groups, the same assignment and the same departments");
  const saved = readBack(opened);
  assert.ok(saved !== null && isGroupedLayout(saved), "the next save writes the group list");
  assert.deepEqual(saved, layout);
});

test("Reset to team keeps the group and lead drawing of each department of a layout stored before groups, whose head was swapped to a person or another seat, or whose head seat another block shares", () => {
  // As #850 stored it: the layer swapped Aerodynamics' head to Sofia Neri, who holds no seat, so the snapshot bound it to her.
  const swaps = layer({ spots: { "head:1:0": { person: 9 } } });
  const { layout } = snapshot(roles(), swaps);
  const [aero, recovery, logistics] = layout.departments;
  assert.deepEqual(aero.head.binding, { kind: "person", memberId: 9 });
  // Then the #851 editor, each department in Operations: Recovery's head picked as Rocco Bellon, who heads Logistics, and Logistics'
  // as Giulia Fontana, on a team-level seat; and a department added with Rocco as its head, so two blocks share his head seat.
  const outreach: KindBlock = {
    id: 900,
    name: "Outreach",
    head: { id: 901, binding: { kind: "department-head", departmentId: 3 }, overrides: { role: "Head of Outreach" } },
    leads: [],
    kind: "technical",
  };
  const stored: KindLayout = {
    leader: layout.leader,
    arc: layout.arc,
    departments: [
      kinded(aero, "operations"),
      kinded({ ...recovery, head: { ...recovery.head, binding: { kind: "department-head", departmentId: 3 } } }, "operations"),
      kinded({ ...logistics, head: { ...logistics.head, binding: { kind: "team-seat", roleId: 27 } } }, "operations"),
      outreach,
    ],
  };
  const [TECHNICAL, OPERATIONS] = layout.groups.map((g) => g.id);

  // Read: each block shows its department, found without a kind; the added one shows none.
  const read = readBack(stored);
  assert.ok(read !== null && !isGroupedLayout(read));
  const opened = teamLayoutOf(read, roles(), swaps);
  const shown = (of: TeamLayout) => of.departments.map((b) => [b.name, b.department, b.group, b.leadsDrawn]);
  assert.deepEqual(shown(opened), [
    ["Aerodynamics", 1, OPERATIONS, "beside"],
    ["Recovery", 2, OPERATIONS, "beside"],
    ["Logistics", 3, OPERATIONS, "beside"],
    ["Outreach", null, TECHNICAL, "under"],
  ]);
  const flipped = roles(people, { ...org, departments: org.departments.map((d) => ({ ...d, kind: d.kind === "technical" ? ("operations" as const) : ("technical" as const) })) });
  assert.deepEqual(teamLayoutOf(read, flipped, swaps), opened, "no department's kind is read");

  // Save: the grouped form, each department written.
  const saved = readBack(opened);
  assert.ok(saved !== null && isGroupedLayout(saved));
  assert.deepEqual(shown(saved), shown(opened));

  // Reset, after the save or before it: each department back in Operations, its leads beside its head, each head the team record's.
  const expected = [
    ["Aerodynamics", OPERATIONS, "beside"],
    ["Recovery", OPERATIONS, "beside"],
    ["Logistics", OPERATIONS, "beside"],
  ];
  for (const kept of [saved, opened]) {
    const reset = teamRecordLayout(roles(), kept);
    assert.deepEqual(
      reset.departments.map((b) => [b.name, b.group, b.leadsDrawn]),
      expected,
    );
    assert.deepEqual(
      reset.departments.map((b) => b.head.binding),
      [1, 2, 3].map((departmentId) => ({ kind: "department-head", departmentId })),
    );
  }

  // Two blocks of the team record sharing a head seat: Recovery's head picked as Rocco while Logistics keeps him.
  const shared: KindLayout = { ...stored, departments: [stored.departments[0], stored.departments[1], kinded(logistics, "operations")] };
  assert.deepEqual(
    teamLayoutOf(readBack(shared)!, roles(), swaps).departments.map((b) => b.department),
    [1, 2, 3],
  );
});

test("apart from the snapshot, nothing on the Team page reads a department's kind: a stored layout draws, resets and counts the same whatever kind the team record gives", () => {
  const { layout } = snapshot(roles(), LAYERS["every edit"]);
  const flipped = roles(people, { ...org, departments: org.departments.map((d) => ({ ...d, kind: d.kind === "technical" ? ("operations" as const) : ("technical" as const) })) });
  assert.deepEqual(layoutPageOf(flipped, layout, LAYERS["every edit"], team), layoutPageOf(roles(), layout, LAYERS["every edit"], team));
  assert.deepEqual(resolveLayout(layout, flipped), resolveLayout(layout, roles()));
  assert.deepEqual(teamRecordLayout(flipped, layout), teamRecordLayout(roles(), layout));
  assert.deepEqual(withoutGoneSeats(layout, flipped), withoutGoneSeats(layout, roles()));
});

test("Reset to team keeps the group list and each department's group, and puts a department new to the page under the first group", () => {
  const { layout } = snapshot(roles(), NO_TEAM_LAYER);
  const [aero, recovery] = layout.departments;
  const kept: TeamLayout = {
    ...layout,
    groups: [{ id: 5, name: "Flight" }, ...layout.groups],
    departments: [
      { ...aero, group: 5, leadsDrawn: "beside" },
      { ...recovery, group: layout.groups[1].id },
    ],
  };
  const reset = teamRecordLayout(roles(), kept);
  assert.deepEqual(reset.groups, kept.groups);
  assert.deepEqual(
    reset.departments.map((b) => [b.name, b.group, b.leadsDrawn]),
    [
      ["Aerodynamics", 5, "beside"],
      ["Recovery", layout.groups[1].id, "under"],
      ["Logistics", 5, "under"],
    ],
  );
  assert.deepEqual(parseTeamLayout(JSON.parse(JSON.stringify(reset))), reset);
});

test("Reset to team keeps a department's group and lead drawing whoever its head place shows: a head swapped to someone with no seat, to another department's head or to a team-level seat, or a head seat handed over", () => {
  const { layout } = snapshot(roles(), NO_TEAM_LAYER);
  const [aero, recovery, logistics] = layout.departments;
  const kept: TeamLayout = {
    ...layout,
    groups: [{ id: 5, name: "Flight" }, ...layout.groups],
    departments: [
      { ...aero, group: 5, leadsDrawn: "beside" },
      { ...recovery, group: layout.groups[1].id },
      { ...logistics, group: 5 },
    ],
  };
  const groupsOf = (of: TeamLayout) => of.departments.map((b) => [b.name, b.group, b.leadsDrawn]);
  const expected = [
    ["Aerodynamics", 5, "beside"],
    ["Recovery", layout.groups[1].id, "under"],
    ["Logistics", 5, "beside"],
  ];

  // The editor picks another head for each block, as the Edit a head block panel does.
  const swap = (of: TeamLayout, blockId: number, personId: number) => layoutWithHead(roles(), of, blockId, pickedHead(withHeadPerson(roles(), headFieldsOf(roles(), of, blockId)!, personId))!);
  const swapped = swap(swap(swap(kept, aero.id, 9), recovery.id, 13), logistics.id, 12);
  assert.deepEqual(
    swapped.departments.map((b) => b.head.binding),
    [
      { kind: "person", memberId: 9 },
      { kind: "department-head", departmentId: 3 },
      { kind: "team-seat", roleId: 27 },
    ],
    "the heads are bound to a person, another department's head and a team-level seat",
  );
  assert.deepEqual(groupsOf(swapped), expected, "a swap keeps the block's group");
  const reset = teamRecordLayout(roles(), swapped);
  assert.deepEqual(groupsOf(reset), expected);
  assert.deepEqual(
    reset.departments.map((b) => b.head.binding),
    [1, 2, 3].map((departmentId) => ({ kind: "department-head", departmentId })),
    "each head is the team record's again",
  );
  assert.deepEqual(parseTeamLayout(JSON.parse(JSON.stringify(swapped))), swapped);

  // The head seat handed over: someone else heads Aerodynamics.
  const handedOver = roles(moved(moved(people, 4, member(10)), 9, head(1)));
  assert.deepEqual(groupsOf(teamRecordLayout(handedOver, kept)), expected);
  assert.equal(resolveLayout(teamRecordLayout(handedOver, kept), handedOver).departments[0].heads[0].shown.name, "Sofia Neri");

  // A department the editor added shows no team record department, so a department new to the team record never takes its group.
  const added = layoutWithHead(roles(), kept, null, { ...newDepartmentFields(), person: 10, department: "Outreach", group: layout.groups[1].id, leads: [] });
  assert.equal(added.departments.at(-1)?.department, null);
  const outreach = roles(moved(people, 10, head(5)), { ...org, departments: [...org.departments, { id: 5, name: "Outreach", kind: "operations" }], divisions: [...org.divisions, { id: 50, name: "Social Division", departmentId: 5 }] });
  const withOutreach = teamRecordLayout(outreach, added);
  assert.deepEqual(groupsOf(withOutreach), [...expected, ["Outreach", 5, "under"]]);
});

test("layoutPhotos lists the photos layerPhotos lists for the same edits", () => {
  const sorted = (list: readonly string[]) => [...list].sort();
  for (const name of ["name, role, photo and LinkedIn overrides", "added leaders", "an added department", "every edit"]) {
    const l = LAYERS[name];
    assert.deepEqual(sorted(layoutPhotos(snapshot(roles(), l).layout)), sorted(layerPhotos(l)), name);
  }
  // The group photo stays in the layer's own store, beside the intro text and the figures.
  assert.deepEqual(sorted(layoutPhotos(snapshot(seededRoles, seededLayer!).layout)), sorted(layerPhotos({ ...seededLayer!, groupPhoto: null })));
});
