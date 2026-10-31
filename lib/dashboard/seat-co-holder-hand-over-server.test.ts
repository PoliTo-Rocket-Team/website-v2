import "./access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { divisions, handOverRequests, roles, teamAddresses, teamAddressReroutes } from "@/db/schema";
import { addRows, databaseWrites, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import type { RoleType } from "./team";
import { fullAccessSeatOf, SEAT_OF_FLAG, type SeatFlag } from "./viewer";

// A co-holder's hand-over leaves the other holders in place (epic #861,
// issue #872), on the seeded matrix fixture (./access-matrix/fixture.ts)
// through the real server actions: with two holders of a seat, a hand-over,
// Change holder, Change head, a confirmed head's hand-over request, a move
// made head and Remove each end the picked holder's row only, and the other
// holder keeps the seat and its rights. A successor who holds that exact seat
// already is refused on each seat kind, and nothing is written. Each test
// runs on a freshly seeded, migrated PGlite database
// (./access-matrix/test-database.ts).

const TEAM_LEADER = accountOf("team leader");
const PROJECT_MANAGER = accountOf("Project Manager");
const STRUCTURES = IDS.department("DM");
const HEAD = EXTRA.head; // heads Structures by row 6_000
/** The second holder of each seat here: in two divisions, holding no seat in the fixture. */
const CO_HOLDER = EXTRA.mover;
const SUCCESSOR = IDS.person("DM"); // a member of Design & Manufacturing, in Structures
/** An unflagged team-level seat the fixture does not hold: laid over it here. */
const SAFETY_ROW = 9_500;
const SAFETY_HOLDER = IDS.person("MA");

type RoleRow = Record<string, unknown>;

beforeEach(async () => {
  await seedFixture();
  await addRows(roles, [{ id: SAFETY_ROW, memberId: SAFETY_HOLDER, title: "Safety Officer", startedAt: "2025-10-01", type: "core" }]);
});

const activeRows = async () => (await tableRows(roles)).filter((r) => r.leavedAt == null);
const holdersBy = async (holds: (r: RoleRow) => boolean) => [...new Set((await activeRows()).filter(holds).map((r) => r.memberId as number))].sort((a, b) => a - b);
const ids = (...members: (number | null)[]) => [...members].map(Number).sort((a, b) => a - b);

const isTeamLeader = (r: RoleRow) => r.type === "president";
const isProjectManager = (r: RoleRow) => r.fullAccess === "project_manager";
const isStructuresHead = (r: RoleRow) => r.type === "head" && r.deptId === STRUCTURES;
const isSafetyOfficer = (r: RoleRow) => r.title === "Safety Officer" && r.deptId == null && r.divisionId == null;

/** The full-access seat someone holds now, read off their active rows as the dashboard reads it. */
async function seatOf(memberId: number) {
  const teamDivisions = await tableRows(divisions);
  const active = (await activeRows())
    .filter((r) => r.memberId === memberId)
    .map((r) => {
      const division = teamDivisions.find((d) => d.id === r.divisionId);
      return {
        type: r.type as RoleType,
        divisionId: r.divisionId as number | null,
        divisionCode: (division?.code ?? null) as string | null,
        divisionClosedAt: (division?.closedAt ?? null) as string | null,
        fullAccess: r.fullAccess == null ? null : SEAT_OF_FLAG[r.fullAccess as SeatFlag],
      };
    });
  return fullAccessSeatOf(active);
}

/** The active row `memberId` holds a team-level seat by. */
async function rowOf(memberId: number | null, holds: (r: RoleRow) => boolean): Promise<number> {
  const row = (await activeRows()).find((r) => r.memberId === memberId && holds(r));
  assert.ok(row, `member ${memberId} holds the seat`);
  return row.id as number;
}

/** Runs `write` and asserts it was refused with nothing written. */
async function refusedWithNoWrite(write: () => Promise<{ ok: boolean }>, why: string) {
  const before = (await databaseWrites()).length;
  const answer = await write();
  assert.equal(answer.ok, false, why);
  assert.equal((await databaseWrites()).length, before, `${why}: nothing written`);
}

describe("two team leaders", () => {
  beforeEach(async () => {
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await teamActions.addTeamLeader({ personId: CO_HOLDER }), { ok: true });
  });

  test("one hands over: their row ends, the successor's starts, and the other keeps the seat and its rights", async () => {
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await teamActions.handOverTeamLeader({ to: SUCCESSOR, outcome: "advisor" }), { ok: true });
    assert.deepEqual(await holdersBy(isTeamLeader), ids(CO_HOLDER, SUCCESSOR));
    assert.equal(await seatOf(CO_HOLDER), "team-leader", "the other team leader keeps the seat's rights");
  });

  test("the co-leader hands over their own place and the first team leader stays", async () => {
    signInAs("mover");
    assert.deepEqual(await teamActions.handOverTeamLeader({ to: SUCCESSOR, outcome: "leave" }), { ok: true });
    assert.deepEqual(await holdersBy(isTeamLeader), ids(TEAM_LEADER.memberId, SUCCESSOR));
  });

  test("a successor who is a team leader already is refused", async () => {
    signInAs(TEAM_LEADER.userId);
    await refusedWithNoWrite(() => teamActions.handOverTeamLeader({ to: CO_HOLDER, outcome: "advisor" }), "the other team leader");
  });

  test("a team address the staying team leader holds is owed no routing item; the one handing over's goes to the successor", async () => {
    await addRows(teamAddresses, [
      { id: 1, address: "leader@politorocketteam.it", purpose: "Team Leader", holderId: CO_HOLDER, movesWith: "team_leader" },
      { id: 2, address: "president@politorocketteam.it", purpose: "President", holderId: TEAM_LEADER.memberId!, movesWith: "team_leader" },
    ]);
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await teamActions.handOverTeamLeader({ to: SUCCESSOR, outcome: "advisor" }), { ok: true });
    assert.deepEqual(
      (await tableRows(teamAddressReroutes)).map((r) => [r.addressId, r.toMember, r.fromMember]),
      [[2, SUCCESSOR, TEAM_LEADER.memberId]],
    );
  });
});

