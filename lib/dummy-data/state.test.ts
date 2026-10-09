import assert from "node:assert/strict";
import { test } from "node:test";
import { applyDummyChange, EMPTY_DUMMY_STATE, parseDummyState, serializeDummyState } from "./state";

test("a test developer's changes survive the cookie round trip", () => {
  let state = applyDummyChange(EMPTY_DUMMY_STATE, { kind: "position", id: 3, open: false, initial: true });
  state = applyDummyChange(state, { kind: "application", id: 12, stage: "in-review", initial: "new" });
  assert.deepEqual(parseDummyState(serializeDummyState(state)), state);
});

test("changing a value back to where the arrays start drops it from the cookie", () => {
  const off = applyDummyChange(EMPTY_DUMMY_STATE, { kind: "position", id: 3, open: false, initial: true });
  assert.deepEqual(applyDummyChange(off, { kind: "position", id: 3, open: true, initial: true }), EMPTY_DUMMY_STATE);
  assert.equal(serializeDummyState(EMPTY_DUMMY_STATE), "{}");
});

test("a cookie that is not a state reads as no changes, and unknown entries are dropped", () => {
  assert.deepEqual(parseDummyState("not json"), EMPTY_DUMMY_STATE);
  assert.deepEqual(parseDummyState(undefined), EMPTY_DUMMY_STATE);
  assert.deepEqual(parseDummyState(JSON.stringify({ r: "yes", p: { 3: "no", x: true }, a: { 4: "hired", 5: "accepted" } })), {
    positionOpen: {},
    applicationStage: { 5: "accepted" },
  });
});
