import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { roles } from "@/db/schema";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { addRows, databaseWrites, tableRows, testDb, writesByTransaction } from "./access-matrix/test-database";
import { titleOnMove } from "./member-move";
import { defaultHeadTitle } from "./team";

// The one move (issue #647), made for real against the migrated in-memory
// Postgres (./access-matrix/test-database.ts): it ends the person's place and
// starts the new one in one write, and a refused move writes nothing, so the
// person stays exactly where they were.

const MA = IDS.division("MA");
const OA = IDS.division("OA");
const DM = IDS.division("DM");
const AERODYNAMICS = IDS.department("MA");
const STRUCTURES = IDS.department("DM");
const TEAM_LEADER = accountOf("team leader").userId;
const AERODYNAMICS_HEAD = accountOf("department head").memberId!;

type Row = { memberId: number; type: string | null; divisionId: number | null; deptId: number | null; title: string };

const active = async (): Promise<Row[]> =>
  (await tableRows(roles)).filter((r) => r.leavedAt === null).map((r) => r as unknown as Row);

/** Where someone is now: each active role as "type@division" or "type@department". */
async function placeOf(memberId: number): Promise<string[]> {
  return (await active())
    .filter((r) => r.memberId === memberId)
    .map((r) => (r.divisionId !== null ? `${r.type}@division:${r.divisionId}` : r.deptId !== null ? `${r.type}@department:${r.deptId}` : `${r.type}@team`))
    .sort();
}

/** Who heads `departmentId` now. */
async function headsOf(departmentId: number): Promise<number[]> {
  return (await active()).filter((r) => r.type === "head" && r.deptId === departmentId).map((r) => r.memberId);
}

const move = (input: Record<string, unknown>) => teamActions.moveMember({ title: "", replaced: null, successor: null, ...input });

describe("moving someone to another unit in one write (issue #647)", () => {
  test("a member moves to another division: their role there ends and one starts in the new division, with its title", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const person = IDS.person("MA");
    const moved = await move({ personId: person, from: { kind: "division", divisionId: MA }, to: { kind: "division", divisionId: DM, as: "member" }, title: "CAD Engineer" });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await placeOf(person), [`core@division:${DM}`]);
    assert.equal((await active()).find((r) => r.memberId === person)?.title, "CAD Engineer");
    assert.equal((await writesByTransaction()).length, 1, "one batch ends the old place and starts the new one");
  });

  test("a lead moves as a member: their lead role ends, and they are a member of the new division", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const lead = IDS.lead("MA");
    const moved = await move({ personId: lead, from: { kind: "division", divisionId: MA }, to: { kind: "division", divisionId: OA, as: "member" } });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await placeOf(lead), [`core@division:${OA}`]);
  });

  test("a head moves to a division and leaves the department with no head", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const moved = await move({ personId: EXTRA.head, from: { kind: "head", departmentId: STRUCTURES }, to: { kind: "division", divisionId: MA, as: "member" } });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await placeOf(EXTRA.head), [`core@division:${MA}`]);
    assert.deepEqual(await headsOf(STRUCTURES), []);
  });

  test("a head moves to a division and a new head is picked from the department in the same write", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const successor = IDS.person("DM");
    const moved = await move({
      personId: EXTRA.head,
      from: { kind: "head", departmentId: STRUCTURES },
      to: { kind: "division", divisionId: MA, as: "member" },
      successor,
    });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await placeOf(EXTRA.head), [`core@division:${MA}`]);
    assert.deepEqual(await headsOf(STRUCTURES), [successor]);
  });

  test("made head of a department that has one: the replace-head choice is asked, and the department never has two heads", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const request = { personId: EXTRA.head, from: { kind: "head", departmentId: STRUCTURES }, to: { kind: "head", departmentId: AERODYNAMICS } };
    const before = (await databaseWrites()).length;
    const unasked = await move(request);
    assert.equal(unasked.ok, false, "refused until the editor says what happens to the head there");
    assert.equal((await databaseWrites()).length, before, "no write");
    assert.deepEqual(await headsOf(AERODYNAMICS), [AERODYNAMICS_HEAD]);

    const moved = await move({ ...request, replaced: "advisor" });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await headsOf(AERODYNAMICS), [EXTRA.head]);
    assert.deepEqual(await headsOf(STRUCTURES), []);
    assert.ok((await placeOf(AERODYNAMICS_HEAD)).includes(`advisor@department:${AERODYNAMICS}`), "the head they replace stays as an advisor");
  });

  test("a head who also holds a team-level seat is made head of another department and keeps the seat (issue #841)", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    await addRows(roles, [{ id: 9_841, memberId: EXTRA.head, title: "Safety Officer", startedAt: "2025-10-01", type: "core" }]);
    const moved = await move({ personId: EXTRA.head, from: { kind: "head", departmentId: STRUCTURES }, to: { kind: "head", departmentId: AERODYNAMICS }, replaced: "advisor" });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await placeOf(EXTRA.head), ["core@team", `head@department:${AERODYNAMICS}`]);
    assert.deepEqual(await headsOf(AERODYNAMICS), [EXTRA.head], "the department never has two heads");
    assert.deepEqual(await headsOf(STRUCTURES), []);
  });

  test("a successor who holds a team-level seat takes the headship over and keeps the seat and their divisions (issue #841)", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    await addRows(roles, [{ id: 9_842, memberId: EXTRA.mover, title: "Safety Officer", startedAt: "2025-10-01", type: "core" }]);
    const before = await placeOf(EXTRA.mover);
    const moved = await move({
      personId: EXTRA.head,
      from: { kind: "head", departmentId: STRUCTURES },
      to: { kind: "division", divisionId: MA, as: "member" },
      successor: EXTRA.mover,
    });
    assert.deepEqual(moved, { ok: true });
    assert.deepEqual(await headsOf(STRUCTURES), [EXTRA.mover]);
    assert.deepEqual(await placeOf(EXTRA.mover), [...before, `head@department:${STRUCTURES}`].sort());
  });

  test("two overlapping moves of one person: the second to land, from a place the first already ended, is refused and writes nothing", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const person = IDS.person("MA");
    const from = { kind: "division", divisionId: MA };
    const rowsBefore = (await tableRows(roles)).length;
    // Both moves read the person in Mission Analysis; the first one's batch waits until the second has run from start to end.
    const batch = testDb.batch;
    let toOA: Awaited<ReturnType<typeof move>> | undefined;
    testDb.batch = async (queries) => {
      testDb.batch = batch;
      toOA = await move({ personId: person, from, to: { kind: "division", divisionId: OA, as: "member" } });
      return batch(queries);
    };
    let toDM: Awaited<ReturnType<typeof move>>;
    try {
      toDM = await move({ personId: person, from, to: { kind: "division", divisionId: DM, as: "member" } });
    } finally {
      testDb.batch = batch;
    }
    assert.deepEqual(toOA, { ok: true });
    assert.deepEqual(toDM, { ok: false, error: "Someone changed this placement since you opened it. Reload and try again." });
    assert.deepEqual(await placeOf(person), [`core@division:${OA}`], "in one place, never two");
    assert.equal((await tableRows(roles)).length, rowsBefore + 1, "only the move that landed started a row");
  });

  test("a viewer without the right to add or remove is refused, and nothing is written", async () => {
    const cases: [string, string, Record<string, unknown>][] = [
      // A division lead reaches only Mission Analysis: they cannot take someone out of Design & Manufacturing.
      ["division lead", "out of a division they do not reach", { personId: IDS.person("DM"), from: { kind: "division", divisionId: DM }, to: { kind: "division", divisionId: MA, as: "member" } }],
      // Nor add someone of theirs to a division they do not reach.
      ["division lead", "into a division they do not reach", { personId: IDS.person("MA"), from: { kind: "division", divisionId: MA }, to: { kind: "division", divisionId: DM, as: "member" } }],
      // Only the team leader and full access move a head.
      ["department head", "a department head", { personId: EXTRA.head, from: { kind: "head", departmentId: STRUCTURES }, to: { kind: "division", divisionId: MA, as: "member" } }],
      ["member", "anyone", { personId: IDS.person("MA"), from: { kind: "division", divisionId: MA }, to: { kind: "division", divisionId: OA, as: "member" } }],
    ];
    for (const [viewer, what, request] of cases) {
      await seedFixture();
      const person = request.personId as number;
      const place = await placeOf(person);
      signInAs(accountOf(viewer).userId);
      const moved = await move(request);
      assert.equal(moved.ok, false, `${viewer} moving ${what}`);
      assert.deepEqual(await databaseWrites(), [], `${viewer} moving ${what}: wrote`);
      assert.deepEqual(await placeOf(person), place, `${viewer} moving ${what}: moved`);
    }
  });
});

