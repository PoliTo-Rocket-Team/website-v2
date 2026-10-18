import { cacheLife } from "next/cache";

// The Team's academic year runs from 1 October to 30 September, on Turin's
// clock: on 1 October 2026 it becomes 2026–2027.

/** The academic year a moment falls in, as its first calendar year. */
export function academicYearStart(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", year: "numeric", month: "numeric" }).formatToParts(at);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return month >= 10 ? year : year - 1;
}

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
export { academicYearLabel, CURRENT_ACADEMIC_YEAR, withAcademicYear } from "./academic-year-copy";

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
