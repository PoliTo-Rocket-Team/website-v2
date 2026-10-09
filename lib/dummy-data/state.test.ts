import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApplicationState } from "@/lib/dashboard/application-flow";
import { applyDummyChange, EMPTY_DUMMY_STATE, MAX_NEW_POSITIONS, parseDummyState, serializeDummyState } from "./state";

const interview: ApplicationState = {
  stage: "interview",
  offered: [
    { start: "2026-10-15T15:30:00.000Z", minutes: 30 },
    { start: "2026-10-16T16:00:00.000Z", minutes: 30 },
  ],
  booked: { slot: { start: "2026-10-15T15:30:00.000Z", minutes: 30 }, at: "2026-10-11T09:00:00.000Z" },
};

test("a test developer's changes survive the cookie round trip", () => {
  let state = applyDummyChange(EMPTY_DUMMY_STATE, { kind: "position", id: 3, open: false, initial: true });
  state = applyDummyChange(state, { kind: "application", id: 12, state: { stage: "in-review" }, initial: { stage: "new" } });
  state = applyDummyChange(state, { kind: "application", id: 13, state: interview, initial: { stage: "new" } });
  state = applyDummyChange(state, {
    kind: "application",
    id: 14,
    state: { stage: "accepted", acceptedAt: "2026-10-09T14:00:00.000Z", ndaArrived: true },
    initial: { stage: "in-review" },
  });
  state = applyDummyChange(state, {
    kind: "new-position",
    position: { id: 11, title: "Trajectory Analyst", divisionId: 1, open: false, motivationLetter: true, createdAt: "2026-10-09T14:00:00.000Z" },
  });
  assert.deepEqual(parseDummyState(serializeDummyState(state)), state);
});

test("changing a value back to where the arrays start drops it from the cookie", () => {
  const off = applyDummyChange(EMPTY_DUMMY_STATE, { kind: "position", id: 3, open: false, initial: true });
  assert.deepEqual(applyDummyChange(off, { kind: "position", id: 3, open: true, initial: true }), EMPTY_DUMMY_STATE);
  const moved = applyDummyChange(EMPTY_DUMMY_STATE, { kind: "application", id: 4, state: { stage: "rejected" }, initial: interview });
  assert.deepEqual(applyDummyChange(moved, { kind: "application", id: 4, state: interview, initial: interview }), EMPTY_DUMMY_STATE);
  assert.equal(serializeDummyState(EMPTY_DUMMY_STATE), "{}");
});

test("the cookie keeps only the newest posted roles", () => {
  let state = EMPTY_DUMMY_STATE;
  for (let id = 100; id < 100 + MAX_NEW_POSITIONS + 2; id++) {
    state = applyDummyChange(state, {
      kind: "new-position",
      position: { id, title: `Role ${id}`, divisionId: 1, open: true, motivationLetter: false, createdAt: "2026-10-09T14:00:00.000Z" },
    });
  }
  assert.equal(state.newPositions.length, MAX_NEW_POSITIONS);
  assert.equal(state.newPositions[0].id, 102);
});

test("a cookie that is not a state reads as no changes, and unknown entries are dropped", () => {
  assert.deepEqual(parseDummyState("not json"), EMPTY_DUMMY_STATE);
  assert.deepEqual(parseDummyState(undefined), EMPTY_DUMMY_STATE);
  assert.deepEqual(
    parseDummyState(JSON.stringify({ r: "yes", p: { 3: "no", x: true }, a: { 4: "hired", 5: "r", 6: ["i", 25, [], null, null] }, n: [[1, ""]] })),
    { positionOpen: {}, applications: { 5: { stage: "in-review" } }, newPositions: [] },
  );
});