describe("the title a move writes (issue #777)", () => {
  /** Their active title in `divisionId`, or on the department they head. */
  const titleIn = async (memberId: number, where: { divisionId?: number; deptId?: number }) =>
    (await active()).find(
      (r) => r.memberId === memberId && (where.divisionId === undefined || r.divisionId === where.divisionId) && (where.deptId === undefined || r.deptId === where.deptId),
    )?.title;

  test("a move to a division saved with a blank title writes a blank title there", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const person = IDS.person("MA");
    assert.deepEqual(await move({ personId: person, from: { kind: "division", divisionId: MA }, to: { kind: "division", divisionId: DM, as: "member" }, title: "" }), { ok: true });
    assert.equal(await titleIn(person, { divisionId: DM }), "");
  });

  test("a move made head with a blank title writes the head's default, Head of <department>", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const moved = await move({ personId: EXTRA.head, from: { kind: "head", departmentId: STRUCTURES }, to: { kind: "head", departmentId: AERODYNAMICS }, title: "", replaced: "advisor" });
    assert.deepEqual(moved, { ok: true });
    assert.equal(await titleIn(EXTRA.head, { deptId: AERODYNAMICS }), defaultHeadTitle("Aerodynamics"));
  });

  test("a head moved to a division as a member, with no title typed, does not keep the head's title there", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const stored = await titleIn(EXTRA.head, { deptId: STRUCTURES });
    assert.ok(stored !== undefined && stored !== "", "the head holds a stored title to leave behind");
    const to = { kind: "division", divisionId: MA, as: "member" } as const;
    // What Edit details sends: the title box emptied once the destination changed, and nothing typed.
    const title = titleOnMove({ current: stored, stored, from: null, to });
    assert.deepEqual(await move({ personId: EXTRA.head, from: { kind: "head", departmentId: STRUCTURES }, to, title }), { ok: true });
    assert.equal(await titleIn(EXTRA.head, { divisionId: MA }), "");
  });
});
