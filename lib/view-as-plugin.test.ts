import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getCookieCache } from "better-auth/cookies";
import type { ViewAsEntry, ViewAsRefusal } from "./dashboard/view-as";
import { TESTERS } from "./dev-tester";
import { accountUserOf, impersonatorOf } from "./session-user";
import type { ViewAsGate } from "./view-as-plugin";

// View as through the real Better Auth instance (issue #604), over an
// in-memory database: the gate is asked before the admin plugin makes any
// session, a start and a stop each log one entry naming both people, and the
// session the person is then signed in with names the acting account. Who
// the gate lets in is proven against the database rules in
// dashboard/access-matrix-server.test.ts; here it is a stand-in, so only the
// wiring is under test. Sessions are opened with the local tester sign-in.

// Throwaway values for an in-memory auth instance; nothing here is a real
// secret or reads .env.
const TEST_ENV = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "view-as-plugin-test-secret-0123456789abcdef",
};
const BASE = "http://localhost:3000/api/auth";
const ORIGIN = "http://localhost:3000";

const savedEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
});

const ACTING = TESTERS["operations-lead"];
const PERSON = TESTERS.member;
/** A stored admin the stand-in gate refuses, as production refuses one. */
const STORED_ADMIN = TESTERS["department-head"];

/** The stand-in gate: only ACTING may start, never from inside a View as session; it keeps what it was asked and what it logged. */
function standInGate() {
  const asked: Parameters<ViewAsGate["refusal"]>[0][] = [];
  const entries: ViewAsEntry[] = [];
  const gate: ViewAsGate = {
    refusal: async (start) => {
      asked.push(start);
      const refusal: ViewAsRefusal | null = start.viewingAs ? "already-viewing-as" : start.actingAccountId === ACTING.id ? null : "not-allowed";
      return refusal;
    },
    record: async (entry) => {
      entries.push(entry);
    },
  };
  return { gate, asked, entries };
}

async function setUp() {
  Object.assign(process.env, TEST_ENV, { NODE_ENV: "development" });
  delete process.env.VERCEL_ENV;
  const now = new Date();
  const db: Record<string, Record<string, unknown>[]> = { user: [], session: [], account: [], verification: [] };
  for (const tester of Object.values(TESTERS)) {
    db.user.push({
      id: tester.id,
      name: tester.name,
      email: tester.email,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
      role: tester.id === STORED_ADMIN.id ? "admin" : null,
    });
  }
  const stand = standInGate();
  const { createAuth } = await import("./auth");
  return { auth: createAuth(memoryAdapter(db), stand.gate), db, ...stand };
}

type Auth = Awaited<ReturnType<typeof setUp>>["auth"];

