import assert from "node:assert/strict";
import { test } from "node:test";
import { GOOGLE_ACCOUNT_RESET, GOOGLE_ACCOUNT_ROWS, MEMBER_SEAT_SECOND_GOOGLE_EMAIL, SIGN_IN_ROWS } from "../../db/seed/people";
import { isSeededEmail, seatOf } from "../seeded-accounts";

// The seeded Google accounts (issue #942): one per seeded login, under its
// email, and a second for the member seat, every value invented.

test("every seeded login has one Google account under its own id and email", () => {
  for (const login of SIGN_IN_ROWS.rows) {
    const own = GOOGLE_ACCOUNT_ROWS.rows.filter((a) => a.userId === login.id && a.email === login.email);
    assert.equal(own.length, 1, `${login.email} has one Google account under its own email`);
    assert.equal(own[0].providerId, "google");
  }
});

test("the member seat has a second Google account on a different invented address", () => {
  const member = seatOf("member");
  const accounts = GOOGLE_ACCOUNT_ROWS.rows.filter((a) => a.userId === member.id);
  assert.deepEqual(accounts.map((a) => a.email).sort(), [member.email, MEMBER_SEAT_SECOND_GOOGLE_EMAIL].sort());
  assert.notEqual(MEMBER_SEAT_SECOND_GOOGLE_EMAIL, member.email);
  assert.ok(isSeededEmail(MEMBER_SEAT_SECOND_GOOGLE_EMAIL));
  const others = GOOGLE_ACCOUNT_ROWS.rows.filter((a) => a.userId !== member.id);
  assert.equal(others.length, SIGN_IN_ROWS.rows.length - 1, "no other login has a second one");
});

test("every seeded Google account is invented: made-up stable ids, reserved emails, no token, scope or password", () => {
  const ids = GOOGLE_ACCOUNT_ROWS.rows.map((a) => a.id);
  const subjects = GOOGLE_ACCOUNT_ROWS.rows.map((a) => a.accountId);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.equal(new Set(subjects).size, subjects.length, "subjects are unique");
  for (const account of GOOGLE_ACCOUNT_ROWS.rows) {
    assert.match(account.id, /^seed-google-/);
    // A real Google subject is a long run of digits; a made-up one is not.
    assert.match(account.accountId, /^seed-google-subject-/);
    assert.equal(account.providerId, "google");
    assert.ok(typeof account.email === "string" && isSeededEmail(account.email), `${account.email} is on the reserved domain`);
    assert.equal(account.accessToken, null);
    assert.equal(account.refreshToken, null);
    assert.equal(account.idToken, null);
    assert.equal(account.scope, null);
    assert.equal(account.password, null);
  }
});

test("the Google account reset names only the seed's made-up ids", () => {
  assert.equal(GOOGLE_ACCOUNT_RESET.sql, `DELETE FROM better_auth.account WHERE id LIKE 'seed-google-%'`);
  assert.deepEqual(GOOGLE_ACCOUNT_RESET.params, []);
});
