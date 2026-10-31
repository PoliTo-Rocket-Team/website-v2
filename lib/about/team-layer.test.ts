import assert from "node:assert/strict";
import { test } from "node:test";
import { BOARD_FLAG_TITLES, BOARD_FLAGS, inDivisions, NO_MEMBERSHIPS, type BoardFlag, type Placement } from "@/lib/dashboard/team";
import {
  addLeader,
  applyLayer,
  ARC_LEADERS,
  isTeamPageLayer,
  leadersOnArc,
  NO_TEAM_LAYER,
  resetLayer,
  type AddedLeader,
  type TeamPageLayer,
} from "./team-layer";
import { publicStoreHost } from "@/lib/storage/pathname";
import { describedGroupPhoto, groupPhotoDescriptions } from "./team-page-edit";
import { ownsTeamPageUpload } from "./team-page-photos";
import type { TeamPerson } from "./team-person";
import { team } from "./team";
import { teamBuildOf, teamPageFromRoles, type TeamRoles } from "./team-roles";

// The Team page's visual layer (issue #283): each edit at its spot, added
// leaders at their place on the arc, Reset to team, and edits that outlive
// changes to the real team.

const since = "2024-10-01";

function person(id: number, name: string, placement: Placement, over: Partial<TeamPerson> = {}): TeamPerson {
  return { id, name, placement, furtherSeats: [], pageTitle: null, photo: null, linkedin: null, teamEmail: null, ...over };
}

const leader = (): Placement => ({ role: "team-leader", memberships: NO_MEMBERSHIPS });
const seat = (s: BoardFlag): Placement => ({
  role: "board",
  seat: { roleId: BOARD_FLAGS.indexOf(s) + 1, title: BOARD_FLAG_TITLES[s], flag: s, since },
  memberships: NO_MEMBERSHIPS,
});
const head = (departmentId: number): Placement => ({ role: "head", departmentId, title: "", memberships: NO_MEMBERSHIPS });
const lead = (divisionId: number) => inDivisions([{ divisionId, role: "lead", since }]);
const member = (divisionId: number) => inDivisions([{ divisionId, role: "member", since }]);

const org: TeamRoles["org"] = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Recovery", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 11, name: "Optimization Division", departmentId: 1 },
    { id: 20, name: "Parachutes Division", departmentId: 2 },
  ],
};

const people: readonly TeamPerson[] = [
  person(1, "Alessandro Greco", leader(), { pageTitle: "Team Leader", teamEmail: "president@politorocketteam.it" }),
  person(2, "Federica Moretti", seat("chief-engineer")),
  person(3, "Lorenzo Gallo", seat("project-manager")),
  person(4, "Chiara Rinaldi", head(1), { teamEmail: "chiara.rinaldi@politorocketteam.it" }),
  person(5, "Pietro Ricci", lead(10)),
  person(6, "Marco Bianchi", lead(11)),
  person(7, "Irene Galli", head(2)),
  person(8, "Simone Testa", lead(20)),
  person(9, "Sofia Neri", member(10), { linkedin: "linkedin.com/in/sofia-neri", teamEmail: "sofia.neri@politorocketteam.it" }),
  person(10, "Kenji Watanabe", member(11)),
  person(11, "Anna Villa", member(20)),
];

const roles = (list: readonly TeamPerson[] = people): TeamRoles => ({ org, people: list });
const shownWith = (layer: TeamPageLayer, list?: readonly TeamPerson[]) => applyLayer(teamBuildOf(roles(list)), layer);
const names = (layer: TeamPageLayer, list?: readonly TeamPerson[]) => shownWith(layer, list).leaders.map((l) => l.shown.name);
const added = (id: number, personId: number, place: AddedLeader["place"], role = "Head of Operations"): AddedLeader => ({
  id,
  person: personId,
  place,
  role,
});

const edited: TeamPageLayer = {
  ...NO_TEAM_LAYER,
  leader: { role: "President" },
  spots: {
    "arc:project-manager:0": { person: 9, role: "Programme Manager" },
    "arc:chief-engineer:0": { name: "Federica M.", photo: "/team/federica.jpg", linkedin: "federica-m" },
    "head:2:0": { role: "Recovery lead" },
    "lead:10:0": { role: "Trajectories", hidden: undefined },
    "lead:11:0": { hidden: true },
  },
  departments: { "1": { name: "Aero" } },
  intro: "A new intro.",
  groupPhoto: { src: "/team/team-2026.jpg", alt: "The team in 2026" },
};

