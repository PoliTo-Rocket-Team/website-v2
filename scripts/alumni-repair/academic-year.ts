// The team's academic year runs 1 October to 30 September; a year is named by
// the calendar year it starts in (2024 is "2024-2025"). Restored from the
// removed import tool (scripts/import, issue #677).

/** The first day of academic year `y` ("2024-10-01"). */
export const yearStart = (y: number) => `${y}-10-01`;

/** The last day of academic year `y` ("2025-09-30"). */
export const yearEnd = (y: number) => `${y + 1}-09-30`;

/** The academic year a day (`YYYY-MM-DD` or a full timestamp) falls in. */
export function academicYearOf(day: string): number {
  const d = new Date(day);
  return d.getUTCMonth() >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/** "2024-2025" for 2024. */
export const yearName = (y: number) => `${y}-${y + 1}`;