/** A browser's cookies across calls: each Set-Cookie line replaces one, and an expired one is gone. */
class Jar {
  private readonly cookies = new Map<string, string>();
  take(response: Response): void {
    for (const line of response.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";").map((part) => part.trim());
      const at = pair.indexOf("=");
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      const expired = value === "" || attributes.some((a) => a.toLowerCase() === "max-age=0");
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
  headers(): Headers {
    return new Headers({ cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "), origin: ORIGIN });
  }
}

async function signIn(auth: Auth, tester: (typeof TESTERS)[keyof typeof TESTERS]): Promise<Jar> {
  const jar = new Jar();
  const response = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=${tester.key}`));
  assert.equal(response.status, 302, `${tester.key} signs in`);
  jar.take(response);
  return jar;
}

async function post(auth: Auth, jar: Jar, path: string, body: unknown = {}): Promise<Response> {
  const headers = jar.headers();
  headers.set("content-type", "application/json");
  const response = await auth.handler(new Request(BASE + path, { method: "POST", headers, body: JSON.stringify(body) }));
  jar.take(response);
  return response;
}

/** Who the session the jar holds is for, as getCurrentUser reads it from the signed cookie cache. */
async function cachedUser(jar: Jar) {
  const cache = await getCookieCache(jar.headers(), { secret: TEST_ENV.BETTER_AUTH_SECRET });
  assert.ok(cache, "a session cookie cache");
  return accountUserOf({ userId: cache.session.userId, name: cache.user.name, impersonatedBy: impersonatorOf(cache.session) });
}

test("the admin plugin and the View as plugin are registered", async () => {
  const { auth } = await setUp();
  const ids = auth.options.plugins.map((plugin) => plugin.id);
  assert.ok(ids.includes("admin") && ids.includes("view-as"), ids.join(", "));
});

test("a start the gate allows makes one View as session for the person, logs it once, and the session names the acting account", async () => {
  const { auth, asked, entries } = await setUp();
  const jar = await signIn(auth, ACTING);

  const started = await post(auth, jar, "/admin/impersonate-user", { userId: PERSON.id });
  assert.equal(started.status, 200);
  assert.deepEqual(asked, [{ actingAccountId: ACTING.id, viewingAs: false, personId: PERSON.id }], "the gate is asked, with the acting account read from its session");

  const viewing = await cachedUser(jar);
  assert.deepEqual(viewing, { session: "account", id: PERSON.id, name: PERSON.name, actingAccountId: ACTING.id });
  const session = await auth.api.getSession({ headers: jar.headers() });
  assert.equal(session?.user.id, PERSON.id);
  assert.equal(session?.impersonatedBy, ACTING.id, "the server's own session read names the acting account");

  assert.equal(entries.length, 1, "one entry for the start");
  assert.deepEqual({ ...entries[0], sessionId: typeof entries[0].sessionId }, { event: "start", sessionId: "string", personId: PERSON.id, actingAccountId: ACTING.id });
});

test("a plain session names no acting account", async () => {
  const { auth } = await setUp();
  const jar = await signIn(auth, ACTING);
  assert.deepEqual(await cachedUser(jar), { session: "account", id: ACTING.id, name: ACTING.name, actingAccountId: null });
  assert.equal((await auth.api.getSession({ headers: jar.headers() }))?.impersonatedBy, null);
});

test("a start the gate refuses makes no session and logs nothing, though the plugin's own role table would let it through", async () => {
  const { auth, db, entries } = await setUp();
  for (const tester of [PERSON, STORED_ADMIN]) {
    const jar = await signIn(auth, tester);
    const sessions = db.session.length;
    const refused = await post(auth, jar, "/admin/impersonate-user", { userId: TESTERS.applicant.id });
    assert.equal(refused.status, 403, tester.key);
    assert.equal(db.session.length, sessions, `${tester.key}: no session is made`);
    assert.deepEqual(await cachedUser(jar), { session: "account", id: tester.id, name: tester.name, actingAccountId: null }, `${tester.key} is still themselves`);
  }
  const signedOut = await auth.handler(
    new Request(`${BASE}/admin/impersonate-user`, { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ userId: PERSON.id }) }),
  );
  assert.equal(signedOut.status, 401);
  assert.deepEqual(entries, []);
});

test("from inside a View as session, the gate is told so and refuses a second start", async () => {
  const { auth, asked, entries } = await setUp();
  const jar = await signIn(auth, ACTING);
  assert.equal((await post(auth, jar, "/admin/impersonate-user", { userId: PERSON.id })).status, 200);
  assert.equal((await post(auth, jar, "/admin/impersonate-user", { userId: TESTERS.applicant.id })).status, 403);
  assert.deepEqual(asked.at(-1), { actingAccountId: PERSON.id, viewingAs: true, personId: TESTERS.applicant.id });
  assert.equal(entries.length, 1, "only the first start is logged");
});

test("every other admin endpoint is refused, even to a stored admin", async () => {
  const { auth } = await setUp();
  const jar = await signIn(auth, STORED_ADMIN);
  const list = await auth.handler(new Request(`${BASE}/admin/list-users`, { headers: jar.headers() }));
  assert.equal(list.status, 403, "list users");
  for (const [path, body] of [
    ["/admin/set-role", { userId: PERSON.id, role: "admin" }],
    ["/admin/ban-user", { userId: PERSON.id }],
    ["/admin/remove-user", { userId: PERSON.id }],
  ] as const) {
    assert.equal((await post(auth, jar, path, body)).status, 403, path);
  }
});

test("Stop ends the View as session, logs it once naming both people, and signs the acting account back in as themselves", async () => {
  const { auth, entries } = await setUp();
  const jar = await signIn(auth, ACTING);
  assert.equal((await post(auth, jar, "/admin/impersonate-user", { userId: PERSON.id })).status, 200);
  const sessionId = entries[0].sessionId;

  const stopped = await post(auth, jar, "/admin/stop-impersonating");
  assert.equal(stopped.status, 200);
  assert.deepEqual(entries, [
    { event: "start", sessionId, personId: PERSON.id, actingAccountId: ACTING.id },
    { event: "stop", sessionId, personId: PERSON.id, actingAccountId: ACTING.id },
  ]);
  assert.deepEqual(await cachedUser(jar), { session: "account", id: ACTING.id, name: ACTING.name, actingAccountId: null });

  // A stop with no View as session to end is refused and logs nothing.
  assert.equal((await post(auth, jar, "/admin/stop-impersonating")).status, 400);
  assert.equal(entries.length, 2);
});

test("signing out of a View as session logs its stop once; a plain sign-out logs nothing", async () => {
  const { auth, entries } = await setUp();
  const plain = await signIn(auth, ACTING);
  assert.equal((await post(auth, plain, "/sign-out")).status, 200);
  assert.equal(entries.length, 0, "a plain sign-out logs nothing");

  const jar = await signIn(auth, ACTING);
  assert.equal((await post(auth, jar, "/admin/impersonate-user", { userId: PERSON.id })).status, 200);
  assert.equal((await post(auth, jar, "/sign-out")).status, 200);
  assert.deepEqual(
    entries.map((e) => [e.event, e.personId, e.actingAccountId]),
    [
      ["start", PERSON.id, ACTING.id],
      ["stop", PERSON.id, ACTING.id],
    ],
  );
});
