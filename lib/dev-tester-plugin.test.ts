import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { memoryAdapter } from "better-auth/adapters/memory";
import { getCookieCache } from "better-auth/cookies";
import { TESTERS } from "./dev-tester";

// Throwaway values for an in-memory auth instance; nothing here is a real
// secret or reads .env.
const TEST_ENV = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "dev-tester-plugin-test-secret-0123456789abcdef",
};

const savedEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
});

function setEnv(vars: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function authWithTesters() {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
  };
  const now = new Date();
  for (const tester of Object.values(TESTERS)) {
    db.user.push({
      id: tester.id,
      name: tester.name,
      email: tester.email,
      emailVerified: true,
      image: null,
      createdAt: now,
      updatedAt: now,
    });
  }
  const { createAuth } = await import("./auth");
  return createAuth(memoryAdapter(db));
}

const BASE = "http://localhost:3000/api/auth";

test("with the gate off, getAuth keeps Google alone and the tester routes are 404", async () => {
  for (const vars of [
    { NODE_ENV: "production", VERCEL_ENV: undefined },
    { NODE_ENV: "production", VERCEL_ENV: "preview" },
    { NODE_ENV: "development", VERCEL_ENV: "preview" },
    { NODE_ENV: "test", VERCEL_ENV: undefined },
  ]) {
    setEnv({ ...TEST_ENV, ...vars });
    const auth = await authWithTesters();
    const label = JSON.stringify(vars);

    assert.deepEqual(Object.keys(auth.options.socialProviders ?? {}), ["google"], label);
    assert.equal("emailAndPassword" in auth.options, false, label);
    assert.deepEqual(auth.options.plugins.map((plugin) => plugin.id), ["custom-session"], label);

    for (const path of ["/dev-tester", "/dev-tester/sign-in?tester=applicant"]) {
      const response = await auth.handler(new Request(BASE + path));
      assert.equal(response.status, 404, `${label} ${path}`);
      assert.equal(response.headers.getSetCookie().length, 0, `${label} ${path}`);
    }
  }
});

test("on next dev, signing in as a tester sets a cookie cache getCurrentUserId reads", async () => {
  setEnv({ ...TEST_ENV, NODE_ENV: "development", VERCEL_ENV: undefined });
  const auth = await authWithTesters();
  assert.deepEqual(
    auth.options.plugins.map((plugin) => plugin.id),
    ["custom-session", "dev-tester"],
  );
  assert.deepEqual(Object.keys(auth.options.socialProviders ?? {}), ["google"]);

  for (const tester of Object.values(TESTERS)) {
    const response = await auth.handler(
      new Request(`${BASE}/dev-tester/sign-in?tester=${tester.key}&cb=/apply/15-mission-analyst`),
    );
    assert.equal(response.status, 302, tester.key);
    assert.equal(response.headers.get("location"), "/apply/15-mission-analyst");

    const cookie = response.headers
      .getSetCookie()
      .map((line) => line.split(";")[0])
      .join("; ");
    const cache = await getCookieCache(new Headers({ cookie }), {
      secret: TEST_ENV.BETTER_AUTH_SECRET,
    });
    assert.equal(cache?.session.userId, tester.id, tester.key);
  }
});

test("on next dev, the tester list links every tester and an unknown key is refused", async () => {
  setEnv({ ...TEST_ENV, NODE_ENV: "development", VERCEL_ENV: undefined });
  const auth = await authWithTesters();

  const list = await auth.handler(new Request(`${BASE}/dev-tester`));
  assert.equal(list.status, 200);
  const html = await list.text();
  for (const tester of Object.values(TESTERS)) {
    assert.ok(html.includes(`/api/auth/dev-tester/sign-in?tester=${tester.key}`), tester.key);
  }

  const unknown = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=admin`));
  assert.equal(unknown.status, 400);
  assert.equal(unknown.headers.getSetCookie().length, 0);
});

test("on next dev, a tester missing from the database gets no session", async () => {
  setEnv({ ...TEST_ENV, NODE_ENV: "development", VERCEL_ENV: undefined });
  const { createAuth } = await import("./auth");
  const auth = createAuth(memoryAdapter({ user: [], session: [], account: [], verification: [] }));

  const response = await auth.handler(new Request(`${BASE}/dev-tester/sign-in?tester=member`));
  assert.equal(response.status, 404);
  assert.equal(response.headers.getSetCookie().length, 0);
});
