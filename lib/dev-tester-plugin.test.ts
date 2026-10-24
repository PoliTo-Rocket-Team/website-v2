import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getCookieCache } from "better-auth/cookies";
import { viewAsRefusalOf, viewAsSiteOf, type ViewAsAccount, type ViewAsEntry, type ViewAsRefusal } from "./dashboard/view-as";
import { SEAT_OF_FLAG } from "./dashboard/viewer";
import {
  BASE,
  GATE_ON,
  Jar,
  PREVIEW_DB,
  TEST_ENV,
  envRestorer,
  memoryAuth,
  seededMemoryDb,
  setEnv,
  type MemoryDb,
} from "./dev-tester-fixture";
import { ADMIN_TESTERS, SEEDED_ACCOUNTS, seatOf, type SeededAccount } from "./seeded-accounts";
import type { ViewAsGate } from "./view-as-plugin";

// The tester sign-in through the real Better Auth instance (issue #608),
// over an in-memory database: under `next dev` and on a preview of the
// shared `preview` database it opens a real session for any seeded seat or
// admin tester, any account signed in this way passes the View as rule there
// (issues #604, #648), and signing out deletes the session. A Google session
// reaches the same View as check as a tester one and gets the same answer.
// Where the gate is off, the plugin is not registered (lib/dev-tester.test.ts).

afterEach(envRestorer());

const label = (vars: Record<string, string | undefined>) => JSON.stringify(vars);

/** The stored sessions an account is signed in with. */
const sessionRowsOf = (db: MemoryDb, userId: string) => db.session.filter((row) => row.userId === userId);

async function signIn(auth: Awaited<ReturnType<typeof memoryAuth>>, account: SeededAccount, cb?: string): Promise<{ response: Response; jar: Jar }> {
  const query = cb === undefined ? "" : `&cb=${encodeURIComponent(cb)}`;
  const response = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=${account.key}${query}`));
  const jar = new Jar();
  jar.take(response);
  return { response, jar };
}

test("where the gate is on, signing in as any seeded seat or admin tester makes a real session for that account", async () => {
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...vars });
    const db = seededMemoryDb();
    const auth = await memoryAuth(db);

    for (const account of SEEDED_ACCOUNTS) {
      const at = `${label(vars)} ${account.key}`;
      const { response, jar } = await signIn(auth, account, "/apply/15-mission-analyst");
      assert.equal(response.status, 302, at);
      assert.equal(response.headers.get("location"), "/apply/15-mission-analyst", at);

      const cache = await getCookieCache(jar.headers(), { secret: TEST_ENV.BETTER_AUTH_SECRET });
      assert.equal(cache?.session.userId, account.id, `${at}: the cookie cache getCurrentUserId reads`);

      const session = await auth.api.getSession({ headers: jar.headers(), query: { disableCookieCache: true } });
      assert.equal(session?.user.id, account.id, `${at}: the session row the server reads`);
      assert.equal(session?.impersonatedBy, null, `${at}: a plain session, not View as`);
      assert.ok(sessionRowsOf(db, account.id).length > 0, `${at}: stored in the database`);
    }
  }
});

test("the tester list links every seeded seat and admin tester, and an unknown key is refused", async () => {
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...vars });
    const auth = await memoryAuth();

    const list = await auth.handler(new Request(`${BASE}/dev-tester`));
    assert.equal(list.status, 200, label(vars));
    const html = await list.text();
    for (const account of SEEDED_ACCOUNTS) {
      assert.ok(html.includes(`/api/auth/dev-tester/sign-in?tester=${account.key}`), `${label(vars)} ${account.key}`);
    }

    const unknown = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=admin`));
    assert.equal(unknown.status, 400, label(vars));
    assert.equal(unknown.headers.getSetCookie().length, 0, label(vars));
  }
});

