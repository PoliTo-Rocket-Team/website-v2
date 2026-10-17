import assert from "node:assert/strict";
import { test } from "node:test";
import { inDivisions, NO_MEMBERSHIPS, type BoardSeat, type Placement } from "@/lib/dashboard/team";
import { team } from "./team";
import { teamPageFromRoles, type TeamPerson, type TeamRoles } from "./team-roles";

// The Team page built from the team's roles (issue #282).

const since = "2024-10-01";

function person(id: number, name: string, placement: Placement, over: Partial<TeamPerson> = {}): TeamPerson {
  return { id, name, placement, pageTitle: null, photo: null, linkedin: null, teamEmail: null, ...over };
}

const leader = (): Placement => ({ role: "team-leader", memberships: NO_MEMBERSHIPS });
const seat = (s: BoardSeat): Placement => ({ role: "board", seat: s, memberships: NO_MEMBERSHIPS });
const head = (departmentId: number, led: readonly number[] = []): Placement => ({
  role: "head",
  departmentId,
  memberships: inDivisions(led.map((divisionId) => ({ divisionId, role: "lead" as const, since }))).memberships,
});
const lead = (divisionId: number) => inDivisions([{ divisionId, role: "lead", since }]);
const member = (divisionId: number) => inDivisions([{ divisionId, role: "member", since }]);

const org: TeamRoles["org"] = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Recovery", kind: "technical" },
    { id: 3, name: "Electronics", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis Division", departmentId: 1 },
    { id: 11, name: "Optimization Division", departmentId: 1 },
    { id: 20, name: "Parachutes Division", departmentId: 2 },
    { id: 30, name: "Hardware Division", departmentId: 3 },
  ],
};

const people: readonly TeamPerson[] = [
  person(1, "Alessandro Greco", leader(), { pageTitle: "Team Leader", teamEmail: "president@politorocketteam.it" }),
  person(2, "Federica Moretti", seat("chief-engineer"), { pageTitle: "Chief Engineer" }),
  person(3, "Lorenzo Gallo", seat("project-manager"), { pageTitle: "Project Manager" }),
  person(4, "Chiara Rinaldi", head(1, [11]), {
    pageTitle: "Head of Aerodynamics",
    photo: "https://store.example/chiara.jpg",
    linkedin: "linkedin.com/in/chiara-rinaldi",
    teamEmail: "chiara.rinaldi@politorocketteam.it",
  }),
  person(5, "Pietro Ricci", lead(10)),
  person(6, "Marco Bianchi", lead(10), { pageTitle: "Mission Analysis Lead" }),
  person(7, "Irene Galli", head(2)),
  person(8, "Simone Testa", lead(20)),
  // Electronics has no head: its lead is a core member.
  person(9, "Stefano Mancini", lead(30), { pageTitle: "Hardware Lead" }),
  person(10, "Sofia Neri", member(10), { pageTitle: "Mission Analyst", linkedin: "linkedin.com/in/sofia-neri" }),
  person(11, "Anna Villa", member(11), { pageTitle: "  " }),
  person(12, "Kenji Watanabe", inDivisions([])),
];

const built = (list: readonly TeamPerson[] = people) => teamPageFromRoles({ org, people: list }, team);

test("who leads: the team leader, then the board seats on the arc in the Team tree's order", () => {
  const page = built()!;
  assert.equal(page.orgChart.leader.name, "Alessandro Greco");
  assert.deepEqual(
    page.orgChart.leaders.map((l) => [l.name, l.role]),
    [
      ["Lorenzo Gallo", "Project Manager"],
      ["Federica Moretti", "Chief Engineer"],
    ],
  );
});

test("departments: each open department's head with its division leads, in department and division order", () => {
  const [slide] = built()!.departments.groups;
  assert.deepEqual(
    slide.members.map((m) => (m.kind === "head" ? [m.name, m.role, m.leads.map((l) => `${l.name} · ${l.division}`)] : m.name)),
    [
      ["Chiara Rinaldi", "Head of Aerodynamics", ["Marco Bianchi · Mission Analysis", "Pietro Ricci · Mission Analysis", "Chiara Rinaldi · Optimization"]],
      ["Irene Galli", "Head of Recovery", ["Simone Testa · Parachutes"]],
    ],
  );
});

test("core members: everyone else with an active role, by name, with their dashboard title", () => {
  assert.deepEqual(built()!.coreMembers.members, [
    { name: "Anna Villa" },
    { name: "Kenji Watanabe" },
    { name: "Sofia Neri", role: "Mission Analyst", linkedin: "sofia-neri" },
    { name: "Stefano Mancini", role: "Hardware Lead" },
  ]);
});

