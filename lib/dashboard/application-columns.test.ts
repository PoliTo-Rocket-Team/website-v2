import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApplicationStage } from "./application-flow";
import {
  applicationColumnOptions,
  applicationColumnValues,
  clearApplicationPicks,
  NO_APPLICATION_PICKS,
  toggleApplicationPick,
  withApplicationPicks,
  type ApplicationColumnsRow,
  type ApplicationPicks,
} from "./application-columns";
import type { ApplicationDocument } from "./recruitment";

// Issue #428: the Applications table's column filters follow the Members
// table's rules: within a column any ticked value matches, across columns all
// must, and a column's popover counts over what the other columns leave.

const cv: ApplicationDocument = { kind: "cv", name: "cv.pdf", size: null, href: null };
const letter: ApplicationDocument = { kind: "motivation-letter", name: "letter.pdf", size: null, href: null };

type Row = ApplicationColumnsRow & { readonly id: number };

function row(
  id: number,
  title: string,
  division: string,
  stage: ApplicationStage,
  studies: { degree: string | null; year: string | null },
  documents: readonly ApplicationDocument[],
  day: string,
): Row {
  return { id, state: { stage }, applicant: studies, position: { title, division }, documents, applied: { day } };
}

const aero = { degree: "Aerospace Engineering", year: "Year 1 Master's" };
const mech = { degree: "Mechanical Engineering", year: "Year 3 Bachelor's" };

// In the order the toolbar left them.
const rows: readonly Row[] = [
  row(1, "Trajectory Engineer", "Mission Analysis Division", "new", aero, [cv, letter], "Today"),
  row(2, "CFD Analyst", "Optimization and Analysis Division", "interview", mech, [cv], "Yesterday"),
  row(3, "Trajectory Engineer", "Mission Analysis Division", "interview", mech, [], "Today"),
  row(4, "Trajectory Engineer", "Propulsion Division", "rejected", { degree: null, year: null }, [letter], "3 days ago"),
];

const ids = (picks: ApplicationPicks) => withApplicationPicks(rows, picks).map((r) => r.id);

test("each filtered column holds what its cell reads, the position with its division", () => {
  const first = rows[0];
  assert.deepEqual(applicationColumnValues(first, "position"), ["Trajectory Engineer · Mission Analysis"]);
  assert.deepEqual(applicationColumnValues(first, "program"), ["Aerospace Eng."]);
  assert.deepEqual(applicationColumnValues(first, "level"), ["MSc 1"]);
  assert.deepEqual(applicationColumnValues(first, "stage"), ["New"]);
  assert.deepEqual(applicationColumnValues(first, "documents"), ["CV + letter"]);
  assert.deepEqual(applicationColumnValues(first, "applied"), ["Today"]);
  // No documents is a value of its own; no studies given holds none.
  assert.deepEqual(applicationColumnValues(rows[2], "documents"), ["None"]);
  assert.deepEqual(applicationColumnValues(rows[3], "program"), []);
  assert.deepEqual(applicationColumnValues(rows[3], "level"), []);
});

test("any ticked value in a column matches, every filtered column must match", () => {
  assert.deepEqual(ids(NO_APPLICATION_PICKS), [1, 2, 3, 4]);
  const interviews = toggleApplicationPick(NO_APPLICATION_PICKS, "stage", "Interview");
  assert.deepEqual(ids(interviews), [2, 3]);
  assert.deepEqual(ids(toggleApplicationPick(interviews, "applied", "Today")), [3]);
  const msc = toggleApplicationPick(NO_APPLICATION_PICKS, "level", "MSc 1");
  assert.deepEqual(ids(toggleApplicationPick(msc, "level", "BSc 3")), [1, 2, 3]);
  // Two positions of one title in two divisions stay apart.
  assert.deepEqual(ids(toggleApplicationPick(NO_APPLICATION_PICKS, "position", "Trajectory Engineer · Propulsion")), [4]);
  // Unticking and clearing give the rows back.
  assert.deepEqual(ids(toggleApplicationPick(interviews, "stage", "Interview")), [1, 2, 3, 4]);
  assert.deepEqual(ids(clearApplicationPicks(toggleApplicationPick(interviews, "applied", "Today"), "stage")), [1, 3]);
});

test("a column's popover counts each value over what the other columns leave, most first", () => {
  assert.deepEqual(applicationColumnOptions(rows, NO_APPLICATION_PICKS, "documents"), [
    { value: "CV", count: 1 },
    { value: "CV + letter", count: 1 },
    { value: "letter", count: 1 },
    { value: "None", count: 1 },
  ]);
  assert.deepEqual(applicationColumnOptions(rows, NO_APPLICATION_PICKS, "applied"), [
    { value: "Today", count: 2 },
    { value: "3 days ago", count: 1 },
    { value: "Yesterday", count: 1 },
  ]);
  const today = toggleApplicationPick(NO_APPLICATION_PICKS, "applied", "Today");
  assert.deepEqual(applicationColumnOptions(rows, today, "stage"), [
    { value: "Interview", count: 1 },
    { value: "New", count: 1 },
  ]);
  // A column's own ticks do not shrink its own list.
  assert.equal(applicationColumnOptions(rows, today, "applied").length, 3);
});
