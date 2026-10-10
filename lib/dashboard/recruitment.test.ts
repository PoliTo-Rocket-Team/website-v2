import assert from "node:assert/strict";
import { test } from "node:test";
import { ago, appliedLabels, documentsLine, filterPositions, quietDays, type PositionRow } from "./recruitment";

const row = (title: string, department: string, open: boolean): PositionRow => ({
  id: title.length,
  ref: title,
  title,
  division: `${department} Division`,
  department,
  open,
  applications: 0,
  newApplications: 0,
  quiet: null,
  updated: "",
  code: "",
  content: { title, description: "", required: [], desirable: [], questions: [], motivationLetter: false },
});

const ROWS = [row("Mission Analyst", "Aerodynamics", true), row("Graphic Designer", "Operations", false), row("Safety Officer", "Operations", true)];

test("the positions filter combines the tab, the department and the search", () => {
  const titles = (rows: PositionRow[]) => rows.map((r) => r.title);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "open", department: null, search: "" })), ["Mission Analyst", "Safety Officer"]);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "all", department: "Operations", search: "" })), ["Graphic Designer", "Safety Officer"]);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "closed", department: "Operations", search: "" })), ["Graphic Designer"]);
  assert.deepEqual(titles(filterPositions(ROWS, { tab: "all", department: null, search: "  aero " })), ["Mission Analyst"]);
});

test("the documents column names the CV and the letter the applicant sent", () => {
  const doc = (kind: "cv" | "motivation-letter") => ({ kind, name: "x.pdf", size: null, href: null });
  assert.equal(documentsLine([doc("cv"), doc("motivation-letter")]), "CV + letter");
  assert.equal(documentsLine([doc("cv")]), "CV");
});

test("ages read as the boards word them", () => {
  const now = new Date("2026-10-09T16:00:00+02:00");
  const before = (hours: number) => new Date(now.getTime() - hours * 3600_000);
  assert.equal(ago(before(5), now), "5 hours ago");
  assert.equal(ago(before(48), now), "2 days ago");
  assert.equal(ago(before(24 * 7), now), "1 week ago");
  assert.equal(ago(before(24 * 30), now), "1 month ago");
  assert.deepEqual(appliedLabels(new Date("2026-10-09T14:32:00+02:00"), now), { day: "Today", at: "today, 14:32" });
  // Calendar days in Turin, not 24-hour spans: late last night is yesterday.
  assert.equal(appliedLabels(new Date("2026-10-08T23:30:00+02:00"), now).day, "Yesterday");
  assert.deepEqual(appliedLabels(new Date("2026-10-07T10:05:00+02:00"), now), { day: "2 days ago", at: "7 Oct, 10:05" });
});

test("only an open role 30 days without an application is quiet", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  assert.equal(quietDays(true, daysAgo(30), now), 30);
  assert.equal(quietDays(true, daysAgo(29), now), null);
  assert.equal(quietDays(false, daysAgo(90), now), null);
});
