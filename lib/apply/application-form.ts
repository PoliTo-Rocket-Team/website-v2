import { z } from "zod";

// The application form of /apply/<slug> (issue #120, board 35): its option
// lists, and the one schema the browser and the server both validate with.
// The browser validates before it sends; the server action validates the same
// FormData again and trusts nothing the browser said.

/** Study programme: the year and level, as the recruitment Google Form words it. */
export const STUDY_PROGRAMMES = [
  "Year 1 Bachelor's",
  "Year 2 Bachelor's",
  "Year 3 Bachelor's",
  "Year 1 Master's",
  "Year 2 Master's",
  "PhD",
] as const;

/** Degree programme at Politecnico di Torino. */
export const DEGREE_PROGRAMMES = [
  "Aerospace Engineering",
  "Mechanical Engineering",
  "Automotive Engineering",
  "Mechatronic Engineering",
  "Electronic Engineering",
  "Electrical Engineering",
  "Computer Engineering",
  "Data Science and Engineering",
  "Communications Engineering",
  "Physics Engineering",
  "Mathematical Engineering",
  "Energy Engineering",
  "Nuclear Engineering",
  "Chemical Engineering",
  "Materials Engineering",
  "Biomedical Engineering",
  "Civil Engineering",
  "Environmental Engineering",
  "Management Engineering",
  "Architecture",
  "Design",
  "Other",
] as const;

export const GENDERS = ["Male", "Female", "Other"] as const;

/** Stored in `users.origin`. */
export const ORIGINS = ["International", "Domestic"] as const;

export const REFERRAL_SOURCES = [
  "Instagram",
  "LinkedIn",
  "A friend or a team member",
  "A PoliTo event or fair",
  "Our website",
  "Other",
] as const;

/**
 * The largest PDF the form takes. Both files travel in one server action
 * request, and Vercel refuses a request body over 4.5 MB before our code runs,
 * so two of these plus the text fields must fit under that (issue #127).
 */
export const MAX_PDF_BYTES = 2 * 1024 * 1024;

/** The limit as the form words it: in each file field's hint and in its error. */
export const MAX_PDF_LABEL = "2 MB";

/** What a position asks of its applicants beyond the fixed fields. */
export type PositionAsks = {
  questions: readonly string[];
  requiresMotivationLetter: boolean;
};

const name = z.string().trim().min(1, "Required.").max(100, "Too long.");

