// The team snapshot and the dashboard import server-only modules; the access matrix's stand-ins let them load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { departments, members, roles, users } from "@/db/schema";
import { addRows, changeRows, resetDatabase, tableRows } from "./access-matrix/test-database";
import { signInAs } from "./access-matrix/session";
import { openDashboard } from "./open";
import { buildTeamTree, type RoleType } from "./team";
import { readTeamSnapshot, rosterOf } from "./team-database";
import { FLAG_OF_SEAT, fullAccessSeatOf, SEAT_OF_FLAG, standingOf, viewerKindOf, type FlaggedSeat, type SeatFlag, type ViewerStanding } from "./viewer";

// Every seat may have several active holders (epic #861, issue #867): the
// database takes two active team leaders, two active holders of one
// full-access seat and two active heads of one department (drizzle/0077
// dropped the one-holder indexes of drizzle/0062), and each holder gets the
// seat's viewer kind and full-access seat, read off their own active rows
// (`viewerKindOf`, `fullAccessSeatOf`) and as their dashboard opens. The team
// snapshot reads the roles in a stable order (start date, then id). Each test
// runs on a freshly migrated PGlite database (./access-matrix/test-database.ts).

const SINCE = "2025-10-01";
const LATER = "2026-01-15";
const AERODYNAMICS = 1;
const STRUCTURES = 2;
const PEOPLE = [1, 2, 3, 4, 5];
const FLAGGED_SEATS: readonly FlaggedSeat[] = ["operations-lead", "it-lead", "project-manager", "chief-engineer"];

const userOf = (memberId: number) => `user-${memberId}`;

beforeEach(async () => {
  await resetDatabase();
  await addRows(departments, [
    { id: AERODYNAMICS, name: "Aerodynamics", startedAt: SINCE, code: "AER", kind: "technical" },
    { id: STRUCTURES, name: "Structures", startedAt: SINCE, code: "STR", kind: "technical" },
  ]);
  await addRows(members, PEOPLE.map((memberId) => ({ memberId, ndaSignedAt: SINCE })));
  await addRows(
    users,
    PEOPLE.map((memberId) => ({ id: userOf(memberId), email: `user-${memberId}@team.test`, firstName: "Person", lastName: `${memberId}`, member: memberId, createdAt: SINCE })),
  );
});

/** Every active role row. */
async function activeRows() {
  return (await tableRows(roles)).filter((r) => r.leavedAt === null);
}

/** Someone's viewer kind and full-access seat, read off their own active rows as the dashboard reads them. */
async function accessOf(memberId: number) {
  const active = (await activeRows())
    .filter((r) => r.memberId === memberId)
    .map((r) => ({
      type: r.type as RoleType,
      divisionId: r.divisionId as number | null,
      fullAccess: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess as SeatFlag],
    }));
  return { kind: viewerKindOf({ scopes: [], activeRoles: active }), seat: fullAccessSeatOf(active) };
}

/** Signs in as the member's account and answers the standing their dashboard opens with. */
async function dashboardStandingOf(memberId: number): Promise<ViewerStanding> {
  signInAs(userOf(memberId));
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `member ${memberId}: the dashboard opens`);
  return standingOf((opening as { data: { viewer: ViewerStanding } }).data.viewer);
}

