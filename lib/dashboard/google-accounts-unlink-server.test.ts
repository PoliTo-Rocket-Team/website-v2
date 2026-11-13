import "./access-matrix/install-real-session";

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { betterAuthAccounts, betterAuthUsers, users } from "@/db/schema";
import { BASE, Jar, TEST_ENV } from "@/lib/dev-tester-fixture";
import type { GoogleAccountStore } from "@/lib/google-accounts-plugin";
import { seatOf } from "@/lib/seeded-accounts";
import { addRows, changeRows, logRowsSinceSeed, resetDatabase, tableRows } from "./access-matrix/test-database";
import { recordGoogleAccountChange, removeGoogleAccount } from "./database-google-accounts";
import { GOOGLE_ACCOUNT_OPERATIONS, GOOGLE_ACCOUNT_REFUSAL_MESSAGES } from "./google-accounts";

// Removing a linked Google account through the real Better Auth instance, on
// the migrated in-memory Postgres (epic #902, acceptance criterion 9): the
// check that a login keeps one Google account and the delete run in one
// database transaction behind the login's row lock, so two removals sent at
// once for the two accounts of a login cannot both land. Placeholder
// addresses only; nothing here is a real secret.

const PERSON = seatOf("non-member");

let app: { readonly auth: typeof import("@/lib/auth") };

before(async () => {
  // A test site: `next dev` off Vercel, where the tester sign-in opens a real session.
  Object.assign(process.env, TEST_ENV, { NODE_ENV: "development" });
  delete process.env.VERCEL_ENV;
  app = { auth: await import("@/lib/auth") };
});

type Auth = ReturnType<typeof app.auth.getAuth>;

/** A fresh database where the person signs in with two Google accounts. */
async function seeded(): Promise<void> {
  await resetDatabase();
  await addRows(betterAuthUsers, [{ id: PERSON.id, name: PERSON.name, email: PERSON.email, emailVerified: true }]);
  const account = (googleId: string, email: string, linkedAt: string) => ({
    id: `row-${googleId}`,
    accountId: googleId,
    providerId: "google",
    userId: PERSON.id,
    email,
    createdAt: new Date(linkedAt),
    updatedAt: new Date(linkedAt),
  });
  await addRows(betterAuthAccounts, [
    account("google-first", PERSON.email, "2026-01-01T10:00:00Z"),
    account("google-second", "second.address@example.com", "2026-10-30T10:00:00Z"),
  ]);
}

async function call(auth: Auth, path: string, jar: Jar, body?: object): Promise<Response> {
  const headers = jar.headers();
  if (body !== undefined) headers.set("content-type", "application/json");
  const init = body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(body) };
  const response = await auth.handler(new Request(BASE + path, init));
  jar.take(response);
  return response;
}

/** A browser freshly signed in as the person, so Better Auth lets it remove a sign-in account. */
async function signedIn(auth: Auth): Promise<Jar> {
  const jar = new Jar();
  const response = await call(auth, `/dev-tester/sign-in?tester=${PERSON.key}`, jar);
  assert.equal(response.status, 302, await response.clone().text());
  return jar;
}

const unlink = (auth: Auth, jar: Jar, googleId: string) => call(auth, "/unlink-account", jar, { providerId: "google", accountId: googleId });

const googleRows = async () => (await tableRows(betterAuthAccounts)).filter((a) => a.userId === PERSON.id && a.providerId === "google");

const unlinkEntries = async () => (await logRowsSinceSeed()).filter((row) => row.operation === GOOGLE_ACCOUNT_OPERATIONS.unlink);

/**
 * The database's removal, held until `count` removals have reached it: each
 * request has then read the login's accounts and passed every check Better
 * Auth and the rules make before the delete, so the removals meet at the
 * database together. A wait past a few seconds lets them through anyway, and
 * `arrived` shows how many came.
 */
function heldRemoval(count: number): { readonly remove: GoogleAccountStore["remove"]; readonly arrived: () => number } {
  let arrived = 0;
  let release = () => {};
  const together = new Promise<void>((resolve) => {
    release = resolve;
    setTimeout(resolve, 5_000).unref();
  });
  return {
    remove: async (removal) => {
      arrived += 1;
      if (arrived === count) release();
      await together;
      return removeGoogleAccount(removal);
    },
    arrived: () => arrived,
  };
}

test("two removals sent at once for the two Google accounts of a login, both past every check before the delete: one lands, the other is refused, and one account remains", async () => {
  await seeded();
  const held = heldRemoval(2);
  const auth = app.auth.createAuth(app.auth.authDatabase(), { googleAccounts: { record: recordGoogleAccountChange, remove: held.remove } });
  const jar = await signedIn(auth);

  const answers = await Promise.all([unlink(auth, jar, "google-first"), unlink(auth, jar, "google-second")]);

  assert.equal(held.arrived(), 2, "both removals reached the database's check");
  assert.deepEqual(answers.map((a) => a.status).sort(), [200, 400]);
  const refused = answers.find((a) => a.status === 400) as Response;
  assert.equal(((await refused.json()) as { message: string }).message, GOOGLE_ACCOUNT_REFUSAL_MESSAGES.last);
  assert.equal((await googleRows()).length, 1, "the login keeps one Google account to sign in with");
  assert.equal((await unlinkEntries()).length, 1, "only the removal that landed is in the Activity log");
});

