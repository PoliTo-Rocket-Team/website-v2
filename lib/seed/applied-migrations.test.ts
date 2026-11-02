import assert from "node:assert/strict";
import { test } from "node:test";
import { appliedMigrations, journalEntries } from "./journal";

// The production build logs which migrations it applied by name (issue #874).
// Drizzle's migrator names none, so the step reads drizzle's record either side
// of the run and names the new rows from the journal.

const JOURNAL = [
  { tag: "0074_first", when: 1000 },
  { tag: "0075_second", when: 2000 },
  { tag: "0076_third", when: 3000 },
];

test("the new rows are named by their journal entries, in journal order", () => {
  assert.deepEqual(appliedMigrations(JOURNAL, new Set(["1000"]), new Set(["3000", "1000", "2000"])), ["0075_second", "0076_third"]);
});

test("a run that applied nothing names nothing, and a first run names every migration", () => {
  assert.deepEqual(appliedMigrations(JOURNAL, new Set(["1000", "2000", "3000"]), new Set(["1000", "2000", "3000"])), []);
  assert.deepEqual(appliedMigrations(JOURNAL, new Set(), new Set(["1000", "2000", "3000"])), ["0074_first", "0075_second", "0076_third"]);
});

test("a new row no journal entry matches is still named, so the log hides none", () => {
  assert.deepEqual(appliedMigrations(JOURNAL, new Set(), new Set(["3000", "9999"])), ["0076_third", "unjournaled migration recorded at 9999"]);
});

test("the real journal gives every migration a tag and a distinct time", () => {
  const entries = journalEntries();
  assert.ok(entries.length > 0);
  assert.equal(new Set(entries.map(({ when }) => when)).size, entries.length);
  for (const { tag, when } of entries) assert.ok(tag.length > 0 && Number.isInteger(when), tag);
});
