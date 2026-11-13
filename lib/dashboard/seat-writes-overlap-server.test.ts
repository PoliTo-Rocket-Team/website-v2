// The team snapshot imports server-only modules; the access matrix's stand-ins let it load outside Next.
import "./access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { members, roles, teamLeaves, users } from "@/db/schema";
import { accountOf, EXTRA, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { addRows, tableRows, testDb } from "./access-matrix/test-database";

// Two overlapping writes on one seat (issue #666): both read the seat as
// still held, then one ends it before the other writes. Only the first
// write to land may succeed; the other is refused and adds no role row.
// The overlap is laid out by hand: the first call's batch waits until a
// second call has run from start to end, so the second call's write lands
// between the first call's read and its write. No unique index stops a
// second holder of a seat (drizzle/0077, epic #861), so only the write's own
// check refuses the late one.

const SINCE = "2025-10-01";
const HOLDER = 9_401;
const SEAT = 9_500;
const SEAT_TITLE = "Safety Officer";

beforeEach(async () => {
  await seedFixture();
  await addRows(members, [{ memberId: HOLDER, ndaSignedAt: SINCE }]);
  await addRows(users, [{ id: "seat-holder", email: "seat-holder@mail.test", firstName: "Seat", lastName: "Holder", member: HOLDER, createdAt: SINCE }]);
  // The seat is the holder's only role, so a write that ends it makes them an advisor to the team.
  await addRows(roles, [{ id: SEAT, memberId: HOLDER, title: SEAT_TITLE, startedAt: SINCE, type: "core", fullAccess: null }]);
  signInAs(accountOf("team leader").userId);
});

type Answer = Awaited<ReturnType<typeof teamActions.removeSeat>>;

/**
 * Runs `call` twice, overlapping: the first run's batch starts only after a
 * second run has finished, so both runs read the seat before either writes.
 * Answers the first run's answer, then the second's.
 */
async function overlapping(call: () => Promise<Answer>): Promise<{ first: Answer; second: Answer }> {
  const batch = testDb.batch;
  let second: Answer | undefined;
  testDb.batch = async (queries) => {
    testDb.batch = batch;
    second = await call();
    return batch(queries);
  };
  try {
    const first = await call();
    assert.ok(second !== undefined, "the second run wrote before the first one's batch");
    return { first, second };
  } finally {
    testDb.batch = batch;
  }
}

async function activeRows(match: (r: Record<string, unknown>) => boolean): Promise<Record<string, unknown>[]> {
  return (await tableRows(roles)).filter((r) => r.leavedAt == null && match(r));
}

const advisorRowsOf = (memberId: number) => activeRows((r) => r.memberId === memberId && r.type === "advisor");
const seatRows = () => activeRows((r) => r.title === SEAT_TITLE && r.deptId == null && r.divisionId == null);

describe("overlapping seat writes on one seat (issue #666)", () => {
  test("two overlapping Remove seat calls: one succeeds, and the holder gets one Advisor role", async () => {
    const { first, second } = await overlapping(() => teamActions.removeSeat(SEAT));
    assert.deepEqual(second, { ok: true });
    assert.deepEqual(first, { ok: false, error: "That seat is no longer held." });
    assert.equal((await seatRows()).length, 0, "the seat is ended");
    assert.equal((await advisorRowsOf(HOLDER)).length, 1, "one active Advisor role");
  });

  test("two overlapping Change holder calls: one succeeds, the seat has one holder, and the old holder one Advisor role", async () => {
    const { first, second } = await overlapping(() => teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "advisor" }));
    assert.deepEqual(second, { ok: true });
    assert.deepEqual(first, { ok: false, error: "That seat is no longer held." });
    const held = await seatRows();
    assert.deepEqual(held.map((r) => r.memberId), [EXTRA.mover], "one active holder row, the successor's");
    assert.equal(held[0].fullAccess, null);
    assert.equal((await advisorRowsOf(HOLDER)).length, 1, "no duplicate Advisor role");
  });

  test("two overlapping Change holder calls where the old holder leaves: one succeeds, the seat has one holder, and the leave is written once", async () => {
    const { first, second } = await overlapping(() => teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "leave" }));
    assert.deepEqual(second, { ok: true });
    assert.deepEqual(first, { ok: false, error: "That seat is no longer held." });
    const held = await seatRows();
    assert.deepEqual(held.map((r) => r.memberId), [EXTRA.mover], "one active holder row, the successor's");
    const leaves = (await tableRows(teamLeaves)).filter((r) => r.memberId === HOLDER);
    assert.equal(leaves.length, 1, "the old holder's leave is written once");
    assert.equal((await activeRows((r) => r.memberId === HOLDER)).length, 0, "the old holder holds no active role");
  });

  test("a batch that ends the seat and then fails on another error is thrown, not read as no longer held (issue #696)", async () => {
    const batch = testDb.batch;
    const failure = new Error("the batch failed", { cause: Object.assign(new Error("duplicate key value"), { code: "23505" }) });
    testDb.batch = async (queries) => {
      await batch(queries);
      throw failure;
    };
    try {
      await assert.rejects(teamActions.removeSeat(SEAT), (error) => error === failure);
    } finally {
      testDb.batch = batch;
    }
    assert.equal((await seatRows()).length, 0, "the seat row is ended on re-read");
  });

  test("a single Remove seat still ends the seat and makes its only-role holder an advisor to the team", async () => {
    assert.deepEqual(await teamActions.removeSeat(SEAT), { ok: true });
    assert.equal((await seatRows()).length, 0);
    const [advisor, ...more] = await advisorRowsOf(HOLDER);
    assert.equal(more.length, 0);
    assert.equal(advisor.deptId, null);
    assert.equal(advisor.divisionId, null);
  });

  test("a single Change holder still moves the seat and makes the holder an advisor to the team", async () => {
    assert.deepEqual(await teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "advisor" }), { ok: true });
    const held = await seatRows();
    assert.deepEqual(held.map((r) => [r.memberId, r.type]), [[EXTRA.mover, "core"]]);
    assert.equal((await advisorRowsOf(HOLDER)).length, 1);
    const ended = (await tableRows(roles)).find((r) => r.id === SEAT);
    assert.notEqual(ended?.leavedAt, null, "the old seat row is ended");
  });
});
