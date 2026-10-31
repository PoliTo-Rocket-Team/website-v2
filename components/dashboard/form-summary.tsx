"use client";

import { useState } from "react";
import { fieldSummaryOf, type FormSummary, type SummaryField } from "@/lib/dashboard/error-summary";
import { ErrorSummary, focusField } from "./error-summary";

/** The summary across a side panel's two footer buttons, above them, while it is set; nothing when it is null. */
export function FooterSummary({ summary }: { summary: FormSummary | null }) {
  if (summary === null) return null;
  return (
    <div className="col-span-2">
      <ErrorSummary summary={summary} />
    </div>
  );
}

/**
 * The summary a Team tree create or save form shows right above its main
 * button (issue #927, built like Edit details' in #911). The button stays
 * clickable while the form is incomplete: a click that `check` refuses names
 * the fields in error and focuses the first; a server refusal, given to
 * `refuse`, shows in the same place. `fields` are the form's fields in the
 * order it shows them, each with its error now.
 */
export function useFormSummary(fields: readonly SummaryField[]) {
  const [showErrors, setShowErrors] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Once a click was refused, the summary follows the fields: it shrinks as each is fixed.
  const summary: FormSummary | null = refusal !== null ? { kind: "refusal", message: refusal } : showErrors ? fieldSummaryOf(fields) : null;

  /** On submit: whether the form may go on. When not, the fields' errors and the summary show, and the first field in error is focused. */
  const check = (form: HTMLFormElement): boolean => {
    setRefusal(null);
    setShowErrors(true);
    const wrong = fieldSummaryOf(fields);
    if (wrong === null) return true;
    if (wrong.kind === "fields") focusField(form, wrong.first);
    return false;
  };

  return { summary, showErrors, check, refuse: setRefusal };
}