describe("two holders of a team-level seat", () => {
  const SEATS = [
    { name: "a full-access seat", holder: PROJECT_MANAGER.memberId!, holds: isProjectManager },
    { name: "an unflagged team-level seat", holder: SAFETY_HOLDER, holds: isSafetyOfficer },
  ] as const;

  for (const seat of SEATS) {
    describe(seat.name, () => {
      beforeEach(async () => {
        signInAs(TEAM_LEADER.userId);
        assert.deepEqual(await teamActions.addSeatHolder(await rowOf(seat.holder, seat.holds), { personId: CO_HOLDER }), { ok: true });
      });

      test("Change holder on one ends only that row; the other holder keeps the seat", async () => {
        signInAs(TEAM_LEADER.userId);
        assert.deepEqual(await teamActions.changeSeatHolder(await rowOf(seat.holder, seat.holds), { to: SUCCESSOR, outcome: "advisor" }), { ok: true });
        assert.deepEqual(await holdersBy(seat.holds), ids(CO_HOLDER, SUCCESSOR));
        if (seat.holds === isProjectManager) assert.equal(await seatOf(CO_HOLDER), "project-manager", "the other holder keeps the full access");
      });

      test("a successor who holds the seat by a co-holder's row is refused", async () => {
        signInAs(TEAM_LEADER.userId);
        const row = await rowOf(seat.holder, seat.holds);
        await refusedWithNoWrite(() => teamActions.changeSeatHolder(row, { to: CO_HOLDER, outcome: "advisor" }), "the co-holder");
      });

      test("Remove on one holder ends only their row; the other keeps the seat", async () => {
        signInAs(TEAM_LEADER.userId);
        assert.deepEqual(await teamActions.removeSeat(await rowOf(seat.holder, seat.holds)), { ok: true });
        assert.deepEqual(await holdersBy(seat.holds), ids(CO_HOLDER));
      });
    });
  }
});

describe("two heads of a department", () => {
  const save = (head: { to: number; from?: number; outcome: "advisor" | "leave" }) => teamActions.saveDepartment(STRUCTURES, { name: "Structures", code: "STR", head });

  beforeEach(async () => {
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await teamActions.addDepartmentHead(STRUCTURES, { personId: CO_HOLDER }), { ok: true });
  });

  test("Change head replaces only the picked head; the other head stays", async () => {
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await save({ to: SUCCESSOR, from: HEAD, outcome: "advisor" }), { ok: true });
    assert.deepEqual(await holdersBy(isStructuresHead), ids(CO_HOLDER, SUCCESSOR));
  });

  test("Change head with no head picked, or to a head already, is refused", async () => {
    signInAs(TEAM_LEADER.userId);
    await refusedWithNoWrite(() => save({ to: SUCCESSOR, outcome: "advisor" }), "no head picked among two");
    await refusedWithNoWrite(() => save({ to: CO_HOLDER, from: HEAD, outcome: "advisor" }), "the other head");
  });

  test("a confirmed hand-over request from one head ends only that head's row", async () => {
    await addRows(handOverRequests, [{ id: 99, fromId: HEAD, role: "head", deptId: STRUCTURES, toId: SUCCESSOR, outcome: "advisor", createdAt: new Date().toISOString() }]);
    signInAs(TEAM_LEADER.userId);
    assert.equal((await actions.answerHandOver(99, "confirm")).ok, true);
    assert.deepEqual(await holdersBy(isStructuresHead), ids(CO_HOLDER, SUCCESSOR));
  });

  test("someone made head by a move replaces only the head picked", async () => {
    signInAs(TEAM_LEADER.userId);
    const moved = await teamActions.moveMember({
      personId: SUCCESSOR,
      from: { kind: "division", divisionId: IDS.division("DM") },
      to: { kind: "head", departmentId: STRUCTURES },
      title: "",
      replaced: "advisor",
      replacing: HEAD,
      successor: null,
    });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await holdersBy(isStructuresHead), ids(CO_HOLDER, SUCCESSOR));
  });

  test("a team address the staying head holds is owed no routing item", async () => {
    await addRows(teamAddresses, [{ id: 1, address: "structures@politorocketteam.it", purpose: "Structures", holderId: CO_HOLDER, movesWith: "department_head", movesWithDeptId: STRUCTURES }]);
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await save({ to: SUCCESSOR, from: HEAD, outcome: "advisor" }), { ok: true });
    assert.deepEqual(await tableRows(teamAddressReroutes), []);
  });
});
