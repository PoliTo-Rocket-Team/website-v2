import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApplicationState } from "./application-flow";
import { BUILT_IN_STATUS_KEYS, type BuiltInStatusKey } from "./application-status";
import type { SlotRow } from "./interview-slots";
import { readsAsNew, statusKeyAfter, statusKeyOf, storedApplicationState, type StoredApplicationRow } from "./stored-application";

const APPLIED = "2026-09-10T10:00:00.000Z";
const ACCEPTED = "2026-10-05T10:00:00.000Z";
const JOINED = "2026-10-09T10:00:00.000Z";

function row(statusKey: string | null, parentKey: string | null = null): StoredApplicationRow {
  return { status_key: statusKey, status_parent_key: parentKey, applied_at: APPLIED, accepted_at: ACCEPTED, nda_arrived_at: null, joined_at: JOINED };
}

const SLOTS: readonly SlotRow[] = [
  {
    application_id: 1,
    starts_at: "2026-10-20T10:00:00.000Z",
    ends_at: "2026-10-20T11:00:00.000Z",
    chosen: false,
    chosen_at: null,
    created_at: "2026-10-14T10:00:00.000Z",
  },
];

const INTERVIEW: ApplicationState = {
  stage: "interview",
  offered: [{ start: "2026-10-20T10:00:00.000Z", end: "2026-10-20T11:00:00.000Z" }],
  booked: null,
};

/** What each built-in status reads as, with one offered time on hand. */
const READS_AS: Readonly<Record<BuiltInStatusKey, ApplicationState>> = {
  new: { stage: "new" },
  interview: INTERVIEW,
  accepted_email_to_be_sent: { stage: "accepted", acceptedAt: ACCEPTED, ndaArrived: false },
  accepted_email_sent: { stage: "accepted", acceptedAt: ACCEPTED, ndaArrived: false },
  nda_received: { stage: "accepted", acceptedAt: ACCEPTED, ndaArrived: true },
  joined: { stage: "joined", joinedAt: JOINED },
  rejected_email_to_be_sent: { stage: "rejected" },
  rejected_email_sent: { stage: "rejected" },
  accepted_for_another_position: { stage: "rejected" },
  withdrawn: { stage: "withdrawn" },
};

for (const key of BUILT_IN_STATUS_KEYS) {
  test(`storedApplicationState reads the status reference "${key}"`, () => {
    assert.deepEqual(storedApplicationState(row(key), SLOTS), READS_AS[key]);
  });
}

test("an application with no status reference reads as New, whatever its times", () => {
  assert.deepEqual(storedApplicationState(row(null), SLOTS), { stage: "new" });
});

test("an added status reads as its built-in parent", () => {
  assert.deepEqual(storedApplicationState(row("second_interview", "interview"), SLOTS), INTERVIEW);
  assert.deepEqual(storedApplicationState(row("on_hold", "rejected_email_to_be_sent"), []), { stage: "rejected" });
});

test("the old status column is not read: only the reference says where it stands", () => {
  const withOldColumn = { ...row("new"), status: "accepted" } as StoredApplicationRow;
  assert.deepEqual(storedApplicationState(withOldColumn, SLOTS), { stage: "new" });
});

test("a missing acceptance or join date falls back to the dates before it", () => {
  const undated = { ...row("joined"), accepted_at: null, joined_at: null };
  assert.deepEqual(storedApplicationState(undated, []), { stage: "joined", joinedAt: APPLIED });
  assert.deepEqual(storedApplicationState({ ...row("nda_received"), accepted_at: null }, []), { stage: "accepted", acceptedAt: APPLIED, ndaArrived: true });
});

test("each lead move writes the built-in status it reaches; In review writes New", () => {
  assert.equal(statusKeyOf({ stage: "new" }, "interview"), "new");
  assert.equal(statusKeyOf({ stage: "in-review" }, "new"), "new");
  assert.equal(statusKeyOf(INTERVIEW, "new"), "interview");
  assert.equal(statusKeyOf({ stage: "accepted", acceptedAt: ACCEPTED, ndaArrived: false }, "interview"), "accepted_email_to_be_sent");
  assert.equal(statusKeyOf({ stage: "accepted", acceptedAt: ACCEPTED, ndaArrived: true }, "accepted_email_sent"), "nda_received");
  assert.equal(statusKeyOf({ stage: "joined", joinedAt: JOINED }, "nda_received"), "joined");
  assert.equal(statusKeyOf({ stage: "rejected" }, "interview"), "rejected_email_to_be_sent");
});

test("taking the NDA tick back keeps a sent acceptance email sent", () => {
  const waiting: ApplicationState = { stage: "accepted", acceptedAt: ACCEPTED, ndaArrived: false };
  assert.equal(statusKeyOf(waiting, "accepted_email_sent"), "accepted_email_sent");
  assert.equal(statusKeyOf(waiting, "nda_received"), "accepted_email_to_be_sent");
});

test("a move that stays on the built-in status the row behaves like keeps the row's own status", () => {
  assert.equal(statusKeyAfter(row("second_interview", "interview"), INTERVIEW), "second_interview");
  assert.equal(statusKeyAfter(row("interview"), INTERVIEW), "interview");
  assert.equal(statusKeyAfter(row("second_interview", "interview"), { stage: "rejected" }), "rejected_email_to_be_sent");
  assert.equal(statusKeyAfter(row(null), INTERVIEW), "interview");
  assert.equal(statusKeyAfter(row(null), { stage: "new" }), "new");
});

test("every state a move writes reads back as that state", () => {
  for (const key of BUILT_IN_STATUS_KEYS) {
    const state = READS_AS[key];
    if (state.stage === "withdrawn") continue;
    assert.deepEqual(storedApplicationState(row(statusKeyAfter(row(key), state)), SLOTS), state, key);
  }
});

test("a row counts as new exactly when its status reads as New (issue #748)", () => {
  assert.equal(readsAsNew(row(null)), true, "no status reference");
  assert.equal(readsAsNew(row("new")), true, "New");
  assert.equal(readsAsNew(row("first_look", "new")), true, "a status added under New");
  for (const key of BUILT_IN_STATUS_KEYS.filter((k) => k !== "new")) assert.equal(readsAsNew(row(key)), false, key);
  assert.equal(readsAsNew(row("second_interview", "interview")), false, "a status added under Interview");
});
