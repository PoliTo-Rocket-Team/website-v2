import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TestDeveloperSignIn } from "@/components/test-developer-sign-in";
import {
  TEST_DEVELOPER_APPLICATIONS_COOKIE,
  TEST_DEVELOPER_COOKIE,
  TEST_DEVELOPER_EDITS_COOKIE,
  TEST_DEVELOPER_STATE_COOKIE,
  testDeveloperOn,
  testDeveloperSignIn,
  testDeveloperSignInHref,
  testDeveloperSignOut,
  testDeveloperViewer,
} from "./test-developer";

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
