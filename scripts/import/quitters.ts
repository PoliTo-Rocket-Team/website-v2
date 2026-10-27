import { academicYearOf, yearEnd, yearStart } from "./academic-year";
import { dayOf, type QuitterRow } from "./sources";

// A person on the Quitters sheet and on no year sheet (issue #816, owner
// decision) is an alumnus of the academic year they left in. Their one stint
// runs from the row's "Joined the Team on" day (else the start of that year)
// to its "Left the Team on" day. An override line may place the row in a year
// instead: the stint is then that whole year, whatever the dates say. A row
// with no leave day and no override, or with a day that does not read, gives
// no stint: it is not imported, and the report lists it by row.

/** The years and days a quitter-only alumnus is imported with. */
export type QuitterStint = { readonly kind: "stint"; readonly year: number; readonly startedAt: string; readonly leftAt: string };

/** Why a quitter-only row gives no stint, and the cell at fault. */
export type QuitterUnclear = {
  readonly kind: "unclear";
  readonly conflict: "quitter-no-date" | "quitter-date-unreadable";
  readonly field: "leftOn" | "joinedOn";
};

/** The stint a quitter-only row gives, under the academic year an override line names for it, if any. */
export function quitterStint(row: QuitterRow, overrideYear: number | null): QuitterStint | QuitterUnclear {
  if (overrideYear !== null) return { kind: "stint", year: overrideYear, startedAt: yearStart(overrideYear), leftAt: yearEnd(overrideYear) };
  const leftText = row.value.leftOn.trim();
  if (leftText === "") return { kind: "unclear", conflict: "quitter-no-date", field: "leftOn" };
  const leftAt = dayOf(leftText);
  if (leftAt === null) return { kind: "unclear", conflict: "quitter-date-unreadable", field: "leftOn" };
  const year = academicYearOf(leftAt);
  const joinedText = row.value.joinedOn.trim();
  if (joinedText === "") return { kind: "stint", year, startedAt: yearStart(year), leftAt };
  const joinedAt = dayOf(joinedText);
  // A join day after the leave day reads as no day the row could mean.
  if (joinedAt === null || joinedAt > leftAt) return { kind: "unclear", conflict: "quitter-date-unreadable", field: "joinedOn" };
  return { kind: "stint", year, startedAt: joinedAt, leftAt };
}
