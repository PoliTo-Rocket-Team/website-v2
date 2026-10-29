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
//   position-division,positions_rows.csv,14,Propulsion/Liquid Systems
//                                   that position goes to that division
//
// This reads each line into the decision it states. A line whose kind is
// unknown, or whose row or value does not read, is reported, not guessed.
// `position-division` lines (issue #842) are the positions-only run's: the
// full run reads none of them, and the positions-only run reads only them.

/** A seat the holder on row `fromRow` of `sheet` handed over to the holder on row `toRow` within the current year. */
export type Handover = { readonly kind: "handover"; readonly at: At; readonly sheet: string; readonly fromRow: number; readonly toRow: number };

/** A Quitters row the owner places in academic year `year`, whatever its dates. */
export type QuitterYear = { readonly kind: "quitter-year"; readonly at: At; readonly sheet: string; readonly row: number; readonly year: number };

/** The title the owner gives row `row` of `sheet` (issue #822): it replaces the row's title cell before any title rule reads it. */
export type TitleOverride = { readonly kind: "title"; readonly at: At; readonly sheet: string; readonly row: number; readonly title: string };

/**
 * The production division the owner gives row `row` of `sheet` in the
 * positions-only run (issue #842): the division named `division` under the
 * department named `department`, each a unit's name or code.
 */
export type PositionDivision = {
  readonly kind: "position-division";
  readonly at: At;
  readonly sheet: string;
  readonly row: number;
  readonly department: string;
  readonly division: string;
};

export type Override = Handover | QuitterYear | TitleOverride | PositionDivision;

/** A line that does not read: the field at fault, and the kind it was meant as when that kind is known. */
export type Unreadable = { readonly kind: "unreadable"; readonly field: string; readonly of: Override["kind"] | null };

export type Overrides = {
  readonly handovers: readonly Handover[];
  readonly quitterYears: readonly QuitterYear[];
  readonly titles: readonly TitleOverride[];
  /** The full run's unreadable lines: an unknown kind, or a line of its kinds that does not read. */
  readonly conflicts: readonly Conflict[];
  /** The positions-only run's lines, and those of them that do not read; the full run reads neither. */
  readonly positionDivisions: { readonly lines: readonly PositionDivision[]; readonly conflicts: readonly Conflict[] };
};

const rowNumber = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

const KINDS: readonly Override["kind"][] = ["handover", "quitter-year", "title", "position-division"];

/** A `position-division` value: a department and a division, split on the first "/". Null unless both parts hold text. */
function departmentAndDivision(value: string): { readonly department: string; readonly division: string } | null {
  const slash = value.indexOf("/");
  if (slash === -1) return null;
  const [department, division] = [value.slice(0, slash).trim(), value.slice(slash + 1).trim()];
  return department === "" || division === "" ? null : { department, division };
}

/** The decision one line states, or the field that does not read. */
export function readOverride(line: Row<keyof typeof OVERRIDES_CSV>): Override | Unreadable {
  const { kind, sheet, row, value } = line.value;
  const at = line.at;
  const named = kind.trim().toLowerCase();
  const of = KINDS.find((k) => k === named) ?? null;
  const unreadable = (field: string): Unreadable => ({ kind: "unreadable", field, of });
  const r = rowNumber(row);
  if (r === null) return unreadable("row");
  switch (of) {
    case "handover": {
      const to = rowNumber(value);
      return to === null ? unreadable("value") : { kind: "handover", at, sheet: sheet.trim(), fromRow: r, toRow: to };
    }
    case "quitter-year": {
      const year = academicYearNamed(value);
      return year === null ? unreadable("value") : { kind: "quitter-year", at, sheet: sheet.trim(), row: r, year };
    }
    case "title": {
      const title = value.replace(/\s+/g, " ").trim();
      return title === "" ? unreadable("value") : { kind: "title", at, sheet: sheet.trim(), row: r, title };
    }
    case "position-division": {
      const parts = departmentAndDivision(value);
      return parts === null ? unreadable("value") : { kind: "position-division", at, sheet: sheet.trim(), row: r, ...parts };
    }
    case null:
      return unreadable("kind");
  }
}

/** Every line, sorted by the decision it states; an unreadable line is an `override-unmatched` conflict on its field, kept with its run's lines. */
export function readOverrides(lines: readonly Row<keyof typeof OVERRIDES_CSV>[]): Overrides {
  const handovers: Handover[] = [];
  const quitterYears: QuitterYear[] = [];
  const titles: TitleOverride[] = [];
  const conflicts: Conflict[] = [];
  const positionDivisions: PositionDivision[] = [];
  const positionConflicts: Conflict[] = [];
  for (const line of lines) {
    const o = readOverride(line);
    if (o.kind === "handover") handovers.push(o);
    else if (o.kind === "quitter-year") quitterYears.push(o);
    else if (o.kind === "title") titles.push(o);
    else if (o.kind === "position-division") positionDivisions.push(o);
    else (o.of === "position-division" ? positionConflicts : conflicts).push({ kind: "override-unmatched", at: line.at, field: o.field });
  }
  return { handovers, quitterYears, titles, conflicts, positionDivisions: { lines: positionDivisions, conflicts: positionConflicts } };
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
