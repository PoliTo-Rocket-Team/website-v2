import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as teamActions from "@/app/dashboard/team-actions";
import { roles } from "@/db/schema";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { databaseWrites, tableRows, writesByTransaction } from "./access-matrix/test-database";

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
