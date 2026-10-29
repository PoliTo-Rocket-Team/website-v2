import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_STATUS_KEYS, type ApplicationStatus, type BuiltInStatusKey } from "./application-status";
import {
  canWithdraw,
  isShownAt,
  isWithdrawable,
  mayOfferInterview,
  oneMonthAfter,
  pickableSlot,
  placeOf,
  publicStepOf,
  WITHDRAWABLE_STATUS_KEYS,
  WITHDRAWN_STATUS_KEY,
  type ActiveApplication,
  type ActiveStage,
  type ApplicationPlace,
  type Interview,
  type PublicStep,
  type StoredApplication,
} from "./my-applications";

const builtIn = (key: BuiltInStatusKey): ApplicationStatus => ({ kind: "built-in", key });

const sent = (status: BuiltInStatusKey | ApplicationStatus, joinedAt: string | null = null): StoredApplication => ({
  status: typeof status === "string" ? builtIn(status) : status,
  appliedAt: "2026-03-02T09:00:00.000Z",
  withdrawnAt: null,
  acceptedAt: null,
  rejectedAt: null,
  joinedAt,
});

// The one-month rule (Owner decision, issue #317): decided on 10 Sep 2026 at noon UTC.
const DECIDED = "2026-09-10T12:00:00.000Z";
const at = (iso: string) => new Date(iso);

// The public step of each built-in status (Owner decision on epic #588,
// 2026-10-25; issue #753). The applicant never sees the team's status.
const PUBLIC_STEPS: Record<BuiltInStatusKey, PublicStep> = {
  new: "received",
  interview: "interview",
  accepted_email_to_be_sent: "in-review",
  accepted_email_sent: "accepted",
  nda_received: "accepted",
  joined: "joined",
  rejected_email_to_be_sent: "in-review",
  rejected_email_sent: "not-selected",
  accepted_for_another_position: "not-selected",
  withdrawn: "withdrawn",
};

test("each of the ten built-in statuses shows its public step (issue #753)", () => {
  assert.deepEqual(Object.keys(PUBLIC_STEPS), [...BUILT_IN_STATUS_KEYS]);
  for (const key of BUILT_IN_STATUS_KEYS) assert.equal(publicStepOf(builtIn(key)), PUBLIC_STEPS[key], key);
});

const SLOT = { id: 1, start: "2026-04-01T10:00:00.000Z", end: "2026-04-01T10:30:00.000Z" };
const OFFERED: Interview = { lead: "Marco Bianchi", slots: [SLOT], chosen: null };

/** Where each built-in status lists on My applications, with interview times offered. */
const PLACES: Record<BuiltInStatusKey, ApplicationPlace> = {
  new: { kind: "active", stage: { kind: "received" } },
  interview: { kind: "active", stage: { kind: "interview", interview: OFFERED } },
  accepted_email_to_be_sent: { kind: "active", stage: { kind: "in-review" } },
  accepted_email_sent: { kind: "active", stage: { kind: "accepted" } },
  nda_received: { kind: "active", stage: { kind: "accepted" } },
  joined: { kind: "past", outcome: { kind: "joined", since: "2026-03-02" } },
  rejected_email_to_be_sent: { kind: "active", stage: { kind: "in-review" } },
  rejected_email_sent: { kind: "past", outcome: { kind: "not-selected" } },
  accepted_for_another_position: { kind: "past", outcome: { kind: "not-selected" } },
  withdrawn: { kind: "past", outcome: { kind: "withdrawn" } },
};

test("each of the ten built-in statuses lists at its public step on My applications (issue #753)", () => {
  for (const key of BUILT_IN_STATUS_KEYS) assert.deepEqual(placeOf(sent(key), OFFERED, null), PLACES[key], key);
});

test("an added status shows its parent's public step (issue #753)", () => {
  for (const parent of BUILT_IN_STATUS_KEYS) {
    const added: ApplicationStatus = { kind: "added", key: `second_${parent}`, parent };
    assert.equal(publicStepOf(added), PUBLIC_STEPS[parent], parent);
    assert.deepEqual(placeOf(sent(added), OFFERED, null), PLACES[parent], parent);
  }
  const secondInterview: ApplicationStatus = { kind: "added", key: "second_interview", parent: "interview" };
  assert.deepEqual(placeOf(sent(secondInterview), null, null), { kind: "active", stage: { kind: "in-review" } });
});

