import { academicYearOf, yearEnd, yearStart } from "./academic-year";
import { dateCellOf, dayMonthSwapped, type DateCell, type QuitterRow } from "./sources";

// A person on the Quitters sheet and on no year sheet (issue #816, owner
// decision) is an alumnus of the academic year they left in. Their one stint
// runs from the row's "Joined the Team on" day (else the start of that year)
// to its "Left the Team on" day. An override line may place the row in a year
// instead: the stint is then that whole year, whatever the dates say. A row
// with no leave day and no override, or with a day that does not read, gives
// no stint: it is not imported, and the report lists it by row.
//
// Quitters dates are day/month (owner decision, issue #818), but the
// spreadsheet stored some date cells as month/day. So when the join day falls
// after the leave day, a date cell (never typed text) whose day is 12 or less
// is read with its day and month swapped, where that swap puts the join on or
// before the leave: the leave day first, then the join day. Only one cell is
// swapped; when neither swap fixes the row, it stays unclear.

/** The cell of a Quitters row a stint read with its day and month swapped. */
export type SwappedField = "leftOn" | "joinedOn";

/** The years and days a quitter-only alumnus is imported with, and the date cell read day/month-swapped, if any. */
export type QuitterStint = {
  readonly kind: "stint";
  readonly year: number;
  readonly startedAt: string;
  readonly leftAt: string;
  readonly swapped: SwappedField | null;
};

/** Why a quitter-only row gives no stint, and the cell at fault. */
export type QuitterUnclear = {
  readonly kind: "unclear";
  readonly conflict: "quitter-no-date" | "quitter-date-unreadable";
  readonly field: "leftOn" | "joinedOn";
};

const stint = (startedAt: string | null, leftAt: string, swapped: SwappedField | null): QuitterStint => {
  const year = academicYearOf(leftAt);
  return { kind: "stint", year, startedAt: startedAt ?? yearStart(year), leftAt, swapped };
};

/** The join and leave days in order: as read, else with one date cell's day and month swapped (the leave day's first); null when neither puts them in order. */
function inOrder(joined: DateCell, left: DateCell): QuitterStint | null {
  if (joined.day <= left.day) return stint(joined.day, left.day, null);
  const leftSwapped = left.serial ? dayMonthSwapped(left.day) : null;
  if (leftSwapped !== null && joined.day <= leftSwapped) return stint(joined.day, leftSwapped, "leftOn");
  const joinedSwapped = joined.serial ? dayMonthSwapped(joined.day) : null;
  if (joinedSwapped !== null && joinedSwapped <= left.day) return stint(joinedSwapped, left.day, "joinedOn");
  return null;
}

/** The stint a quitter-only row gives, under the academic year an override line names for it, if any. */
export function quitterStint(row: QuitterRow, overrideYear: number | null): QuitterStint | QuitterUnclear {
  if (overrideYear !== null) return { kind: "stint", year: overrideYear, startedAt: yearStart(overrideYear), leftAt: yearEnd(overrideYear), swapped: null };
  const leftText = row.value.leftOn.trim();
  if (leftText === "") return { kind: "unclear", conflict: "quitter-no-date", field: "leftOn" };
  const left = dateCellOf(leftText);
  if (left === null) return { kind: "unclear", conflict: "quitter-date-unreadable", field: "leftOn" };
  const joinedText = row.value.joinedOn.trim();
  if (joinedText === "") return stint(null, left.day, null);
  const joined = dateCellOf(joinedText);
  // A join day that does not read, or that falls after the leave day however the cells are read, is no day the row could mean.
  const ordered = joined === null ? null : inOrder(joined, left);
  return ordered ?? { kind: "unclear", conflict: "quitter-date-unreadable", field: "joinedOn" };
}
