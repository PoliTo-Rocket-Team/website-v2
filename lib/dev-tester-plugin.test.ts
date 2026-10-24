import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { getCookieCache } from "better-auth/cookies";
import { viewAsRefusalOf, viewAsSiteOf, type ViewAsAccount, type ViewAsEntry } from "./dashboard/view-as";
import { SEAT_OF_FLAG } from "./dashboard/viewer";
import {
  BASE,
  GATE_ON,
  Jar,
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
// admin tester, an admin tester signed in this way passes the View as rule of
// issue #604, and signing out deletes the session. Where the gate is off, the
// plugin is not registered (lib/dev-tester.test.ts).

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

/**
 * The View as gate of issue #604 with its database reads swapped for this
 * in-memory one: the same rule (`viewAsRefusalOf`) on the same site reading
 * (`viewAsSiteOf`), each account's stored role read from its user row and its
 * full-access seat from the seat table. It keeps what it logged.
 */
function issue604Gate(db: MemoryDb): { gate: ViewAsGate; entries: ViewAsEntry[] } {
  const accountOf = (id: string): ViewAsAccount | null => {
    const row = db.user.find((u) => u.id === id);
    if (row === undefined) return null;
    const seeded = SEEDED_ACCOUNTS.find((a) => a.id === id);
    const activeRoles = seeded?.kind === "seat" ? seeded.roles.map((r) => ({ fullAccess: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess] })) : [];
    return { storedRole: typeof row.role === "string" ? row.role : null, activeRoles };
  };
  const entries: ViewAsEntry[] = [];
  return {
    entries,
    gate: {
      refusal: async (start) => viewAsRefusalOf({ ...start, acting: accountOf(start.actingAccountId), person: accountOf(start.personId) }, viewAsSiteOf()),
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

test("an admin tester signed in this way can start View as through the issue #604 gate; a plain seat cannot", async () => {
  const person = seatOf("member");
  for (const vars of GATE_ON) {
    setEnv({ ...TEST_ENV, ...vars });
    const db = seededMemoryDb();
    const { gate, entries } = issue604Gate(db);
    const auth = await memoryAuth(db, gate);

    for (const admin of ADMIN_TESTERS) {
      const at = `${label(vars)} ${admin.key}`;
      const { jar } = await signIn(auth, admin);
      const started = await post(auth, jar, "/admin/impersonate-user", { userId: person.id });
      assert.equal(started.status, 200, at);
      const session = await auth.api.getSession({ headers: jar.headers(), query: { disableCookieCache: true } });
      assert.equal(session?.user.id, person.id, `${at}: viewing as the member seat`);
      assert.equal(session?.impersonatedBy, admin.id, `${at}: the session names the admin tester`);
      const viewAsRows = db.session.filter((row) => row.impersonatedBy === admin.id);
      assert.equal(viewAsRows.length, 1, `${at}: one stored View as session`);
      assert.deepEqual(entries.at(-1), { event: "start", sessionId: viewAsRows[0].id, personId: person.id, actingAccountId: admin.id }, at);
      assert.equal((await post(auth, jar, "/admin/stop-impersonating")).status, 200, `${at}: Stop`);
    }

    const { jar } = await signIn(auth, seatOf("division-lead"));
    const refused = await post(auth, jar, "/admin/impersonate-user", { userId: person.id });
    assert.equal(refused.status, 403, `${label(vars)}: a plain seat is refused`);
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
