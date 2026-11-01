import assert from "node:assert/strict";
import { test } from "node:test";
import { team } from "../about/team";
import type { TeamBuild } from "../about/team-layer";
import { isTeamSeat } from "../dashboard/team";
import { isActive, SEED_DATA, teamPageOfSeed, teamRolesOf, type SeedData } from "../../db/seed/cases";
import { CHIEF_ENGINEER, PROJECT_MANAGER, SECOND_SEAT_TITLE } from "../../db/seed/people";

// Two seeded people hold more than one seat (issue #944), so the Team tree
// draws one person on several cards (#929) on a preview. Their extra rows
// must not move them on the public Team page.

const data = SEED_DATA;
const people = teamRolesOf(data).people;
const personOf = (id: number) => {
  const person = people.find((p) => p.id === id);
  assert.ok(person, `member ${id} is on this year's team`);
  return person;
};
const activeRolesOf = (memberId: number) => data.roles.filter((r) => r.memberId === memberId && isActive(r));
const teamLevel = (r: SeedData["roles"][number]) => isTeamSeat({ type: r.type ?? null, departmentId: r.deptId ?? null, divisionId: r.divisionId ?? null });

/** Whether a role row is one of the two this issue adds. */
const isAdded = (r: SeedData["roles"][number]) =>
  (r.memberId === PROJECT_MANAGER && r.title === SECOND_SEAT_TITLE) || (r.memberId === CHIEF_ENGINEER && r.type === "head");

test("the Project Manager holds two team-level seats: a further seat of kind board beside their placement", () => {
  const person = personOf(PROJECT_MANAGER);
  assert.equal(activeRolesOf(PROJECT_MANAGER).filter(teamLevel).length, 2);
  assert.equal(person.placement.role, "board");
  assert.ok(person.furtherSeats.some((s) => s.kind === "board"));
});

test("the Chief Engineer holds a team-level seat and heads an open department: one further seat beside their placement", () => {
  const { org } = teamRolesOf(data);
  const roles = activeRolesOf(CHIEF_ENGINEER);
  assert.ok(roles.some(teamLevel));
  assert.ok(roles.some((r) => r.type === "head" && org.departments.some((d) => d.id === r.deptId)));
  const person = personOf(CHIEF_ENGINEER);
  assert.equal(person.placement.role, "board");
  assert.equal(person.furtherSeats.length, 1);
  assert.ok(["board", "head"].includes(person.furtherSeats[0].kind));
});

test("both are people lib/about/team.ts names, and two different people", () => {
  const named = new Set([team.orgChart.leader, ...team.orgChart.leaders].map((l) => l.name));
  assert.notEqual(PROJECT_MANAGER, CHIEF_ENGINEER);
  for (const id of [PROJECT_MANAGER, CHIEF_ENGINEER]) assert.ok(named.has(personOf(id).name), personOf(id).name);
});

test("no added role row carries a full-access flag, and each holder keeps exactly one flagged row", () => {
  const added = data.roles.filter(isAdded);
  assert.equal(added.length, 2);
  for (const r of added) assert.equal(r.fullAccess ?? null, null);
  for (const id of [PROJECT_MANAGER, CHIEF_ENGINEER]) assert.equal(activeRolesOf(id).filter((r) => r.fullAccess != null).length, 1);
});

/** Every place the Team page build gives someone: arc spot, department block entry or core member. */
function placesOf(build: TeamBuild): string[] {
  return [
    ...build.arc.map((l) => `${l.spot} ${l.person.id}`),
    ...build.departments.flatMap((d) => [...d.heads.map((h) => `${h.spot} ${h.person.id}`), ...d.leads.map((l) => `${l.spot} ${l.person.id}`)]),
    ...build.core.map((m) => `core ${m.name} ${m.role ?? ""}`),
  ];
}

test("the Team page keeps its arc spots, and neither person gains a place on it", () => {
  const { build } = teamPageOfSeed(data);
  assert.equal(build.arc.map((l) => l.spot).join(","), "arc:project-manager:0,arc:chief-engineer:0");
  const without = teamPageOfSeed({ ...data, roles: data.roles.filter((r) => !isAdded(r)) }).build;
  assert.deepEqual(placesOf(build), placesOf(without));
  for (const id of [PROJECT_MANAGER, CHIEF_ENGINEER]) {
    const name = personOf(id).name;
    assert.equal(build.arc.filter((l) => l.person.id === id).length, 1, name);
    assert.ok(!build.departments.some((d) => [...d.heads, ...d.leads].some((e) => e.person.id === id)), name);
    assert.ok(!build.core.some((m) => m.name === name), name);
  }
});
