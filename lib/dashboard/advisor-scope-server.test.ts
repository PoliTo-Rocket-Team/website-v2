import "./access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { roles, scopes } from "@/db/schema";
import { addRows, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { ADVISOR_TITLE, type AdvisorPlace } from "./hand-over";

// Stays as an advisor at a place the editor picks (issue #900), through the
// real server actions on the seeded matrix fixture (./access-matrix/
// fixture.ts) and a freshly migrated PGlite database: a division lead removed
// or replaced, a department head replaced, and a team seat's holder changed or
// removed each end the role they held and its access, and start one Advisor
// role at the picked place. A payload with no scope keeps today's place.

const TEAM_LEADER = accountOf("team leader").userId;
const DM = IDS.division("DM"); // Design & Manufacturing, in Structures
const STRUCTURES = IDS.department("DM");
const LEAD = IDS.lead("DM"); // leads Design & Manufacturing by row 5_000 + LEAD
const HEAD = EXTRA.head; // heads Structures by row 6_000
const SUCCESSOR = IDS.person("DM"); // a member of Design & Manufacturing
const OUTSIDER = IDS.person("MA"); // in Mission Analysis, not in Structures
const PROJECT_MANAGER = accountOf("Project Manager").memberId!;

const division = { name: "Design & Manufacturing", code: "DMA", members: [], emails: [] };
const department = { name: "Structures", code: "STR" };

type RoleRow = Record<string, unknown>;

beforeEach(async () => {
  await seedFixture();
  // The lead also belongs to Testing, and holds a grant in Design & Manufacturing.
  await addRows(roles, [{ id: 9_600, memberId: LEAD, divisionId: EXTRA.testing, title: "Member", startedAt: "2025-10-01", type: "core" }]);
  await addRows(scopes, [{ id: 9_601, memberId: LEAD, scope: "division", target: "positions", accessLevel: "edit", divisionId: DM }]);
  signInAs(TEAM_LEADER);
});

const activeOf = async (memberId: number) => (await tableRows(roles)).filter((r) => r.leavedAt == null && r.memberId === memberId);
const accessOf = async (memberId: number) => (await tableRows(scopes)).filter((r) => r.memberId === memberId);

const at = (r: RoleRow, place: AdvisorPlace) =>
  place.kind === "team"
    ? r.deptId == null && r.divisionId == null
    : place.kind === "department"
      ? r.deptId === place.departmentId && r.divisionId == null
      : r.divisionId === place.divisionId;

/** Their active Advisor roles, as the places they sit at: exactly the one picked. */
async function assertAdvisesOnlyAt(memberId: number, place: AdvisorPlace) {
  const advisor = (await activeOf(memberId)).filter((r) => r.type === "advisor");
  assert.equal(advisor.length, 1, "one active Advisor role");
  assert.ok(at(advisor[0], place), `the Advisor role sits at ${JSON.stringify(place)}`);
  assert.equal(advisor[0].title, ADVISOR_TITLE);
}

const PLACES = {
  division: { kind: "division", divisionId: DM },
  department: { kind: "department", departmentId: STRUCTURES },
  team: { kind: "team" },
} as const satisfies Record<string, AdvisorPlace>;

describe("a division lead removed or replaced stays as an advisor where the editor picked", () => {
  for (const scope of ["division", "department", "team"] as const) {
    test(`Remove lead, ${scope}: the lead role and their access end, their other division stays`, async () => {
      const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [SUCCESSOR], oldLeads: [{ personId: LEAD, via: "removed", outcome: "advisor", scope }] });
      assert.deepEqual(saved, { ok: true });
      const active = await activeOf(LEAD);
      assert.equal(active.some((r) => r.type === "lead"), false, "no lead role");
      assert.ok(active.some((r) => r.divisionId === EXTRA.testing && r.type === "core"), "still a member of Testing");
      await assertAdvisesOnlyAt(LEAD, PLACES[scope]);
      assert.deepEqual(await accessOf(LEAD), [], "their access ends");
    });
  }

  test("Replace lead with a scope: the replaced lead advises the department", async () => {
    const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [SUCCESSOR], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "advisor", scope: "department" }] });
    assert.deepEqual(saved, { ok: true });
    await assertAdvisesOnlyAt(LEAD, PLACES.department);
  });

  test("Replace lead saved with no scope keeps today's place: the division", async () => {
    const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [SUCCESSOR], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "advisor" }] });
    assert.deepEqual(saved, { ok: true });
    await assertAdvisesOnlyAt(LEAD, PLACES.division);
  });
});

describe("a replaced department head stays as an advisor where the editor picked", () => {
  for (const scope of ["department", "team", null] as const) {
    test(`Change head, ${scope ?? "no scope"}`, async () => {
      const saved = await teamActions.saveDepartment(STRUCTURES, { ...department, head: { to: OUTSIDER, from: HEAD, outcome: "advisor", ...(scope === null ? {} : { scope }) } });
      assert.deepEqual(saved, { ok: true });
      assert.equal((await activeOf(HEAD)).some((r) => r.type === "head"), false, "no head role");
      await assertAdvisesOnlyAt(HEAD, scope === "team" ? PLACES.team : PLACES.department);
    });
  }

  test("a head is never offered a division: the save is refused and nothing changes", async () => {
    const saved = await teamActions.saveDepartment(STRUCTURES, { ...department, head: { to: OUTSIDER, from: HEAD, outcome: "advisor", scope: "division" } });
    assert.equal(saved.ok, false);
    assert.ok((await activeOf(HEAD)).some((r) => r.type === "head"), "still the head");
  });
});

describe("a team seat's holder stays as an advisor to the whole team", () => {
  const pmRow = async () => (await activeOf(PROJECT_MANAGER)).find((r) => r.fullAccess === "project_manager")?.id as number;

  test("Change holder: the full-access seat moves on, the holder advises the team", async () => {
    const saved = await teamActions.changeSeatHolder(await pmRow(), { to: SUCCESSOR, outcome: "advisor", scope: "team" });
    assert.deepEqual(saved, { ok: true });
    assert.equal((await activeOf(PROJECT_MANAGER)).some((r) => r.fullAccess != null), false, "no full-access seat left");
    await assertAdvisesOnlyAt(PROJECT_MANAGER, PLACES.team);
    assert.deepEqual(await accessOf(PROJECT_MANAGER), [], "their access ends");
  });

  test("Remove seat with Stays as an advisor: the seat and its full access end, the holder advises the team", async () => {
    const saved = await teamActions.removeSeat(await pmRow(), { outcome: "advisor", scope: "team" });
    assert.deepEqual(saved, { ok: true });
    assert.equal((await activeOf(PROJECT_MANAGER)).some((r) => r.fullAccess != null), false, "the seat ends");
    await assertAdvisesOnlyAt(PROJECT_MANAGER, PLACES.team);
    assert.deepEqual(await accessOf(PROJECT_MANAGER), [], "their access ends");
  });

  test("a seat holder is never offered a department", async () => {
    const row = await pmRow();
    assert.equal((await teamActions.removeSeat(row, { outcome: "advisor", scope: "department" })).ok, false);
    assert.ok((await activeOf(PROJECT_MANAGER)).some((r) => r.id === row), "still holds the seat");
  });
});
