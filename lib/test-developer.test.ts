import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TestDeveloperSignIn } from "@/components/test-developer-sign-in";
import {
  TEST_DEVELOPER_APPLICATIONS_COOKIE,
  TEST_DEVELOPER_GRANT_COOKIE,
  TEST_DEVELOPER_COOKIE,
  TEST_DEVELOPER_EDITS_COOKIE,
  TEST_DEVELOPER_STATE_COOKIE,
  testDeveloperOn,
  testDeveloperSignIn,
  testDeveloperSignInHref,
  testDeveloperSignOut,
  testDeveloperViewer,
  auditWriterOf,
  testDeveloperMayWrite,
  testDeveloperStandIn,
  TestDeveloperWriteRefused,
} from "./test-developer";
import { TEST_VIEWERS } from "./dashboard/viewer";
import { PREVIEW_ENDPOINT } from "./seed/target";
import { TEST_VIEWER_PEOPLE } from "./test-viewer-people";

const PRODUCTION = { NODE_ENV: "production", VERCEL_ENV: "production" };
const PREVIEW = { NODE_ENV: "production", VERCEL_ENV: "preview" };
const LOCAL_DEV = { NODE_ENV: "development" };

test("the gate is on for previews and next dev, and off everywhere else", () => {
  assert.equal(testDeveloperOn(PREVIEW), true);
  assert.equal(testDeveloperOn(LOCAL_DEV), true);
  for (const NODE_ENV of ["development", "production", "test", undefined]) {
    assert.equal(testDeveloperOn({ NODE_ENV, VERCEL_ENV: "production" }), false, `${NODE_ENV}/production`);
    assert.equal(testDeveloperOn({ NODE_ENV, VERCEL_ENV: "development" }), false, `${NODE_ENV}/development`);
  }
  for (const NODE_ENV of ["production", "test", undefined]) {
    assert.equal(testDeveloperOn({ NODE_ENV }), false, `${NODE_ENV}, no VERCEL_ENV`);
  }
});

function withEnv(env: { NODE_ENV?: string; VERCEL_ENV?: string }, run: () => void): void {
  const saved = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
  const set = (key: "NODE_ENV" | "VERCEL_ENV", value: string | undefined) => {
    if (value === undefined) delete (process.env as Record<string, string | undefined>)[key];
    else (process.env as Record<string, string | undefined>)[key] = value;
  };
  set("NODE_ENV", env.NODE_ENV);
  set("VERCEL_ENV", env.VERCEL_ENV);
  try {
    run();
  } finally {
    set("NODE_ENV", saved.NODE_ENV);
    set("VERCEL_ENV", saved.VERCEL_ENV);
  }
}

test("production's /login renders no test developer entry; a preview's does", () => {
  withEnv(PRODUCTION, () => {
    assert.equal(renderToStaticMarkup(createElement(TestDeveloperSignIn, { cb: "/dashboard" })), "");
  });
  withEnv(PREVIEW, () => {
    const html = renderToStaticMarkup(createElement(TestDeveloperSignIn, { cb: "/dashboard" }));
    assert.match(html, /Sign in as test developer/);
    assert.match(html, /\/api\/test-developer\/sign-in\?viewer=operations-lead&amp;cb=%2Fdashboard/);
  });
});