test("applyLayer shows each edit at its spot, and nothing else moves", () => {
  const shown = shownWith(edited);
  assert.deepEqual(shown.leader, { name: "Alessandro Greco", email: "president@politorocketteam.it", role: "President" });
  // The arc reads Project Manager, then Chief Engineer (the Team tree's seat order).
  assert.deepEqual(
    shown.leaders.map((l) => [l.at, l.shown]),
    [
      // Another team member in the spot: their name, LinkedIn and team email, with the role the edit sets.
      [
        "arc:project-manager:0",
        { name: "Sofia Neri", linkedin: "sofia-neri", email: "sofia.neri@politorocketteam.it", role: "Programme Manager" },
      ],
      ["arc:chief-engineer:0", { name: "Federica M.", photo: "/team/federica.jpg", linkedin: "federica-m", role: "Chief Engineer" }],
    ],
  );
  const [aero, recovery] = shown.departments;
  assert.equal(aero.name, "Aero");
  // The head's role reads "Head of" the name the page shows; a hidden lead row is left off.
  assert.equal(aero.heads[0].shown.role, "Head of Aero");
  assert.deepEqual(aero.heads[0].shown.leads, [{ name: "Pietro Ricci", division: "Trajectories" }]);
  assert.equal(recovery.heads[0].shown.role, "Recovery lead");
  assert.equal(shown.intro, "A new intro.");

  const page = teamPageFromRoles(roles(), team, edited);
  assert.ok(page !== null);
  assert.equal(page.header.intro, "A new intro.");
  assert.deepEqual(page.coreMembers.groupPhoto, { src: "/team/team-2026.jpg", alt: "The team in 2026" });
  assert.equal(page.departments.groups[0].name, "Technical Departments");
  // Core members are not editable: Sofia Neri shown on the arc is still a core member, from the roles.
  assert.ok(page.coreMembers.members.some((m) => m.name === "Sofia Neri"));
  assert.deepEqual(teamPageFromRoles(roles(), team, edited)?.coreMembers.members, teamPageFromRoles(roles(), team)?.coreMembers.members);
});

test("an edit whose spot the roles no longer fill is kept in the layer and skipped on the page, and shows again when the spot returns", () => {
  // The project manager left, Recovery closed, and Sofia Neri, shown in a spot, left too.
  const changed = people.filter((p) => p.id !== 3 && p.id !== 9).map((p) => (p.id === 7 ? person(7, p.name, member(10)) : p));
  const orgWithoutRecovery = { ...org, departments: org.departments.filter((d) => d.id !== 2) };
  const build = teamBuildOf({ org: orgWithoutRecovery, people: changed });
  const layer: TeamPageLayer = { ...edited, departments: { ...edited.departments, "2": { name: "Landing" } } };
  const before = structuredClone(layer);

  const shown = applyLayer(build, layer);
  assert.deepEqual(
    shown.leaders.map((l) => [l.at, l.shown.name]),
    [["arc:chief-engineer:0", "Federica M."]],
  );
  assert.deepEqual(
    shown.departments.map((d) => d.name),
    ["Aero"],
  );
  assert.deepEqual(layer, before, "applying never changes the layer");

  // An edit that shows someone who left falls back to who the roles put there.
  const back = applyLayer(teamBuildOf(roles(people.filter((p) => p.id !== 9))), layer);
  assert.equal(back.leaders[0].shown.name, "Lorenzo Gallo");
  assert.equal(back.leaders[0].shown.role, "Programme Manager");
  // The whole team back: every edit shows again.
  assert.deepEqual(applyLayer(teamBuildOf(roles()), layer).departments.map((d) => d.name), ["Aero", "Landing"]);
});

test("added leaders land at their place in OrgChart.leaders reading order: either end, between neighbours, after another added leader", () => {
  // The roles' arc reads Lorenzo Gallo (project manager), Federica Moretti (chief engineer).
  assert.deepEqual(names(NO_TEAM_LAYER), ["Lorenzo Gallo", "Federica Moretti"]);
  const layer: TeamPageLayer = {
    ...NO_TEAM_LAYER,
    addedLeaders: [
      added(1, 4, { at: "start" }),
      added(2, 7, { at: "end" }),
      added(3, 5, { after: "arc:project-manager:0" }),
      // Placed after a leader added later in the list: placed once that one is.
      added(4, 6, { after: "added:5" }),
      added(5, 8, { after: "arc:chief-engineer:0" }),
    ],
  };
  assert.deepEqual(names(layer), ["Chiara Rinaldi", "Lorenzo Gallo", "Pietro Ricci", "Federica Moretti", "Simone Testa", "Marco Bianchi", "Irene Galli"]);
  assert.deepEqual(
    shownWith(layer).leaders.map((l) => l.at),
    ["added:1", "arc:project-manager:0", "added:3", "arc:chief-engineer:0", "added:5", "added:4", "added:2"],
  );

  // A hidden neighbour keeps its place for the leaders placed after it.
  const hidden: TeamPageLayer = { ...layer, spots: { "arc:project-manager:0": { hidden: true } } };
  assert.deepEqual(names(hidden), ["Chiara Rinaldi", "Pietro Ricci", "Federica Moretti", "Simone Testa", "Marco Bianchi", "Irene Galli"]);

  // A neighbour gone from the team sends the leader to the end; a leader who left is skipped and kept.
  const gone = people.filter((p) => p.id !== 3 && p.id !== 4);
  assert.deepEqual(names(layer, gone), ["Federica Moretti", "Simone Testa", "Marco Bianchi", "Irene Galli", "Pietro Ricci"]);
});

