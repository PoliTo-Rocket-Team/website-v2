import assert from "node:assert/strict";
import { test } from "node:test";
import { ADMIN_TESTER_TITLE, actingTitleOf, attributedName } from "./acting-account";

// How a write made in a View as session reads (issue #605, Owner decisions
// on #597): the acting seat's title, then the person's full name.

test("a write with an acting account reads as the seat title, then the person's full name", () => {
  assert.equal(attributedName("Sara Conti", "IT lead"), "IT lead as Sara Conti");
});

test("a write with no acting account reads as the name alone, as before", () => {
  assert.equal(attributedName("Sara Conti", null), "Sara Conti");
});

test("an acting account that holds or held the IT lead seat is the IT lead, whatever else it holds", () => {
  assert.equal(actingTitleOf(["it-lead"]), "IT lead");
  assert.equal(actingTitleOf([null, "operations-lead", "it-lead"]), "IT lead");
});

test("an acting account that never held the IT lead seat can only be a seeded admin tester", () => {
  assert.equal(actingTitleOf([]), ADMIN_TESTER_TITLE);
  assert.equal(actingTitleOf([null, "operations-lead"]), ADMIN_TESTER_TITLE);
});
