import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { handOverRequests, roles } from "@/db/schema";
import { addRows, databaseWrites, tableRows } from "./access-matrix/test-database";
import { accountOf, EXTRA, IDS, moveSeatOnto, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { ONE_SUCCESSOR_FOR_SEAT } from "./hand-over";
import type { RoleType } from "./team";
import { FLAG_OF_SEAT, fullAccessSeatOf, SEAT_OF_FLAG, type FlaggedSeat, type SeatFlag } from "./viewer";

// Full access follows the role on every database write that hands a role
// over or replaces it (issue #501): a lead replace and a lead hand-over in a
// division save, Change head, and a confirmed hand-over request, a lead's and
// a head's. Each runs for real against the migrated in-memory Postgres
// (./access-matrix/test-database.ts), and the seat is then read off the
// active rows with `fullAccessSeatOf`, as the dashboard reads it.

const SEATS: readonly FlaggedSeat[] = ["operations-lead", "it-lead", "project-manager", "chief-engineer"];

const DM = IDS.division("DM");
const STRUCTURES = IDS.department("DM");
const LEAD = IDS.lead("DM"); // leads Design & Manufacturing
const LEAD_ROW = 5_000 + LEAD;
const MEMBER = IDS.person("DM"); // a member of Design & Manufacturing
const OUTSIDER = IDS.person("MA"); // a member of Mission Analysis, not in Design & Manufacturing
const HEAD_ROW = 6_000; // EXTRA.head's head row on Structures
const TEAM_LEADER = accountOf("team leader").userId;

const activeRows = async () => (await tableRows(roles)).filter((r) => r.leavedAt === null);

/**
 * How many active rows carry the seat: one, since the database keeps one
 * active holder (drizzle/0062), so a hand-over is checked to add none: the
 * successor's row carries it only as the predecessor's row ends.
 */
const holders = async (seat: FlaggedSeat) => (await activeRows()).filter((r) => r.fullAccess === FLAG_OF_SEAT[seat]).length;

/** A freshly seeded database, with the seat moved onto `rowId`; answers how many active rows hold the seat then. */
async function seededWith(seat: FlaggedSeat, rowId: number): Promise<number> {
  await seedFixture();
  await moveSeatOnto(rowId, FLAG_OF_SEAT[seat]);
  return holders(seat);
}

/** The seat someone holds now, read off their active rows as the dashboard reads it. */
async function seatOf(memberId: number) {
  const active = (await activeRows())
    .filter((r) => r.memberId === memberId)
    .map((r) => ({
      type: r.type as RoleType,
      divisionId: r.divisionId as number | null,
      fullAccess: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess as SeatFlag],
    }));
  return fullAccessSeatOf(active);
}

const division = { name: "Design & Manufacturing", code: "DMA", members: [], emails: [] };

describe("full access follows the role on the database's hand-over writes", () => {
  for (const seat of SEATS) {
    test(`${seat}: a lead replaced by a member who becomes the lead`, async () => {
      const held = await seededWith(seat, LEAD_ROW);
      signInAs(TEAM_LEADER);
      const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [MEMBER], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "advisor" }] });
      assert.equal(saved.ok, true);
      assert.deepEqual([await seatOf(MEMBER), await seatOf(LEAD), await holders(seat)], [seat, null, held]);
    });

    test(`${seat}: a lead replaced by someone new to the division, the old lead leaving the team`, async () => {
      const held = await seededWith(seat, LEAD_ROW);
      signInAs(TEAM_LEADER);
      const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [OUTSIDER], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "leave" }] });
      assert.equal(saved.ok, true);
      assert.deepEqual([await seatOf(OUTSIDER), await seatOf(LEAD), await holders(seat)], [seat, null, held]);
    });

    test(`${seat}: Change head`, async () => {
      const held = await seededWith(seat, HEAD_ROW);
      signInAs(TEAM_LEADER);
      const saved = await teamActions.saveDepartment(STRUCTURES, { name: "Structures", code: "STR", kind: "technical", head: { to: MEMBER, outcome: "advisor" } });
      assert.equal(saved.ok, true);
      assert.deepEqual([await seatOf(MEMBER), await seatOf(EXTRA.head), await holders(seat)], [seat, null, held]);
    });

    test(`${seat}: a lead's hand-over request, confirmed`, async () => {
      const held = await seededWith(seat, LEAD_ROW);
      signInAs("head-str");
      assert.equal((await actions.answerHandOver(IDS.handOver("DM"), "confirm")).ok, true);
      assert.deepEqual([await seatOf(MEMBER), await seatOf(LEAD), await holders(seat)], [seat, null, held]);
    });

    test(`${seat}: a head's hand-over request, confirmed`, async () => {
      const held = await seededWith(seat, HEAD_ROW);
      await addRows(handOverRequests, [{ id: 99, fromId: EXTRA.head, role: "head", deptId: STRUCTURES, toId: MEMBER, outcome: "advisor", createdAt: new Date().toISOString() }]);
      signInAs(TEAM_LEADER);
      assert.equal((await actions.answerHandOver(99, "confirm")).ok, true);
      assert.deepEqual([await seatOf(MEMBER), await seatOf(EXTRA.head), await holders(seat)], [seat, null, held]);
    });

    test(`${seat}: a save replacing the flagged lead while naming two new leads is refused and changes no row`, async () => {
      await seededWith(seat, LEAD_ROW);
      signInAs(TEAM_LEADER);
      const before = (await databaseWrites()).length;
      const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [MEMBER, OUTSIDER], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "advisor" }] });
      assert.deepEqual(saved, { ok: false, error: ONE_SUCCESSOR_FOR_SEAT });
      assert.equal((await databaseWrites()).length, before, "no write");
      assert.deepEqual([await seatOf(LEAD), await seatOf(MEMBER), await seatOf(OUTSIDER)], [seat, null, null]);
    });
  }

  test("a lead with no seat replaced by two new leads is saved as before, and nobody gains a seat", async () => {
    await seedFixture();
    signInAs(TEAM_LEADER);
    const saved = await teamActions.saveDivision(DM, { ...division, newLeads: [MEMBER, OUTSIDER], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "advisor" }] });
    assert.equal(saved.ok, true);
    assert.deepEqual([await seatOf(LEAD), await seatOf(MEMBER), await seatOf(OUTSIDER)], [null, null, null]);
  });
});
