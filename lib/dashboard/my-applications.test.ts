import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canWithdraw,
  isShownAt,
  oneMonthAfter,
  pickableSlot,
  placeOf,
  withdrawnOnDelete,
  type ActiveApplication,
  type ActiveStage,
  type OwnApplication,
  type StoredApplication,
} from "./my-applications";

const sent = (status: StoredApplication["status"], joinedAt: string | null = null): StoredApplication => ({
  status,
  appliedAt: "2026-03-02T09:00:00.000Z",
  withdrawnAt: null,
  acceptedAt: null,
  rejectedAt: null,
  joinedAt,
});

// The one-month rule (Owner decision, issue #317): decided on 10 Sep 2026 at noon UTC.
const DECIDED = "2026-09-10T12:00:00.000Z";
const at = (iso: string) => new Date(iso);

test("an application still being decided is shown however old it is (issue #317)", () => {
  for (const status of ["received", "pending", "interview"] as const) {
    assert.equal(isShownAt(sent(status), at("2030-01-01T00:00:00.000Z")), true, status);
  }
});

test("a decided application is shown until one month after its decision, that moment included, and hidden after (issue #317)", () => {
  const decided: readonly StoredApplication[] = [
    { ...sent("accepted"), acceptedAt: DECIDED },
    { ...sent("rejected"), rejectedAt: DECIDED },
    { ...sent("accepted_by_another_team"), rejectedAt: DECIDED },
    { ...sent("joined"), joinedAt: DECIDED },
    { ...sent("received"), withdrawnAt: DECIDED },
  ];
  for (const application of decided) {
    assert.equal(isShownAt(application, at("2026-10-10T12:00:00.000Z")), true, application.status);
    assert.equal(isShownAt(application, at("2026-10-10T12:00:00.001Z")), false, application.status);
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
  for (const status of ["accepted", "rejected", "accepted_by_another_team", "joined"] as const) {
    assert.equal(isShownAt(sent(status), at("2026-03-02T09:00:01.000Z")), false, status);
  }
});

test("a member's confirmed join is over as joined, and their other accepted application stays active (#187)", () => {
  // A member: their current role started on 2026-05-01, the day Confirm join ran on application A.
  const memberRoleSince = "2026-05-01T10:00:00.000Z";
  const joined = placeOf(sent("joined", "2026-05-01T10:00:00.000Z"), null, memberRoleSince);
  const accepted = placeOf(sent("accepted"), null, memberRoleSince);
  assert.deepEqual(joined, { kind: "past", outcome: { kind: "joined", since: "2026-05-01" } });
  assert.deepEqual(accepted, { kind: "active", stage: { kind: "accepted" } });
});

test("an accepted application is active at accepted for a non-member too", () => {
  assert.deepEqual(placeOf(sent("accepted"), null, null), { kind: "active", stage: { kind: "accepted" } });
});

test("only a joined application is over as joined", () => {
  const statuses: StoredApplication["status"][] = ["received", "pending", "interview", "accepted", "rejected", "accepted_by_another_team", "joined"];
  const joinedOnes = statuses.filter((status) => {
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
  assert.deepEqual(placeOf({ ...sent("accepted"), withdrawnAt: "2026-04-01T00:00:00.000Z" }, null, null), {
    kind: "past",
    outcome: { kind: "withdrawn" },
  });
});

test("an application under review shows its interview once times are offered", () => {
  const slot = { id: 1, start: "2026-04-01T10:00:00.000Z", end: "2026-04-01T10:30:00.000Z" };
  const interview = { lead: "Marco Bianchi", slots: [slot], chosen: null };
  assert.deepEqual(placeOf(sent("pending"), null, null), { kind: "active", stage: { kind: "in-review" } });
  assert.deepEqual(placeOf(sent("interview"), interview, null), { kind: "active", stage: { kind: "interview", interview } });
});

const application = (overrides: Partial<OwnApplication> & Pick<OwnApplication, "id">): OwnApplication => ({
  status: "received",
  withdrawnAt: null,
  cvFileId: null,
  coverLetterFileId: null,
  ...overrides,
});

test("Delete account withdraws only the open applications and deletes only their files", () => {
  const result = withdrawnOnDelete([
    application({ id: 1, status: "received", cvFileId: 10, coverLetterFileId: 11 }),
    application({ id: 2, status: "interview", cvFileId: 20 }),
    application({ id: 3, status: "rejected", cvFileId: 30, coverLetterFileId: 31 }),
    application({ id: 4, status: "accepted", cvFileId: 40 }),
    application({ id: 5, status: "pending", withdrawnAt: "2026-01-01T00:00:00Z", cvFileId: 50 }),
  ]);
  assert.deepEqual(result.applicationIds, [1, 2]);
  assert.deepEqual(result.fileIds, [10, 11, 20]);
});

test("a file another application still uses stays", () => {
  const result = withdrawnOnDelete([
    application({ id: 1, status: "received", cvFileId: 10 }),
    application({ id: 2, status: "joined", cvFileId: 10 }),
  ]);
  assert.deepEqual(result.applicationIds, [1]);
  assert.deepEqual(result.fileIds, []);
});

test("with no open application, nothing is withdrawn or deleted", () => {
  assert.deepEqual(withdrawnOnDelete([application({ id: 3, status: "rejected", cvFileId: 30 })]), { applicationIds: [], fileIds: [] });
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