test("a title changed on the member panel shows on the rebuilt page", () => {
  const renamed = people.map((p) => (p.id === 10 ? { ...p, pageTitle: "Trajectory Analyst" } : p));
  assert.equal(built(renamed)!.coreMembers.members.find((m) => m.name === "Sofia Neri")?.role, "Trajectory Analyst");
});

test("photo, LinkedIn and team email come from the member record; none of them is an absent key", () => {
  const [slide] = built()!.departments.groups;
  const [chiara, irene] = slide.members;
  assert.deepEqual(
    { photo: chiara.photo, linkedin: chiara.linkedin, email: chiara.email },
    { photo: "https://store.example/chiara.jpg", linkedin: "chiara-rinaldi", email: "chiara.rinaldi@politorocketteam.it" },
  );
  assert.deepEqual(Object.keys(irene!).sort(), ["kind", "leads", "name", "role"]);
});

test("the arc keeps at most eight leaders; slides hold ten heads each, at most five", () => {
  const seats = Array.from({ length: 10 }, (_, i) => person(100 + i, `Seat ${String(i).padStart(2, "0")}`, seat("chief-engineer")));
  const departments = Array.from({ length: 56 }, (_, i) => ({ id: 1000 + i, name: `Department ${i}`, kind: "technical" as const }));
  const heads = departments.map((d, i) => person(200 + i, `Head ${String(i).padStart(2, "0")}`, head(d.id)));
  const page = teamPageFromRoles({ org: { departments, divisions: [] }, people: [...people, ...seats, ...heads] }, team)!;
  assert.equal(page.orgChart.leaders.length, 8);
  assert.deepEqual(
    page.departments.groups.map((g) => g.members.length),
    [10, 10, 10, 10, 10],
  );
  assert.ok(page.departments.groups.every((g) => g.name === "Technical Departments"));
});

test("the carousel groups heads by their department's kind: Technical Departments first, then Operations (issue #325)", () => {
  // Operations comes first by id; its slide still follows the technical one.
  const kinded: TeamRoles["org"] = {
    departments: [{ id: 0, name: "Operations", kind: "operations" }, ...org.departments],
    divisions: [...org.divisions, { id: 40, name: "Logistics Division", departmentId: 0 }, { id: 41, name: "Safety Division", departmentId: 0 }],
  };
  const operationsPeople = [
    person(20, "Rocco Bellon", head(0), { pageTitle: "Head of Operations" }),
    person(21, "Ettore De Bartolo", lead(40)),
    person(22, "Asmaa Jamai", lead(41)),
  ];
  const page = teamPageFromRoles({ org: kinded, people: [...people, ...operationsPeople] }, team)!;
  const [technical, operations] = page.departments.groups;
  assert.ok(operations);
  assert.deepEqual(
    page.departments.groups.map((g) => g.name),
    ["Technical Departments", "Operations"],
  );
  assert.deepEqual(
    technical.members.map((m) => m.name),
    ["Chiara Rinaldi", "Irene Galli"],
  );
  // An operations head stands beside their divisions' leads, each drawn at a head's level (board 26).
  assert.deepEqual(
    operations.members.map((m) => (m.kind === "head" ? [m.name, m.role, m.leads.length] : [m.name, m.division])),
    [
      ["Rocco Bellon", "Head of Operations", 0],
      ["Ettore De Bartolo", "Logistics"],
      ["Asmaa Jamai", "Safety"],
    ],
  );
  // Everyone the carousel draws is left out of the core members.
  assert.ok(!page.coreMembers.members.some((m) => operationsPeople.some((p) => p.name === m.name)));
});

test("a kind with more than ten places fills more slides under the same heading, at most five in all (boards 26e, 26f)", () => {
  const departments = [
    ...Array.from({ length: 35 }, (_, i) => ({ id: 1000 + i, name: `Department ${i}`, kind: "technical" as const })),
    { id: 2000, name: "Operations", kind: "operations" as const },
  ];
  const heads = departments.map((d, i) => person(200 + i, `Head ${String(i).padStart(2, "0")}`, head(d.id)));
  const page = teamPageFromRoles({ org: { departments, divisions: [] }, people: [...people, ...heads] }, team)!;
  assert.deepEqual(
    page.departments.groups.map((g) => [g.name, g.members.length]),
    [
      ["Technical Departments", 10],
      ["Technical Departments", 10],
      ["Technical Departments", 10],
      ["Technical Departments", 5],
      ["Operations", 1],
    ],
  );
});

test("roles that cannot fill the page build nothing, so the page keeps its record", () => {
  assert.equal(built(people.filter((p) => p.placement.role !== "team-leader")), null);
  assert.equal(built(people.filter((p) => p.placement.role !== "board")), null);
});
