import { z } from "zod";
import {
  DEGREE_PROGRAMMES,
  formDefaults,
  GENDERS,
  STUDY_PROGRAMMES,
  type FormDefaults,
} from "@/lib/apply/application-form";
import { nameRule, namesThemselves } from "./person-name";
import { normalizeLinkedin } from "./self";
import { isOffTeam, type ViewerKind } from "./viewer";

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

/** A lead's on My profile: their own name first, then a member's fields (issue #668). */
const LEAD_DETAIL_KEYS: readonly DetailKey[] = ["firstName", "lastName", ...MEMBER_DETAIL_KEYS];

/** Every field, for My account (board 51). */
const ACCOUNT_DETAIL_KEYS: readonly DetailKey[] = DETAIL_FIELDS.map((f) => f.key);

/**
 * Who saves "Your details": an applicant on My account, or someone on the
 * team on My profile, who is a `lead` when they rename themselves
 * (`namesThemselves`, issue #668) and a `member` when their lead sets their
 * name. It decides which fields the save may write.
 */
export type DetailsEditor = "applicant" | "member" | "lead";

/** The editor of a viewer's own "Your details", from their kind alone: the server decides it, never the form. */
export function detailsEditorOf(kind: ViewerKind): DetailsEditor {
  if (isOffTeam(kind)) return "applicant";
  return namesThemselves(kind) ? "lead" : "member";
}

/**
 * The fields each editor's "Your details" writes. A member's name is set by
 * their lead, and anyone's LinkedIn on the team by the Details card, so a
 * member's save never touches either, and a lead's only their name.
 */
