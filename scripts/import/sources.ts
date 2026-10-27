import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ADVISORS_CSV,
  cell,
  DIVISIONS_CSV,
  FAQS_CSV,
  locate,
  ORDERS_CSV,
  OVERRIDES_CSV,
  PEOPLE_CSV,
  QUITTERS_SHEET,
  ROLES_SHEET,
  SUBTEAMS_CSV,
  TEAM_MEMBERS_CSV,
  yearSheetOf,
  type PersonField,
  type SourceSpec,
  type YearField,
} from "./columns";
import { parseCsv } from "./csv";
import type { Conflict, At } from "./conflicts";
import { excelDay, readWorkbook, type Sheet } from "./xlsx";

// Reads the source directory (issue #677): the roster workbook, the source of
// truth, and the old Supabase CSV exports. Every file is read from the
// directory given at run time; any of them may be missing. Each row keeps
// where it came from (file, sheet, row) so the report can point at it without
// printing what it holds.

export const CSV_FILES = {
  people: "people_rows.csv",
  teamMembers: "team_members_rows.csv",
  subteams: "subteams_rows.csv",
  divisions: "divisions_rows.csv",
  advisors: "advisors_rows.csv",
  orders: "orders_rows.csv",
  faqs: "faqs_rows.csv",
  overrides: "overrides.csv",
} as const;

type CsvName = keyof typeof CSV_FILES;

/**
 * The exports a run leaves out whatever they hold (owner decision, issue
 * #820): the old open positions, since recruitment creates new ones. A file
 * here is listed as left out when the directory has it, and never read.
 */
const UNREAD_CSV_FILES: Readonly<Record<string, string>> = {
  "positions_rows.csv": "not imported (owner decision); recruitment creates new positions",
};

/** One located row: where it sits and each field's value ("" when the source has none). */
export type Row<F extends string> = { readonly at: At; readonly value: Readonly<Record<F, string>> };

/** A year sheet's row. Its `joinedOn` is "" on every sheet but 2022-2023's. */
export type PersonRow = Row<YearField>;

/** One `YYYY-YYYY` sheet: the academic year it starts in (2025 for "2025-2026"). */
export type YearSheet = { readonly year: number; readonly sheet: string; readonly rows: readonly PersonRow[] };

export type QuitterRow = Row<PersonField | "leftOn" | "joinedOn">;

export type RolesSheet = { readonly year: number; readonly sheet: string; readonly rows: readonly Row<"firstName" | "lastName" | "subteam" | "division" | "title">[] };

export type Sources = {
  /** The files and sheets read, in order. */
  readonly read: readonly string[];
  /** The files and sheets left out, each with why. */
  readonly skipped: readonly string[];
  /** The current academic year: the newest year sheet's, or the one the run named. */
  readonly currentYear: number | null;
  /** Newest first; none newer than the current year. */
  readonly years: readonly YearSheet[];
  readonly quitters: readonly QuitterRow[];
  readonly rolesSheets: readonly RolesSheet[];
  /** Rows of the year, Quitters and Roles sheets with neither a first nor a last name (a template row of email placeholders): left out, never matched. */
  readonly namelessRows: number;
  readonly csv: {
    readonly people: readonly Row<keyof typeof PEOPLE_CSV>[];
    readonly teamMembers: readonly Row<keyof typeof TEAM_MEMBERS_CSV>[];
    readonly subteams: readonly Row<keyof typeof SUBTEAMS_CSV>[];
    readonly divisions: readonly Row<keyof typeof DIVISIONS_CSV>[];
    readonly advisors: readonly Row<keyof typeof ADVISORS_CSV>[];
    readonly orders: readonly Row<keyof typeof ORDERS_CSV>[];
    readonly faqs: readonly Row<keyof typeof FAQS_CSV>[];
    /** The import's override input, not an export: seats handed over this year, and Quitters rows given an academic year. */
    readonly overrides: readonly Row<keyof typeof OVERRIDES_CSV>[];
  };
  /** Sheets and files whose header could not be found. */
  readonly conflicts: readonly Conflict[];
};