test("an email to be sent shows In review, never the outcome, and is still being decided for the applicant (issue #753)", () => {
  for (const key of ["accepted_email_to_be_sent", "rejected_email_to_be_sent"] as const) {
    const decided: StoredApplication = { ...sent(key), acceptedAt: DECIDED, rejectedAt: DECIDED };
    assert.deepEqual(placeOf(decided, null, null), { kind: "active", stage: { kind: "in-review" } }, key);
    assert.equal(isShownAt(decided, at("2030-01-01T00:00:00.000Z")), true, key);
  }
});

test('"Accepted for another position" shows Not selected, as accepted_by_another_team did (issue #753)', () => {
  assert.deepEqual(placeOf(sent("accepted_for_another_position"), null, "2026-05-01T10:00:00.000Z"), {
    kind: "past",
    outcome: { kind: "not-selected" },
  });
});

test("interview times are read only for an application whose public step is Interview", () => {
  const offering = BUILT_IN_STATUS_KEYS.filter((key) => mayOfferInterview(sent(key)));
  assert.deepEqual(offering, ["interview"]);
  assert.equal(mayOfferInterview({ ...sent("interview"), withdrawnAt: DECIDED }), false);
  assert.equal(mayOfferInterview(sent({ kind: "added", key: "second_interview", parent: "interview" })), true);
});

test("the applicant can withdraw only before an outcome shows", () => {
  assert.deepEqual(WITHDRAWABLE_STATUS_KEYS, ["new", "interview", "accepted_email_to_be_sent", "rejected_email_to_be_sent"]);
  for (const key of BUILT_IN_STATUS_KEYS) {
    const where = placeOf(sent(key), OFFERED, null);
    assert.equal(where.kind === "active" && canWithdraw(where.stage), WITHDRAWABLE_STATUS_KEYS.includes(key), key);
  }
});

test("an application still being decided is shown however old it is (issue #317)", () => {
  for (const status of ["new", "interview", "accepted_email_to_be_sent", "rejected_email_to_be_sent"] as const) {
    assert.equal(isShownAt(sent(status), at("2030-01-01T00:00:00.000Z")), true, status);
  }
});

test("a decided application is shown until one month after its decision, that moment included, and hidden after (issue #317)", () => {
  const decided: readonly StoredApplication[] = [
    { ...sent("accepted_email_sent"), acceptedAt: DECIDED },
    { ...sent("nda_received"), acceptedAt: DECIDED },
    { ...sent("rejected_email_sent"), rejectedAt: DECIDED },
    { ...sent("accepted_for_another_position"), rejectedAt: DECIDED },
    { ...sent("joined"), joinedAt: DECIDED },
    { ...sent("new"), withdrawnAt: DECIDED },
    { ...sent("withdrawn"), withdrawnAt: DECIDED },
  ];
  for (const application of decided) {
    const label = JSON.stringify(application.status);
    assert.equal(isShownAt(application, at("2026-10-10T12:00:00.000Z")), true, label);
    assert.equal(isShownAt(application, at("2026-10-10T12:00:00.001Z")), false, label);
  }
});

test("a month after the 31st ends on the next month's last day", () => {
  assert.equal(oneMonthAfter("2026-01-31T08:00:00.000Z").toISOString(), "2026-02-28T08:00:00.000Z");
  assert.equal(oneMonthAfter("2026-12-15T08:00:00.000Z").toISOString(), "2027-01-15T08:00:00.000Z");
});

test("after an accept, the join is the latest decision the month counts from (issue #317)", () => {
  const joined: StoredApplication = { ...sent("joined"), acceptedAt: "2026-08-01T12:00:00.000Z", joinedAt: DECIDED };
  assert.equal(isShownAt(joined, at("2026-09-20T12:00:00.000Z")), true);
  assert.equal(isShownAt(joined, at("2026-10-11T12:00:00.000Z")), false);
});

test("a decided application with no decision time on record is past the month (issue #317)", () => {
  for (const status of ["accepted_email_sent", "nda_received", "rejected_email_sent", "accepted_for_another_position", "joined", "withdrawn"] as const) {
    assert.equal(isShownAt(sent(status), at("2026-03-02T09:00:01.000Z")), false, status);
  }
});

test("a member's confirmed join is over as joined, and their other accepted application stays active (#187)", () => {
  // A member: their current role started on 2026-05-01, the day Confirm join ran on application A.
  const memberRoleSince = "2026-05-01T10:00:00.000Z";
  const joined = placeOf(sent("joined", "2026-05-01T10:00:00.000Z"), null, memberRoleSince);
  const accepted = placeOf(sent("accepted_email_sent"), null, memberRoleSince);
  assert.deepEqual(joined, { kind: "past", outcome: { kind: "joined", since: "2026-05-01" } });
  assert.deepEqual(accepted, { kind: "active", stage: { kind: "accepted" } });
});

