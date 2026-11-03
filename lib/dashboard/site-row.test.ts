import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sameEmail, siteRowStepOf, type SiteRowCandidate } from "./site-row";

// The site row a new session gives its login (issue #910).

const LOGIN = { id: "login-1", email: "Sara.Conti@Example.com" };

const row = (id: string, email: string, fields: Partial<SiteRowCandidate> = {}): SiteRowCandidate => ({
  id,
  email,
  heldByLogin: false,
  closed: false,
  ...fields,
});

describe("siteRowStepOf", () => {
  test("a login with its own row changes nothing, whatever else carries its email", () => {
    assert.deepEqual(siteRowStepOf(LOGIN, [row("login-1", "old@example.com", { heldByLogin: true }), row("added:1", "sara.conti@example.com")]), { kind: "present" });
  });

  test("with no row of its own, it takes over the one free row with its email, whatever the case", () => {
    assert.deepEqual(siteRowStepOf(LOGIN, [row("added:1", " sara.conti@example.com ")]), { kind: "attach", rowId: "added:1" });
  });

  test("a row another login holds is never taken: the login gets a fresh row", () => {
    assert.deepEqual(siteRowStepOf(LOGIN, [row("login-2", "sara.conti@example.com", { heldByLogin: true })]), { kind: "create" });
  });

  test("beside a held row, the free one is taken", () => {
    const rows = [row("login-2", "sara.conti@example.com", { heldByLogin: true }), row("added:1", "sara.conti@example.com")];
    assert.deepEqual(siteRowStepOf(LOGIN, rows), { kind: "attach", rowId: "added:1" });
  });

  test("a closed account is not re-opened: the login gets a fresh row", () => {
    assert.deepEqual(siteRowStepOf(LOGIN, [row("added:1", "sara.conti@example.com", { closed: true })]), { kind: "create" });
  });

  test("with no row on its email, or several free ones to guess between, the login gets a fresh row", () => {
    assert.deepEqual(siteRowStepOf(LOGIN, []), { kind: "create" });
    assert.deepEqual(siteRowStepOf(LOGIN, [row("added:1", "sara.conti@example.com"), row("added:2", "SARA.CONTI@example.com")]), { kind: "create" });
  });

  test("a row on another email is never taken", () => {
    assert.deepEqual(siteRowStepOf(LOGIN, [row("added:1", "sara.conti@example.org")]), { kind: "create" });
  });
});

test("sameEmail ignores case and surrounding spaces only", () => {
  assert.ok(sameEmail("A@B.it", " a@b.it "));
  assert.ok(!sameEmail("a@b.it", "a@b.it.example"));
  assert.ok(!sameEmail("a.b@c.it", "ab@c.it"));
});
