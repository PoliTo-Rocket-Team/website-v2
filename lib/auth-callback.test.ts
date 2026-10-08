import assert from "node:assert/strict";
import { test } from "node:test";
import { callbackPath, DEFAULT_CALLBACK } from "./auth-callback";

test("keeps a path on this site, with its query and hash", () => {
  assert.equal(callbackPath("/dashboard"), "/dashboard");
  assert.equal(callbackPath("/apply/avionics?step=2#cv"), "/apply/avionics?step=2#cv");
});

test("falls back when cb is missing or not a path", () => {
  for (const raw of [null, undefined, "", "dashboard", "https://evil.com", "javascript:alert(1)"]) {
    assert.equal(callbackPath(raw), DEFAULT_CALLBACK, String(raw));
  }
});

test("falls back on every form that resolves off-site", () => {
  for (const raw of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\\\t\\evil.com"]) {
    assert.equal(callbackPath(raw), DEFAULT_CALLBACK, JSON.stringify(raw));
  }
});

test("falls back on a sign-in page, which would loop", () => {
  for (const raw of ["/login", "/login?cb=/x", "/sign-in/", "/sign-up"]) {
    assert.equal(callbackPath(raw), DEFAULT_CALLBACK, raw);
  }
});
