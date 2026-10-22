import assert from "node:assert/strict";
import { test } from "node:test";
import { interviewStateOf, upcomingInterviews, type SlotRow } from "./interview-slots";

function slot(applicationId: number, startsAt: string, chosen = false): SlotRow {
  const start = new Date(startsAt);
  return {
    application_id: applicationId,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    chosen,
    chosen_at: chosen ? "2026-10-01T09:00:00.000Z" : null,
    created_at: "2026-09-30T09:00:00.000Z",
  };
}

test("an interview with no times left reads as In review", () => {
  assert.deepEqual(interviewStateOf([]), { stage: "in-review" });
});

test("times with none chosen wait for the applicant; offered come soonest first", () => {
  const state = interviewStateOf([slot(1, "2026-10-20T10:00:00Z"), slot(1, "2026-10-18T10:00:00Z")]);
  assert.equal(state.stage, "interview");
  if (state.stage !== "interview") return;
  assert.equal(state.booked, null);
  assert.deepEqual(
    state.offered.map((s) => s.start),
    ["2026-10-18T10:00:00.000Z", "2026-10-20T10:00:00.000Z"],
  );
});

test("the chosen time is the booking", () => {
  const state = interviewStateOf([slot(1, "2026-10-18T10:00:00Z"), slot(1, "2026-10-20T10:00:00Z", true)]);
  assert.equal(state.stage, "interview");
  if (state.stage !== "interview") return;
  assert.deepEqual(state.booked, {
    slot: { start: "2026-10-20T10:00:00.000Z", end: "2026-10-20T10:30:00.000Z" },
    at: "2026-10-01T09:00:00.000Z",
  });
});

test("upcoming interviews: booked soonest first, then waiting; none without times", () => {
  const list = upcomingInterviews([
    { applicant: "Ada", position: "Avionics", slots: [slot(1, "2026-10-21T10:00:00Z", true)] },
    { applicant: "Bea", position: "Avionics", slots: [slot(2, "2026-10-19T10:00:00Z")] },
    { applicant: "Cy", position: "Structures", slots: [] },
    { applicant: "Dan", position: "Structures", slots: [slot(4, "2026-10-17T08:00:00Z", true), slot(4, "2026-10-22T08:00:00Z")] },
  ]);
  assert.deepEqual(list, [
    {
      applicant: "Dan",
      position: "Structures",
      state: "booked",
      start: new Date("2026-10-17T08:00:00Z"),
      end: new Date("2026-10-17T08:30:00Z"),
    },
    {
      applicant: "Ada",
      position: "Avionics",
      state: "booked",
      start: new Date("2026-10-21T10:00:00Z"),
      end: new Date("2026-10-21T10:30:00Z"),
    },
    { applicant: "Bea", position: "Avionics", state: "waiting" },
  ]);
});
