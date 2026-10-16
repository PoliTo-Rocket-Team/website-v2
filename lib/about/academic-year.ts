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