const YEAR_SHEET_NAME = /^(\d{4})-(\d{4})$/;
const ROLES_SHEET_NAME = /^roles (\d{2})-(\d{2})$/i;
const QUITTERS_SHEET_NAME = /^quitters$/i;

/** The academic years whose `Roles YY-YY` sheet is not read at all (owner decision, issue #816): `Roles 22-23`. */
const UNREAD_ROLES_YEARS: ReadonlySet<number> = new Set([2022]);

/** The academic year a `YYYY-YYYY` name starts in, or null when the name is no such year. */
export function yearOfSheet(name: string): number | null {
  const m = YEAR_SHEET_NAME.exec(name.trim());
  return m !== null && Number(m[2]) === Number(m[1]) + 1 ? Number(m[1]) : null;
}

function rolesYearOf(name: string): number | null {
  const m = ROLES_SHEET_NAME.exec(name.trim());
  return m !== null && (Number(m[2]) - Number(m[1]) + 100) % 100 === 1 ? 2000 + Number(m[1]) : null;
}

/** The located rows below a header; a row with every field empty is left out. */
function rowsBelow<F extends string>(
  rows: readonly (readonly string[])[],
  spec: SourceSpec<F>,
  where: { file: string; sheet?: string },
  conflicts: Conflict[],
  rowNumber: (index: number) => number = (i) => i + 1,
): Row<F>[] | null {
  const located = locate(rows, spec);
  if (located === null) {
    conflicts.push({ kind: "no-header", at: { ...where, row: 1 } });
    return null;
  }
  const fields = Object.keys(spec) as F[];
  return rows.slice(located.headerRow).flatMap((row, i): Row<F>[] => {
    const value = Object.fromEntries(fields.map((f) => [f, cell(located, row, f)])) as Record<F, string>;
    return fields.some((f) => value[f] !== "") ? [{ at: { ...where, row: rowNumber(located.headerRow + i) }, value }] : [];
  });
}

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
export type DateCell = { readonly day: string; readonly serial: boolean };

/**
 * A day the sheet gives as a date cell (an Excel day serial) or as text:
 * "2024-06-30", "30/06/2024", "3/6/2024" or "30.06.2024", day first. Null
 * when it is none of these, or no real day in the roster's years.
 */
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

/** The day a cell gives, whatever its form (see `dateCellOf`). */
export function dayOf(text: string): string | null {
  return dateCellOf(text)?.day ?? null;
}

/**
 * A day with its day and month swapped: the day a date cell meant when the
 * spreadsheet stored a day/month date as month/day (issue #818). Null when the
 * day is over 12 (no month), or equals the month (the swap changes nothing).
 */
export function dayMonthSwapped(day: string): string | null {
  const [year, month, date] = day.split("-").map(Number);
  return date > 12 || date === month ? null : realDay(year, date, month);
}

/** Leaves out the rows of a person sheet that carry neither a first nor a last name, and counts them. */
function named<R extends Row<"firstName" | "lastName">>(rows: readonly R[], nameless: { count: number }): R[] {
  return rows.filter((r) => {
    const keep = r.value.firstName.trim() !== "" || r.value.lastName.trim() !== "";
    if (!keep) nameless.count++;
    return keep;
  });
}

