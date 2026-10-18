import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_GESTURE, readWheel, WHEEL_IDLE_MS, type WheelGesture } from "./wheel-swipe";

/** Feeds a burst of [dx, dy] events 16ms apart and returns every step taken. */
function burst(events: readonly (readonly [number, number])[], start = 0, from: WheelGesture = NO_GESTURE) {
  let gesture = from;
  const steps: number[] = [];
  events.forEach(([dx, dy], i) => {
    const read = readWheel(gesture, dx, dy, start + i * 16);
    gesture = read.gesture;
    if (read.step !== 0) steps.push(read.step);
  });
  return { gesture, steps };
}

test("one sideways gesture steps once, inertia tail included", () => {
  const { steps } = burst([[10, 0], [20, 1], [30, 0], [25, 0], [12, 0], [6, 0], [2, 0]]);
  assert.deepEqual(steps, [1]);
});

test("a leftward gesture steps back", () => {
  assert.deepEqual(burst([[-15, 0], [-30, 2], [-20, 0]]).steps, [-1]);
});

test("a short nudge does not step", () => {
  assert.deepEqual(burst([[8, 0], [10, 0], [6, 0]]).steps, []);
});

test("mostly vertical scrolling never steps and is left to the page", () => {
  assert.deepEqual(burst([[20, 60], [30, 80], [25, 70]]).steps, []);
  assert.equal(readWheel(NO_GESTURE, 5, 40, 0).sideways, false);
  assert.equal(readWheel(NO_GESTURE, 40, 5, 0).sideways, true);
});

test("a new gesture after a pause steps again", () => {
  const first = burst([[30, 0], [30, 0]]);
  const second = burst([[30, 0], [30, 0]], 32 + WHEEL_IDLE_MS + 1, first.gesture);
  assert.deepEqual([...first.steps, ...second.steps], [1, 1]);
});
