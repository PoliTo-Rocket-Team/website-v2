import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readWorkbook, type Sheet } from "./xlsx";

// Reads the roster workbook's "Joined the Team on" column (issue #948). Every
// sheet whose header names that column is read, whatever the sheet is called:
// the import read it on the `Quitters` sheet, and any other sheet that carries
// it is read the same way. A row gives the person's emails, the day they
// joined, and the day they left when the sheet has that column too (it only
// decides which date cell was stored month/day). Columns are found by their
// header text, never by position, as the import found them
// (scripts/import/columns.ts, removed by PR #847). The workbook stays outside
// the repo: it is read from the directory the run names. Each row keeps its
// sheet and row number so the report can point at it without printing what it
// holds.

/** One field: the header texts it goes by, in order of preference. */
type FieldSpec = { readonly aliases: readonly string[]; readonly required?: true };

const JOIN_SHEET = {
  firstName: { aliases: ["First Name", "first_name"], required: true },
  lastName: { aliases: ["Last Name", "last_name"], required: true },
  personalEmail: { aliases: ["Personal Mail", "Gmail", "Personal Email"] },
  studentEmail: { aliases: ["Polito Student Email", "poli email", "poli_email"] },
  phdEmail: { aliases: ["Polito PhD email"] },
  prtEmail: { aliases: ["PRT Domain @politorocketteam.it", "PRT Specific email @politorocketteam.it", "PRT email"] },
  joinedOn: { aliases: ["Joined the Team on"], required: true },
  leftOn: { aliases: ["Left the Team on"] },
} as const satisfies Readonly<Record<string, FieldSpec>>;

export type JoinField = keyof typeof JOIN_SHEET;

/** The email fields of a row, in the order a person's address is read. */
export const EMAIL_FIELDS = ["personalEmail", "studentEmail", "phdEmail", "prtEmail"] as const satisfies readonly JoinField[];

/** Where a row sits: its sheet, and its row number on that sheet (from 1). */
export type At = { readonly sheet: string; readonly row: number };

/** One located row: where it sits and each field's value ("" when the sheet has none). */
export type JoinRow = { readonly at: At; readonly value: Readonly<Record<JoinField, string>> };

export type Roster = {
  /** The sheets read: those whose header names "Joined the Team on". */
  readonly read: readonly string[];
  /** The sheets left out. */
  readonly skipped: readonly string[];
  readonly rows: readonly JoinRow[];
  /** Rows with neither a first nor a last name (a template row): left out. */
  readonly namelessRows: number;
};

/** How header text is compared: case, spacing and a trailing colon do not count. */
function headerKey(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().replace(/\s*:$/, "");
}

/** How many rows from the top the header is looked for in. */
const HEADER_SEARCH_ROWS = 15;

type Located = { readonly headerRow: number; readonly columns: Readonly<Record<JoinField, readonly number[]>> };

const FIELDS = Object.keys(JOIN_SHEET) as JoinField[];

/** The header row: the first of the top rows that holds every required field and the most fields of all; null when none does. */
function locate(rows: readonly (readonly string[])[]): Located | null {
  let best: Located | null = null;
  let bestCount = 0;
  rows.slice(0, HEADER_SEARCH_ROWS).forEach((row, i) => {
    const keys = row.map(headerKey);
    const columns = Object.fromEntries(
      FIELDS.map((f) => [f, JOIN_SHEET[f].aliases.flatMap((alias) => keys.flatMap((k, c) => (k !== "" && k === headerKey(alias) ? [c] : [])))]),
    ) as Record<JoinField, number[]>;
    if (!FIELDS.every((f) => !("required" in JOIN_SHEET[f]) || columns[f].length > 0)) return;
    const count = FIELDS.filter((f) => columns[f].length > 0).length;
    if (count > bestCount) {
      best = { headerRow: i + 1, columns };
      bestCount = count;
    }
  });
  return best;
}

/** The field's value on one row: its first non-empty cell in alias order, trimmed; "" when none. */
function cell(located: Located, row: readonly string[], field: JoinField): string {
  for (const column of located.columns[field]) {
    const value = (row[column] ?? "").trim();
    if (value !== "") return value;
  }
  return "";
}

/** The roster the sheets of one workbook give: every named row of every sheet with a "Joined the Team on" column. */
export function rosterOf(sheets: readonly Sheet[]): Roster {
  const read: string[] = [];
  const skipped: string[] = [];
  const rows: JoinRow[] = [];
  let namelessRows = 0;
  for (const sheet of sheets) {
    const located = locate(sheet.rows);
    if (located === null) {
      skipped.push(`${sheet.name}: no "Joined the Team on" column`);
      continue;
    }
    read.push(sheet.name);
    sheet.rows.slice(located.headerRow).forEach((row, i) => {
      const value = Object.fromEntries(FIELDS.map((f) => [f, cell(located, row, f)])) as Record<JoinField, string>;
      if (!FIELDS.some((f) => value[f] !== "")) return;
      if (value.firstName === "" && value.lastName === "") {
        namelessRows++;
        return;
      }
      rows.push({ at: { sheet: sheet.name, row: located.headerRow + i + 1 }, value });
    });
  }
  return { read, skipped, rows, namelessRows };
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
