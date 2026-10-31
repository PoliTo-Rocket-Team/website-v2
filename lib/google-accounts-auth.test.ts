import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import { GOOGLE_ACCOUNT_REFUSAL_MESSAGES, type GoogleAccountEntry } from "./dashboard/google-accounts";
import { BASE, envRestorer, Jar, ORIGIN, SEAT_DIRECTORY, seededMemoryDb, setEnv, TEST_ENV, type MemoryDb } from "./dev-tester-fixture";
import type { GoogleAccountLog } from "./google-accounts-plugin";
import { seatOf } from "./seeded-accounts";
import type { ViewAsGate } from "./view-as-plugin";

// Linked Google accounts through the real Better Auth instance (issue #906),
// over an in-memory database. Google itself is the one stand-in: its token
// endpoint answers with an id token for the code the test sends, so sign-in
// and linking run Better Auth's own redirect, state and callback code, through
// the same `/callback/google` redirect URI production uses. Every address is
// on a domain reserved for examples; nothing here is a real secret.

const restoreEnv = envRestorer();
const realFetch = globalThis.fetch;
afterEach(() => {
  restoreEnv();
  globalThis.fetch = realFetch;
});

const MEMBER = seatOf("member");
const OTHER = seatOf("non-member");
const ACTING = seatOf("operations-lead");

/** A Google account the stand-in signs in: Google's id for it and the email its id token names. */
type Google = { readonly sub: string; readonly email: string };
const FIRST: Google = { sub: "google-first", email: MEMBER.email };
const SECOND: Google = { sub: "google-second", email: "second.address@example.com" };

const OPEN_GATE: ViewAsGate = { refusal: async () => null, record: async () => {} };

const base64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const idTokenOf = (google: Google) => `${base64url({ alg: "none" })}.${base64url({ sub: google.sub, email: google.email, email_verified: true, name: "Tester" })}.signature`;

/**
 * Google's token endpoint as the test plays it: the authorization code is the
 * name of the Google account in `accounts`, so the test picks which account
 * signs in by the code it sends back.
 */
function standInGoogle(accounts: Map<string, Google>): void {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith("https://oauth2.googleapis.com/token")) throw new Error(`unexpected fetch ${url}`);
    const code = new URLSearchParams(String(init?.body)).get("code") ?? "";
    const google = accounts.get(code);
    if (google === undefined) return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400, headers: { "content-type": "application/json" } });
    const body = { access_token: `access-${code}`, id_token: idTokenOf(google), token_type: "Bearer", expires_in: 3600, scope: "openid email profile" };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

async function setUp() {
  setEnv({ ...TEST_ENV, AUTH_GOOGLE_ID: "test-client-id", AUTH_GOOGLE_SECRET: "test-client-secret", NODE_ENV: "development", VERCEL_ENV: undefined });
  const google = new Map<string, Google>([
    ["first", FIRST],
    ["second", SECOND],
  ]);
  standInGoogle(google);
  const entries: GoogleAccountEntry[] = [];
  const log: GoogleAccountLog = { record: async (entry) => void entries.push(entry) };
  const db = seededMemoryDb();
  const { createAuth } = await import("./auth");
  const auth = createAuth(memoryAdapter(db), OPEN_GATE, SEAT_DIRECTORY, undefined, log);
  return { auth, db, google, entries };
}

type Auth = Awaited<ReturnType<typeof setUp>>["auth"];

async function post(auth: Auth, jar: Jar, path: string, body: object): Promise<Response> {
  const headers = jar.headers();
  headers.set("content-type", "application/json");
  headers.set("origin", ORIGIN);
  const response = await auth.handler(new Request(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) }));
  jar.take(response);
  return response;
}

/** Google sends the browser back with `code`, for the state an earlier answer's Google URL carried; answers where Better Auth then sends it. */
async function returnFromGoogle(auth: Auth, jar: Jar, started: Response, code: string): Promise<string> {
  const { url } = (await started.json()) as { url: string };
  const state = new URL(url).searchParams.get("state");
  assert.ok(state, "Better Auth sent the browser to Google with a state");
  assert.equal(new URL(url).searchParams.get("redirect_uri"), `${BASE}/callback/google`, "the same redirect URI sign-in uses");
  const response = await auth.handler(new Request(`${BASE}/callback/google?code=${code}&state=${state}`, { headers: jar.headers() }));
  jar.take(response);
  assert.equal(response.status, 302);
  return response.headers.get("location") ?? "";
}

/** A fresh browser signing in with Google as the account `code` names; answers the session's user id. */
async function signInWithGoogle(auth: Auth, code: string): Promise<{ jar: Jar; userId: string }> {
  const jar = new Jar();
  const started = await post(auth, jar, "/sign-in/social", { provider: "google", callbackURL: "/dashboard" });
  assert.equal(started.status, 200);
  await returnFromGoogle(auth, jar, started, code);
  const session = await auth.handler(new Request(`${BASE}/get-session`, { headers: jar.headers() }));
  const read = (await session.json()) as { user?: { id: string } } | null;
  assert.ok(read?.user, `${code} signs in`);
  return { jar, userId: read.user.id };
}

/** Adds the Google account `code` names to the login the browser is signed in to; answers where Better Auth sends it back. */
async function link(auth: Auth, jar: Jar, code: string): Promise<string> {
  const started = await post(auth, jar, "/link-social", { provider: "google", callbackURL: "/dashboard/profile", errorCallbackURL: "/dashboard/profile" });
  assert.equal(started.status, 200);
  return returnFromGoogle(auth, jar, started, code);
}

