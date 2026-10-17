import assert from "node:assert/strict";
import { test } from "node:test";
import { heldFrameShown, revealAfterLost, revealOnShow, step, HIDDEN, type Stage } from "./hero-stage";

// A returning hero canvas that loses its WebGL context before it has drawn
// (issue #113): the held frame must not drop out while the replacement warms.

/** A return: the page is shown again, with or without a frame held. */
function returnTo(frameHeld: boolean): Stage {
  return step(HIDDEN, { type: "shown", canvas: 1, reveal: revealOnShow(frameHeld) });
}

/** The warming canvas 1 loses its context; canvas 2 replaces it. */
function loseWhileWarming(stage: Stage, frameHeld: boolean): Stage {
  return step(stage, { type: "lost", canvas: 1, next: 2, reveal: revealAfterLost(frameHeld, true) });
}

test("a context lost while warming over a held frame keeps the frame shown until the replacement draws", () => {
  const warming = returnTo(true);
  assert.equal(heldFrameShown(warming), true);

  const replaced = loseWhileWarming(warming, true);
  assert.deepEqual(replaced, { kind: "warming", canvas: 2, reveal: "over-last-frame" });
  assert.equal(heldFrameShown(replaced), true);

  const drawn = step(replaced, { type: "warm", canvas: 2 });
  assert.equal(heldFrameShown(drawn), false);
});

test("with no frame held, a lost context shows no frame and keeps the fade or at-once reveal", () => {
  const replaced = loseWhileWarming(returnTo(false), false);
  assert.deepEqual(replaced, { kind: "warming", canvas: 2, reveal: "fade" });
  assert.equal(heldFrameShown(replaced), false);

  assert.equal(revealAfterLost(false, false), "at-once");
});
