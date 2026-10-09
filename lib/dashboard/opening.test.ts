import assert from "node:assert/strict";
import { test } from "node:test";
import type { DashboardData } from "./data";
import { dashboardOpening } from "./opening";

const DATA = {} as DashboardData;

// The proxy sends a session-token holder on /login back to /dashboard, so a
// token holder sent to /login would redirect-loop (PR #149, criterion 12).
test("a request holding a session token is never opened as signed out", () => {
  assert.deepEqual(dashboardOpening(null, true), { kind: "account-unresolved" });
  assert.deepEqual(dashboardOpening(DATA, true), { kind: "open", data: DATA });
});

test("a request with no session token and no account is signed out", () => {
  assert.deepEqual(dashboardOpening(null, false), { kind: "signed-out" });
});
