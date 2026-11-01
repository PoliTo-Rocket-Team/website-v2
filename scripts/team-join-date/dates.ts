import type { JoinRow } from "./roster";
import { excelDay } from "./xlsx";

// The day a roster row says its person joined the team (issue #948), read as
// the import read it (scripts/import/quitters.ts, issues #816 and #818, and
// scripts/alumni-repair/quitters.ts, issue #913). Dates are day first. The
// spreadsheet stored some date cells as month/day, so when a row's join day
// falls after its leave day, a date cell (never typed text) whose day is 12 or
// less is read with day and month swapped, where that swap puts the join on or
// before the leave: the leave day first, then the join day. A row whose dates
// no swap puts in order gives no join day.

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

/** What a row says of the day its person joined. */
export type JoinDay =
  | { readonly kind: "joined"; readonly day: string; readonly swapped: boolean }
  | { readonly kind: "no-join-date" }
  | { readonly kind: "date-unreadable"; readonly field: "joinedOn" | "leftOn" }
  | { readonly kind: "dates-out-of-order" };

/** The day a row's person joined, or why the row gives none. */
export function joinDayOf(row: JoinRow): JoinDay {
  const joinedText = row.value.joinedOn.trim();
  if (joinedText === "") return { kind: "no-join-date" };
  const joined = dateCellOf(joinedText);
  if (joined === null) return { kind: "date-unreadable", field: "joinedOn" };
  const leftText = row.value.leftOn.trim();
  if (leftText === "") return { kind: "joined", day: joined.day, swapped: false };
  const left = dateCellOf(leftText);
  if (left === null) return { kind: "date-unreadable", field: "leftOn" };
  if (joined.day <= left.day) return { kind: "joined", day: joined.day, swapped: false };
  // The leave day is swapped first, as the import did: the join day then stands as read.
  const leftSwapped = left.serial ? dayMonthSwapped(left.day) : null;
  if (leftSwapped !== null && joined.day <= leftSwapped) return { kind: "joined", day: joined.day, swapped: false };
  const joinedSwapped = joined.serial ? dayMonthSwapped(joined.day) : null;
  if (joinedSwapped !== null && joinedSwapped <= left.day) return { kind: "joined", day: joinedSwapped, swapped: true };
  return { kind: "dates-out-of-order" };
}