test("production answers 404 to sign-in and sign-out and sets no cookie", () => {
  const url = new URL("https://example.org/api/test-developer/sign-in?viewer=operations-lead");
  for (const response of [testDeveloperSignIn(url, PRODUCTION), testDeveloperSignOut(url, PRODUCTION)]) {
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

test("production ignores a test developer cookie", () => {
  assert.equal(testDeveloperViewer("operations-lead", PRODUCTION), null);
  assert.equal(testDeveloperViewer("member", { NODE_ENV: "production" }), null);
});

test("on a preview, sign-in sets the viewer cookie and returns to a site path only", () => {
  const response = testDeveloperSignIn(
    new URL("https://preview.example.org/api/test-developer/sign-in?viewer=member&cb=/dashboard/profile"),
    PREVIEW,
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://preview.example.org/dashboard/profile");
  const cookie = response.headers.get("set-cookie") ?? "";
  assert.match(cookie, new RegExp(`^${TEST_DEVELOPER_COOKIE}=member;`));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.equal(testDeveloperViewer("member", PREVIEW), "member");

  const offSite = testDeveloperSignIn(
    new URL("https://preview.example.org/api/test-developer/sign-in?viewer=member&cb=//evil.example"),
    PREVIEW,
  );
  assert.equal(offSite.headers.get("location"), "https://preview.example.org/dashboard");
});

test("sign-in with applications=none starts the viewer with none; a plain sign-in brings the sample set back", () => {
  const none = testDeveloperSignIn(
    new URL("https://preview.example.org/api/test-developer/sign-in?viewer=non-member&applications=none&cb=/dashboard"),
    PREVIEW,
  );
  assert.equal(none.headers.get("location"), "https://preview.example.org/dashboard");
  const [viewer, applications] = none.headers.getSetCookie();
  assert.match(viewer ?? "", new RegExp(`^${TEST_DEVELOPER_COOKIE}=non-member;`));
  assert.match(applications ?? "", new RegExp(`^${TEST_DEVELOPER_APPLICATIONS_COOKIE}=none;.*Max-Age=${7 * 24 * 60 * 60}`));
  assert.equal(
    testDeveloperSignInHref("non-member", "/dashboard", "none"),
    "/api/test-developer/sign-in?viewer=non-member&applications=none&cb=%2Fdashboard",
  );

  // View as links carry no `applications`, so switching viewer clears it.
  const plain = testDeveloperSignIn(new URL(`https://preview.example.org${testDeveloperSignInHref("non-member")}`), PREVIEW);
  assert.match(plain.headers.getSetCookie()[1] ?? "", new RegExp(`^${TEST_DEVELOPER_APPLICATIONS_COOKIE}=;.*Max-Age=0`));
});

test("sign-in with a grant gives it to the member only; View as drops it (issue #351)", () => {
  const grantCookie = (query: string) =>
    testDeveloperSignIn(new URL(`https://preview.example.org/api/test-developer/sign-in?${query}`), PREVIEW)
      .headers.getSetCookie()
      .find((c) => c.startsWith(`${TEST_DEVELOPER_GRANT_COOKIE}=`)) ?? "";
  assert.match(grantCookie("viewer=member&grant=members-view"), new RegExp(`^${TEST_DEVELOPER_GRANT_COOKIE}=members-view;`));
  assert.match(grantCookie("viewer=division-lead&grant=members-view"), /=;.*Max-Age=0/);
  assert.match(grantCookie("viewer=member&grant=everything"), /=;.*Max-Age=0/);
  assert.match(grantCookie(new URL(`https://x.org${testDeveloperSignInHref("member")}`).search.slice(1)), /=;.*Max-Age=0/);
});

test("sign-in with applications=withdrawn starts the viewer with only withdrawn applications (issue #227)", () => {
  const href = testDeveloperSignInHref("non-member", "/dashboard", "withdrawn");
  assert.equal(href, "/api/test-developer/sign-in?viewer=non-member&applications=withdrawn&cb=%2Fdashboard");
  const response = testDeveloperSignIn(new URL(`https://preview.example.org${href}`), PREVIEW);
  assert.match(response.headers.getSetCookie()[1] ?? "", new RegExp(`^${TEST_DEVELOPER_APPLICATIONS_COOKIE}=withdrawn;`));
});

test("a value that is not one of the four viewers signs nobody in", () => {
  const response = testDeveloperSignIn(
    new URL("http://localhost:3000/api/test-developer/sign-in?viewer=admin"),
    LOCAL_DEV,
  );
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(testDeveloperViewer("admin", LOCAL_DEV), null);
});

test("sign-out clears the cookie and the dummy team's changes, and goes to /login", () => {
  const response = testDeveloperSignOut(new URL("http://localhost:3000/api/test-developer/sign-out"), LOCAL_DEV);
  assert.equal(response.headers.get("location"), "http://localhost:3000/login");
  const cleared = response.headers.getSetCookie();
  assert.match(cleared[0] ?? "", new RegExp(`^${TEST_DEVELOPER_COOKIE}=;.*Max-Age=0`));
  assert.match(cleared[1] ?? "", new RegExp(`^${TEST_DEVELOPER_STATE_COOKIE}=;.*Max-Age=0`));
  assert.match(cleared[2] ?? "", new RegExp(`^${TEST_DEVELOPER_EDITS_COOKIE}=;.*Max-Age=0`));
  assert.match(cleared[4] ?? "", new RegExp(`^${TEST_DEVELOPER_APPLICATIONS_COOKIE}=;.*Max-Age=0`));
});

// The shared `preview` branch, by its pooled and its direct host. The hosts
// are only parsed: no test here connects to any database.
const DB = `postgresql://app@${PREVIEW_ENDPOINT}-pooler.c-2.eu-central-1.aws.neon.tech/neondb`;
const DB_DIRECT = `postgresql://app@${PREVIEW_ENDPOINT}.c-2.eu-central-1.aws.neon.tech/neondb`;
const OTHER_DB = "postgresql://app@ep-cool-darkness-123456-pooler.eu-central-1.aws.neon.tech/neondb";

test("on a preview with its seeded database, each viewer is read as its seeded person", () => {
  for (const viewer of TEST_VIEWERS) {
    assert.deepEqual(
      testDeveloperStandIn(viewer, { ...PREVIEW, DATABASE_URL: DB }),
      { viewer, userId: TEST_VIEWER_PEOPLE[viewer] },
      viewer,
    );
  }
  assert.equal(testDeveloperStandIn("not-a-viewer", { ...PREVIEW, DATABASE_URL: DB }), null);
  assert.equal(testDeveloperStandIn(undefined, { ...PREVIEW, DATABASE_URL: DB }), null);
});

test("a test developer is read as no one where pages read the dummy arrays or the gate is off", () => {
  assert.equal(testDeveloperStandIn("member", PREVIEW), null, "preview with no database: the dummy dashboard serves it");
  assert.equal(testDeveloperStandIn("member", LOCAL_DEV), null, "next dev with no database");
  assert.equal(testDeveloperStandIn("member", { ...PRODUCTION, DATABASE_URL: DB }), null, "production");
  assert.equal(testDeveloperStandIn("member", { NODE_ENV: "production", DATABASE_URL: DB }), null, "local production build");
});

test("an audited write by an account is logged under it, in every environment", () => {
  for (const env of [PREVIEW, PRODUCTION, LOCAL_DEV]) {
    assert.equal(auditWriterOf({ session: "account", id: "u1" }, env), "u1");
    assert.equal(auditWriterOf(null, env), null);
  }
});

test("on a preview reading the preview branch, a test developer's write is logged under the seeded person the viewer switch resolves to (ADR 0016)", () => {
  assert.equal(testDeveloperMayWrite({ ...PREVIEW, DATABASE_URL: DB }), true, "pooled host");
  assert.equal(testDeveloperMayWrite({ ...PREVIEW, DATABASE_URL: DB_DIRECT }), true, "direct host");
  for (const viewer of TEST_VIEWERS) {
    const env = { ...PREVIEW, DATABASE_URL: DB };
    const standIn = testDeveloperStandIn(viewer, env);
    assert.ok(standIn, viewer);
    assert.equal(auditWriterOf({ session: "test-developer", id: standIn.userId }, env), TEST_VIEWER_PEOPLE[viewer], viewer);
  }
});

test("on a preview pointed at any database other than the preview branch, a test developer's write is refused before it is sent (#364)", () => {
  const user = { session: "test-developer", id: TEST_VIEWER_PEOPLE.member } as const;
  for (const [name, DATABASE_URL] of [
    ["another Neon endpoint", OTHER_DB],
    ["a local database", "postgresql://app@localhost:5432/prt"],
    ["a host that is not Neon", "postgresql://app@db.example.com/prt"],
    ["no DATABASE_URL", undefined],
  ] as const) {
    const env = { ...PREVIEW, DATABASE_URL };
    assert.equal(testDeveloperMayWrite(env), false, name);
    assert.throws(() => auditWriterOf(user, env), TestDeveloperWriteRefused, name);
  }
});

test("in production, under next dev and on any other Vercel environment, a test developer's write is refused before it is sent, even on the preview branch", () => {
  const user = { session: "test-developer", id: TEST_VIEWER_PEOPLE.member } as const;
  for (const [name, env] of [
    ["production", PRODUCTION],
    ["production on the preview branch", { ...PRODUCTION, DATABASE_URL: DB }],
    ["next dev", LOCAL_DEV],
    ["next dev on the preview branch", { ...LOCAL_DEV, DATABASE_URL: DB }],
    ["local production build", { NODE_ENV: "production" }],
    ["development Vercel environment", { NODE_ENV: "production", VERCEL_ENV: "development", DATABASE_URL: DB }],
  ] as const) {
    assert.equal(testDeveloperMayWrite(env), false, name);
    assert.throws(() => auditWriterOf(user, env), TestDeveloperWriteRefused, name);
  }
});
