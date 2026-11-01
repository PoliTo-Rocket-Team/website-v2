import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { betterAuthAccounts, betterAuthUsers } from "@/db/schema";
import { addRows } from "./access-matrix/test-database";
import { accountOf, seedFixture } from "./access-matrix/fixture";
import { signInAs, viewAs } from "./access-matrix/session";
import type { DashboardData } from "./data";
import { readActivityLog } from "./database-activity-log";
import { recordGoogleAccountChange } from "./database-google-accounts";
import { openDashboard } from "./open";

// Linked Google accounts on the migrated in-memory Postgres the access matrix
// uses (issue #906): what My profile and My account read, and what the
// Activity log shows of a link and an unlink. Placeholder addresses only.

const MEMBER = accountOf("member").userId;
const APPLICANT = accountOf("non-member").userId;
const ACTING = accountOf("team leader").userId;
const TOKEN = "stored-access-token-value";

/** A fresh database where the member and the applicant each sign in with Google accounts; the member's second was linked last. */
async function seeded(): Promise<void> {
  await seedFixture();
  await addRows(betterAuthUsers, [
    { id: MEMBER, name: "Member", email: `${MEMBER}@team.test`, emailVerified: true },
    { id: APPLICANT, name: "Applicant", email: `${APPLICANT}@team.test`, emailVerified: true },
  ]);
  const account = (id: string, userId: string, email: string, createdAt: string) => ({
    id,
    accountId: `google-${id}`,
    providerId: "google",
    userId,
    email,
    accessToken: TOKEN,
    idToken: TOKEN,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  });
  await addRows(betterAuthAccounts, [
    account("member-second", MEMBER, "second@example.com", "2026-10-30T10:00:00Z"),
    account("member-first", MEMBER, `${MEMBER}@team.test`, "2026-01-01T10:00:00Z"),
    account("applicant-first", APPLICANT, `${APPLICANT}@team.test`, "2026-02-01T10:00:00Z"),
  ]);
}

async function data(): Promise<DashboardData> {
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  return (opening as { data: DashboardData }).data;
}

test("My profile and My account list the person's own Google accounts by email, newest last, the same under View as", async () => {
  await seeded();
  const expected = [
    { id: "member-first", googleId: "google-member-first", email: `${MEMBER}@team.test` },
    { id: "member-second", googleId: "google-member-second", email: "second@example.com" },
  ];
  signInAs(MEMBER);
  assert.deepEqual((await (await data()).myProfile())?.googleAccounts, expected);
  viewAs(MEMBER, ACTING);
  assert.deepEqual((await (await data()).myProfile())?.googleAccounts, expected, "View as shows the person's own list (issue #653)");
  signInAs(APPLICANT);
  assert.deepEqual((await (await data()).myAccount())?.googleAccounts.map((a) => a.email), [`${APPLICANT}@team.test`]);
});

test("a link and an unlink each read as one sentence in the Account area under the person, and no token reaches the Activity log", async () => {
  await seeded();
  await recordGoogleAccountChange({ event: "link", userId: MEMBER, accountRowId: "member-second", email: "second@example.com" });
  await recordGoogleAccountChange({ event: "unlink", userId: MEMBER, accountRowId: "member-second", email: "second@example.com" });
  const page = await readActivityLog(new Date());
  const account = page.entries.filter((e) => e.change.kind === "write" && e.change.area === "account");
  assert.deepEqual(
    account.map((e) => [e.who.id, e.change.kind === "write" ? e.change.sentence : ""]),
    [
      [MEMBER, "Removed the Google account second@example.com"],
      [MEMBER, "Linked the Google account second@example.com"],
    ],
  );
  assert.equal(JSON.stringify(page).includes(TOKEN), false, "the account rows the audit trigger stored, tokens and all, are never read");
});
