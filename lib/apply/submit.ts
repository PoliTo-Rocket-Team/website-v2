import { createHash } from "node:crypto";
import {
  isPdfBytes,
  parseApplicationForm,
  type ApplicationFields,
  type FieldErrors,
} from "./application-form";
import { isPublic, type PositionState, type Recruitment } from "./positions";
import type { SubmitResult } from "./submit-result";

export type { SubmitResult } from "./submit-result";

// Sending an application (issue #120). The server action wires this to the
// session, the database and R2; the rules live here, so the tests run them
// with fakes. Nothing the browser sends is trusted: the user comes from the
// session, the position is read again and must still be public, the fields
// are parsed with the form's own schema, and each file must carry PDF bytes.

/** The signed-in user, from the session. */
export type Applicant = { id: string; email: string };

/** The position as the submit reads it, fresh from the database. */
export type SubmitPosition = PositionState & {
  id: number;
  customQuestions: readonly string[];
  requiresMotivationLetter: boolean;
};

/** A PDF stored in R2 under a key the server chose. */
export type StoredPdf = {
  key: string;
  filename: string;
  size: number;
  /** First 16 hex digits of the SHA-256: the dashboard's file link. */
  hash: string;
};

/** What the store writes: the applicant's profile, the application and its files. A CV is always there. */
export type NewApplication = {
  userId: string;
  positionId: number;
  profile: Omit<ApplicationFields, "answers" | "cv" | "motivationLetter">;
  answers: { question: string; answer: string }[];
  cv: StoredPdf;
  motivationLetter: StoredPdf | null;
};

export type SubmitDeps = {
  applicant(): Promise<Applicant | null>;
  position(id: number): Promise<{ position: SubmitPosition; recruitment: Recruitment } | null>;
  hasApplied(userId: string, positionId: number): Promise<boolean>;
  putPdf(key: string, bytes: Uint8Array): Promise<void>;
  deletePdf(key: string): Promise<void>;
  /** Writes the profile, the file rows and the application in one transaction. */
  save(application: NewApplication): Promise<"saved" | "already-applied">;
  /** A fresh random name for a stored file. */
  newFileName(): string;
};

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

  const cvBytes = await pdfBytes(cv);
  const letterBytes = motivationLetter ? await pdfBytes(motivationLetter) : null;
  if (cvBytes === null || (motivationLetter && letterBytes === null)) {
    const errors: FieldErrors = {};
    if (cvBytes === null) errors.cv = NOT_PDF;
    if (motivationLetter && letterBytes === null) errors.motivationLetter = NOT_PDF;
    return { ok: false, reason: "invalid", errors };
  }

  const stored: StoredPdf[] = [];
  const store = async (file: File, content: Uint8Array): Promise<StoredPdf> => {
    const pdf: StoredPdf = {
      key: `applications/${deps.newFileName()}.pdf`,
      filename: file.name,
      size: content.byteLength,
      hash: createHash("sha256").update(content).digest("hex").slice(0, 16),
    };
    await deps.putPdf(pdf.key, content);
    stored.push(pdf);
    return pdf;
  };

  try {
    const cvPdf = await store(cv, cvBytes);
    const letterPdf = motivationLetter && letterBytes ? await store(motivationLetter, letterBytes) : null;
    const saved = await deps.save({
      userId: applicant.id,
      positionId: position.id,
      profile,
      answers: position.customQuestions.map((question, i) => ({ question, answer: answers[i] })),
      cv: cvPdf,
      motivationLetter: letterPdf,
    });
    if (saved === "saved") return { ok: true };
    await removeAll(stored, deps);
    return { ok: false, reason: "already-applied" };
  } catch (error) {
    console.error("Application not saved:", error);
    await removeAll(stored, deps);
    return { ok: false, reason: "failed" };
  }
}

const NOT_PDF = "This file is not a PDF.";

/** A file's bytes when they are a PDF's, else null: the name and type the browser sent prove nothing. */
async function pdfBytes(file: File): Promise<Uint8Array | null> {
  const content = new Uint8Array(await file.arrayBuffer());
  return isPdfBytes(content) ? content : null;
}

/** Deletes the files of an application that was not saved, so R2 keeps no orphan. */
async function removeAll(stored: readonly StoredPdf[], deps: SubmitDeps): Promise<void> {
  await Promise.all(
    stored.map((pdf) =>
      deps.deletePdf(pdf.key).catch((error) => console.error(`Could not delete ${pdf.key}:`, error)),
    ),
  );
}