/** Reads every source in `directory`. `year` names the current academic year's sheet; by default it is the newest. */
export function readSources(directory: string, year?: number): Sources {
  const read: string[] = [];
  const skipped: string[] = [];
  const conflicts: Conflict[] = [];
  const names = readdirSync(directory).filter((n) => !n.startsWith("~$") && !n.startsWith("."));
  const workbooks = names.filter((n) => n.toLowerCase().endsWith(".xlsx")).sort();
  if (workbooks.length > 1) throw new Error(`the directory holds ${workbooks.length} .xlsx files; leave only the roster workbook in it`);

  let years: YearSheet[] = [];
  let quitters: QuitterRow[] = [];
  const rolesSheets: RolesSheet[] = [];
  let currentYear: number | null = null;
  const nameless = { count: 0 };

  const file = workbooks[0];
  if (file === undefined) {
    skipped.push("roster workbook (.xlsx): not found");
  } else {
    read.push(file);
    const sheets: Sheet[] = readWorkbook(readFileSync(join(directory, file)));
    const yearSheets = sheets.flatMap((s) => {
      const y = yearOfSheet(s.name);
      return y === null ? [] : [{ y, s }];
    });
    const newest = Math.max(...yearSheets.map((x) => x.y));
    if (year !== undefined && !yearSheets.some((x) => x.y === year)) throw new Error(`the workbook has no ${year}-${year + 1} sheet`);
    currentYear = year ?? (yearSheets.length > 0 ? newest : null);
    for (const sheet of sheets) {
      const where = { file, sheet: sheet.name };
      const y = yearOfSheet(sheet.name);
      const rolesYear = rolesYearOf(sheet.name);
      if (y !== null) {
        if (currentYear !== null && y > currentYear) {
          skipped.push(`${file} › ${sheet.name}: newer than the current year`);
          continue;
        }
        const rows = rowsBelow(sheet.rows, yearSheetOf(y), where, conflicts);
        if (rows === null) continue;
        read.push(`${file} › ${sheet.name}`);
        years.push({ year: y, sheet: sheet.name, rows: named(rows, nameless) });
      } else if (QUITTERS_SHEET_NAME.test(sheet.name.trim())) {
        const rows = rowsBelow(sheet.rows, QUITTERS_SHEET, where, conflicts);
        if (rows === null) continue;
        read.push(`${file} › ${sheet.name}`);
        quitters = named(rows, nameless);
      } else if (rolesYear !== null && UNREAD_ROLES_YEARS.has(rolesYear)) {
        skipped.push(`${file} › ${sheet.name}: not read (owner decision); that year's own sheet is its only source`);
      } else if (rolesYear !== null) {
        const rows = rowsBelow(sheet.rows, ROLES_SHEET, where, conflicts);
        if (rows === null) continue;
        read.push(`${file} › ${sheet.name}`);
        rolesSheets.push({ year: rolesYear, sheet: sheet.name, rows: named(rows, nameless) });
      } else {
        skipped.push(`${file} › ${sheet.name}: not imported`);
      }
    }
    years = years.sort((a, b) => b.year - a.year);
  }

  const csv = <N extends CsvName, F extends string>(name: N, spec: SourceSpec<F>): Row<F>[] => {
    const fileName = CSV_FILES[name];
    const path = join(directory, fileName);
    if (!existsSync(path)) {
      skipped.push(`${fileName}: not found`);
      return [];
    }
    const records = parseCsv(readFileSync(path, "utf8"));
    const rows = rowsBelow(
      records.map((r) => r.cells),
      spec,
      { file: fileName },
      conflicts,
      (i) => records[i]?.line ?? i + 1,
    );
    if (rows === null) return [];
    read.push(fileName);
    return rows;
  };
  const csvRows = {
    people: csv("people", PEOPLE_CSV),
    teamMembers: csv("teamMembers", TEAM_MEMBERS_CSV),
    subteams: csv("subteams", SUBTEAMS_CSV),
    divisions: csv("divisions", DIVISIONS_CSV),
    advisors: csv("advisors", ADVISORS_CSV),
    orders: csv("orders", ORDERS_CSV),
    faqs: csv("faqs", FAQS_CSV),
    overrides: csv("overrides", OVERRIDES_CSV),
  };
  for (const [fileName, why] of Object.entries(UNREAD_CSV_FILES)) if (names.includes(fileName)) skipped.push(`${fileName}: ${why}`);

  return {
    read,
    skipped,
    currentYear,
    years,
    quitters,
    rolesSheets,
    namelessRows: nameless.count,
    csv: csvRows,
    conflicts,
  };
}