test("a removal beside another account lands with its one log entry, and then the last one is refused and changes nothing", async () => {
  await seeded();
  const auth = app.auth.getAuth();
  const jar = await signedIn(auth);

  assert.equal((await unlink(auth, jar, "google-second")).status, 200);
  const last = await unlink(auth, jar, "google-first");
  assert.equal(last.status, 400);
  assert.equal(((await last.json()) as { message: string }).message, GOOGLE_ACCOUNT_REFUSAL_MESSAGES.last);
  assert.deepEqual((await googleRows()).map((a) => a.accountId), ["google-first"]);
  assert.deepEqual((await unlinkEntries()).map((row) => row.newData), [{ email: "second.address@example.com" }]);
});

const SECOND_EMAIL = "second.address@example.com";

/** The login's sign-in email, and the email of its person row. */
async function signInEmails(): Promise<[unknown, unknown]> {
  const login = (await tableRows(betterAuthUsers)).find((u) => u.id === PERSON.id);
  const person = (await tableRows(users)).find((u) => u.id === PERSON.id);
  return [login?.email, person?.email];
}

const emailEntries = async () => (await logRowsSinceSeed()).filter((row) => row.operation === GOOGLE_ACCOUNT_OPERATIONS["sign-in-email"]);

const removalOf = (googleId: string, email: string | null) => ({ userId: PERSON.id, accountRowId: `row-${googleId}`, email });

test("removing the account whose email is the sign-in email moves that email to the oldest remaining account's, in letter case aside, and logs the move once", async () => {
  await seeded();
  await changeRows(betterAuthUsers, { id: PERSON.id }, { email: ` ${PERSON.email.toUpperCase()}` });
  await addRows(betterAuthAccounts, [
    { id: "row-google-third", accountId: "google-third", providerId: "google", userId: PERSON.id, email: "third.address@example.com", createdAt: new Date("2026-10-31T10:00:00Z"), updatedAt: new Date("2026-10-31T10:00:00Z") },
  ]);

  assert.equal(await removeGoogleAccount(removalOf("google-first", PERSON.email)), null);

  assert.deepEqual(await signInEmails(), [SECOND_EMAIL, SECOND_EMAIL], "the oldest remaining account's email, on the login and its person row");
  assert.deepEqual((await emailEntries()).map((row) => [row.recordId, row.newData, row.changedBy]), [["row-google-second", { email: SECOND_EMAIL }, PERSON.id]]);
  assert.equal((await unlinkEntries()).length, 1);
  assert.deepEqual((await googleRows()).map((a) => a.accountId).sort(), ["google-second", "google-third"]);
});

test("removing an account whose email is not the sign-in email leaves the sign-in email as it was, and logs no move", async () => {
  await seeded();
  const before = await signInEmails();
  assert.equal(await removeGoogleAccount(removalOf("google-second", SECOND_EMAIL)), null);
  assert.deepEqual(await signInEmails(), before);
  assert.equal(before[0], PERSON.email);
  assert.deepEqual(await emailEntries(), []);
  assert.equal((await unlinkEntries()).length, 1);
});

test("the sign-in email does not move onto another login's or another open person's email, nor to no email: the removal is refused and writes nothing", async () => {
  const takenBy: Record<string, () => Promise<void>> = {
    "another login": () => addRows(betterAuthUsers, [{ id: "other-login", name: "Other", email: SECOND_EMAIL, emailVerified: true }]),
    "another open person row": () => addRows(users, [{ id: "other-person", email: ` ${SECOND_EMAIL.toUpperCase()} ` }]),
    "no email on the remaining account": () => changeRows(betterAuthAccounts, { id: "row-google-second" }, { email: null }),
  };
  for (const [why, take] of Object.entries(takenBy)) {
    await seeded();
    await take();
    const before = await signInEmails();
    assert.equal(await removeGoogleAccount(removalOf("google-first", PERSON.email)), "sign-in-email", why);
    assert.deepEqual(await signInEmails(), before, `${why}: the sign-in email stays`);
    assert.deepEqual((await googleRows()).map((a) => a.accountId).sort(), ["google-first", "google-second"], `${why}: nothing is deleted`);
    assert.deepEqual([(await emailEntries()).length, (await unlinkEntries()).length], [0, 0], `${why}: nothing is logged`);
  }
});

test("a removal refused for its sign-in email answers in the rules' words over the real Better Auth instance", async () => {
  await seeded();
  await addRows(betterAuthUsers, [{ id: "other-login", name: "Other", email: SECOND_EMAIL, emailVerified: true }]);
  const auth = app.auth.getAuth();
  const jar = await signedIn(auth);
  const refused = await unlink(auth, jar, "google-first");
  assert.equal(refused.status, 400);
  assert.equal(((await refused.json()) as { message: string }).message, GOOGLE_ACCOUNT_REFUSAL_MESSAGES["sign-in-email"]);
});

test("after the removal moves the sign-in email, the same browser's session reads the new one without waiting for its cookie cache", async () => {
  await seeded();
  const auth = app.auth.getAuth();
  const jar = await signedIn(auth);
  assert.equal((await unlink(auth, jar, "google-first")).status, 200);
  const session = (await (await call(auth, "/get-session", jar)).json()) as { user: { email: string } };
  assert.equal(session.user.email, SECOND_EMAIL);
});

test("the database's removal refuses the last Google account, and an account no longer on the login, writing nothing", async () => {
  await seeded();
  const second = { userId: PERSON.id, accountRowId: "row-google-second", email: "second.address@example.com" };
  assert.equal(await removeGoogleAccount(second), null);
  assert.equal(await removeGoogleAccount(second), "not-yours");
  assert.equal(await removeGoogleAccount({ userId: PERSON.id, accountRowId: "row-google-first", email: PERSON.email }), "last");
  assert.deepEqual((await googleRows()).map((a) => a.accountId), ["google-first"]);
  assert.equal((await unlinkEntries()).length, 1);
});