test("an account missing from the database gets no session", async () => {
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...vars });
    const auth = await memoryAuth({ user: [], session: [], account: [], verification: [] });

    const response = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=member`));
    assert.equal(response.status, 404, label(vars));
    assert.equal(response.headers.getSetCookie().length, 0, label(vars));
  }
});

/** One question the gate was asked, and its answer. */
type Asked = { readonly start: Parameters<ViewAsGate["refusal"]>[0]; readonly answer: ViewAsRefusal | null };

/**
 * The View as gate of issue #604 with its database reads swapped for this
 * in-memory one: the same rule (`viewAsRefusalOf`) on the same site reading
 * (`viewAsSiteOf`, read at each request), each account's full-access seat
 * from the seat table. It keeps what it was asked, its answers and what it
 * logged.
 */
function issue604Gate(db: MemoryDb): { gate: ViewAsGate; asked: Asked[]; entries: ViewAsEntry[] } {
  const accountOf = (id: string): ViewAsAccount | null => {
    if (!db.user.some((u) => u.id === id)) return null;
    const seeded = SEEDED_ACCOUNTS.find((a) => a.id === id);
    const activeRoles = seeded?.kind === "seat" ? seeded.roles.map((r) => ({ fullAccess: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess] })) : [];
    return { activeRoles };
  };
  const asked: Asked[] = [];
  const entries: ViewAsEntry[] = [];
  return {
    asked,
    entries,
    gate: {
      refusal: async (start) => {
        const answer = viewAsRefusalOf({ ...start, acting: accountOf(start.actingAccountId), person: accountOf(start.personId) }, viewAsSiteOf());
        asked.push({ start, answer });
        return answer;
      },
      record: async (entry) => {
        entries.push(entry);
      },
    },
  };
}

async function post(auth: Awaited<ReturnType<typeof memoryAuth>>, jar: Jar, path: string, body: unknown = {}): Promise<Response> {
  const headers = jar.headers();
  headers.set("content-type", "application/json");
  const response = await auth.handler(new Request(BASE + path, { method: "POST", headers, body: JSON.stringify(body) }));
  jar.take(response);
  return response;
}

test("any account signed in this way can start View as through the gate, a plain member seat included (issue #648)", async () => {
  const person = seatOf("department-head");
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...vars });
    const db = seededMemoryDb();
    const { gate, entries } = issue604Gate(db);
    const auth = await memoryAuth(db, gate);

    for (const acting of [seatOf("member"), seatOf("division-lead"), ...ADMIN_TESTERS]) {
      const at = `${label(vars)} ${acting.key}`;
      const { jar } = await signIn(auth, acting);
      const started = await post(auth, jar, "/admin/impersonate-user", { userId: person.id });
      assert.equal(started.status, 200, at);
      const session = await auth.api.getSession({ headers: jar.headers(), query: { disableCookieCache: true } });
      assert.equal(session?.user.id, person.id, `${at}: viewing as the department head seat`);
      assert.equal(session?.impersonatedBy, acting.id, `${at}: the session names the acting account`);
      const viewAsRows = db.session.filter((row) => row.impersonatedBy === acting.id);
      assert.equal(viewAsRows.length, 1, `${at}: one stored View as session`);
      assert.deepEqual(entries.at(-1), { event: "start", sessionId: viewAsRows[0].id, personId: person.id, actingAccountId: acting.id }, at);

      const chained = await post(auth, jar, "/admin/impersonate-user", { userId: seatOf("alumni").id });
      assert.equal(chained.status, 403, `${at}: no second start from inside the View as session`);
      assert.equal((await post(auth, jar, "/admin/stop-impersonating")).status, 200, `${at}: Stop`);
    }
  }
});

// Google sign-in, over the same in-memory database: the real `/sign-in/social`
// and `/callback/google` endpoints, with only Google's token endpoint
// answered here. The ID token is not signed, as Better Auth only decodes the
// one its own token exchange returns.

const GOOGLE_ENV = { AUTH_GOOGLE_ID: "google-client-id.test", AUTH_GOOGLE_SECRET: "google-client-secret-test" };
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function unsignedIdToken(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "none", typ: "JWT" })}.${part(claims)}.`;
}

/** Signs in with Google as the account, through the real OAuth endpoints, and returns the browser's cookies. */
async function googleSignIn(auth: Awaited<ReturnType<typeof memoryAuth>>, account: SeededAccount): Promise<Jar> {
  const jar = new Jar();
  const headers = jar.headers();
  headers.set("content-type", "application/json");
  const started = await auth.handler(new Request(`${BASE}/sign-in/social`, { method: "POST", headers, body: JSON.stringify({ provider: "google", callbackURL: "/dashboard" }) }));
  assert.equal(started.status, 200, `${account.key}: the Google sign-in starts`);
  jar.take(started);
  const state = new URL(((await started.json()) as { url: string }).url).searchParams.get("state");
  assert.ok(state, `${account.key}: Google is sent a state`);

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const target = input instanceof Request ? input.url : String(input);
    if (!target.startsWith(GOOGLE_TOKEN_URL)) return realFetch(input, init);
    const idToken = unsignedIdToken({
      iss: "https://accounts.google.com",
      aud: GOOGLE_ENV.AUTH_GOOGLE_ID,
      sub: `google-${account.id}`,
      email: account.email,
      email_verified: true,
      name: account.name,
    });
    return Response.json({ access_token: "google-access-token", token_type: "Bearer", expires_in: 3600, scope: "openid email profile", id_token: idToken });
  }) as typeof fetch;
  try {
    const callback = await auth.handler(new Request(`${BASE}/callback/google?state=${encodeURIComponent(state)}&code=google-code`, { headers: jar.headers() }));
    assert.equal(callback.status, 302, `${account.key}: Google answers back`);
    assert.equal(callback.headers.get("location"), "/dashboard", `${account.key}: signed in`);
    jar.take(callback);
  } finally {
    globalThis.fetch = realFetch;
  }
  return jar;
}