const googleRows = (db: MemoryDb) => db.account.filter((a) => a.providerId === "google");
const rowsOf = (db: MemoryDb, userId: string) => googleRows(db).filter((a) => a.userId === userId);

test("after linking a second Google account, signing in with either one opens the same login, and each row keeps its own email", async () => {
  const { auth, db, entries } = await setUp();
  const first = await signInWithGoogle(auth, "first");
  assert.equal(first.userId, MEMBER.id, "the first Google account opens the member's login");
  assert.deepEqual(entries, [], "a login's first Google account is its sign-up, not a link");

  assert.equal(await link(auth, first.jar, "second"), "/dashboard/profile", "back on the page that asked");
  assert.deepEqual(
    rowsOf(db, MEMBER.id).map((a) => [a.accountId, a.email]),
    [
      [FIRST.sub, FIRST.email],
      [SECOND.sub, SECOND.email],
    ],
  );
  assert.deepEqual(entries.map(({ event, userId, email }) => ({ event, userId, email })), [{ event: "link", userId: MEMBER.id, email: SECOND.email }]);

  for (const code of ["second", "first"]) {
    assert.equal((await signInWithGoogle(auth, code)).userId, MEMBER.id, `${code} lands on the same login`);
  }
  assert.equal(db.user.filter((u) => u.email === SECOND.email).length, 0, "no second login was made for the second address");
});

test("each sign-in refreshes the row's email from the id token Google sends", async () => {
  const { auth, db, google } = await setUp();
  const { jar } = await signInWithGoogle(auth, "first");
  await link(auth, jar, "second");
  google.set("second", { ...SECOND, email: "Renamed.Address@Example.com" });
  await signInWithGoogle(auth, "second");
  assert.equal(googleRows(db).find((a) => a.accountId === SECOND.sub)?.email, "renamed.address@example.com");
});

test("a Google account another login already holds is not linked: Google's return carries the reason, and nothing moves", async () => {
  const { auth, db, google, entries } = await setUp();
  google.set("other", { sub: "google-other", email: OTHER.email });
  const other = await signInWithGoogle(auth, "other");
  assert.equal(other.userId, OTHER.id);
  const { jar } = await signInWithGoogle(auth, "first");
  assert.equal(await link(auth, jar, "other"), "/dashboard/profile?error=account_already_linked_to_different_user");
  assert.deepEqual(rowsOf(db, OTHER.id).map((a) => a.accountId), ["google-other"]);
  assert.deepEqual(rowsOf(db, MEMBER.id).map((a) => a.accountId), [FIRST.sub]);
  assert.deepEqual(entries, []);
});

test("removing a linked account works and is logged once; the last one, a stranger's or an unnamed one is refused", async () => {
  const { auth, db, google, entries } = await setUp();
  google.set("other", { sub: "google-other", email: OTHER.email });
  await signInWithGoogle(auth, "other");
  const { jar } = await signInWithGoogle(auth, "first");
  await link(auth, jar, "second");
  entries.length = 0;

  for (const [body, message] of [
    [{ providerId: "google" }, GOOGLE_ACCOUNT_REFUSAL_MESSAGES["not-yours"]],
    [{ providerId: "google", accountId: "google-other" }, GOOGLE_ACCOUNT_REFUSAL_MESSAGES["not-yours"]],
  ] as const) {
    const refused = await post(auth, jar, "/unlink-account", body);
    assert.equal(refused.status, 400, JSON.stringify(body));
    assert.equal(((await refused.json()) as { message: string }).message, message);
  }
  assert.deepEqual(rowsOf(db, OTHER.id).map((a) => a.accountId), ["google-other"], "another login's account stays");

  const removed = await post(auth, jar, "/unlink-account", { providerId: "google", accountId: SECOND.sub });
  assert.equal(removed.status, 200);
  assert.deepEqual(rowsOf(db, MEMBER.id).map((a) => a.accountId), [FIRST.sub]);
  assert.deepEqual(entries.map(({ event, userId, email }) => ({ event, userId, email })), [{ event: "unlink", userId: MEMBER.id, email: SECOND.email }]);

  const last = await post(auth, jar, "/unlink-account", { providerId: "google", accountId: FIRST.sub });
  assert.equal(last.status, 400);
  assert.equal(((await last.json()) as { message: string }).message, GOOGLE_ACCOUNT_REFUSAL_MESSAGES.last);
  assert.deepEqual(rowsOf(db, MEMBER.id).map((a) => a.accountId), [FIRST.sub], "the last account stays");
  assert.equal(entries.length, 1, "a refusal logs nothing");
});

test("inside View as, linking and removing are refused before Better Auth acts, and nothing is logged", async () => {
  const { auth, db, entries } = await setUp();
  await signInWithGoogle(auth, "first");
  const jar = new Jar();
  const signedIn = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=${ACTING.key}`));
  assert.equal(signedIn.status, 302);
  jar.take(signedIn);
  const viewing = await post(auth, jar, "/admin/impersonate-user", { userId: MEMBER.id });
  assert.equal(viewing.status, 200, "View as of the member started");

  const linking = await post(auth, jar, "/link-social", { provider: "google", callbackURL: "/dashboard/profile" });
  const removing = await post(auth, jar, "/unlink-account", { providerId: "google", accountId: FIRST.sub });
  for (const refused of [linking, removing]) {
    assert.equal(refused.status, 403);
    assert.equal(((await refused.json()) as { message: string }).message, GOOGLE_ACCOUNT_REFUSAL_MESSAGES["view-as"]);
  }
  assert.deepEqual(rowsOf(db, MEMBER.id).map((a) => a.accountId), [FIRST.sub]);
  assert.deepEqual(entries, []);
});
