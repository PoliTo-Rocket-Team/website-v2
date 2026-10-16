// The academic year as page copy names it. No cache and no server code, so
// the public pages and the Team page editor in the browser (issue #284) fill
// copy the same way; ./academic-year.ts reads which year it is.

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
