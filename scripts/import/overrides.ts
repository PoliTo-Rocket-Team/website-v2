import { academicYearNamed } from "./academic-year";
import type { OVERRIDES_CSV } from "./columns";
import type { At, Conflict } from "./conflicts";
import type { Row, Sources } from "./sources";

// The import's override input (issues #816, #822): `overrides.csv`, written by
// the person running the import, for the owner decisions the workbook cannot
// carry. Each line names rows, never people:
//
//   kind,sheet,row,value
//   handover,2026-2027,113,50       row 113 handed its seat over to row 50 this year
//   quitter-year,Quitters,7,2022-2023   Quitters row 7 is an alumnus of 2022-2023
//   title,2026-2027,33,Advisor      row 33's title cell reads "Advisor"
//
// This reads each line into the decision it states. A line whose kind is
// unknown, or whose row or value does not read, is reported, not guessed.

/** A seat the holder on row `fromRow` of `sheet` handed over to the holder on row `toRow` within the current year. */
export type Handover = { readonly kind: "handover"; readonly at: At; readonly sheet: string; readonly fromRow: number; readonly toRow: number };

/** A Quitters row the owner places in academic year `year`, whatever its dates. */
export type QuitterYear = { readonly kind: "quitter-year"; readonly at: At; readonly sheet: string; readonly row: number; readonly year: number };

/** The title the owner gives row `row` of `sheet` (issue #822): it replaces the row's title cell before any title rule reads it. */
export type TitleOverride = { readonly kind: "title"; readonly at: At; readonly sheet: string; readonly row: number; readonly title: string };

export type Override = Handover | QuitterYear | TitleOverride;

export type Overrides = {
  readonly handovers: readonly Handover[];
  readonly quitterYears: readonly QuitterYear[];
  readonly titles: readonly TitleOverride[];
  readonly conflicts: readonly Conflict[];
};

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
    case "title": {
      const title = value.replace(/\s+/g, " ").trim();
      return title === "" ? { kind: "unreadable", field: "value" } : { kind: "title", at, sheet: sheet.trim(), row: r, title };
    }
    default:
      return { kind: "unreadable", field: "kind" };
  }
}

/** Every line, sorted by the decision it states; an unreadable line is an `override-unmatched` conflict on its field. */
export function readOverrides(lines: readonly Row<keyof typeof OVERRIDES_CSV>[]): Overrides {
  const handovers: Handover[] = [];
  const quitterYears: QuitterYear[] = [];
  const titles: TitleOverride[] = [];
  const conflicts: Conflict[] = [];
  for (const line of lines) {
    const o = readOverride(line);
    if (o.kind === "handover") handovers.push(o);
    else if (o.kind === "quitter-year") quitterYears.push(o);
    else if (o.kind === "title") titles.push(o);
    else conflicts.push({ kind: "override-unmatched", at: line.at, field: o.field });
  }
  return { handovers, quitterYears, titles, conflicts };
}

/** A row's place on its sheet, as a `title` line names it. */
const placeKey = (sheet: string, row: number) => `${sheet}\u0000${row}`;

/** A row with its title cell replaced. */
const retitled = <F extends string>(row: Row<F | "title">, title: string | undefined): Row<F | "title"> =>
  title === undefined ? row : { ...row, value: { ...row.value, title } };

/**
 * The sources with the `title` lines of their override input applied (issue
 * #822): each line's text replaces the title cell of the row it names, on a
 * year, `Quitters` or `Roles` sheet the run read, so every title rule reads
 * the new text. A line naming a sheet the run did not read, or no row with a
 * name on it, or a row an earlier line already retitled, is not applied: it is
 * an `override-unmatched` conflict on that field. A line that does not read is
 * left to the plan, which reports every such line once.
 */
export function withTitleOverrides(sources: Sources): Sources {
  const rows = [...sources.years.flatMap((y) => y.rows), ...sources.quitters, ...sources.rolesSheets.flatMap((s) => s.rows)];
  const sheets = new Set([...sources.years.map((y) => y.sheet), ...sources.rolesSheets.map((s) => s.sheet), ...sources.quitters.map((q) => q.at.sheet ?? "")]);
  const named = new Set(rows.map((r) => placeKey(r.at.sheet ?? "", r.at.row)));
  const titleAt = new Map<string, string>();
  const conflicts: Conflict[] = [];
  for (const line of readOverrides(sources.csv.overrides).titles) {
    const key = placeKey(line.sheet, line.row);
    if (!sheets.has(line.sheet)) conflicts.push({ kind: "override-unmatched", at: line.at, field: "sheet" });
    else if (!named.has(key) || titleAt.has(key)) conflicts.push({ kind: "override-unmatched", at: line.at, field: "row" });
    else titleAt.set(key, line.title);
  }
  const retitle = <F extends string>(row: Row<F | "title">) => retitled(row, titleAt.get(placeKey(row.at.sheet ?? "", row.at.row)));
  return {
    ...sources,
    years: sources.years.map((y) => ({ ...y, rows: y.rows.map(retitle) })),
    quitters: sources.quitters.map(retitle),
    rolesSheets: sources.rolesSheets.map((s) => ({ ...s, rows: s.rows.map(retitle) })),
    titleOverrides: titleAt.size,
    conflicts: [...sources.conflicts, ...conflicts],
  };
}