const pdf = z
  .instanceof(File, { message: "Add a PDF." })
  .refine((f) => f.size > 0, "Add a PDF.")
  .refine((f) => f.size <= MAX_PDF_BYTES, `The file is over ${MAX_PDF_LABEL}.`)
  .refine((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"), "PDF only.");

/** The largest id a stored file can have: `application_files.id` is a Postgres integer. */
const MAX_FILE_ID = 2_147_483_647;

/**
 * A PDF the applicant already stored with an earlier application, sent in
 * place of the file itself (issue #826). The server takes it only when the
 * stored file is the signed-in applicant's own.
 */
export type StoredPdfRef = { storedFileId: number };

const storedPdf = z.object({ storedFileId: z.number().int().positive().max(MAX_FILE_ID) });

/** A document field's value: a new upload, or a reference to a file the applicant already stored. */
const pdfChoice = z.union([storedPdf, pdf], { error: "Add a PDF." });

/** A PDF the applicant sent with an earlier application, as the form offers it again (issue #826). */
export type PreviousFile = { id: number; name: string; size: number | null };

/** The applicant's latest stored CV and motivation letter, each null when they never sent one. */
export type PreviousFiles = { cv: PreviousFile | null; motivationLetter: PreviousFile | null };

/** What a document field holds in the browser: nothing, the earlier file it offers, or a new upload. */
export type PdfPick = { kind: "previous"; file: PreviousFile } | { kind: "upload"; file: File } | null;

/** The form's two document fields. */
export type PdfFieldName = "cv" | "motivationLetter";

/** The FormData key a reference to a stored file travels under: "cvStored", "motivationLetterStored". */
const storedKeyOf = (field: PdfFieldName) => `${field}Stored` as const;

/** Puts a document field's pick into the FormData the form sends: the file, a reference to the stored one, or nothing. */
export function setPdfField(form: FormData, field: PdfFieldName, pick: PdfPick): void {
  form.delete(field);
  form.delete(storedKeyOf(field));
  if (pick?.kind === "upload") form.set(field, pick.file);
  if (pick?.kind === "previous") form.set(storedKeyOf(field), String(pick.file.id));
}

/** Why a picked file cannot be sent, or null when it can: the same checks the submit runs on it. */
export function pdfProblem(file: File): string | null {
  const result = pdf.safeParse(file);
  return result.success ? null : (result.error.issues[0]?.message ?? "Add a PDF.");
}

function isPastDate(iso: string): boolean {
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 1900 && date.getTime() < Date.now();
}

/** The form's fields, for a position that asks the given questions and documents. */
export function applicationSchema(asks: PositionAsks) {
  return z.object({
    firstName: name,
    lastName: name,
    politoId: z.string().trim().regex(/^[0-9]{1,10}$/, "Numbers only."),
    phone: z
      .string()
      .trim()
      .regex(/^\+[0-9][0-9 ]{5,18}[0-9]$/, "Start with + and the country code."),
    dateOfBirth: z.iso.date("Pick a date.").refine(isPastDate, "Pick a date in the past."),
    studyProgramme: z.enum(STUDY_PROGRAMMES, "Pick one."),
    degreeProgramme: z.enum(DEGREE_PROGRAMMES, "Pick one."),
    answers: z
      .array(z.string().trim().min(1, "Required.").max(4000, "Too long."))
      .length(asks.questions.length),
    cv: pdfChoice,
    motivationLetter: asks.requiresMotivationLetter ? pdfChoice : z.null(),
    gender: z.enum(GENDERS, "Pick one."),
    origin: z.enum(ORIGINS, "Pick one."),
    referral: z.enum(REFERRAL_SOURCES, "Pick one."),
  });
}

export type ApplicationFields = z.infer<ReturnType<typeof applicationSchema>>;

/** A field the form shows an error under. Answers are `answers.<index>`. */
export type FieldErrors = Partial<Record<string, string>>;

/** The text fields' starting values. A choice is either one of its options or unset (""). */
export type FormDefaults = {
  firstName: string;
  lastName: string;
  politoId: string;
  phone: string;
  dateOfBirth: string;
  studyProgramme: (typeof STUDY_PROGRAMMES)[number] | "";
  degreeProgramme: (typeof DEGREE_PROGRAMMES)[number] | "";
  gender: (typeof GENDERS)[number] | "";
  origin: (typeof ORIGINS)[number] | "";
  referral: (typeof REFERRAL_SOURCES)[number] | "";
};

function oneOf<T extends string>(options: readonly T[], value: string | null): T | "" {
  return options.find((o) => o === value) ?? "";
}

/** Starting values from a saved profile. A stored value that is no longer an option starts unset. */
export function formDefaults(profile: { [K in keyof FormDefaults]: string | null }): FormDefaults {
  return {
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    politoId: profile.politoId ?? "",
    phone: profile.phone ?? "",
    dateOfBirth: profile.dateOfBirth ?? "",
    studyProgramme: oneOf(STUDY_PROGRAMMES, profile.studyProgramme),
    degreeProgramme: oneOf(DEGREE_PROGRAMMES, profile.degreeProgramme),
    gender: oneOf(GENDERS, profile.gender),
    origin: oneOf(ORIGINS, profile.origin),
    referral: oneOf(REFERRAL_SOURCES, profile.referral),
  };
}

function fileOrNull(value: FormDataEntryValue | null): File | null {
  return value instanceof File && value.size > 0 ? value : null;
}

/** A document field as sent: a new file wins over a reference to a stored one, so an upload replaces the pre-selection. */
function pdfChoiceOf(form: FormData, field: PdfFieldName): File | StoredPdfRef | null {
  const stored = form.get(storedKeyOf(field));
  const id = typeof stored === "string" && /^[1-9][0-9]{0,9}$/.test(stored) ? Number(stored) : null;
  const ref = id !== null && id <= MAX_FILE_ID ? { storedFileId: id } : null;
  return fileOrNull(form.get(field)) ?? ref;
}

/** Reads the form's FormData into the shape the schema parses. */
export function readApplicationForm(form: FormData): Record<string, unknown> {
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    firstName: text("firstName"),
    lastName: text("lastName"),
    politoId: text("politoId"),
    phone: text("phone"),
    dateOfBirth: text("dateOfBirth"),
    studyProgramme: text("studyProgramme"),
    degreeProgramme: text("degreeProgramme"),
    answers: form.getAll("answers").map((a) => (typeof a === "string" ? a : "")),
    cv: pdfChoiceOf(form, "cv"),
    motivationLetter: pdfChoiceOf(form, "motivationLetter"),
    gender: text("gender"),
    origin: text("origin"),
    referral: text("referral"),
  };
}

export type ParsedApplication =
  | { ok: true; fields: ApplicationFields }
  | { ok: false; errors: FieldErrors };

/** Validates the form for one position: the fields, or one message per bad field. */
export function parseApplicationForm(form: FormData, asks: PositionAsks): ParsedApplication {
  const result = applicationSchema(asks).safeParse(readApplicationForm(form));
  if (result.success) return { ok: true, fields: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

/** A file is a PDF when its bytes start with the PDF header, whatever its name or type says. */
export function isPdfBytes(bytes: Uint8Array): boolean {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
  return bytes.length >= header.length && header.every((b, i) => bytes[i] === b);
}