test("an accepted application is active at accepted for a non-member too", () => {
  assert.deepEqual(placeOf(sent("accepted_email_sent"), null, null), { kind: "active", stage: { kind: "accepted" } });
});

test("only a joined application is over as joined", () => {
  const joinedOnes = BUILT_IN_STATUS_KEYS.filter((status) => {
    const where = placeOf(sent(status), null, "2026-05-01T10:00:00.000Z");
    return where.kind === "past" && where.outcome.kind === "joined";
  });
  assert.deepEqual(joinedOnes, ["joined"]);
});

test("a join stored without joined_at dates from the role, then from the application", () => {
  assert.deepEqual(placeOf(sent("joined"), null, "2026-05-01T10:00:00.000Z"), { kind: "past", outcome: { kind: "joined", since: "2026-05-01" } });
  assert.deepEqual(placeOf(sent("joined"), null, null), { kind: "past", outcome: { kind: "joined", since: "2026-03-02" } });
});

test("a withdrawn application is over as withdrawn, whatever its status", () => {
  assert.deepEqual(placeOf({ ...sent("accepted_email_sent"), withdrawnAt: "2026-04-01T00:00:00.000Z" }, null, null), {
    kind: "past",
    outcome: { kind: "withdrawn" },
  });
});

test("an application at Interview shows In review until times are offered, then its interview", () => {
  assert.deepEqual(placeOf(sent("interview"), null, null), { kind: "active", stage: { kind: "in-review" } });
  assert.deepEqual(placeOf(sent("interview"), OFFERED, null), { kind: "active", stage: { kind: "interview", interview: OFFERED } });
});

const added = (key: string, parent: BuiltInStatusKey): ApplicationStatus => ({ kind: "added", key, parent });

// Delete account withdraws every application not withdrawn yet, whatever its
// status (Owner decision, issue #831), in the batch that writes:
// ./file-references-server.test.ts covers it on the database.

test("an open application is one the Withdraw button could withdraw, built-in or added", () => {
  for (const key of BUILT_IN_STATUS_KEYS) {
    assert.equal(isWithdrawable(builtIn(key)), WITHDRAWABLE_STATUS_KEYS.includes(key), key);
    assert.equal(isWithdrawable(added(`under_${key}`, key)), WITHDRAWABLE_STATUS_KEYS.includes(key), key);
  }
});

test("both ways to withdraw end at the Withdrawn status, which is no longer open (#759)", () => {
  assert.equal(WITHDRAWN_STATUS_KEY, "withdrawn");
  assert.equal(publicStepOf(builtIn(WITHDRAWN_STATUS_KEY)), "withdrawn");
  assert.equal(isWithdrawable(builtIn(WITHDRAWN_STATUS_KEY)), false);
});

// Withdraw and the interview time on My applications (issues #171, #183): the
// rules the database side's withdrawApplication and chooseInterviewSlot ask.

test("an accepted application cannot be withdrawn; one still being decided can", () => {
  assert.equal(canWithdraw({ kind: "accepted" }), false);
  for (const stage of [{ kind: "received" }, { kind: "in-review" }, { kind: "interview", interview: { lead: "Lead", slots: [], chosen: null } }] as const) {
    assert.equal(canWithdraw(stage), true, stage.kind);
  }
});

test("the applicant picks one offered interview time: an unknown time, a second pick or no interview is refused", () => {
  const slots = [
    { id: 1, start: "2026-10-20T09:00:00.000Z", end: "2026-10-20T10:00:00.000Z" },
    { id: 2, start: "2026-10-21T09:00:00.000Z", end: "2026-10-21T10:00:00.000Z" },
  ];
  const card = (stage: ActiveStage): ActiveApplication => ({ id: 7, code: "AER-MSA-007", title: "Engineer", department: "Aerodynamics", division: null, sent: "2026-10-01T09:00:00.000Z", stage, files: [], answers: [] });
  const waiting = card({ kind: "interview", interview: { lead: "Lead", slots, chosen: null } });

  assert.deepEqual(pickableSlot(waiting, 2), { ok: true, slot: slots[1] });
  assert.deepEqual(pickableSlot(waiting, 9999), { ok: false, error: "That time is no longer offered." });
  assert.deepEqual(pickableSlot(card({ kind: "interview", interview: { lead: "Lead", slots, chosen: slots[1] } }), 1), { ok: false, error: "You already picked a time." });
  assert.deepEqual(pickableSlot(card({ kind: "received" }), 1), { ok: false, error: "This application has no interview to pick a time for." });
  assert.deepEqual(pickableSlot(undefined, 1), { ok: false, error: "That application is not yours." });
});
