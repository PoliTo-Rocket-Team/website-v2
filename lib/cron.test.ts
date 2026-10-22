import assert from "node:assert/strict";
import { test } from "node:test";
import { cronAuthorized, cronRefused } from "./cron";

test("a cron route lets in only the request carrying the secret", () => {
  assert.equal(cronAuthorized("Bearer s3cret", "s3cret"), true);
  assert.equal(cronAuthorized(null, "s3cret"), false);
  assert.equal(cronAuthorized("Bearer wrong", "s3cret"), false);
  assert.equal(cronAuthorized("s3cret", "s3cret"), false);
});

test("with no secret set, nothing is let in", () => {
  assert.equal(cronAuthorized("Bearer ", ""), false);
  assert.equal(cronAuthorized("Bearer undefined", undefined), false);
});

test("a refused request gets a 401", () => {
  assert.equal(cronRefused().status, 401);
});
