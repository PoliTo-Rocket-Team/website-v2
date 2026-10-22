import assert from "node:assert/strict";
import { test } from "node:test";
import { academicYearLabel, academicYearStart, newestFinishedAcademicYear, shortAcademicYearLabel } from "./academic-year";

// One rule for "this team year" (issue #515): it turns over on 1 October, on Turin's clock.

test("the academic year turns over at midnight on 1 October in Turin", () => {
  // 30 September 23:59 in Turin (summer time, UTC+2).
  assert.equal(academicYearStart(new Date("2026-09-30T21:59:00Z")), 2025);
  // 1 October 00:01 in Turin.
  assert.equal(academicYearStart(new Date("2026-09-30T22:01:00Z")), 2026);
  // Still 30 September in UTC, already 1 October in Turin.
  assert.equal(academicYearStart(new Date("2026-09-30T23:30:00Z")), 2026);
});

test("the short label writes the start year and the end year's last two digits", () => {
  assert.equal(shortAcademicYearLabel(2025), "2025–26");
  assert.equal(shortAcademicYearLabel(2026), "2026–27");
  assert.equal(shortAcademicYearLabel(2099), "2099–00");
});

test("the copy label keeps both years in full", () => {
  assert.equal(academicYearLabel(2026), "2026–2027");
});

// The newest finished academic year (issue #391): years start on 1 October, on Turin's clock.

test("on 30 September the year that ends that day is still running", () => {
  assert.equal(newestFinishedAcademicYear(new Date("2026-09-30T12:00:00Z")), 2024);
  // 23:59 in Turin (summer time, UTC+2).
  assert.equal(newestFinishedAcademicYear(new Date("2026-09-30T21:59:59Z")), 2024);
});

test("on 1 October the year that just ended is the newest finished one", () => {
  // Midnight in Turin, still 30 September in UTC.
  assert.equal(newestFinishedAcademicYear(new Date("2026-09-30T22:00:00Z")), 2025);
  assert.equal(newestFinishedAcademicYear(new Date("2026-10-01T12:00:00Z")), 2025);
});

test("the newest finished year holds from October through September", () => {
  assert.equal(newestFinishedAcademicYear(new Date("2027-01-15T12:00:00Z")), 2025);
  assert.equal(newestFinishedAcademicYear(new Date("2027-09-30T12:00:00Z")), 2025);
});
