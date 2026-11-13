import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import type { SiteRows } from "./auth";
import { BASE, envRestorer, SEAT_DIRECTORY, seededMemoryDb, setEnv, TEST_ENV, type MemoryDb } from "./dev-tester-fixture";
import { seatOf } from "./seeded-accounts";
import type { ViewAsGate } from "./view-as-plugin";

// The site-row repair through the real Better Auth instance (issue #910),
// over an in-memory database: every new session asks for its login's site
// row before the session is stored, and a repair that fails leaves the
// sign-in as it was. The sessions are opened with the local tester sign-in.
// What the repair writes is run on the migrated database in
// lib/dashboard/site-row-server.test.ts.

const restoreEnv = envRestorer();
afterEach(restoreEnv);

const MEMBER = seatOf("member");
const OPEN_GATE: ViewAsGate = { refusal: async () => null, record: async () => {} };

async function signInWith(siteRows: SiteRows, db: MemoryDb = seededMemoryDb()) {
  setEnv({ ...TEST_ENV, NODE_ENV: "development", VERCEL_ENV: undefined });
  const { createAuth } = await import("./auth");
  const auth = createAuth(memoryAdapter(db), { viewAs: OPEN_GATE, testers: SEAT_DIRECTORY, siteRows });
  return auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=${MEMBER.key}`));
}

test("a new session asks for its login's site row before the session is stored", async () => {
  const db = seededMemoryDb();
  const asked: { loginId: string; sessionsStored: number }[] = [];
  const response = await signInWith({ ensure: async (loginId) => void asked.push({ loginId, sessionsStored: db.session.length }) }, db);
  assert.equal(response.status, 302);
  assert.deepEqual(asked, [{ loginId: MEMBER.id, sessionsStored: 0 }]);
  assert.equal(db.session.length, 1);
});

test("a repair that fails leaves the sign-in as it was", async () => {
  const failing: SiteRows = {
    ensure: async () => {
      throw new Error("database down");
    },
  };
  const logged = console.error;
  console.error = () => {};
  try {
    assert.equal((await signInWith(failing)).status, 302);
  } finally {
    console.error = logged;
  }
});
