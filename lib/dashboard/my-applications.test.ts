import assert from "node:assert/strict";
import { test } from "node:test";
import { placeOf, type StoredApplication } from "./my-applications";

const sent = (status: StoredApplication["status"], joinedAt: string | null = null): StoredApplication => ({
  status,
  appliedAt: "2026-03-02T09:00:00.000Z",
  withdrawnAt: null,
  joinedAt,
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
