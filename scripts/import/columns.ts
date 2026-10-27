// Where each field sits in a sheet or a CSV (issue #677). Columns are found by
// their header text, never by position, through one alias table per kind of
// source: the roster's headers change between years ("Team Title Official" is
// "Team Role" before 2024, "Personal Mail" was "Gmail"), and some sheets put a
// title above the header. A field with several aliases reads the first
// non-empty cell in alias order, so where a sheet has both "PRT Domain" and
// "PRT email" the domain address wins.

/** One field: the header texts it goes by, in order of preference. An alias ending in "*" matches any header that starts with it. */
type FieldSpec = { readonly aliases: readonly string[]; readonly required?: true };

export type SourceSpec<F extends string> = Readonly<Record<F, FieldSpec>>;

/** The header row, from 1, and each field's columns in alias order. */
export type Located<F extends string> = { readonly headerRow: number; readonly columns: Readonly<Record<F, readonly number[]>> };

/** How the import compares header text: case, spacing and a trailing colon do not count. */
export function headerKey(text: string): string {
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

/**
 * The header row of `rows` for `spec`: the first of the top rows that holds
 * every required field and the most fields of all; null when none does.
 */
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

// The roster workbook ---------------------------------------------------------

const PERSON_FIELDS = {
  firstName: { aliases: ["First Name", "first_name"], required: true },
  lastName: { aliases: ["Last Name", "last_name"], required: true },
  studentId: { aliases: ["St. ID", "Student ID"] },
  personalEmail: { aliases: ["Personal Mail", "Gmail", "Personal Email"] },
  studentEmail: { aliases: ["Polito Student Email", "poli email", "poli_email"] },
  phdEmail: { aliases: ["Polito PhD email"] },
  prtEmail: { aliases: ["PRT Domain @politorocketteam.it", "PRT Specific email @politorocketteam.it", "PRT email"] },
  mobile: { aliases: ["Mobile number"] },
  linkedin: { aliases: ["LinkedIn Username", "linkedin", "LinkendIn Username"] },
  discord: { aliases: ["Discord Username"] },
  subteam: { aliases: ["Subteam(s)", "Subteam"] },
  division: { aliases: ["Division"] },
  title: { aliases: ["Team Title Official", "Team Role"] },
  program: { aliases: ["Program", "Programs"] },
  origin: { aliases: ["International / Domestic student"] },
  country: { aliases: ["Country of origin"] },
  level: { aliases: ["Level (Bachelor's or Master's)*", "Degree Level", "level of study", "Level"] },
} as const satisfies SourceSpec<string>;

export type PersonField = keyof typeof PERSON_FIELDS;

/** A year sheet's fields: a person's, and the day their role that year started, which only the 2022-2023 sheet gives. */
export type YearField = PersonField | "joinedOn";

/** A `YYYY-YYYY` year sheet: its roles start on the academic year's first day. */
export const YEAR_SHEET: SourceSpec<YearField> = { ...PERSON_FIELDS, joinedOn: { aliases: [] } };

/**
 * The `2022-2023` sheet (owner decision, issue #816): its Division column is
 * headed "A", and its "Date of joining" column, where filled, is the day each
 * role that year started.
 */
const YEAR_2022_SHEET: SourceSpec<YearField> = {
  ...PERSON_FIELDS,
  division: { aliases: ["Division", "A"] },
  joinedOn: { aliases: ["Date of joining"] },
};

/** The columns of the year sheet for the academic year starting in `year`. */
export const yearSheetOf = (year: number): SourceSpec<YearField> => (year === 2022 ? YEAR_2022_SHEET : YEAR_SHEET);

/** The `Quitters` sheet: a title above the header, the day each person left and the day they joined. */
export const QUITTERS_SHEET: SourceSpec<PersonField | "leftOn" | "joinedOn"> = {
  ...PERSON_FIELDS,
  leftOn: { aliases: ["Left the Team on"] },
  joinedOn: { aliases: ["Joined the Team on"] },
};

/** A `Roles YY-YY` sheet: the year's seats with the division and group that year's own sheet lacks. */
export const ROLES_SHEET: SourceSpec<"firstName" | "lastName" | "subteam" | "division" | "title"> = {
  firstName: PERSON_FIELDS.firstName,
  lastName: PERSON_FIELDS.lastName,
  subteam: PERSON_FIELDS.subteam,
  division: PERSON_FIELDS.division,
  title: { aliases: ["Team Role", "Team Title Official"], required: true },
};

// The old Supabase exports ----------------------------------------------------

export const PEOPLE_CSV = {
  id: { aliases: ["id"], required: true },
  firstName: { aliases: ["first_name"], required: true },
  lastName: { aliases: ["last_name"], required: true },
  linkedin: { aliases: ["linkedin"] },
  user: { aliases: ["user"] },
  hasPhoto: { aliases: ["has_pp"] },
} as const satisfies SourceSpec<string>;

export const TEAM_MEMBERS_CSV = {
  id: { aliases: ["id"] },
  firstName: { aliases: ["first_name"], required: true },
  lastName: { aliases: ["last_name"], required: true },
  studentEmail: { aliases: ["poli_email"] },
  linkedin: { aliases: ["linkedin"] },
  program: { aliases: ["program"] },
  level: { aliases: ["level"] },
  origin: { aliases: ["origin"] },
} as const satisfies SourceSpec<string>;

export const SUBTEAMS_CSV = {
  id: { aliases: ["id"], required: true },
  name: { aliases: ["name"], required: true },
  code: { aliases: ["code"] },
} as const satisfies SourceSpec<string>;

export const DIVISIONS_CSV = {
  id: { aliases: ["id"], required: true },
  subteam: { aliases: ["subteam"] },
  name: { aliases: ["name"], required: true },
  code: { aliases: ["code"] },
} as const satisfies SourceSpec<string>;

export const ADVISORS_CSV = {
  id: { aliases: ["id"] },
  firstName: { aliases: ["first_name"], required: true },
  lastName: { aliases: ["last_name"], required: true },
  title: { aliases: ["title_name"], required: true },
  linkedin: { aliases: ["linkedin"] },
  hasPhoto: { aliases: ["has_pp"] },
} as const satisfies SourceSpec<string>;

export const ORDERS_CSV = {
  requester: { aliases: ["requester"], required: true },
  description: { aliases: ["description"] },
  quantity: { aliases: ["quantity"] },
  price: { aliases: ["price"] },
  status: { aliases: ["status"], required: true },
  reason: { aliases: ["reason"] },
  createdAt: { aliases: ["createdAt", "created_at"] },
  name: { aliases: ["name"] },
  quoteName: { aliases: ["quoteName", "quote_name"] },
} as const satisfies SourceSpec<string>;

// The import's own override input (issue #816) ---------------------------------

/**
 * `overrides.csv`: one line per owner decision the workbook cannot carry. `kind` says which:
 * `handover` (row `row` of `sheet` handed its seat over to row `value` within the current year) or
 * `quitter-year` (Quitters row `row` is an alumnus of academic year `value`, "YYYY-YYYY").
 */
export const OVERRIDES_CSV = {
  kind: { aliases: ["kind"], required: true },
  sheet: { aliases: ["sheet"], required: true },
  row: { aliases: ["row"], required: true },
  value: { aliases: ["value"], required: true },
} as const satisfies SourceSpec<string>;

export const FAQS_CSV = {
  question: { aliases: ["question"], required: true },
  answer: { aliases: ["answer"], required: true },
  visible: { aliases: ["visible"] },
} as const satisfies SourceSpec<string>;
