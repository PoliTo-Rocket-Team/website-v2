import assert from "node:assert/strict";
import { test } from "node:test";
import { fieldSummaryOf, summaryLine } from "./error-summary";

// Issue #911: a refused Save names the fields in error above the buttons, in the form's order, and the form
// scrolls to and focuses the first of them.

const FIELDS = [
  { name: "firstName", label: "First name", error: undefined },
  { name: "title-v3", label: "Role in Logistics", error: "Too long." },
  { name: "phone", label: "Phone", error: "Start with + and the country code." },
  { name: "linkedin", label: "LinkedIn", error: undefined },
] as const;

test("the summary names every field in error by label, in the form's order, and picks the first one to focus", () => {
  const summary = fieldSummaryOf(FIELDS);
  assert.deepEqual(summary, { kind: "fields", labels: ["Role in Logistics", "Phone"], first: "title-v3" });
  assert.equal(summaryLine(summary!), "Fix 2 fields: Role in Logistics, Phone");
});

test("one field in error reads in the singular, and none shows no summary", () => {
  const one = fieldSummaryOf([FIELDS[0], FIELDS[2]]);
  assert.equal(summaryLine(one!), "Fix 1 field: Phone");
  assert.equal(fieldSummaryOf([FIELDS[0], FIELDS[3]]), null);
});

test("a server refusal shows its own message", () => {
  assert.equal(summaryLine({ kind: "refusal", message: "Could not save the details. You cannot change this person." }), "Could not save the details. You cannot change this person.");
});
