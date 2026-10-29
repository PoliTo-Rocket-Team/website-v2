import { createHash } from "node:crypto";
import {
  isPdfBytes,
  parseApplicationForm,
  type ApplicationFields,
  type FieldErrors,
  type StoredPdfRef,
} from "./application-form";
import { privatePathname, type PrivatePathname } from "../storage/pathname";
import { isPublic, type PositionState, type Recruitment } from "./positions";
import type { SubmitResult } from "./submit-result";

export type { SubmitResult } from "./submit-result";

// Sending an application (issue #120). The server action wires this to the
// session, the database and the private file store; the rules live here, so
// the tests run them with fakes. Nothing the browser sends is trusted: the user comes from the
// session, the position is read again and must still be public, the fields
// are parsed with the form's own schema, each file must carry PDF bytes, and
// a stored file the form names must be the applicant's own.
//
// One applicant's files are stored once (issue #826): a document whose bytes
// match one the applicant already stored links the stored file, and nothing
// new is uploaded or written for it. Files are never shared between applicants.

/** The signed-in user, from the session. */
export type Applicant = { id: string; email: string };

/** The position as the submit reads it, fresh from the database. */
export type SubmitPosition = PositionState & {
  id: number;
  customQuestions: readonly string[];
  requiresMotivationLetter: boolean;
};

/** A PDF in the private file store, under a pathname the server chose. */
export type StoredPdf = {
  key: PrivatePathname;
  filename: string;
  size: number;
  /** First 16 hex digits of the SHA-256: the dashboard's file link. */
  hash: string;
};

/** One of the applicant's own `application_files` rows. */
export type OwnFile = { id: number; filename: string };

/** A document of the new application: a file uploaded now, which gets its own row, or a row the applicant already has. */
export type ApplicationPdf =
  | { kind: "new"; pdf: StoredPdf }
  /** `filename` is the name the applicant gave this time: the application keeps it as its own. */
  | { kind: "kept"; fileId: number; filename: string };

/** What the store writes: the applicant's profile, the application and its files. A CV is always there. */
export type NewApplication = {
  userId: string;
  positionId: number;
  profile: Omit<ApplicationFields, "answers" | "cv" | "motivationLetter">;
  answers: { question: string; answer: string }[];
  cv: ApplicationPdf;
  motivationLetter: ApplicationPdf | null;
};

export type SubmitDeps = {
  applicant(): Promise<Applicant | null>;
  position(id: number): Promise<{ position: SubmitPosition; recruitment: Recruitment } | null>;
  hasApplied(userId: string, positionId: number): Promise<boolean>;
  /** The user's own stored file with this id; null when there is none, or it is another user's. */
  ownFile(userId: string, fileId: number): Promise<OwnFile | null>;
  /** The user's own stored file with these bytes, by their hash and size; null when they stored none. */
  ownFileWithContent(userId: string, hash: string, size: number): Promise<OwnFile | null>;
  putPdf(key: PrivatePathname, bytes: Uint8Array): Promise<void>;
  deletePdf(key: PrivatePathname): Promise<void>;
  /** Writes the profile, the new file rows and the application in one transaction. */
  save(application: NewApplication): Promise<"saved" | "already-applied">;
  /** A fresh random name for a stored file. */
  newFileName(): string;
};

/** A document as the form sent it, once checked: new PDF bytes, or one of the applicant's own stored files. */
type Picked = { kind: "upload"; file: File; bytes: Uint8Array } | { kind: "stored"; file: OwnFile };

/** Validates and stores one application for one position. */
export async function submitApplication(
  positionId: number,
  form: FormData,
  deps: SubmitDeps,
): Promise<SubmitResult> {
  const applicant = await deps.applicant();
  if (applicant === null) return { ok: false, reason: "signed-out" };

  const read = Number.isSafeInteger(positionId) ? await deps.position(positionId) : null;
  if (read === null || !isPublic(read.position, read.recruitment)) return { ok: false, reason: "not-public" };
  const { position } = read;

  if (await deps.hasApplied(applicant.id, position.id)) return { ok: false, reason: "already-applied" };

  const parsed = parseApplicationForm(form, {
    questions: position.customQuestions,
    requiresMotivationLetter: position.requiresMotivationLetter,
  });
  if (!parsed.ok) return { ok: false, reason: "invalid", errors: parsed.errors };
  const { answers, cv, motivationLetter, ...profile } = parsed.fields;

  const pick = async (choice: File | StoredPdfRef): Promise<Picked | string> => {
    if (choice instanceof File) {
      const bytes = await pdfBytes(choice);
      return bytes === null ? NOT_PDF : { kind: "upload", file: choice, bytes };
    }
    const own = await deps.ownFile(applicant.id, choice.storedFileId);
    return own === null ? NOT_YOURS : { kind: "stored", file: own };
  };
  const cvPick = await pick(cv);
  const letterPick = motivationLetter ? await pick(motivationLetter) : null;
  const errors: FieldErrors = {};
  if (typeof cvPick === "string") errors.cv = cvPick;
  if (typeof letterPick === "string") errors.motivationLetter = letterPick;
  if (typeof cvPick === "string" || typeof letterPick === "string") return { ok: false, reason: "invalid", errors };

  const uploaded: StoredPdf[] = [];
  /** Links a document: a stored file as it is, new bytes the applicant already stored to that row, and only other bytes as a new upload. */
  const link = async (picked: Picked): Promise<ApplicationPdf> => {
    if (picked.kind === "stored") return { kind: "kept", fileId: picked.file.id, filename: picked.file.filename };
    const { file, bytes } = picked;
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
    const same = await deps.ownFileWithContent(applicant.id, hash, bytes.byteLength);
    if (same !== null) return { kind: "kept", fileId: same.id, filename: file.name };
    const pdf: StoredPdf = {
      key: privatePathname("application", `${deps.newFileName()}.pdf`),
      filename: file.name,
      size: bytes.byteLength,
      hash,
    };
    await deps.putPdf(pdf.key, bytes);
    uploaded.push(pdf);
    return { kind: "new", pdf };
  };

  try {
    const cvPdf = await link(cvPick);
    const letterPdf = letterPick ? await link(letterPick) : null;
    const saved = await deps.save({
      userId: applicant.id,
      positionId: position.id,
      profile,
      answers: position.customQuestions.map((question, i) => ({ question, answer: answers[i] })),
      cv: cvPdf,
      motivationLetter: letterPdf,
    });
    if (saved === "saved") return { ok: true };
    await removeAll(uploaded, deps);
    return { ok: false, reason: "already-applied" };
  } catch (error) {
    console.error("Application not saved:", error);
    await removeAll(uploaded, deps);
    return { ok: false, reason: "failed" };
  }
}

const NOT_PDF = "This file is not a PDF.";
const NOT_YOURS = "This file is no longer available. Add a PDF.";

/** A file's bytes when they are a PDF's, else null: the name and type the browser sent prove nothing. */
async function pdfBytes(file: File): Promise<Uint8Array | null> {
  const content = new Uint8Array(await file.arrayBuffer());
  return isPdfBytes(content) ? content : null;
}

/** Deletes the files uploaded for an application that was not saved, so the store keeps no orphan. Kept files are never touched. */
async function removeAll(uploaded: readonly StoredPdf[], deps: SubmitDeps): Promise<void> {
  await Promise.all(
    uploaded.map((pdf) =>
      deps.deletePdf(pdf.key).catch((error) => console.error(`Could not delete ${pdf.key}:`, error)),
    ),
  );
}
