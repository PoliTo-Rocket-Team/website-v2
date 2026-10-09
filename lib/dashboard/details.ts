import { z } from "zod";
import {
  DEGREE_PROGRAMMES,
  formDefaults,
  STUDY_PROGRAMMES,
  type FormDefaults,
} from "@/lib/apply/application-form";
import { normalizeLinkedin } from "./self";

// "Your details" (boards 51 and 55, issue #169): what a person keeps about
// themselves for their applications. My account shows all of them; My profile
// shows the ones its Details card does not (name and LinkedIn are there). The
// apply form at /apply/<slug> starts from them (`applyFormDefaults`).

export type DegreeProgramme = (typeof DEGREE_PROGRAMMES)[number];
export type StudyProgramme = (typeof STUDY_PROGRAMMES)[number];

/** Every field may be empty (""); a filled one is valid. */
export type YourDetails = {
  readonly firstName: string;
  readonly lastName: string;
  /** "+39 333 123 4567" */
  readonly phone: string;
  /** The digits of the PoliTo student number; the page shows "s312456". */
  readonly politoId: string;
  readonly programme: DegreeProgramme | "";
  readonly level: StudyProgramme | "";
  readonly country: string;
  /** ISO date, "2003-03-14". */
  readonly birthDate: string;
  /** The short form, "linkedin.com/in/giuliarossi"; "" when none. */
  readonly linkedin: string;
};

export const NO_DETAILS: YourDetails = {
  firstName: "",
  lastName: "",
  phone: "",
  politoId: "",
  programme: "",
  level: "",
  country: "",
  birthDate: "",
  linkedin: "",
};

export type DetailKey = keyof YourDetails;

/** The fields in the order the boards show them, with their labels. */
export const DETAIL_FIELDS: readonly { readonly key: DetailKey; readonly label: string }[] = [
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "phone", label: "Phone" },
  { key: "politoId", label: "PoliTo ID" },
  { key: "programme", label: "Programme" },
  { key: "level", label: "Level of study" },
  { key: "country", label: "Country" },
  { key: "birthDate", label: "Birth date" },
  { key: "linkedin", label: "LinkedIn" },
];

/** The fields My profile's "Your details" shows (board 55): its Details card has the name and LinkedIn. */
const MEMBER_DETAIL_KEYS: readonly DetailKey[] = ["politoId", "programme", "level", "phone", "country", "birthDate"];

/** Every field, for My account (board 51). */
const ACCOUNT_DETAIL_KEYS: readonly DetailKey[] = DETAIL_FIELDS.map((f) => f.key);

/**
 * Who saves "Your details": an applicant on My account, or a team member on
 * My profile. It decides which fields the save may write.
 */
export type DetailsEditor = "applicant" | "member";

/**
 * The fields each editor's "Your details" writes. A member's name is set by
 * their lead and their LinkedIn by the Details card, so their save never
 * touches either.
 */
export function editableDetailKeys(editor: DetailsEditor): readonly DetailKey[] {
  return editor === "member" ? MEMBER_DETAIL_KEYS : ACCOUNT_DETAIL_KEYS;
}

/** A save of "Your details": only the fields the editor may write, each checked. */
export type DetailsChange = Partial<YourDetails>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "Year 1 Master's" reads "Master's · year 1"; "PhD" stays. */
export function levelLabel(level: StudyProgramme): string {
  const match = /^Year ([0-9]) (.+)$/.exec(level);
  return match ? `${match[2]} · year ${match[1]}` : level;
}

/** A field as the page shows it; null for an empty one. */
export function detailText(details: YourDetails, key: DetailKey): string | null {
  const value = details[key];
  if (value === "") return null;
  switch (key) {
    case "politoId":
      return `s${value}`;
    case "level":
      return levelLabel(value as StudyProgramme);
    case "birthDate": {
      const [y, m, d] = value.split("-").map(Number);
      return `${d} ${MONTHS[m - 1]} ${y}`;
    }
    default:
      return value;
  }
}

function isPastDate(iso: string): boolean {
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 1900 && date.getTime() < Date.now();
}

/** Empty, or the rule the apply form checks the same field with (lib/apply/application-form.ts). */
const optional = <T extends z.ZodType<string>>(rule: T) => z.union([z.literal(""), rule]);

const detailsSchema = z.object({
  firstName: z.string().trim().max(100, "Too long."),
  lastName: z.string().trim().max(100, "Too long."),
  phone: z.string().trim().pipe(optional(z.string().regex(/^\+[0-9][0-9 ]{5,18}[0-9]$/, "Start with + and the country code."))),
  politoId: z
    .string()
    .trim()
    .transform((s) => s.replace(/^s/i, ""))
    .pipe(optional(z.string().regex(/^[0-9]{1,10}$/, "Numbers only, like s312456."))),
  programme: z.union([z.literal(""), z.enum(DEGREE_PROGRAMMES, "Pick one.")]),
  level: z.union([z.literal(""), z.enum(STUDY_PROGRAMMES, "Pick one.")]),
  country: z.string().trim().max(60, "Too long."),
  birthDate: z.string().trim().pipe(optional(z.iso.date("Pick a date.").refine(isPastDate, "Pick a date in the past."))),
  linkedin: z.string(),
});

