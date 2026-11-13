import "./access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { aliasRequests, departments, roles, teamAddresses, teamAddressReroutes } from "@/db/schema";
import { addRows, databaseWrites, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { defaultHeadTitle } from "./team";

// Add another holder on the database (epic #861, issue #868), on the seeded
// matrix fixture (./access-matrix/fixture.ts) through the real server actions:
// each seat kind takes a second holder, every holder stays active and no row
// ends; someone who holds the seat already, and anyone but the team leader
// or full access, is refused and nothing is written. Each test runs on a
// freshly seeded, migrated PGlite database (./access-matrix/test-database.ts).

const TEAM_LEADER = accountOf("team leader");
const PROJECT_MANAGER = accountOf("Project Manager");
const STRUCTURES = IDS.department("DM");
/** In two divisions, holding no seat and no PRT email. */
const NEWCOMER = EXTRA.mover;
/** An unflagged team-level seat the fixture does not hold: laid over it here. */
const SAFETY_ROW = 9_500;
const SAFETY_HOLDER = IDS.person("MA");

/** A `roles` row as the test database reads it back. */
type RoleRow = Record<string, unknown>;

beforeEach(async () => {
  await seedFixture();
  await addRows(roles, [{ id: SAFETY_ROW, memberId: SAFETY_HOLDER, title: "Safety Officer", startedAt: "2025-10-01", type: "core" }]);
});

const activeRows = async () => (await tableRows(roles)).filter((r) => r.leavedAt == null);
const endedCount = async () => (await tableRows(roles)).filter((r) => r.leavedAt != null).length;

/** The active row a matrix viewer's team-level seat is. */
const seatRowOf = async (memberId: number | null): Promise<RoleRow> => {
  const row = (await activeRows()).find((r) => r.memberId === memberId && r.deptId == null && r.divisionId == null);
  assert.ok(row, `member ${memberId} holds a team-level seat`);
  return row;
};

const structuresHeadTitle = async () => defaultHeadTitle((await tableRows(departments)).find((d) => d.id === STRUCTURES)!.name as string);

type Kind = {
  readonly name: string;
  readonly add: (personId: number) => Promise<unknown>;
  readonly holds: (r: RoleRow) => boolean;
  /** The row the new holder gets: the seat's type, title and full-access flag, and for a head its department. */
  readonly copied: () => Promise<RoleRow>;
};

const KINDS: readonly Kind[] = [
  {
    name: "the team leader seat",
    add: (personId) => teamActions.addTeamLeader({ personId }),
    holds: (r) => r.type === "president",
    copied: async () => ({ type: "president", title: (await seatRowOf(TEAM_LEADER.memberId)).title, fullAccess: null, deptId: null, divisionId: null }),
  },
  {
    name: "a full-access seat",
    add: async (personId) => teamActions.addSeatHolder((await seatRowOf(PROJECT_MANAGER.memberId)).id as number, { personId }),
    holds: (r) => r.fullAccess === "project_manager",
    copied: async () => {
      const seat = await seatRowOf(PROJECT_MANAGER.memberId);
      return { type: seat.type, title: seat.title, fullAccess: "project_manager", deptId: null, divisionId: null };
    },
  },
  {
    name: "a department's head seat",
    add: (personId) => teamActions.addDepartmentHead(STRUCTURES, { personId }),
    holds: (r) => r.type === "head" && r.deptId === STRUCTURES,
    copied: async () => ({ type: "head", title: await structuresHeadTitle(), fullAccess: null, deptId: STRUCTURES, divisionId: null }),
  },
  {
    name: "an unflagged team-level seat",
    add: (personId) => teamActions.addSeatHolder(SAFETY_ROW, { personId }),
    holds: (r) => r.type === "core" && r.title === "Safety Officer" && r.fullAccess == null && r.deptId == null && r.divisionId == null,
    copied: async () => ({ type: "core", title: "Safety Officer", fullAccess: null, deptId: null, divisionId: null }),
  },
];

const holdersOf = async (kind: Kind) => (await activeRows()).filter(kind.holds).map((r) => r.memberId);

describe("each seat kind takes a second holder, and both stay active", () => {
  for (const kind of KINDS) {
    test(kind.name, async () => {
      const before = await holdersOf(kind);
      assert.equal(before.length, 1, "one holder before");
      const ended = await endedCount();
      const expected = await kind.copied();
      signInAs(TEAM_LEADER.userId);
      assert.deepEqual(await kind.add(NEWCOMER), { ok: true });
      assert.deepEqual((await holdersOf(kind)).sort(), [...before, NEWCOMER].sort(), "both holders are active");
      assert.equal(await endedCount(), ended, "no row ended");
      const added = (await activeRows()).filter((r) => r.memberId === NEWCOMER && kind.holds(r));
      assert.equal(added.length, 1);
      const { type, title, fullAccess, deptId, divisionId } = added[0]!;
      assert.deepEqual({ type, title, fullAccess, deptId, divisionId }, expected);
      // The newcomer keeps both divisions they are in.
      assert.equal((await activeRows()).filter((r) => r.memberId === NEWCOMER && r.divisionId != null).length, 2);
    });
  }
});

describe("the refusals write nothing", () => {
  for (const kind of KINDS) {
    test(`${kind.name}: someone who holds it already is refused`, async () => {
      const [holder] = await holdersOf(kind);
      signInAs(TEAM_LEADER.userId);
      const writesBefore = (await databaseWrites()).length;
      const answer = (await kind.add(holder as number)) as { ok: boolean };
      assert.equal(answer.ok, false);
      assert.equal((await databaseWrites()).length, writesBefore, "nothing written");
    });

    test(`${kind.name}: a department head, a division lead and a member are refused`, async () => {
      for (const who of ["head-str", "lead-dm", accountOf("member").userId]) {
        signInAs(who);
        const writesBefore = (await databaseWrites()).length;
        const answer = (await kind.add(NEWCOMER)) as { ok: boolean };
        assert.equal(answer.ok, false, who);
        assert.equal((await databaseWrites()).length, writesBefore, `${who}: nothing written`);
      }
    });
  }

  test("someone who holds a different seat is added: the Project Manager joins the team leaders", async () => {
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await teamActions.addTeamLeader({ personId: PROJECT_MANAGER.memberId }), { ok: true });
    assert.ok((await activeRows()).some((r) => r.memberId === PROJECT_MANAGER.memberId && r.fullAccess === "project_manager"), "they keep their seat");
  });
});

