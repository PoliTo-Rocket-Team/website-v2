import assert from "node:assert/strict";
import { test } from "node:test";
import {
  mergeResultNotice,
  planLoginMerge,
  ticketHolds,
  ticketUserOf,
  withMergeResult,
  type LoginMergeRefusal,
  type MergeLogin,
} from "./login-merge";

// The rules of merging an empty second login (issue #907), apart from Better
// Auth and the database: lib/google-accounts-auth.test.ts runs the Google
// trip through the real endpoints, and ./login-merge-server.test.ts the
// batch on the migrated database.

const login = (userId: string, facts: Partial<MergeLogin> = {}): MergeLogin => ({
  userId,
  email: `${userId}@example.com`,
  member: null,
  deleted: false,
  waiting: false,
  breakGlass: false,
  livePositions: [],
  ...facts,
});

const MEMBER = login("member", { member: 7 });
const EMPTY = login("empty");

test("an empty login merges into the signed-in one, member or not", () => {
  for (const into of [MEMBER, login("applicant")]) {
    assert.deepEqual(planLoginMerge(into, EMPTY, false), {
      kind: "merge",
      merge: { into: { userId: into.userId, member: into.member, waiting: false }, from: { userId: "empty", email: "empty@example.com", waiting: false } },
    });
  }
});

test("which merges are refused", () => {
  const cases: [string, MergeLogin | null, MergeLogin | null, boolean, LoginMergeRefusal][] = [
    ["inside View as", MEMBER, EMPTY, true, "view-as"],
    ["the login into itself", MEMBER, MEMBER, false, "self"],
    ["a login that holds another member's record", MEMBER, login("other", { member: 8 }), false, "member"],
    ["the break-glass account", MEMBER, login("admin", { breakGlass: true }), false, "break-glass"],
    ["into the break-glass account", login("admin", { breakGlass: true }), EMPTY, false, "break-glass"],
    ["a closed login", MEMBER, login("closed", { deleted: true }), false, "closed"],
    ["a waiting login into a member", MEMBER, login("waiting", { waiting: true }), false, "waiting"],
    ["a waiting login into a login that waits too", login("joiner", { waiting: true }), login("waiting", { waiting: true }), false, "waiting"],
    ["two open applications to one position", login("a", { livePositions: [3, 4] }), login("b", { livePositions: [4] }), false, "same-position"],
    ["a login the read could not find", MEMBER, null, false, "changed"],
    ["into a login closed since", login("gone", { deleted: true }), EMPTY, false, "changed"],
  ];
  for (const [name, into, from, viewingAs, refusal] of cases) assert.deepEqual(planLoginMerge(into, from, viewingAs), { kind: "refused", refusal }, name);
});

test("a waiting login merges into a login with no member record and no wait of its own", () => {
  const plan = planLoginMerge(login("applicant"), login("waiting", { waiting: true, livePositions: [1] }), false);
  assert.equal(plan.kind, "merge");
  assert.equal(plan.kind === "merge" && plan.merge.from.waiting, true);
});

test("a merge ticket holds once, for the login that asked, until it runs out", () => {
  const now = new Date("2026-10-31T12:00:00Z");
  const ticket = { userId: "member", expiresAt: new Date("2026-10-31T12:05:00Z") };
  assert.equal(ticketHolds(ticket, "member", now), true);
  assert.equal(ticketHolds(ticket, "someone-else", now), false, "bound to the login that asked");
  assert.equal(ticketHolds(ticket, null, now), false, "no session came back");
  assert.equal(ticketHolds(null, "member", now), false, "taken already, or never asked for");
  assert.equal(ticketHolds(ticket, "member", new Date("2026-10-31T12:05:00Z")), false, "run out");
  assert.equal(ticketUserOf(JSON.stringify({ userId: "member" })), "member");
  assert.equal(ticketUserOf("not json"), null);
});

test("the return to the page carries the outcome, and the section reads it as words", () => {
  assert.equal(withMergeResult("/dashboard/profile?error=account_already_linked_to_different_user", { kind: "merged", email: "e@example.com" }), "/dashboard/profile?google_merge=merged");
  assert.equal(withMergeResult("/dashboard/account", { kind: "refused", refusal: "member" }), "/dashboard/account?google_merge=member");
  assert.deepEqual(mergeResultNotice("merged")?.tone, "done");
  assert.match(mergeResultNotice("member")?.message ?? "", /another member's login/);
  assert.equal(mergeResultNotice("member")?.tone, "refused");
  assert.equal(mergeResultNotice("something-else"), null);
  assert.equal(mergeResultNotice(null), null);
});
