import { academicYearNamed } from "./academic-year";
import type { OVERRIDES_CSV } from "./columns";
import type { At, Conflict } from "./conflicts";
import type { Row } from "./sources";

// The import's override input (issue #816): `overrides.csv`, written by the
// person running the import, for the owner decisions the workbook cannot
// carry. Each line names rows, never people:
//
//   kind,sheet,row,value
//   handover,2026-2027,113,50       row 113 handed its seat over to row 50 this year
//   quitter-year,Quitters,7,2022-2023   Quitters row 7 is an alumnus of 2022-2023
//
// This reads each line into the decision it states. A line whose kind is
// unknown, or whose row or value does not read, is reported, not guessed.

/** A seat the holder on row `fromRow` of `sheet` handed over to the holder on row `toRow` within the current year. */
export type Handover = { readonly kind: "handover"; readonly at: At; readonly sheet: string; readonly fromRow: number; readonly toRow: number };

/** A Quitters row the owner places in academic year `year`, whatever its dates. */
export type QuitterYear = { readonly kind: "quitter-year"; readonly at: At; readonly sheet: string; readonly row: number; readonly year: number };

export type Override = Handover | QuitterYear;

export type Overrides = { readonly handovers: readonly Handover[]; readonly quitterYears: readonly QuitterYear[]; readonly conflicts: readonly Conflict[] };

const rowNumber = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** The decision one line states, or the field that does not read. */
export function readOverride(line: Row<keyof typeof OVERRIDES_CSV>): Override | { readonly kind: "unreadable"; readonly field: string } {
  const { kind, sheet, row, value } = line.value;
  const at = line.at;
  const r = rowNumber(row);
  if (r === null) return { kind: "unreadable", field: "row" };
  switch (kind.trim().toLowerCase()) {
    case "handover": {
      const to = rowNumber(value);
      return to === null ? { kind: "unreadable", field: "value" } : { kind: "handover", at, sheet: sheet.trim(), fromRow: r, toRow: to };
    }
    case "quitter-year": {
      const year = academicYearNamed(value);
      return year === null ? { kind: "unreadable", field: "value" } : { kind: "quitter-year", at, sheet: sheet.trim(), row: r, year };
    }
    default:
      return { kind: "unreadable", field: "kind" };
  }
}

/** Every line, sorted by the decision it states; an unreadable line is an `override-unmatched` conflict on its field. */
export function readOverrides(lines: readonly Row<keyof typeof OVERRIDES_CSV>[]): Overrides {
  const handovers: Handover[] = [];
  const quitterYears: QuitterYear[] = [];
  const conflicts: Conflict[] = [];
  for (const line of lines) {
    const o = readOverride(line);
    if (o.kind === "handover") handovers.push(o);
    else if (o.kind === "quitter-year") quitterYears.push(o);
    else conflicts.push({ kind: "override-unmatched", at: line.at, field: o.field });
  }
  return { handovers, quitterYears, conflicts };
}