describe("the database accepts several active holders of one seat", () => {
  test("two active team leaders", async () => {
    await addRows(roles, [
      { id: 20, memberId: 1, title: "Team Leader", startedAt: SINCE, type: "president" },
      { id: 21, memberId: 2, title: "Team Leader", startedAt: LATER, type: "president" },
    ]);
    assert.deepEqual((await activeRows()).filter((r) => r.type === "president").map((r) => r.memberId), [1, 2]);
  });

  for (const seat of FLAGGED_SEATS) {
    test(`two active holders of the ${seat} seat, on a plain role and on a head's role`, async () => {
      const flag = FLAG_OF_SEAT[seat];
      await addRows(roles, [
        { id: 30, memberId: 1, title: "Seat", startedAt: SINCE, type: "core", fullAccess: flag },
        { id: 31, memberId: 2, title: "Seat", startedAt: LATER, type: "core", fullAccess: flag },
        // On a head's role, as a seat can be (issue #485), it is the same seat.
        { id: 32, memberId: 3, deptId: STRUCTURES, title: "Head", startedAt: LATER, type: "head", fullAccess: flag },
      ]);
      assert.deepEqual((await activeRows()).filter((r) => r.fullAccess === flag).map((r) => r.memberId), [1, 2, 3]);
    });
  }

  test("two active heads of one department", async () => {
    await addRows(roles, [
      { id: 40, memberId: 1, deptId: AERODYNAMICS, title: "Head", startedAt: SINCE, type: "head" },
      { id: 41, memberId: 2, deptId: AERODYNAMICS, title: "Head", startedAt: LATER, type: "head" },
    ]);
    assert.deepEqual((await activeRows()).filter((r) => r.type === "head" && r.deptId === AERODYNAMICS).map((r) => r.memberId), [1, 2]);
  });

  test("an ended row reopened while the seat is held", async () => {
    await addRows(roles, [
      { id: 50, memberId: 1, deptId: AERODYNAMICS, title: "Head", startedAt: SINCE, type: "head" },
      { id: 51, memberId: 2, deptId: AERODYNAMICS, title: "Head", startedAt: "2024-10-01", leavedAt: "2025-09-30", type: "head" },
    ]);
    await changeRows(roles, { id: 51 }, { leavedAt: null });
    assert.deepEqual((await activeRows()).map((r) => r.id).sort(), [50, 51]);
  });
});

describe("each co-holder gets the seat's viewer kind and full-access seat", () => {
  test("both team leaders are the team leader, with full access", async () => {
    await addRows(roles, [
      { id: 20, memberId: 1, title: "Team Leader", startedAt: SINCE, type: "president" },
      { id: 21, memberId: 2, title: "Team Leader", startedAt: LATER, type: "president" },
    ]);
    for (const holder of [1, 2]) {
      assert.deepEqual(await accessOf(holder), { kind: "operations-lead", seat: "team-leader" }, `holder ${holder}`);
      assert.deepEqual(await dashboardStandingOf(holder), { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false }, `holder ${holder}`);
    }
  });

  for (const seat of FLAGGED_SEATS) {
    test(`both holders of the ${seat} seat hold it, with full access`, async () => {
      const flag = FLAG_OF_SEAT[seat];
      await addRows(roles, [
        { id: 30, memberId: 1, title: "Seat", startedAt: SINCE, type: "core", fullAccess: flag },
        { id: 31, memberId: 2, title: "Seat", startedAt: LATER, type: "core", fullAccess: flag },
      ]);
      for (const holder of [1, 2]) {
        assert.deepEqual(await accessOf(holder), { kind: "operations-lead", seat }, `holder ${holder}`);
        assert.deepEqual(await dashboardStandingOf(holder), { kind: "operations-lead", seat, siteContent: false, approveOrders: false }, `holder ${holder}`);
      }
    });
  }

  test("both heads of one department are department heads, with no full-access seat", async () => {
    await addRows(roles, [
      { id: 40, memberId: 1, deptId: AERODYNAMICS, title: "Head", startedAt: SINCE, type: "head" },
      { id: 41, memberId: 2, deptId: AERODYNAMICS, title: "Head", startedAt: LATER, type: "head" },
    ]);
    for (const holder of [1, 2]) {
      assert.deepEqual(await accessOf(holder), { kind: "department-head", seat: null }, `holder ${holder}`);
      assert.deepEqual(await dashboardStandingOf(holder), { kind: "department-head", siteContent: false, approveOrders: false }, `holder ${holder}`);
    }
  });

  test("someone with a plain role beside two team leaders gains nothing from their seat", async () => {
    await addRows(roles, [
      { id: 20, memberId: 1, title: "Team Leader", startedAt: SINCE, type: "president" },
      { id: 21, memberId: 2, title: "Team Leader", startedAt: LATER, type: "president" },
      { id: 22, memberId: 3, title: "Member", startedAt: SINCE, type: "core" },
    ]);
    assert.deepEqual(await accessOf(3), { kind: "member", seat: null });
  });
});

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
