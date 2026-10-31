import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { SignInLog } from "./auth";
import { BREAK_GLASS_SETTING, type BreakGlassSignIn } from "./break-glass";
import { BASE, envRestorer, Jar, NO_SITE_ROWS, ORIGIN, SEAT_DIRECTORY, seededMemoryDb, setEnv, TEST_ENV } from "./dev-tester-fixture";
import { seatOf } from "./seeded-accounts";
import type { ViewAsGate } from "./view-as-plugin";

// The break-glass sign-in log through the real Better Auth instance (issue
// #646), over an in-memory database: each new session of the account the
// break-glass setting names is logged once, and no other session is. The
// sessions are opened with the local tester sign-in; the setting names a
// seeded account, whose email sits on a domain reserved for examples.

const restoreEnv = envRestorer();
afterEach(restoreEnv);

const ADMIN = seatOf("non-member");
const MEMBER = seatOf("member");

/** A View as gate that lets every start through and logs nothing: only the sign-in log is under test here. */
const OPEN_GATE: ViewAsGate = { refusal: async () => null, record: async () => {} };

async function setUp(setting: string | undefined) {
  setEnv({ ...TEST_ENV, NODE_ENV: "development", VERCEL_ENV: undefined, [BREAK_GLASS_SETTING]: setting });
  const signIns: BreakGlassSignIn[] = [];
  const log: SignInLog = { record: async (signIn) => void signIns.push(signIn) };
  const { createAuth } = await import("./auth");
  return {
    auth: createAuth(memoryAdapter(seededMemoryDb()), { viewAs: OPEN_GATE, testers: SEAT_DIRECTORY, signIns: log, siteRows: NO_SITE_ROWS }),
    signIns,
  };
}

type Auth = Awaited<ReturnType<typeof setUp>>["auth"];

async function signIn(auth: Auth, tester: { readonly key: string }): Promise<Jar> {
  const jar = new Jar();
  const response = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=${tester.key}`));
  assert.equal(response.status, 302, `${tester.key} signs in`);
  jar.take(response);
  return jar;
}

test("each sign-in of the account the setting names writes one entry naming it; another account's writes none", async () => {
  const { auth, signIns } = await setUp(` ${ADMIN.email.toUpperCase()} `);
  await signIn(auth, MEMBER);
  assert.equal(signIns.length, 0, "another account");
  await signIn(auth, ADMIN);
  await signIn(auth, ADMIN);
  assert.equal(signIns.length, 2, "one per sign-in");
  assert.ok(signIns.every((s) => s.userId === ADMIN.id && typeof s.sessionId === "string"));
  assert.notEqual(signIns[0].sessionId, signIns[1].sessionId);
});

test("with the setting unset or empty, no sign-in writes an entry", async () => {
  for (const setting of [undefined, ""]) {
    const { auth, signIns } = await setUp(setting);
    await signIn(auth, ADMIN);
    assert.deepEqual(signIns, [], JSON.stringify(setting));
  }
});

test("a View as session for the named account is no sign-in of it", async () => {
  const { auth, signIns } = await setUp(ADMIN.email);
  const jar = await signIn(auth, MEMBER);
  const headers = jar.headers();
  headers.set("content-type", "application/json");
  headers.set("origin", ORIGIN);
  const started = await auth.handler(new Request(`${BASE}/admin/impersonate-user`, { method: "POST", headers, body: JSON.stringify({ userId: ADMIN.id }) }));
  assert.equal(started.status, 200);
  assert.deepEqual(signIns, []);
});