export function editableDetailKeys(editor: DetailsEditor): readonly DetailKey[] {
  return editor === "member" ? MEMBER_DETAIL_KEYS : editor === "lead" ? LEAD_DETAIL_KEYS : ACCOUNT_DETAIL_KEYS;
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

const PHONE = /^\+[0-9][0-9 ]{5,18}[0-9]$/;

/**
 * A phone as a details form sends it, checked against `opened`, the phone the
 * form opened with (issue #887). Sent back unchanged, it is kept whatever its
 * format: phones imported from the old roster often have no country code, and
 * a save that leaves the phone alone must not fail on it. A changed phone is
 * empty or starts with + and the country code. A form that opened empty
 * passes "".
 */
function phoneRule(opened: string) {
  const kept = opened.trim();
  return z
    .string()
    .trim()
    .refine((phone) => phone === "" || phone === kept || PHONE.test(phone), "Start with + and the country code.");
}

const detailsSchema = z.object({
  firstName: z.string().trim().max(100, "Too long."),
  lastName: z.string().trim().max(100, "Too long."),
  phone: phoneRule(""),
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

/** A lead's own name on My profile (issue #668). */
const OWN_NAME = { firstName: nameRule("Enter your first name."), lastName: nameRule("Enter your last name.") };

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
 * `openedPhone` is the phone the form opened with: the browser's own, the
 * server's the stored `users.phone`, never one the form sends.
 */
export function parseDetailsChange(
  input: unknown,
  editor: DetailsEditor,
  openedPhone: string,
): { ok: true; value: DetailsChange } | { ok: false; errors: DetailErrors } {
  const keys = editableDetailKeys(editor);
  const picked: Record<string, unknown> = {};
  const sent = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  for (const key of keys) picked[key] = sent[key];
  const schema = detailsSchema.extend({ phone: phoneRule(openedPhone) }).pick(Object.fromEntries(keys.map((k) => [k, true] as const)));
  // An applicant's name may wait for the apply form; a lead's is on the Team page, so it is never blank.
  const result = (editor === "lead" ? schema.extend(OWN_NAME) : schema).safeParse(picked);
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

// A member's details as a lead or head keeps them on the Members page (issue
// #231, boards 61f, 61g and 61h2): contact, studies and personal. A lead or a
// head fills them, or the person does after they sign in with the email they
// were added with (Owner decision, 2026-10-11). Every field may be empty.

export type Gender = (typeof GENDERS)[number];

export type MemberDetails = {
  /** "d.russo@politorocketteam.it" */
  readonly prtEmail: string;
  readonly phone: string;
  readonly discord: string;
  /** The short form, "linkedin.com/in/davide-russo". */
  readonly linkedin: string;
  /** The digits; the page shows "s312456". */
  readonly politoId: string;
  readonly programme: DegreeProgramme | "";
  readonly level: StudyProgramme | "";
  /** Where they are from: "Italy". */
  readonly country: string;
  /** ISO date, "2001-05-14". */
  readonly birthDate: string;
  readonly gender: Gender | "";
};

export type MemberDetailKey = keyof MemberDetails;

export const NO_MEMBER_DETAILS: MemberDetails = {
  prtEmail: "",
  phone: "",
  discord: "",
  linkedin: "",
  politoId: "",
  programme: "",
  level: "",
  country: "",
  birthDate: "",
  gender: "",
};

/** Whether nothing is filled yet: the "Details not filled yet" line under someone waiting for their NDA (board 61e). */
export function noDetailsFilled(details: MemberDetails): boolean {
  return Object.values(details).every((value) => value === "");
}

/** A LinkedIn link in its short form, "" when empty: checked inside the schema so its error lands beside every other field's. */
const linkedinRule = z.string().transform((raw, ctx) => {
  const linkedin = normalizeLinkedin(raw);
  if (linkedin.ok) return linkedin.value ?? "";
  ctx.addIssue({ code: "custom", message: linkedin.error });
  return z.NEVER;
});

const memberDetailsSchema = detailsSchema
  .pick({ phone: true, politoId: true, programme: true, level: true, country: true, birthDate: true })
  .extend({
    prtEmail: z.string().trim().toLowerCase().pipe(optional(z.email("Write an email address.").max(200, "Too long."))),
    discord: z.string().trim().max(40, "Too long."),
    linkedin: linkedinRule,
    gender: z.union([z.literal(""), z.enum(GENDERS, "Pick one.")]),
  });

export type MemberDetailErrors = Partial<Record<MemberDetailKey, string>>;

/**
 * The member's details as the Edit details or Add member form sent them,
 * checked: the clean values, or one message per bad field. The browser and
 * the server run the same check. `openedPhone` is the phone the form opened
 * with, as the page reads the person's record; "" for Add member.
 */
export function parseMemberDetails(input: unknown, openedPhone: string): { ok: true; value: MemberDetails } | { ok: false; errors: MemberDetailErrors } {
  const result = memberDetailsSchema.extend({ phone: phoneRule(openedPhone) }).safeParse(input);
  if (!result.success) {
    const errors: MemberDetailErrors = {};
    for (const issue of result.error.issues) errors[issue.path[0] as MemberDetailKey] ??= issue.message;
    return { ok: false, errors };
  }
  return { ok: true, value: result.data };
}

/** A member detail as the drawer shows it (board 61f); null for an empty one. */
export function memberDetailText(details: MemberDetails, key: MemberDetailKey): string | null {
  const value = details[key];
  if (value === "") return null;
  if (key === "politoId") return `s${value}`;
  if (key === "level") return levelLabel(value as StudyProgramme);
  if (key === "birthDate") return detailText({ ...NO_DETAILS, birthDate: value }, "birthDate");
  return value;
}

/** The columns member details are stored in, each holding `V`: a value, null to clear it, or undefined where it is not written. */
type MemberDetailColumns<V> = {
  readonly user: {
    readonly phone: V;
    readonly linkedin: V;
    readonly politoId: V;
    readonly program: V;
    readonly levelOfStudy: V;
    readonly country: V;
    readonly dateOfBirth: V;
    readonly gender: V;
  };
  readonly member: { readonly prtEmail: V; readonly discord: V };
};

/**
 * Where each member detail is stored: the person's `users` row, or their
 * `members` row for the PRT email and Discord (a person waiting for their NDA
 * keeps those two on their `team_joins` row). An empty field clears its
 * column; a field left out is not written, so neither is its column.
 */
export function columnsFromMemberDetails(details: MemberDetails): MemberDetailColumns<string | null>;
export function columnsFromMemberDetails(details: Partial<MemberDetails>): MemberDetailColumns<string | null | undefined>;
export function columnsFromMemberDetails(details: Partial<MemberDetails>): MemberDetailColumns<string | null | undefined> {
  const value = (text: string | undefined) => (text === undefined ? undefined : text === "" ? null : text);
  const sent = <T extends Record<string, string | null | undefined>>(columns: T) =>
    Object.fromEntries(Object.entries(columns).filter(([, v]) => v !== undefined)) as T;
  return {
    user: sent({
      phone: value(details.phone),
      linkedin: details.linkedin === undefined ? undefined : details.linkedin === "" ? null : `https://www.${details.linkedin}`,
      politoId: value(details.politoId),
      program: value(details.programme),
      levelOfStudy: value(details.level),
      country: value(details.country),
      dateOfBirth: value(details.birthDate),
      gender: value(details.gender),
    }),
    member: sent({ prtEmail: value(details.prtEmail), discord: value(details.discord) }),
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
