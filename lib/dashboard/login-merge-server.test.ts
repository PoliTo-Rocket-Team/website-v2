import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationFiles, applications, betterAuthAccounts, betterAuthSessions, betterAuthUsers, users } from "@/db/schema";
import { addRows, changeRows, tableRows } from "./access-matrix/test-database";
import { accountOf, BREAK_GLASS_EMAIL, IDS, seedFixture } from "./access-matrix/fixture";
import { readActivityLog } from "./database-activity-log";
import { mergeLogin, readMergeLogin, writeLoginMerge } from "./database-login-merge";
import { planLoginMerge } from "./login-merge";

// Merging an empty second login on the migrated in-memory Postgres the access
// matrix uses (issue #907): everything that points at the empty login moves
// to the person in one batch, the empty login is closed and never deleted,
// and a refused or stale merge writes nothing. Placeholder addresses only.

const MEMBER = accountOf("member").userId;
const OTHER_MEMBER = accountOf("operations lead").userId;
const BREAK_GLASS = accountOf("break-glass admin").userId;
const EMPTY = "empty-login";
const EMPTY_EMAIL = "empty.login@example.com";
const TOKEN = "stored-access-token-value";
const APPLICATION = 9_907;
const FILE = 9_907;

/**
 * A fresh database where the member and an empty login each sign in with a
 * Google account; the empty login holds an application with its CV file,
 * two sessions and profile fields, and a bystander holds a session of its own.
 */
async function seeded(): Promise<void> {
  await seedFixture();
  await addRows(users, [{ id: EMPTY, email: EMPTY_EMAIL, firstName: "Other Name", phone: "+39 333 000 0000", country: "Italy" }]);
  await changeRows(users, { id: MEMBER }, { firstName: "Kept", phone: null, country: null });
  await addRows(betterAuthUsers, [
    { id: MEMBER, name: "Member", email: `${MEMBER}@team.test`, emailVerified: true },
    { id: EMPTY, name: "Empty", email: EMPTY_EMAIL, emailVerified: true },
    { id: "bystander", name: "Bystander", email: "bystander@example.com", emailVerified: true },
  ]);
  const account = (id: string, userId: string, email: string) => ({ id, accountId: `google-${id}`, providerId: "google", userId, email, accessToken: TOKEN, idToken: TOKEN, createdAt: new Date(), updatedAt: new Date() });
  await addRows(betterAuthAccounts, [account("member-first", MEMBER, `${MEMBER}@team.test`), account("empty-first", EMPTY, EMPTY_EMAIL)]);
  const session = (id: string, userId: string) => ({ id, token: `token-${id}`, userId, expiresAt: new Date("2099-01-01T00:00:00Z"), updatedAt: new Date() });
  await addRows(betterAuthSessions, [session("e1", EMPTY), session("e2", EMPTY), session("m1", MEMBER), session("b1", "bystander")]);
  await addRows(applicationFiles, [
    { id: FILE, pathname: "applications/cv-empty.pdf", originalFilename: "cv-empty.pdf", fileHash: "hash-cv-empty", fileSize: 1, uploadedAt: new Date().toISOString(), userId: EMPTY },
  ]);
  await addRows(applications, [
    { id: APPLICATION, applyPositionId: IDS.position("MA"), userId: EMPTY, cvFileId: FILE, cvName: "cv-empty.pdf", status: "received", statusKey: "new", customAnswers: [] },
  ]);
}

/** Every row a merge could touch, as stored. */
async function snapshot() {
  return {
    users: await tableRows(users),
    applications: await tableRows(applications),
    files: await tableRows(applicationFiles),
    accounts: await tableRows(betterAuthAccounts),
    sessions: await tableRows(betterAuthSessions),
    signIns: await tableRows(betterAuthUsers),
  };
}

const accountSentences = async () =>
  (await readActivityLog(new Date())).entries.flatMap((e) => (e.change.kind === "write" && e.change.area === "account" ? [[e.who.id, e.change.sentence]] : []));

test("an empty login merges into the member: its application, file, Google account and every other row move, its sessions end, and it is closed, not deleted", async () => {
  await seeded();
  const entriesBefore = (await readActivityLog(new Date())).entries.length;

  assert.deepEqual(await mergeLogin({ userId: MEMBER, fromUserId: EMPTY, viewingAs: false }), { kind: "merged", email: EMPTY_EMAIL });

  const after = await snapshot();
  assert.equal(after.applications.find((a) => a.id === APPLICATION)?.userId, MEMBER);
  assert.equal(after.files.find((f) => f.id === FILE)?.userId, MEMBER);
  assert.equal(after.applications.find((a) => a.id === APPLICATION)?.cvFileId, FILE, "the application still names its file");
  assert.deepEqual(after.accounts.filter((a) => a.userId === MEMBER).map((a) => a.id).sort(), ["empty-first", "member-first"], "the empty login's Google account now signs in to the member");
  assert.deepEqual(after.sessions.map((s) => s.userId).sort(), ["bystander", MEMBER], "the empty login's sessions ended, and no one else's");

  const closed = after.users.find((u) => u.id === EMPTY);
  assert.ok(closed?.deletedAt, "the empty login's row is closed");
  assert.ok(after.signIns.some((u) => u.id === EMPTY), "its sign-in account row stays");
  const member = after.users.find((u) => u.id === MEMBER);
  assert.deepEqual([member?.firstName, member?.phone, member?.country, member?.deletedAt], ["Kept", "+39 333 000 0000", "Italy", null], "empty fields filled, filled ones kept");

  assert.deepEqual(await accountSentences(), [[MEMBER, `Merged the login ${EMPTY_EMAIL} into their account`]]);
  assert.equal((await readActivityLog(new Date())).entries.length, entriesBefore + 1, "the merge reads as one entry");
  assert.equal(JSON.stringify(await readActivityLog(new Date())).includes(TOKEN), false, "no token reaches the Activity log");
});

test("a login that holds another member's record, the break-glass account, the person's own login and View as are refused, and nothing changes", async () => {
  await seeded();
  assert.ok((await tableRows(betterAuthUsers)).some((u) => u.id === BREAK_GLASS && u.email === BREAK_GLASS_EMAIL), "the fixture's break-glass account signs in with the break-glass email");
  const before = await snapshot();
  const cases = [
    [{ userId: MEMBER, fromUserId: OTHER_MEMBER, viewingAs: false }, "member"],
    [{ userId: MEMBER, fromUserId: BREAK_GLASS, viewingAs: false }, "break-glass"],
    [{ userId: MEMBER, fromUserId: MEMBER, viewingAs: false }, "self"],
    [{ userId: MEMBER, fromUserId: EMPTY, viewingAs: true }, "view-as"],
  ] as const;
  for (const [request, refusal] of cases) assert.deepEqual(await mergeLogin(request), { kind: "refused", refusal }, refusal);
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await accountSentences(), []);
});

test("a merge whose rows changed between the plan and the write fails whole and writes nothing", async () => {
  await seeded();
  const plan = planLoginMerge(await readMergeLogin(MEMBER), await readMergeLogin(EMPTY), false);
  assert.ok(plan.kind === "merge");
  // Between the read and the write, the empty login is given a member record.
  await changeRows(users, { id: EMPTY }, { member: accountOf("operations lead").memberId });
  const before = await snapshot();

  assert.deepEqual(await writeLoginMerge(plan.merge), { kind: "refused", refusal: "changed" });
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await accountSentences(), []);
});