export type DetailErrors = Partial<Record<DetailKey, string>>;

/** One message per bad field: the first the check found. */
function errorsOf(error: z.ZodError): DetailErrors {
  const errors: DetailErrors = {};
  for (const issue of error.issues) errors[issue.path[0] as DetailKey] ??= issue.message;
  return errors;
}

/**
 * The details as the edit form sent them, checked: the clean values, or one
 * message per bad field. The browser and the server run the same check.
 */
export function parseDetails(input: unknown): { ok: true; value: YourDetails } | { ok: false; errors: DetailErrors } {
  const result = detailsSchema.safeParse(input);
  if (!result.success) return { ok: false, errors: errorsOf(result.error) };
  const linkedin = normalizeLinkedin(result.data.linkedin);
  if (!linkedin.ok) return { ok: false, errors: { linkedin: linkedin.error } };
  return { ok: true, value: { ...result.data, linkedin: linkedin.value ?? "" } };
}

/**
 * A save of "Your details" as the edit form sent it, checked: only the
 * fields `editor` may write are read, so anything else sent is dropped
 * before it reaches a column. The browser and the server run the same check.
 */
export function parseDetailsChange(
  input: unknown,
  editor: DetailsEditor,
): { ok: true; value: DetailsChange } | { ok: false; errors: DetailErrors } {
  const keys = editableDetailKeys(editor);
  const picked: Record<string, unknown> = {};
  const sent = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  for (const key of keys) picked[key] = sent[key];
  const result = detailsSchema.pick(Object.fromEntries(keys.map((k) => [k, true] as const))).safeParse(picked);
  if (!result.success) return { ok: false, errors: errorsOf(result.error) };
  const change: DetailsChange = result.data;
  if (change.linkedin === undefined) return { ok: true, value: change };
  const linkedin = normalizeLinkedin(change.linkedin);
  if (!linkedin.ok) return { ok: false, errors: { linkedin: linkedin.error } };
  return { ok: true, value: { ...change, linkedin: linkedin.value ?? "" } };
}

/** The details after a save: the changed fields as sent, every other as it was. */
export function applyDetailsChange(current: YourDetails, change: DetailsChange): YourDetails {
  return { ...current, ...change };
}

/** The first message of a failed check, for a toast. */
export function firstDetailError(errors: DetailErrors): string {
  return Object.values(errors)[0] ?? "Check the form.";
}

/** The `users` columns the details live in. */
export type DetailColumns = {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  politoId: string | null;
  program: string | null;
  levelOfStudy: string | null;
  country: string | null;
  dateOfBirth: string | null;
  linkedin: string | null;
};

function oneOf<T extends string>(options: readonly T[], value: string | null): T | "" {
  return options.find((o) => o === value) ?? "";
}

/** The details a `users` row holds; a stored value that is no longer an option reads empty. */
export function detailsFromColumns(row: DetailColumns): YourDetails {
  const linkedin = row.linkedin === null ? null : normalizeLinkedin(row.linkedin);
  return {
    firstName: row.firstName ?? "",
    lastName: row.lastName ?? "",
    phone: row.phone ?? "",
    politoId: row.politoId ?? "",
    programme: oneOf(DEGREE_PROGRAMMES, row.program),
    level: oneOf(STUDY_PROGRAMMES, row.levelOfStudy),
    country: row.country ?? "",
    birthDate: row.dateOfBirth ?? "",
    linkedin: linkedin?.ok ? (linkedin.value ?? "") : "",
  };
}

/** The column each detail lives in. */
const COLUMN_OF: Readonly<Record<DetailKey, keyof DetailColumns>> = {
  firstName: "firstName",
  lastName: "lastName",
  phone: "phone",
  politoId: "politoId",
  programme: "program",
  level: "levelOfStudy",
  country: "country",
  birthDate: "dateOfBirth",
  linkedin: "linkedin",
};

/**
 * The `users` columns a save writes: one per field in the change and no
 * other, so a column the change does not name keeps its value. An empty
 * field clears its column.
 */
export function columnsFromDetails(change: DetailsChange): Partial<DetailColumns> {
  const columns: Partial<DetailColumns> = {};
  for (const [key, value] of Object.entries(change) as [DetailKey, string | undefined][]) {
    if (value === undefined) continue;
    columns[COLUMN_OF[key]] = value === "" ? null : key === "linkedin" ? `https://www.${value}` : value;
  }
  return columns;
}

/** What the apply form keeps that "Your details" does not. */
export type ApplyOnlyFields = Pick<FormDefaults, "gender" | "origin" | "referral">;

/**
 * The apply form's starting values from saved details: each field the form
 * shares with "Your details" starts as saved. Country and LinkedIn are not on
 * the form.
 */
export function applyFormDefaults(details: YourDetails, rest: ApplyOnlyFields = { gender: "", origin: "", referral: "" }): FormDefaults {
  return formDefaults({
    firstName: details.firstName,
    lastName: details.lastName,
    politoId: details.politoId,
    phone: details.phone,
    dateOfBirth: details.birthDate,
    studyProgramme: details.level,
    degreeProgramme: details.programme,
    gender: rest.gender,
    origin: rest.origin,
    referral: rest.referral,
  });
}
