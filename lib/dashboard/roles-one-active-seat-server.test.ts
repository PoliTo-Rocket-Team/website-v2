// The team snapshot imports server-only modules; the access matrix's stand-ins let it load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { departments, members, roles, users } from "@/db/schema";
import { addRows, changeRows, resetDatabase } from "./access-matrix/test-database";
import { buildTeamTree } from "./team";
import { readTeamSnapshot, rosterOf } from "./team-database";

// One active holder per seat (issue #667). The team snapshot reads the roles
// in a stable order (start date, then id), so a pick among them does not
// change when an update moves a row; and the database itself refuses a
// second active team leader, a second active holder of a full-access seat
// and a second active head of one department (drizzle/0062). An ended row
// (`leaved_at` set) beside the active one is still allowed. Each test runs
// on a freshly migrated PGlite database (./access-matrix/test-database.ts).

const SINCE = "2025-10-01";
const ENDED = "2026-06-01";
const AERODYNAMICS = 1;
const STRUCTURES = 2;
const PEOPLE = [1, 2, 3, 4, 5];

beforeEach(async () => {
  await resetDatabase();
  await addRows(departments, [
    { id: AERODYNAMICS, name: "Aerodynamics", startedAt: SINCE, code: "AER", kind: "technical" },
    { id: STRUCTURES, name: "Structures", startedAt: SINCE, code: "STR", kind: "technical" },
  ]);
  await addRows(members, PEOPLE.map((memberId) => ({ memberId })));
  await addRows(
    users,
    PEOPLE.map((memberId) => ({ id: `user-${memberId}`, email: `user-${memberId}@team.test`, firstName: "Person", lastName: `${memberId}`, member: memberId, createdAt: SINCE })),
  );
});

/** Whether `run` is refused by the unique index `index`. */
async function refusedBy(index: string, run: () => Promise<unknown>): Promise<void> {
  await assert.rejects(run, (error: unknown) => {
    const text = `${String(error)} ${String((error as { cause?: unknown }).cause)}`;
    assert.match(text, new RegExp(`duplicate key value violates unique constraint "${index}"`));
    return true;
  });
}

describe("the team snapshot reads roles in a stable order", () => {
  test("by start date, then id, also after an update moves an earlier row", async () => {
    await addRows(roles, [
      { id: 10, memberId: 1, deptId: AERODYNAMICS, title: "Head", startedAt: SINCE, type: "head" },
      { id: 11, memberId: 2, title: "Member", startedAt: "2024-09-01", type: "core" },
      { id: 12, memberId: 3, title: "Member", startedAt: SINCE, type: "core" },
      { id: 13, memberId: 4, deptId: AERODYNAMICS, title: "Head", startedAt: "2023-01-01", leavedAt: "2024-08-31", type: "head" },
    ]);
    const order = [13, 11, 10, 12];
    const before = await readTeamSnapshot();
    assert.deepEqual(before.roles.map((r) => r.id), order);
    const headBefore = buildTeamTree(rosterOf(before), before.org, "2025–26", null).departments.find((d) => d.id === AERODYNAMICS)?.head;

    // On Postgres an update writes a new row version, so a read with no order returns the row last.
    await changeRows(roles, { id: 10 }, { title: "Chief of Aerodynamics" });
    const after = await readTeamSnapshot();
    assert.deepEqual(after.roles.map((r) => r.id), order);
    const headAfter = buildTeamTree(rosterOf(after), after.org, "2025–26", null).departments.find((d) => d.id === AERODYNAMICS)?.head;
    assert.equal(headAfter?.id, 1);
    assert.equal(headAfter?.id, headBefore?.id, "the same head on every load");
  });
});

describe("the database keeps one active holder per seat", () => {
  test("a second active team leader is refused", async () => {
    await addRows(roles, [{ id: 20, memberId: 1, title: "Team Leader", startedAt: SINCE, type: "president" }]);
    await refusedBy("roles_one_active_team_leader", () => addRows(roles, [{ id: 21, memberId: 2, title: "Team Leader", startedAt: SINCE, type: "president" }]));
  });

  test("an ended team leader beside the active one is allowed", async () => {
    await addRows(roles, [
      { id: 20, memberId: 1, title: "Team Leader", startedAt: "2024-10-01", leavedAt: "2025-09-30", type: "president" },
      { id: 21, memberId: 2, title: "Team Leader", startedAt: SINCE, type: "president" },
      { id: 22, memberId: 3, title: "Team Leader", startedAt: "2023-10-01", leavedAt: "2024-09-30", type: "president" },
    ]);
  });

  for (const seat of ["operations_lead", "it_lead", "project_manager", "chief_engineer"] as const) {
    test(`a second active holder of the ${seat} seat is refused, and an ended one is allowed`, async () => {
      await addRows(roles, [
        { id: 30, memberId: 1, title: "Seat", startedAt: SINCE, type: "core", fullAccess: seat },
        { id: 31, memberId: 2, title: "Seat", startedAt: "2024-10-01", leavedAt: ENDED, type: "core", fullAccess: seat },
      ]);
      await refusedBy("roles_one_active_full_access_seat", () => addRows(roles, [{ id: 32, memberId: 3, title: "Seat", startedAt: SINCE, type: "core", fullAccess: seat }]));
      // On a head's role, as a seat can be (issue #485), it is the same seat.
      await refusedBy("roles_one_active_full_access_seat", () =>
        addRows(roles, [{ id: 33, memberId: 4, deptId: STRUCTURES, title: "Head", startedAt: SINCE, type: "head", fullAccess: seat }]),
      );
    });
  }

  test("each full-access seat has its own holder", async () => {
    await addRows(roles, [
      { id: 30, memberId: 1, title: "Operations Lead", startedAt: SINCE, type: "core", fullAccess: "operations_lead" },
      { id: 31, memberId: 2, title: "IT Lead", startedAt: SINCE, type: "core", fullAccess: "it_lead" },
      { id: 32, memberId: 3, title: "Project Manager", startedAt: SINCE, fullAccess: "project_manager" },
      { id: 33, memberId: 4, title: "Chief Engineer", startedAt: SINCE, fullAccess: "chief_engineer" },
    ]);
  });

  test("a second active head of one department is refused, and an ended one is allowed", async () => {
    await addRows(roles, [
      { id: 40, memberId: 1, deptId: AERODYNAMICS, title: "Head", startedAt: SINCE, type: "head" },
      { id: 41, memberId: 2, deptId: AERODYNAMICS, title: "Head", startedAt: "2024-10-01", leavedAt: ENDED, type: "head" },
      // Another department has its own head.
      { id: 42, memberId: 3, deptId: STRUCTURES, title: "Head", startedAt: SINCE, type: "head" },
    ]);
    await refusedBy("roles_one_active_department_head", () => addRows(roles, [{ id: 43, memberId: 4, deptId: AERODYNAMICS, title: "Head", startedAt: SINCE, type: "head" }]));
  });

  test("reopening an ended row while the seat is held is refused", async () => {
    await addRows(roles, [
      { id: 50, memberId: 1, deptId: AERODYNAMICS, title: "Head", startedAt: SINCE, type: "head" },
      { id: 51, memberId: 2, deptId: AERODYNAMICS, title: "Head", startedAt: "2024-10-01", leavedAt: ENDED, type: "head" },
    ]);
    await refusedBy("roles_one_active_department_head", () => changeRows(roles, { id: 51 }, { leavedAt: null }));
  });
});
