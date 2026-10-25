import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_TESTER_TITLE, BREAK_GLASS_TITLE, actingTitleOf, attributedName } from "./acting-account";

// How a write made in a View as session reads (issue #605, Owner decisions
// on #597): the acting seat's title, then the person's full name.

test("a write with an acting account reads as the seat title, then the person's full name", () => {
  assert.equal(attributedName("Sara Conti", "IT lead"), "IT lead as Sara Conti");
});

test("a write with no acting account reads as the name alone, as before", () => {
  assert.equal(attributedName("Sara Conti", null), "Sara Conti");
});

test("an acting account that holds or held the IT lead seat is the IT lead, whatever else it holds, on either site", () => {
  for (const site of ["live", "test"] as const) {
    assert.equal(actingTitleOf(["it-lead"], site), "IT lead", site);
    assert.equal(actingTitleOf([null, "operations-lead", "it-lead"], site), "IT lead", site);
  }
});

test("on a test site an acting account that never held the IT lead seat is an admin tester", () => {
  assert.equal(actingTitleOf([], "test"), ADMIN_TESTER_TITLE);
  assert.equal(actingTitleOf([null, "operations-lead"], "test"), ADMIN_TESTER_TITLE);
});

test("on the live site an acting account that never held the IT lead seat is the break-glass admin, titled without naming the account (issue #646)", () => {
  assert.equal(actingTitleOf([], "live"), BREAK_GLASS_TITLE);
  assert.equal(actingTitleOf([null, "operations-lead"], "live"), BREAK_GLASS_TITLE);
  assert.notEqual(BREAK_GLASS_TITLE, ADMIN_TESTER_TITLE);
  assert.equal(attributedName("Sara Conti", actingTitleOf([], "live")), "Admin as Sara Conti");
});
