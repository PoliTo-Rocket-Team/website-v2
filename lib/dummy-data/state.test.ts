import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApplicationState } from "@/lib/dashboard/application-flow";
import type { PositionContent } from "@/lib/dashboard/new-position";
import { applyDummyChange, EMPTY_DUMMY_STATE, fitsDummyCookie, MAX_NEW_POSITIONS, parseDummyState, serializeDummyState } from "./state";

const content = (title: string): PositionContent => ({
  title,
  description: "You plan and check rocket trajectories.",
  required: ["Python or MATLAB"],
  desirable: [],
  questions: ["Tell us about a simulation you built."],
  motivationLetter: true,
});

const interview: ApplicationState = {
  stage: "interview",
  offered: [
    { start: "2026-10-15T15:30:00.000Z", end: "2026-10-15T16:00:00.000Z" },
    { start: "2026-10-16T16:00:00.000Z", end: "2026-10-16T16:30:00.000Z" },
  ],
  booked: { slot: { start: "2026-10-15T15:30:00.000Z", end: "2026-10-15T16:00:00.000Z" }, at: "2026-10-11T09:00:00.000Z" },
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
    content: content("Trajectory Analyst"),
  });
  state = applyDummyChange(state, { kind: "position-edit", id: 4, content: content("Trajectory Analyst II"), initial: content("Trajectory Analyst") });
  assert.deepEqual(parseDummyState(serializeDummyState(state)), state);
});

test("an edit back to the role's own text drops it, and the newest edit stays when the cookie runs out of room", () => {
  const edited = applyDummyChange(EMPTY_DUMMY_STATE, { kind: "position-edit", id: 4, content: content("New title"), initial: content("Old title") });
  assert.equal(edited.positionEdits.length, 1);
  assert.deepEqual(applyDummyChange(edited, { kind: "position-edit", id: 4, content: content("Old title"), initial: content("Old title") }), EMPTY_DUMMY_STATE);

  let state = EMPTY_DUMMY_STATE;
  for (let id = 1; id <= 6; id++) {
    state = applyDummyChange(state, { kind: "position-edit", id, content: { ...content(`Role ${id}`), description: "x".repeat(900) }, initial: null });
  }
  assert.ok(fitsDummyCookie(state));
  assert.ok(state.positionEdits.length < 6);
  assert.equal(state.positionEdits.at(-1)?.id, 6);
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
      content: content(`Role ${id}`),
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
    { positionOpen: {}, applications: { 5: { stage: "in-review" } }, newPositions: [], positionEdits: [] },
  );
});
