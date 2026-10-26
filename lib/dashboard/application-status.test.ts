import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BUILT_IN_STATUS_KEYS,
  BUILT_IN_STATUSES,
  builtInOf,
  isBuiltInStatusKey,
  maySetStatus,
  seesDoNotEmailNote,
  statusOfStored,
} from "./application-status";

test("the built-in statuses come in the order the owner ruled (2026-10-25)", () => {
  assert.deepEqual(
    BUILT_IN_STATUSES.map((s) => s.name),
    [
      "New",
      "Interview",
      "Accepted · email to be sent",
      "Accepted · email sent",
      "NDA received",
      "Joined",
      "Rejected · email to be sent",
      "Rejected · email sent",
      "Accepted for another position",
      "Withdrawn",
    ],
  );
  assert.deepEqual(BUILT_IN_STATUS_KEYS, BUILT_IN_STATUSES.map((s) => s.key));
  assert.equal(new Set(BUILT_IN_STATUS_KEYS).size, 10, "every key is its own");
});

test("every built-in colour is a six-digit upper-case hex, as the table's check asks", () => {
  for (const s of BUILT_IN_STATUSES) assert.match(s.colour, /^#[0-9A-F]{6}$/, s.key);
});

test("an application with no status reference reads as New", () => {
  assert.deepEqual(statusOfStored({ key: null, parentKey: null }), { kind: "built-in", key: "new" });
  assert.equal(builtInOf(statusOfStored({ key: null, parentKey: null })), "new");
});

test("a built-in status resolves to itself", () => {
  for (const key of BUILT_IN_STATUS_KEYS) {
    const status = statusOfStored({ key, parentKey: null });
    assert.deepEqual(status, { kind: "built-in", key });
    assert.equal(builtInOf(status), key);
  }
});

test("an added status resolves to its built-in parent", () => {
  const status = statusOfStored({ key: "second_interview", parentKey: "interview" });
  assert.deepEqual(status, { kind: "added", key: "second_interview", parent: "interview" });
  assert.equal(builtInOf(status), "interview");
  assert.equal(builtInOf(statusOfStored({ key: "waiting_for_visa", parentKey: "nda_received" })), "nda_received");
});

test("a stored row the table's checks refuse is not a status", () => {
  assert.throws(() => statusOfStored({ key: "interview", parentKey: "new" }), /has a parent/);
  assert.throws(() => statusOfStored({ key: "second_interview", parentKey: null }), /no built-in parent/);
  assert.throws(() => statusOfStored({ key: "third_interview", parentKey: "second_interview" }), /no built-in parent/);
});

test("only the team leader sets Accepted · email sent and the statuses added under it; anyone else who moves it sets the rest (board 97e)", () => {
  const leader = { teamLeader: true };
  const approver = { teamLeader: false };
  for (const key of BUILT_IN_STATUS_KEYS) {
    assert.equal(maySetStatus(key, leader), true, key);
    assert.equal(maySetStatus(key, approver), key !== "accepted_email_sent", key);
  }
  assert.equal(maySetStatus({ kind: "added", key: "courier_sent", parent: "accepted_email_sent" }, approver), false);
  assert.equal(maySetStatus({ kind: "added", key: "courier_sent", parent: "accepted_email_sent" }, leader), true);
  assert.equal(maySetStatus({ kind: "added", key: "second_interview", parent: "interview" }, approver), true);
});

test("everyone but the team leader sees the do-not-email note while the acceptance email is to be sent or has gone out", () => {
  const noted = BUILT_IN_STATUS_KEYS.filter((key) => seesDoNotEmailNote(key, { teamLeader: false }));
  assert.deepEqual(noted, ["accepted_email_to_be_sent", "accepted_email_sent"]);
  assert.ok(BUILT_IN_STATUS_KEYS.every((key) => !seesDoNotEmailNote(key, { teamLeader: true })));
  assert.equal(seesDoNotEmailNote({ kind: "added", key: "waiting_for_tl", parent: "accepted_email_to_be_sent" }, { teamLeader: false }), true);
});

test("only the ten keys are built-in", () => {
  assert.ok(BUILT_IN_STATUS_KEYS.every(isBuiltInStatusKey));
  for (const other of ["received", "pending", "accepted", "rejected", "accepted_by_another_team", "in_review", "", null, 3]) {
    assert.equal(isBuiltInStatusKey(other), false, String(other));
  }
});
