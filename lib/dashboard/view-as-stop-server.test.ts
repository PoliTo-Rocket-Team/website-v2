import "./access-matrix/install-real-session";

import assert from "node:assert/strict";
import { before, test } from "node:test";
import { BASE, Jar, TEST_ENV } from "@/lib/dev-tester-fixture";
import { seatOf } from "@/lib/seeded-accounts";
import { VIEW_AS_SESSION_SECONDS } from "@/lib/view-as-plugin";
import { sendRequestWith } from "./access-matrix/fakes/request-headers";
import { seeded } from "./access-matrix/whole-seed";

// Why Stop could not end View as on production (issue #899). A View as
// session lasts an hour, but the cookie cache it sets lasts as long as the
// browser. The dashboard read that cache cookie directly, without its expiry,
// so once the View as session ran out every page still opened as the person
// and drew the banner, while Stop found no session to end. Here the app's own
// lib/current-user.ts reads the cookies a real View as start set
// (./access-matrix/install-real-session.ts), on the whole seed.

let app: {
  readonly getAuth: typeof import("@/lib/auth").getAuth;
  readonly getCurrentUser: typeof import("@/lib/current-user").getCurrentUser;
};

before(async () => {
  // A test site: `next dev` off Vercel, where tester sign-in is on and any account may use View as (issue #648).
  Object.assign(process.env, TEST_ENV, { NODE_ENV: "development" });
  delete process.env.VERCEL_ENV;
  const [auth, currentUser] = await Promise.all([import("@/lib/auth"), import("@/lib/current-user")]);
  app = { getAuth: auth.getAuth, getCurrentUser: currentUser.getCurrentUser };
});

async function post(jar: Jar, path: string, body: unknown = {}): Promise<Response> {
  const headers = jar.headers();
  headers.set("content-type", "application/json");
  const response = await app.getAuth().handler(new Request(BASE + path, { method: "POST", headers, body: JSON.stringify(body) }));
  jar.take(response);
  return response;
}

async function currentUserOf(jar: Jar) {
  sendRequestWith(jar.headers());
  return app.getCurrentUser();
}

const ACTING = seatOf("team-leader");
const PERSON = seatOf("member");

test("a View as session that ran out no longer opens as the person, and Stop returns the acting account to its own session", async (t) => {
  await seeded();
  // The session starts an hour and a minute ago, so by now both the View as
  // session and its 10-minute cookie cache have run out. The clock is moved
  // back rather than forward, so nothing timed against it waits past the test.
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() - (VIEW_AS_SESSION_SECONDS + 60) * 1000 });
  const jar = new Jar();
  const signedIn = await app.getAuth().handler(new Request(`${BASE}/dev-tester/sign-in?tester=${ACTING.key}`));
  assert.equal(signedIn.status, 302);
  jar.take(signedIn);
  const started = await post(jar, "/admin/impersonate-user", { userId: PERSON.id });
  assert.equal(started.status, 200, await started.clone().text());
  assert.deepEqual(await currentUserOf(jar), { id: PERSON.id, name: PERSON.name, actingAccountId: ACTING.id });
  t.mock.timers.reset();

  assert.equal(await currentUserOf(jar), null, "a View as session that ran out opens as nobody");
  assert.equal((await post(jar, "/view-as/stop")).status, 200);
  assert.deepEqual(await currentUserOf(jar), { id: ACTING.id, name: ACTING.name, actingAccountId: null });
});