describe("what a new holder is owed, as a hand-over owes it", () => {
  const openRequestsFor = async (memberId: number) => (await tableRows(aliasRequests)).filter((r) => r.memberId === memberId && r.outcome === null).length;

  test("a new team leader and a new head get an alias request; a team-level seat's new holder does not", async () => {
    for (const [kind, asked] of [
      [KINDS[0]!, 1],
      [KINDS[2]!, 1],
      [KINDS[1]!, 0],
      [KINDS[3]!, 0],
    ] as const) {
      await seedFixture();
      await addRows(roles, [{ id: SAFETY_ROW, memberId: SAFETY_HOLDER, title: "Safety Officer", startedAt: "2025-10-01", type: "core" }]);
      signInAs(TEAM_LEADER.userId);
      assert.deepEqual(await kind.add(NEWCOMER), { ok: true });
      assert.equal(await openRequestsFor(NEWCOMER), asked, kind.name);
    }
  });

  test("a team address tied to the seat moves nothing while its holder still holds the seat", async () => {
    await addRows(teamAddresses, [{ id: 1, address: "leader@politorocketteam.it", purpose: "Team Leader", holderId: TEAM_LEADER.memberId!, movesWith: "team_leader" }]);
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await teamActions.addTeamLeader({ personId: NEWCOMER }), { ok: true });
    assert.deepEqual(await tableRows(teamAddressReroutes), []);
  });

  test("a team address tied to the seat, held by someone who holds it no more, goes to the new holder", async () => {
    await addRows(teamAddresses, [
      { id: 1, address: "pm@politorocketteam.it", purpose: "Project Manager", holderId: SAFETY_HOLDER, movesWith: "full_access_seat", movesWithSeat: "project_manager" },
    ]);
    signInAs(TEAM_LEADER.userId);
    assert.deepEqual(await teamActions.addSeatHolder((await seatRowOf(PROJECT_MANAGER.memberId)).id as number, { personId: NEWCOMER }), { ok: true });
    const reroutes = await tableRows(teamAddressReroutes);
    assert.deepEqual(
      reroutes.map((r) => [r.addressId, r.toMember, r.fromMember]),
      [[1, NEWCOMER, SAFETY_HOLDER]],
    );
  });
});
