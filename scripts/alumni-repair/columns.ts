// Where each field sits in a roster sheet, trimmed from the removed import
// tool (scripts/import, issue #677) to the fields this repair reads. Columns
// are found by their header text, never by position: the roster's headers
// change between years, and some sheets put a title above the header. A field
// with several aliases reads the first non-empty cell in alias order.

/** One field: the header texts it goes by, in order of preference. An alias ending in "*" matches any header that starts with it. */
type FieldSpec = { readonly aliases: readonly string[]; readonly required?: true };

export type SourceSpec<F extends string> = Readonly<Record<F, FieldSpec>>;

/** The header row, from 1, and each field's columns in alias order. */
type Located<F extends string> = { readonly headerRow: number; readonly columns: Readonly<Record<F, readonly number[]>> };

/** How header text is compared: case, spacing and a trailing colon do not count. */
function headerKey(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim().replace(/\s*:$/, "");
}

function matches(alias: string, header: string): boolean {
  const a = headerKey(alias);
  return a.endsWith("*") ? header.startsWith(a.slice(0, -1)) : header === a;
}

function columnsIn<F extends string>(header: readonly string[], spec: SourceSpec<F>): Record<F, number[]> {
  const keys = header.map(headerKey);
  const out = {} as Record<F, number[]>;
  for (const field of Object.keys(spec) as F[]) {
    out[field] = spec[field].aliases.flatMap((alias) => keys.flatMap((k, i) => (k !== "" && matches(alias, k) ? [i] : [])));
  }
  return out;
}

/** How many rows from the top the header is looked for in. */
const HEADER_SEARCH_ROWS = 15;

/** The header row of `rows` for `spec`: the first of the top rows that holds every required field and the most fields of all; null when none does. */
export function locate<F extends string>(rows: readonly (readonly string[])[], spec: SourceSpec<F>): Located<F> | null {
  const required = (Object.keys(spec) as F[]).filter((f) => spec[f].required);
  let best: Located<F> | null = null;
  let bestCount = 0;
  rows.slice(0, HEADER_SEARCH_ROWS).forEach((row, i) => {
    const columns = columnsIn(row, spec);
    if (!required.every((f) => columns[f].length > 0)) return;
    const count = (Object.keys(columns) as F[]).filter((f) => columns[f].length > 0).length;
    if (count > bestCount) {
      best = { headerRow: i + 1, columns };
      bestCount = count;
    }
  });
  return best;
}

/** The field's value on one row: its first non-empty cell in alias order, trimmed; "" when none. */
export function cell<F extends string>(located: Located<F>, row: readonly string[], field: F): string {
  for (const column of located.columns[field]) {
    const value = (row[column] ?? "").trim();
    if (value !== "") return value;
  }
  return "";
}

/** A person's fields on a year sheet: who they are, by name and emails. */
export const YEAR_SHEET = {
  firstName: { aliases: ["First Name", "first_name"], required: true },
  lastName: { aliases: ["Last Name", "last_name"], required: true },
  personalEmail: { aliases: ["Personal Mail", "Gmail", "Personal Email"] },
  studentEmail: { aliases: ["Polito Student Email", "poli email", "poli_email"] },
  phdEmail: { aliases: ["Polito PhD email"] },
  prtEmail: { aliases: ["PRT Domain @politorocketteam.it", "PRT Specific email @politorocketteam.it", "PRT email"] },
} as const satisfies SourceSpec<string>;

export type YearField = keyof typeof YEAR_SHEET;

/** The `Quitters` sheet: a person, their units and title, the day they left and the day they joined. */
export const QUITTERS_SHEET = {
  ...YEAR_SHEET,
  subteam: { aliases: ["Subteam(s)", "Subteam"] },
  division: { aliases: ["Division"] },
  title: { aliases: ["Team Title Official", "Team Role"] },
  leftOn: { aliases: ["Left the Team on"] },
  joinedOn: { aliases: ["Joined the Team on"] },
} as const satisfies SourceSpec<string>;

export type QuitterField = keyof typeof QUITTERS_SHEET;

/** The email fields of a row, in the order a person's address is read. */
export const EMAIL_FIELDS = ["personalEmail", "studentEmail", "phdEmail", "prtEmail"] as const satisfies readonly YearField[];