test("someone the editor added to the arc whose role then becomes a team-level seat shows once, where the editor put them", () => {
  const rd: Placement = { role: "board", seat: { roleId: 27, title: "Head of R&D", flag: null, since }, memberships: NO_MEMBERSHIPS };
  const withSeat = [...people, person(12, "Marco Dona", rd)];
  const layer: TeamPageLayer = { ...NO_TEAM_LAYER, addedLeaders: [added(1, 12, { at: "start" }, "Head of R&D")] };
  assert.deepEqual(
    shownWith(layer, withSeat).leaders.map((l) => [l.at, l.shown.name, l.shown.role]),
    [
      ["added:1", "Marco Dona", "Head of R&D"],
      ["arc:project-manager:0", "Lorenzo Gallo", "Project Manager"],
      ["arc:chief-engineer:0", "Federica Moretti", "Chief Engineer"],
    ],
  );
  // With no such entry the roles seat them after the flagged seats.
  assert.deepEqual(names(NO_TEAM_LAYER, withSeat), ["Lorenzo Gallo", "Federica Moretti", "Marco Dona"]);
});

test("the arc holds at most eight: Add leader refuses the ninth, and the page draws only the first eight", () => {
  const build = teamBuildOf(roles());
  let layer = NO_TEAM_LAYER;
  for (const id of [4, 5, 6, 7, 8, 9]) {
    const result = addLeader(build, layer, { person: id, place: { at: "end" }, role: "Lead" });
    assert.ok(result.ok, `leader ${id}`);
    layer = result.value;
  }
  assert.equal(leadersOnArc(build, layer), ARC_LEADERS);
  assert.deepEqual(
    layer.addedLeaders.map((l) => l.id),
    [1, 2, 3, 4, 5, 6],
  );
  const ninth = addLeader(build, layer, { person: 10, place: { after: "arc:project-manager:0" }, role: "Lead" });
  assert.equal(ninth.ok, false);
  assert.equal(addLeader(build, NO_TEAM_LAYER, { person: 999, place: { at: "end" }, role: "Lead" }).ok, false, "someone not on the team");

  // Hiding one frees a place.
  const freed = addLeader(build, { ...layer, spots: { "arc:chief-engineer:0": { hidden: true } } }, { person: 10, place: { at: "start" }, role: "Lead" });
  assert.ok(freed.ok);

  // A layer stored over a team that grew still draws eight.
  const crowded: TeamPageLayer = { ...layer, addedLeaders: [...layer.addedLeaders, added(7, 10, { at: "end" })] };
  assert.equal(shownWith(crowded).leaders.length, ARC_LEADERS);
});

test("resetLayer removes every edit except the intro text and the group photo", () => {
  const full: TeamPageLayer = {
    ...edited,
    addedLeaders: [added(1, 4, { at: "start" })],
    departments: { "1": { name: "Aero", hidden: true, leadOrder: ["lead:11:0", "added:2"], addedLeads: [{ id: 2, person: 9, division: "Wind tunnel" }] } },
    addedDepartments: [{ id: 3, name: "Outreach", head: { person: 10 }, leads: [] }],
  };
  assert.deepEqual(resetLayer(full), { ...NO_TEAM_LAYER, intro: "A new intro.", groupPhoto: { src: "/team/team-2026.jpg", alt: "The team in 2026" } });
  assert.deepEqual(resetLayer(NO_TEAM_LAYER), NO_TEAM_LAYER);
});

test("departments: added division leads, the order of lead rows, hidden departments and added departments", () => {
  const layer: TeamPageLayer = {
    ...NO_TEAM_LAYER,
    departments: {
      "1": { leadOrder: ["added:2", "lead:11:0"], addedLeads: [{ id: 2, person: 9, division: "Wind tunnel" }] },
      "2": { hidden: true },
    },
    addedDepartments: [
      { id: 3, name: "Outreach", head: { person: 10 }, leads: [{ id: 4, person: 11, division: "Events" }] },
      // Its head left the team: skipped, kept.
      { id: 5, name: "Gone", head: { person: 999 }, leads: [] },
    ],
  };
  const shown = shownWith(layer);
  assert.deepEqual(
    shown.departments.map((d) => [d.at, d.name, d.heads.map((h) => [h.shown.name, h.shown.role, h.shown.leads.map((l) => l.division)])]),
    [
      [1, "Aerodynamics", [["Chiara Rinaldi", "Head of Aerodynamics", ["Wind tunnel", "Optimization", "Mission Analysis"]]]],
      ["added:3", "Outreach", [["Kenji Watanabe", "Head of Outreach", ["Events"]]]],
    ],
  );
});

