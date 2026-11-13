import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect } from "node:util";
import postgres from "postgres";
import { failureLogOf, REDACTED_CONNECTION } from "./failure-log";

// The build step's failure log never prints a connection string (issue #874).

const UNPARSEABLE = "postgresql://owner:hunter2-secret@[bad-host/neondb";
const PLAIN_SECRET = "not a url hunter2-secret";

/** The error `postgres()` itself throws on a string it cannot parse; it connects to nothing. */
function postgresParseError(connectionString: string): unknown {
  try {
    postgres(connectionString, { max: 1 });
  } catch (error) {
    return error;
  }
  throw new Error("postgres() accepted the string, so this test needs a different one");
}

test("postgres() puts an unparseable connection string in its error, so the raw error would leak it", () => {
  const error = postgresParseError(UNPARSEABLE);
  assert.ok(inspect(error).includes("hunter2-secret"));
});

test("the failure log of postgres()'s parse error names the failure and never the connection string", () => {
  const log = failureLogOf(postgresParseError(UNPARSEABLE), [UNPARSEABLE, UNPARSEABLE]);
  assert.ok(!log.includes("hunter2-secret"), log);
  assert.ok(!log.includes("[bad-host"), log);
  assert.match(log, /TypeError/);
});

test("a connection string the step was given is redacted even when it is not shaped like a URL", () => {
  const error = new Error(`could not use ${PLAIN_SECRET} here`);
  const log = failureLogOf(error, [PLAIN_SECRET, undefined, ""]);
  assert.ok(!log.includes("hunter2-secret"), log);
  assert.ok(log.includes(`could not use ${REDACTED_CONNECTION} here`), log);
});

test("any Postgres URL is redacted, in the message, the cause chain and a thrown non-error", () => {
  const cause = new Error("dial postgres://u:p4ss@ep-x.neon.tech/db failed");
  const log = failureLogOf(new Error("migration failed", { cause }), []);
  assert.ok(!log.includes("p4ss"), log);
  assert.match(log, /Caused by: Error: dial \[connection string redacted\] failed/);
  assert.ok(!failureLogOf("postgres://u:p4ss@h/db", []).includes("p4ss"));
});

test("fields other than the name, message, stack, code and cause never reach the log", () => {
  const error = Object.assign(new Error("relation does not exist"), { code: "42P01", input: "opaque-secret-value", detail: "opaque-detail" });
  const log = failureLogOf(error, []);
  assert.ok(log.includes("relation does not exist"));
  assert.ok(log.includes("code: 42P01"));
  assert.ok(!log.includes("opaque-secret-value"));
  assert.ok(!log.includes("opaque-detail"));
});
