import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  advisorPillLabel,
  advisorRolesOf,
  ONLY_ROLE,
  ONLY_TEAM_LEADER_CHANGES,
  planAdvisorPlaceChange,
  type AdvisorPlaceChange,
  type AdvisorPlaceOption,
} from "./advisor-roles";
import { membershipsOf, type OrgChart, type RoleSeat, type TeamActor, type TeamStanding } from "./team";

// Edit details' department and whole-team Advisor rows (issue #976): where
// each one's pill may move the role, what it locks and why, and the server's
// plan reading the same rule.

const ORG: OrgChart = {
  departments: [
    { id: 1, name: "Aerodynamics", kind: "technical" },
    { id: 2, name: "Structures", kind: "technical" },
  ],
  divisions: [
    { id: 10, name: "Mission Analysis", departmentId: 1 },
    { id: 11, name: "Optimization", departmentId: 1 },
    { id: 20, name: "Design & Manufacturing", departmentId: 2 },
  ],
};
const TEAM: TeamActor = { kind: "team" };
const HEAD: TeamActor = { kind: "head", departmentIds: [1] };

/** A member of each division named. */
const memberOf = (...divisionIds: number[]) => membershipsOf(divisionIds.map((divisionId) => ({ divisionId, role: "member" as const, since: "2025-10-01" })));

const advisesAerodynamics: TeamStanding = { memberships: memberOf(20), beyond: [{ kind: "advisor", departmentId: 1 }] };

const labels = (options: readonly AdvisorPlaceOption[]) => options.map((o) => o.label);
const locks = (options: readonly AdvisorPlaceOption[]) => Object.fromEntries(options.flatMap((o) => (o.permission.allowed ? [] : [[o.label, o.permission.reason]])));

describe("the rows", () => {
  test("a department Advisor role is a row named by its department; it moves to the whole team, the department or a division in it, or ends", () => {
    const [row, ...more] = advisorRolesOf(advisesAerodynamics, ORG, TEAM);
    assert.equal(more.length, 0);
    assert.equal(row.name, "Aerodynamics");
    assert.deepEqual(labels(row.options), ["Aerodynamics", "Whole team", "Mission Analysis", "Optimization", "End this role"]);
    assert.deepEqual(locks(row.options), {}, "the team may pick each");
  });

  test("a whole-team Advisor role is a row named Whole team; it moves to a department, and comes first", () => {
    const standing: TeamStanding = { memberships: memberOf(), beyond: [{ kind: "advisor", departmentId: 2 }, { kind: "advisor", departmentId: null }] };
    const [team, department] = advisorRolesOf(standing, ORG, TEAM);
    assert.equal(team.name, "Whole team");
    assert.deepEqual(labels(team.options), ["Whole team", "Aerodynamics", "Structures", "End this role"]);
    assert.deepEqual(locks(team.options), { Structures: "Already advises Structures" });
    assert.equal(department.name, "Structures");
    assert.deepEqual(locks(department.options), { "Whole team": "Already advises the whole team" });
  });

  test("no row for a head or a division Advisor role", () => {
    const standing: TeamStanding = { memberships: memberOf(10), beyond: [{ kind: "head", departmentId: 1, title: "" }] };
    assert.deepEqual(advisorRolesOf(standing, ORG, TEAM), []);
  });

  test("a division they are in already is locked, and so is End while it is their only role", () => {
    const inMission: TeamStanding = { memberships: memberOf(10), beyond: [{ kind: "advisor", departmentId: 1 }] };
    assert.deepEqual(locks(advisorRolesOf(inMission, ORG, TEAM)[0].options), { "Mission Analysis": "Already in Mission Analysis" });
    const only: TeamStanding = { memberships: memberOf(), beyond: [{ kind: "advisor", departmentId: 1 }] };
    assert.deepEqual(locks(advisorRolesOf(only, ORG, TEAM)[0].options), { "End this role": ONLY_ROLE });
  });

  test("for anyone but the team every choice but the current place is locked: a role beyond the divisions is the team leader's", () => {
    const options = advisorRolesOf(advisesAerodynamics, ORG, HEAD)[0].options;
    assert.ok(options[0].permission.allowed, "the current place stays open");
    assert.ok(options.slice(1).every((o) => !o.permission.allowed && o.permission.reason === ONLY_TEAM_LEADER_CHANGES));
  });

  test("the pill reads Advisor, the place picked, or Ends on Save", () => {
    const row = advisorRolesOf(advisesAerodynamics, ORG, TEAM)[0];
    assert.equal(advisorPillLabel({ kind: "advise", place: row.place }, row.place, row.options), "Advisor");
    assert.equal(advisorPillLabel({ kind: "advise", place: { kind: "division", divisionId: 10 } }, row.place, row.options), "Advisor · Mission Analysis");
    assert.equal(advisorPillLabel({ kind: "end" }, row.place, row.options), "Ends on Save");
  });
});

describe("the plan Save writes", () => {
  const ROLES: RoleSeat[] = [
    { id: 1, type: "core", divisionId: 20, departmentId: null, title: "", since: "2025-10-01", fullAccess: null },
    { id: 2, type: "advisor", divisionId: null, departmentId: 1, title: "Advisor", since: "2025-10-01", fullAccess: null },
  ];
  const plan = (to: AdvisorPlaceChange["to"], over: { actor?: TeamActor; roles?: RoleSeat[]; standing?: TeamStanding } = {}) =>
    planAdvisorPlaceChange({
      actor: over.actor ?? TEAM,
      org: ORG,
      change: { personId: 9, from: { kind: "department", departmentId: 1 }, to },
      roles: over.roles ?? ROLES,
      standing: over.standing ?? advisesAerodynamics,
    });

  test("a move ends the Advisor row and starts one at the place picked; End starts none", () => {
    assert.deepEqual(plan({ kind: "division", divisionId: 11 }), { ok: true, value: { ending: 2, start: { kind: "division", divisionId: 11 } } });
    assert.deepEqual(plan({ kind: "team" }), { ok: true, value: { ending: 2, start: { kind: "team" } } });
    assert.deepEqual(plan(null), { ok: true, value: { ending: 2, start: null } });
  });

  test("refused as the pill locks it, and for a place it does not offer", () => {
    assert.deepEqual(plan({ kind: "team" }, { actor: HEAD }), { ok: false, error: `${ONLY_TEAM_LEADER_CHANGES}.` });
    assert.deepEqual(plan(null, { roles: [ROLES[1]], standing: { memberships: memberOf(), beyond: [{ kind: "advisor", departmentId: 1 }] } }), { ok: false, error: ONLY_ROLE });
    assert.equal(plan({ kind: "division", divisionId: 20 }).ok, false, "a division of another department");
    assert.equal(plan({ kind: "department", departmentId: 1 }).ok, false, "where it is already");
    assert.equal(plan({ kind: "team" }, { roles: [ROLES[0]] }).ok, false, "no Advisor role there any more");
  });
});
