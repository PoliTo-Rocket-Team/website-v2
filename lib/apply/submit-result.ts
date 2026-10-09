import type { FieldErrors } from "./application-form";

// What sending an application answers (lib/apply/submit.ts), and what the
// form says for each answer. Kept apart from the submit itself, which runs on
// the server only, so the form can import it.

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "signed-out" | "not-public" | "already-applied" | "failed" }
  | { ok: false; reason: "invalid"; errors: FieldErrors };

/** The toast the form shows for each refusal. */
export const SUBMIT_MESSAGES: Record<Exclude<SubmitResult, { ok: true }>["reason"], string> = {
  "signed-out": "Sign in with Google to apply.",
  "not-public": "This position is not accepting applications right now.",
  "already-applied": "You have already applied for this position.",
  invalid: "Some answers need a fix. Check the fields marked below.",
  failed: "Your application was not sent. Please try again.",
};
