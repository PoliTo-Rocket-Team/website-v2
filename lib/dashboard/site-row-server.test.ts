import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import { applications, betterAuthAccounts, betterAuthSessions, betterAuthUsers, logs, users } from "@/db/schema";
import { ensureSiteRow } from "./database-site-row";
import { openDashboard } from "./open";
import { accountOf, EXTRA, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";
import { addRows, changeRows, removeRows, tableRows } from "./access-matrix/test-database";

// A login whose site row is gone (issue #910), on the migrated database: each
// new session gives it a row back (`ensureSiteRow`, which Better Auth's
// session hook runs, lib/auth.ts), so the dashboard opens instead of showing
// that the account could not be opened. And Delete account takes the login
// and its Google link with it, so the same Google identity signs in afresh,
// on a fresh row: the sign-in sync leaves the closed row alone (drizzle/0078).

/** A login, as Better Auth stores it at a first Google sign-in, linked to the Google account `googleId`. */
async function addLogin(id: string, email: string, googleId = `google-${id}`): Promise<void> {
  await addRows(betterAuthUsers, [{ id, name: id, email, emailVerified: true }]);
  await addRows(betterAuthAccounts, [{ id: `account-${id}`, accountId: googleId, providerId: "google", userId: id, updatedAt: new Date() }]);
}

/** A login whose `public.users` row was removed outside the app. */
async function orphanLogin(id: string, email: string): Promise<void> {
  await addLogin(id, email);
  await removeRows(users, { id });
}

async function openingAs(userId: string) {
  signInAs(userId);
  return openDashboard();
}

async function userRow(id: string) {
  return (await tableRows(users)).find((u) => u.id === id);
}

describe("a sign-in whose login has no site row (ensureSiteRow)", () => {
  test("with no row on its email, the login gets a fresh empty row, and the dashboard opens", async () => {
    await seedFixture();
    await orphanLogin("lost-1", "lost@mail.test");
    assert.equal((await openingAs("lost-1")).kind, "account-unresolved", "before the repair");

    assert.deepEqual(await ensureSiteRow("lost-1"), { kind: "create" });
    const row = await userRow("lost-1");
    assert.deepEqual({ email: row?.email, member: row?.member, firstName: row?.firstName }, { email: "lost@mail.test", member: null, firstName: null });
    assert.equal((await openingAs("lost-1")).kind, "open");
    assert.deepEqual(await ensureSiteRow("lost-1"), { kind: "present" }, "a second session changes nothing");
    assert.equal((await tableRows(users)).filter((u) => u.id === "lost-1").length, 1);
  });

  test("an imported record with the same email, whatever the case, is attached and keeps its member link and details", async () => {
    await seedFixture();
    await orphanLogin("lost-mover", "MOVER@mail.test");
    const before = await userRow("mover");

    assert.deepEqual(await ensureSiteRow("lost-mover"), { kind: "attach", rowId: "mover" });
    assert.equal(await userRow("mover"), undefined, "the record took the login's id");
    const after = await userRow("lost-mover");
    assert.deepEqual({ ...after, id: "mover", updatedAt: null }, { ...before, updatedAt: null }, "every other field is kept");
    assert.equal(after?.member, EXTRA.mover);

    const opening = await openingAs("lost-mover");
    assert.equal(opening.kind, "open");
    const { viewer } = (opening as { data: { viewer: { kind: string; name: string } } }).data;
    assert.deepEqual({ kind: viewer.kind, name: viewer.name }, { kind: "member", name: "Mover Twice" });
  });

  test("a row another live login holds is refused: the login gets a fresh row, and that row is left unchanged", async () => {
    await seedFixture();
    const holder = accountOf("member").userId;
    await addLogin(holder, `${holder}@team.test`);
    // The member's profile email was changed to the address the other login signs in with.
    await changeRows(users, { id: holder }, { email: "shared@mail.test" });
    await orphanLogin("lost-2", "shared@mail.test");
    const held = await userRow(holder);

    assert.deepEqual(await ensureSiteRow("lost-2"), { kind: "create" });
    assert.deepEqual(await userRow(holder), held);
    assert.deepEqual({ email: (await userRow("lost-2"))?.email, member: (await userRow("lost-2"))?.member }, { email: "shared@mail.test", member: null });
    assert.equal((await openingAs("lost-2")).kind, "open");
    assert.equal((await openingAs(holder)).kind, "open", "the other login still opens its own account");
  });

  test("a new login is not handed a row another login holds by the sign-in sync either (drizzle/0078)", async () => {
    await seedFixture();
    const holder = accountOf("member").userId;
    await addLogin(holder, `${holder}@team.test`);
    await changeRows(users, { id: holder }, { email: "shared@mail.test" });
    const held = await userRow(holder);
    await addLogin("newcomer", "shared@mail.test");
    assert.deepEqual(await userRow(holder), held);
    assert.equal((await userRow("newcomer"))?.member, null);
  });

  test("a free record that applications and audit rows still point at cannot take the login's id: the login gets a fresh row, and the record and those rows are left unchanged", async () => {
    await seedFixture();
    await orphanLogin("lost-applicant", "applicant@mail.test");
    await addRows(users, [{ id: "applicant", email: "applicant@mail.test", firstName: "Imported" }]);
    await addRows(applications, [{ userId: "applicant" }]);
    await addRows(logs, [{ schemaName: "public", tableName: "users", operation: "UPDATE", recordId: "applicant", changedBy: "applicant" }]);
    const record = await userRow("applicant");
    assert.equal((await openingAs("lost-applicant")).kind, "account-unresolved", "before the repair");

    assert.deepEqual(await ensureSiteRow("lost-applicant"), { kind: "create" });
    assert.deepEqual(await userRow("applicant"), record);
    assert.deepEqual((await tableRows(applications)).filter((a) => a.userId === "applicant").length, 1);
    assert.deepEqual((await tableRows(logs)).filter((l) => l.changedBy === "applicant" && l.recordId === "applicant").length, 1);
    const fresh = await userRow("lost-applicant");
    assert.deepEqual({ email: fresh?.email, member: fresh?.member, firstName: fresh?.firstName }, { email: "applicant@mail.test", member: null, firstName: null });
    assert.equal((await openingAs("lost-applicant")).kind, "open");
    assert.deepEqual(await ensureSiteRow("lost-applicant"), { kind: "present" }, "a second session changes nothing");
  });

  test("an unknown login is left alone", async () => {
    await seedFixture();
    assert.equal(await ensureSiteRow("nobody"), null);
    assert.equal(await userRow("nobody"), undefined);
  });
});

describe("Delete account (deleteAccount, ./database-self.ts)", () => {
  test("removes the login, its Google link and its sessions, so the same Google identity signs in afresh", async () => {
    await seedFixture();
    const { userId } = accountOf("member");
    const email = `${userId}@team.test`;
    await addLogin(userId, email, "google-sub-member");
    await addRows(betterAuthSessions, [{ id: "session-1", token: "token-1", userId, expiresAt: new Date(Date.now() + 86_400_000), updatedAt: new Date() }]);

    signInAs(userId);
    assert.equal((await actions.deleteAccount(false, false)).ok, true);
    assert.deepEqual((await tableRows(betterAuthUsers)).filter((u) => u.id === userId), [], "the login is gone");
    assert.deepEqual((await tableRows(betterAuthAccounts)).filter((a) => a.userId === userId || a.accountId === "google-sub-member"), [], "its Google link is gone");
    assert.deepEqual((await tableRows(betterAuthSessions)).filter((s) => s.userId === userId), [], "its sessions are gone");

    // The same Google account signs in again: Better Auth finds no login for
    // it and makes a new one, which gets a fresh row (drizzle/0078); the
    // closed row stays with the team until it is anonymized.
    const closed = await userRow(userId);
    assert.notEqual(closed?.deletedAt, null);
    await addLogin("fresh-login", email, "google-sub-member");
    assert.deepEqual(await userRow(userId), closed);
    assert.deepEqual(await ensureSiteRow("fresh-login"), { kind: "present" });
    const fresh = await userRow("fresh-login");
    assert.deepEqual({ member: fresh?.member, deletedAt: fresh?.deletedAt }, { member: null, deletedAt: null });
    assert.equal((await openingAs("fresh-login")).kind, "open");
  });
});
