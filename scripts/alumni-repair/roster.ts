import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cell, locate, QUITTERS_SHEET, YEAR_SHEET, type QuitterField, type SourceSpec, type YearField } from "./columns";
import { readWorkbook, type Sheet } from "./xlsx";

// Reads the roster workbook (issue #913): every `YYYY-YYYY` year sheet up to
// the current one, for who was on the team which year, and the `Quitters`
// sheet, for who left, when, and in which units and title. The workbook stays
// outside the repo: it is read from the directory the run names. Each row
// keeps its sheet and row number so the report can point at it without
// printing what it holds. Trimmed from the removed import tool's readers
// (scripts/import/sources.ts, issue #677).

/** Where a row sits: its sheet, and its row number on that sheet (from 1). */
export type At = { readonly sheet: string; readonly row: number };

/** One located row: where it sits and each field's value ("" when the sheet has none). */
export type Row<F extends string> = { readonly at: At; readonly value: Readonly<Record<F, string>> };

export type YearRow = Row<YearField>;
export type QuitterRow = Row<QuitterField>;

/** One `YYYY-YYYY` sheet: the academic year it starts in (2025 for "2025-2026"). */
export type YearSheet = { readonly year: number; readonly sheet: string; readonly rows: readonly YearRow[] };

export type Roster = {
  /** The sheets read, in order. */
  readonly read: readonly string[];
  /** The sheets left out, each with why. */
  readonly skipped: readonly string[];
  /** The current academic year: the newest year sheet's. */
  readonly currentYear: number | null;
  /** Newest first. */
  readonly years: readonly YearSheet[];
  readonly quitters: readonly QuitterRow[];
  /** Rows with neither a first nor a last name (a template row): left out, never matched. */
  readonly namelessRows: number;
};

const YEAR_SHEET_NAME = /^(\d{4})-(\d{4})$/;
const QUITTERS_SHEET_NAME = /^quitters$/i;

/** The academic year a `YYYY-YYYY` sheet name starts in, or null when the name is no such year. */
function yearOfSheet(name: string): number | null {
  const m = YEAR_SHEET_NAME.exec(name.trim());
  return m !== null && Number(m[2]) === Number(m[1]) + 1 ? Number(m[1]) : null;
}

/** The named rows below a sheet's header; a row with no name is counted and left out. Null when the header is not found. */
function rowsBelow<F extends string>(sheet: Sheet, spec: SourceSpec<F>, nameless: { count: number }): Row<F>[] | null {
  const located = locate(sheet.rows, spec);
  if (located === null) return null;
  const fields = Object.keys(spec) as F[];
  return sheet.rows.slice(located.headerRow).flatMap((row, i): Row<F>[] => {
    const value = Object.fromEntries(fields.map((f) => [f, cell(located, row, f)])) as Record<F, string>;
    if (!fields.some((f) => value[f] !== "")) return [];
    const named: Partial<Record<string, string>> = value;
    if ((named.firstName ?? "").trim() === "" && (named.lastName ?? "").trim() === "") {
      nameless.count++;
      return [];
    }
    return [{ at: { sheet: sheet.name, row: located.headerRow + i + 1 }, value }];
  });
}

/** The roster the sheets of one workbook give. */
export function rosterOf(sheets: readonly Sheet[]): Roster {
  const read: string[] = [];
  const skipped: string[] = [];
  const years: YearSheet[] = [];
  let quitters: QuitterRow[] = [];
  const nameless = { count: 0 };
  const yearOfEach = sheets.flatMap((s) => {
    const y = yearOfSheet(s.name);
    return y === null ? [] : [y];
  });
  const currentYear = yearOfEach.length === 0 ? null : Math.max(...yearOfEach);
  for (const sheet of sheets) {
    const year = yearOfSheet(sheet.name);
    if (year !== null) {
      const rows = rowsBelow(sheet, YEAR_SHEET, nameless);
      if (rows === null) {
        skipped.push(`${sheet.name}: no header found`);
        continue;
      }
      read.push(sheet.name);
      years.push({ year, sheet: sheet.name, rows });
    } else if (QUITTERS_SHEET_NAME.test(sheet.name.trim())) {
      const rows = rowsBelow(sheet, QUITTERS_SHEET, nameless);
      if (rows === null) {
        skipped.push(`${sheet.name}: no header found`);
        continue;
      }
      read.push(sheet.name);
      quitters = rows;
    } else {
      skipped.push(`${sheet.name}: not read`);
    }
  }
  return { read, skipped, currentYear, years: years.sort((a, b) => b.year - a.year), quitters, namelessRows: nameless.count };
}

/** Reads the one roster workbook in `directory`. Any other file there is not read. */
export function readRoster(directory: string): Roster & { readonly file: string } {
  const workbooks = readdirSync(directory)
    .filter((n) => !n.startsWith("~$") && !n.startsWith(".") && n.toLowerCase().endsWith(".xlsx"))
    .sort();
  if (workbooks.length !== 1) throw new Error(`the directory holds ${workbooks.length} .xlsx files; it needs exactly one, the roster workbook`);
  const file = workbooks[0];
  return { file, ...rosterOf(readWorkbook(readFileSync(join(directory, file)))) };
}
