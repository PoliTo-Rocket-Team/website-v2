import assert from "node:assert/strict";
import { test } from "node:test";
import { stepCardTurn, TURN_PER_S, type CardTurnMotion } from "./card-turn";

// The card canvas asks for a frame only while stepCardTurn answers true
// (issue #385), so a rocket that never settles exactly at rest would keep
// drawing forever on an idle page.

const FRAME_S = 1 / 30;

/** Steps at 30 fps until the motion reports rest; the frames it took, or Infinity. */
function framesToRest(m: CardTurnMotion, limit = 30 * 10): number {
  for (let frame = 1; frame <= limit; frame++) {
    if (!stepCardTurn(m, "rest", FRAME_S)) return frame;
  }
  return Infinity;
}

test("a rocket let go anywhere in its turn comes back to exactly its tuned pose and stops asking for frames", () => {
  for (const angle of [Math.PI, -Math.PI / 2, 0.5, 0.003]) {
    const m = { angle, speed: TURN_PER_S };
    assert.ok(framesToRest(m) <= 30 * 6, `from ${angle} it settles within 6 s`);
    assert.equal(m.angle, 0);
    assert.equal(m.speed, 0);
  }
});

test("a rocket already at rest asks for no frame", () => {
  assert.equal(stepCardTurn({ angle: 0, speed: 0 }, "rest", FRAME_S), false);
});

test("a hovered rocket eases up to one turn in 20 s, and its angle stays the short way back to rest", () => {
  const m = { angle: 0, speed: 0 };
  for (let frame = 0; frame < 30 * 30; frame++) {
    assert.equal(stepCardTurn(m, "turn", FRAME_S), true);
    assert.ok(m.angle > -Math.PI && m.angle <= Math.PI);
  }
  assert.ok(Math.abs(m.speed - (2 * Math.PI) / 20) < 1e-6);
});
