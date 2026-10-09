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
export const MEMBER_DETAIL_KEYS: readonly DetailKey[] = ["politoId", "programme", "level", "phone", "country", "birthDate"];

/** Every field, for My account (board 51). */
export const ACCOUNT_DETAIL_KEYS: readonly DetailKey[] = DETAIL_FIELDS.map((f) => f.key);

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

/**
 * The details as the edit form sent them, checked: the clean values, or one
 * message per bad field. The browser and the server run the same check.
 */
export function parseDetails(input: unknown): { ok: true; value: YourDetails } | { ok: false; errors: DetailErrors } {
  const result = detailsSchema.safeParse(input);
  const errors: DetailErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as DetailKey;
      errors[key] ??= issue.message;
    }
    return { ok: false, errors };
  }
  const linkedin = normalizeLinkedin(result.data.linkedin);
  if (!linkedin.ok) return { ok: false, errors: { linkedin: linkedin.error } };
  return { ok: true, value: { ...result.data, linkedin: linkedin.value ?? "" } };
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

/** The `users` columns to write for saved details; an empty field clears its column. */
export function columnsFromDetails(details: YourDetails): DetailColumns {
  const orNull = (s: string) => (s === "" ? null : s);
  return {
    firstName: orNull(details.firstName),
    lastName: orNull(details.lastName),
    phone: orNull(details.phone),
    politoId: orNull(details.politoId),
    program: orNull(details.programme),
    levelOfStudy: orNull(details.level),
    country: orNull(details.country),
    dateOfBirth: orNull(details.birthDate),
    linkedin: details.linkedin === "" ? null : `https://www.${details.linkedin}`,
  };
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