test("a layer is read back only when this code could have written it", () => {
  const full: TeamPageLayer = {
    ...edited,
    addedLeaders: [added(1, 4, { at: "start" }), added(2, 5, { after: "added:1" })],
    addedDepartments: [{ id: 3, name: "Outreach", head: { person: 10, role: "Lead" }, leads: [{ id: 4, person: 11, division: "Events" }] }],
  };
  const owns = ownsTeamPageUpload(publicStoreHost("store_Own123"));
  const own = "https://own123.public.blob.vercel-storage.com/photos/team-page-1.jpg";
  assert.ok(isTeamPageLayer(JSON.parse(JSON.stringify(full)), owns));
  assert.ok(isTeamPageLayer(NO_TEAM_LAYER, owns));
  // The group photo's description is optional (issue #430).
  assert.ok(isTeamPageLayer({ ...NO_TEAM_LAYER, groupPhoto: { src: "/team/team-2026.jpg", alt: "" } }, owns));
  // A group photo uploaded in the editor, on the store's own host (issue #510).
  assert.ok(isTeamPageLayer({ ...NO_TEAM_LAYER, groupPhoto: { src: own, alt: "The team in 2026" } }, owns));
  // A layer saved before the figures were editable has no figures key, and reads as one that left them alone.
  assert.ok(isTeamPageLayer({ ...NO_TEAM_LAYER, figures: team.header.stats }, owns));
  const bad: unknown[] = [
    null,
    { ...NO_TEAM_LAYER, intro: undefined },
    { ...NO_TEAM_LAYER, spots: { "arc:treasurer:0": {} } },
    { ...NO_TEAM_LAYER, spots: { "head:1:0": { role: "" } } },
    { ...NO_TEAM_LAYER, spots: { "head:1:0": { email: "a@b.c" } } },
    { ...NO_TEAM_LAYER, leader: { hidden: true } },
    { ...NO_TEAM_LAYER, spots: { "lead:1:0": { photo: "javascript:alert(1)" } } },
    { ...NO_TEAM_LAYER, addedLeaders: [added(1, 4, { after: "head:1:0" as never })] },
    { ...NO_TEAM_LAYER, addedLeaders: [added(1, 4, { at: "start" }), added(1, 5, { at: "end" })] },
    { ...NO_TEAM_LAYER, groupPhoto: { src: "https://x.example/p.jpg", alt: "x" } },
    // Another Blob store's Team page upload, and a file of the own store that the editor did not upload.
    { ...NO_TEAM_LAYER, groupPhoto: { src: "https://other456.public.blob.vercel-storage.com/photos/team-page-1.jpg", alt: "x" } },
    { ...NO_TEAM_LAYER, groupPhoto: { src: "https://own123.public.blob.vercel-storage.com/photos/member-1.jpg", alt: "x" } },
    // Always four figures, each with a value and a label.
    { ...NO_TEAM_LAYER, figures: team.header.stats.slice(0, 3) },
    { ...NO_TEAM_LAYER, figures: [{ value: "", label: { text: "MEMBERS" } }, ...team.header.stats.slice(1)] },
    { ...NO_TEAM_LAYER, departments: { abc: {} } },
    { ...NO_TEAM_LAYER, extra: 1 },
  ];
  for (const value of bad) assert.equal(isTeamPageLayer(value, owns), false, JSON.stringify(value));
});

test("picking another group photo shows that photo's own description, never the one typed for the last", () => {
  const original = { src: "/team/team-2025.jpg", alt: "The team in 2025" } as const;
  let descriptions = groupPhotoDescriptions(original, original);
  // Typed for the record's photo, then another photo picked: it starts with none.
  descriptions = { ...descriptions, [original.src]: "Edited" };
  assert.deepEqual(describedGroupPhoto("/team/team-2026.jpg", descriptions), { src: "/team/team-2026.jpg", alt: "" });
  descriptions = { ...descriptions, "/team/team-2026.jpg": "The team in 2026" };
  // Back to the first: its own text is still there.
  assert.deepEqual(describedGroupPhoto(original.src, descriptions), { src: original.src, alt: "Edited" });
  assert.deepEqual(describedGroupPhoto("/team/team-2026.jpg", descriptions), { src: "/team/team-2026.jpg", alt: "The team in 2026" });
});
