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
 * order it shows them, each with its error now. `values` are the form's
 * state as it stands; `open` is whether its panel is open.
 *
 * A refusal speaks for the values it refused: it goes as soon as one of them
 * changes, and when the panel closes, since the form stays mounted across a
 * close and a reopen.
 */
export function useFormSummary(fields: readonly SummaryField[], { open, values }: { open: boolean; values: readonly unknown[] }) {
  const [showErrors, setShowErrors] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const standing = refusal !== null && open && sameValues(refusal.values, values) ? refusal : null;
  // Dropped during render, React's way to reset state from props, so no stale refusal is ever drawn.
  if (refusal !== null && standing === null) setRefusal(null);
  // Once a click was refused, the summary follows the fields: it shrinks as each is fixed.
  const summary: FormSummary | null = standing !== null ? { kind: "refusal", message: standing.message } : showErrors ? fieldSummaryOf(fields) : null;

  /** On submit: whether the form may go on. When not, the fields' errors and the summary show, and the first field in error is focused. */
  const check = (form: HTMLFormElement): boolean => {
    setRefusal(null);
    setShowErrors(true);
    const wrong = fieldSummaryOf(fields);
    if (wrong === null) return true;
    if (wrong.kind === "fields") focusField(form, wrong.first);
    return false;
  };

  /** A server refusal of the values this render holds, the ones just sent. */
  const refuse = (message: string) => setRefusal({ message, values });

  return { summary, showErrors, check, refuse };
}

/** The server's refusal and the form values it refused. */
type Refusal = { readonly message: string; readonly values: readonly unknown[] };

function sameValues(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}
