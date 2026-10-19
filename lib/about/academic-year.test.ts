import assert from "node:assert/strict";
import { test } from "node:test";
import { newestFinishedAcademicYear } from "./academic-year";

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
