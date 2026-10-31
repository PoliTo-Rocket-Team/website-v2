import { academicYearOf, yearStart } from "./academic-year";
import type { QuitterRow } from "./roster";
import { excelDay } from "./xlsx";

// The last stretch on the team a Quitters row gives (issue #913): the academic
// year its "Left the Team on" day falls in, from the start of that year (or
// the row's "Joined the Team on" day, when that is later) to the leave day.
// The date reading is restored from the removed import tool
// (scripts/import/quitters.ts and sources.ts, issues #816 and #818).
//
// Quitters dates are day/month (owner decision, issue #818), but the
// spreadsheet stored some date cells as month/day. So when the join day falls
// after the leave day, a date cell (never typed text) whose day is 12 or less
// is read with its day and month swapped, where that swap puts the join on or
// before the leave: the leave day first, then the join day. Only one cell is
// swapped; when neither swap fixes the row, its dates are unclear.

/** The years a roster day may fall in: a cell outside them (a bare "2024" read as a day serial is in 1905) is no day. */
const FIRST_ROSTER_YEAR = 1990;
const LAST_ROSTER_YEAR = 2100;

/** `YYYY-MM-DD` when the three parts name a real day in the roster's years; null otherwise ("31/02/2024"). */
function realDay(year: number, month: number, day: number): string | null {
  const d = new Date(Date.UTC(year, month - 1, day));
  const real = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
  return real && year >= FIRST_ROSTER_YEAR && year <= LAST_ROSTER_YEAR ? d.toISOString().slice(0, 10) : null;
}

/** A date cell as read: its day, and whether the sheet stored it as a date cell (an Excel day serial) rather than as typed text. */
type DateCell = { readonly day: string; readonly serial: boolean };

/** A day the sheet gives as a date cell or as text: "2024-06-30", "30/06/2024", "3/6/2024" or "30.06.2024", day first. */
export function dateCellOf(text: string): DateCell | null {
  const t = text.trim();
  const serial = excelDay(t);
  const read = (day: string | null, isSerial: boolean) => (day === null ? null : { day, serial: isSerial });
  if (serial !== null) return read(realDay(Number(serial.slice(0, 4)), Number(serial.slice(5, 7)), Number(serial.slice(8, 10))), true);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+Z?)?$/.exec(t);
  if (iso !== null) return read(realDay(Number(iso[1]), Number(iso[2]), Number(iso[3])), false);
  const eu = /^(\d{1,2})([/.])(\d{1,2})\2(\d{4})$/.exec(t);
  if (eu !== null) return read(realDay(Number(eu[4]), Number(eu[3]), Number(eu[1])), false);
  return null;
}

/** A day with its day and month swapped; null when the day is over 12 (no month), or equals the month. */
function dayMonthSwapped(day: string): string | null {
  const [year, month, date] = day.split("-").map(Number);
  return date > 12 || date === month ? null : realDay(year, date, month);
}

/** The cell of a Quitters row read with its day and month swapped. */
export type SwappedField = "leftOn" | "joinedOn";

/** The last academic year a Quitters row gives, the days its role runs, and the date cell read swapped, if any. */
export type LastYear = {
  readonly kind: "last-year";
  readonly year: number;
  readonly startedAt: string;
  readonly leftAt: string;
  readonly swapped: SwappedField | null;
};

/** Why a Quitters row gives no last year, and the cell at fault. */
export type DatesUnclear = { readonly kind: "unclear"; readonly reason: "no-leave-date" | "date-unreadable"; readonly field: SwappedField };

const lastYear = (joined: string | null, leftAt: string, swapped: SwappedField | null): LastYear => {
  const year = academicYearOf(leftAt);
  const start = yearStart(year);
  return { kind: "last-year", year, startedAt: joined !== null && joined > start ? joined : start, leftAt, swapped };
};

/** The join and leave days in order: as read, else with one date cell's day and month swapped (the leave day's first). */
function inOrder(joined: DateCell, left: DateCell): LastYear | null {
  if (joined.day <= left.day) return lastYear(joined.day, left.day, null);
  const leftSwapped = left.serial ? dayMonthSwapped(left.day) : null;
  if (leftSwapped !== null && joined.day <= leftSwapped) return lastYear(joined.day, leftSwapped, "leftOn");
  const joinedSwapped = joined.serial ? dayMonthSwapped(joined.day) : null;
  if (joinedSwapped !== null && joinedSwapped <= left.day) return lastYear(joinedSwapped, left.day, "joinedOn");
  return null;
}

/** The last academic year a Quitters row gives, or why its dates give none. */
export function lastYearOf(row: QuitterRow): LastYear | DatesUnclear {
  const leftText = row.value.leftOn.trim();
  if (leftText === "") return { kind: "unclear", reason: "no-leave-date", field: "leftOn" };
  const left = dateCellOf(leftText);
  if (left === null) return { kind: "unclear", reason: "date-unreadable", field: "leftOn" };
  const joinedText = row.value.joinedOn.trim();
  if (joinedText === "") return lastYear(null, left.day, null);
  const joined = dateCellOf(joinedText);
  const ordered = joined === null ? null : inOrder(joined, left);
  return ordered ?? { kind: "unclear", reason: "date-unreadable", field: "joinedOn" };
}
