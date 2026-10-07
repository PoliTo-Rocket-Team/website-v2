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

/** "2026–2027": an academic year as page copy writes it (no em dashes). */
export function academicYearLabel(start: number): string {
  return `${start}–${start + 1}`;
}

/** Where copy names the current academic year; the page fills it in. */
export const CURRENT_ACADEMIC_YEAR = "{academicYear}";

/** Fills `{academicYear}` in a line of copy with the current academic year. */
export function withAcademicYear(text: string, start: number): string {
  return text.replaceAll(CURRENT_ACADEMIC_YEAR, academicYearLabel(start));
}

/**
 * Today's academic year. Cached for a day, so a prerendered page turns over
 * on 1 October without a redeploy.
 */
export async function currentAcademicYearStart(): Promise<number> {
  "use cache";
  cacheLife("days");
  return academicYearStart(new Date());
}
