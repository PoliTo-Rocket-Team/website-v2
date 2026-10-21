import { cacheLife } from "next/cache";
import { academicYearStart } from "./academic-year-copy";

// The Team's academic year runs from 1 October to 30 September, on Turin's
// clock. The rule lives in ./academic-year-copy.ts, with no server code, so
// the dashboard and the browser read it too (issue #515).

/**
 * The newest academic year that has ended at a moment, as its first calendar
 * year: the one before the running year. On 30 September 2026 it is 2024–25;
 * on 1 October 2026 it is 2025–26 (issue #391).
 */
export function newestFinishedAcademicYear(at: Date): number {
  return academicYearStart(at) - 1;
}

// How copy names the year lives apart, with no cache, so the Team page
// editor in the browser fills the intro the same way (issue #284).
export { academicYearLabel, academicYearStart, CURRENT_ACADEMIC_YEAR, shortAcademicYearLabel, withAcademicYear } from "./academic-year-copy";

/**
 * Today's academic year. Cached for a day, so a prerendered page turns over
 * on 1 October without a redeploy.
 */
export async function currentAcademicYearStart(): Promise<number> {
  "use cache";
  cacheLife("days");
  return academicYearStart(new Date());
}

/**
 * Today's newest finished academic year, cached for a day like the running
 * year, so the Alumni page gains the year that just ended on 1 October
 * without a redeploy.
 */
export async function newestFinishedAcademicYearStart(): Promise<number> {
  "use cache";
  cacheLife("days");
  return newestFinishedAcademicYear(new Date());
}
