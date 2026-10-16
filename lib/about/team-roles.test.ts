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
    { id: 1, name: "Aerodynamics" },
    { id: 2, name: "Recovery" },
    { id: 3, name: "Electronics" },
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
  const departments = Array.from({ length: 56 }, (_, i) => ({ id: 1000 + i, name: `Department ${i}` }));
  const heads = departments.map((d, i) => person(200 + i, `Head ${String(i).padStart(2, "0")}`, head(d.id)));
  const page = teamPageFromRoles({ org: { departments, divisions: [] }, people: [...people, ...seats, ...heads] }, team)!;
  assert.equal(page.orgChart.leaders.length, 8);
  assert.deepEqual(
    page.departments.groups.map((g) => g.members.length),
    [10, 10, 10, 10, 10],
  );
  assert.equal(page.departments.groups[0].name, "Department 0 to Department 9");
});

test("roles that cannot fill the page build nothing, so the page keeps its record", () => {
  assert.equal(built(people.filter((p) => p.placement.role !== "team-leader")), null);
  assert.equal(built(people.filter((p) => p.placement.role !== "board")), null);
});
