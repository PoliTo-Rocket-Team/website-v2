import assert from "node:assert/strict";
import { test } from "node:test";
import { ONE_SUCCESSOR_FOR_SEAT, seatHandOver } from "./hand-over";
import { fullAccessSeatOf, type ActiveRoleRef, type FlaggedSeat } from "./viewer";

// Full access follows the role on a hand-over (issue #501): the rule every
// hand-over and replacement write reads. The writes themselves are
// ./seat-hand-over-server.test.ts's.

const SEATS: readonly FlaggedSeat[] = ["operations-lead", "it-lead", "project-manager", "chief-engineer"];

const SUCCESSOR = 7;

for (const seat of SEATS) {
  test(`a hand-over of the ${seat} seat's role gives the seat to the successor, and the predecessor holds it no more`, () => {
    const outgoing: ActiveRoleRef = { type: "lead", divisionId: 1, divisionCode: null, divisionClosedAt: null, fullAccess: seat };
    const handed = seatHandOver([outgoing], [SUCCESSOR]);
    assert.deepEqual(handed, { ok: true, value: { seat, to: SUCCESSOR } });
    // The successor's row carries the seat; the outgoing row ends with it, so the predecessor holds no active row.
    const successorRow: ActiveRoleRef = { type: "lead", divisionId: 1, divisionCode: null, divisionClosedAt: null, fullAccess: handed.ok ? (handed.value?.seat ?? null) : null };
    assert.equal(fullAccessSeatOf([successorRow]), seat);
    assert.equal(fullAccessSeatOf([]), null);
  });

  test(`the ${seat} seat goes to exactly one successor: two, or none, is refused`, () => {
    const outgoing = [{ fullAccess: seat }];
    assert.deepEqual(seatHandOver(outgoing, [SUCCESSOR, 8]), { ok: false, error: ONE_SUCCESSOR_FOR_SEAT });
    assert.deepEqual(seatHandOver(outgoing, []), { ok: false, error: ONE_SUCCESSOR_FOR_SEAT });
  });
}

test("a role with no seat hands over no seat, whatever the successors", () => {
  assert.deepEqual(seatHandOver([{ fullAccess: null }], [SUCCESSOR]), { ok: true, value: null });
  assert.deepEqual(seatHandOver([{ fullAccess: null }], [SUCCESSOR, 8]), { ok: true, value: null });
  assert.deepEqual(seatHandOver([], []), { ok: true, value: null });
});

test("the seat on any of the rows handed over is the one that moves", () => {
  assert.deepEqual(seatHandOver([{ fullAccess: null }, { fullAccess: "it-lead" }], [SUCCESSOR]), { ok: true, value: { seat: "it-lead", to: SUCCESSOR } });
});