test("a Google session and a tester session reach the same View as check and get the same answer, on a test site and on production", async () => {
  const person = seatOf("department-head");
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...GOOGLE_ENV, ...vars });
    const db = seededMemoryDb();
    const { gate, asked } = issue604Gate(db);
    const auth = await memoryAuth(db, gate);

    for (const acting of [seatOf("member"), seatOf("division-lead"), ADMIN_TESTERS[0]]) {
      const at = `${label(vars)} ${acting.key}`;
      const google = await googleSignIn(auth, acting);
      const session = await auth.api.getSession({ headers: google.headers(), query: { disableCookieCache: true } });
      assert.equal(session?.user.id, acting.id, `${at}: the Google session is theirs`);
      assert.ok(db.account.some((row) => row.userId === acting.id && row.providerId === "google"), `${at}: signed in with Google`);
      const viaGoogle = await post(auth, google, "/admin/impersonate-user", { userId: person.id });
      const googleAsked = asked.at(-1);

      const { jar: tester } = await signIn(auth, acting);
      const viaTester = await post(auth, tester, "/admin/impersonate-user", { userId: person.id });
      const testerAsked = asked.at(-1);

      assert.notEqual(googleAsked, testerAsked, `${at}: the gate is asked for each session`);
      assert.deepEqual(googleAsked, testerAsked, `${at}: the same question, the same answer`);
      assert.deepEqual(testerAsked, { start: { actingAccountId: acting.id, viewingAs: false, personId: person.id }, answer: null }, at);
      assert.deepEqual([viaGoogle.status, viaTester.status], [200, 200], at);
    }
  }

  // Production, even on the shared preview database: tester sign-in is off, so a Google session is the only one, and only the IT lead seat starts.
  setEnv({ ...TEST_ENV, ...GOOGLE_ENV, NODE_ENV: "production", VERCEL_ENV: "production", DATABASE_URL: PREVIEW_DB });
  const db = seededMemoryDb();
  const { gate, asked } = issue604Gate(db);
  const auth = await memoryAuth(db, gate);
  for (const [acting, answer] of [
    [seatOf("member"), "not-allowed"],
    [person, "not-allowed"],
    [ADMIN_TESTERS[0], "not-allowed"],
    [seatOf("it-lead"), null],
  ] as const) {
    const google = await googleSignIn(auth, acting);
    const started = await post(auth, google, "/admin/impersonate-user", { userId: seatOf("alumni").id });
    assert.equal(asked.at(-1)?.answer, answer, `production ${acting.key}`);
    assert.equal(started.status, answer === null ? 200 : 403, `production ${acting.key}`);
  }
});

test("signing out ends the real session: its row is deleted and its cookies no longer sign anyone in", async () => {
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...vars });
    const db = seededMemoryDb();
    const auth = await memoryAuth(db);
    for (const account of [seatOf("member"), ADMIN_TESTERS[0]]) {
      const at = `${label(vars)} ${account.key}`;
      const { jar } = await signIn(auth, account);
      const before = await auth.api.getSession({ headers: jar.headers(), query: { disableCookieCache: true } });
      assert.equal(before?.user.id, account.id, `${at}: signed in`);
      assert.equal(sessionRowsOf(db, account.id).length, 1, `${at}: one stored session`);
      const stale = jar.headers();

      const out = await post(auth, jar, "/sign-out");
      assert.equal(out.status, 200, at);
      assert.deepEqual(sessionRowsOf(db, account.id), [], `${at}: the session row is gone`);
      assert.equal(await auth.api.getSession({ headers: jar.headers() }), null, `${at}: the browser is signed out`);
      assert.equal(await auth.api.getSession({ headers: stale, query: { disableCookieCache: true } }), null, `${at}: the old session cookie opens nothing`);
    }
  }
});
