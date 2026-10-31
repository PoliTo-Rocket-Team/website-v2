// The error summary a dashboard form drawer shows right above its Save and
// Cancel buttons (issue #911): when Save is refused, the fields in error by
// their visible labels and which one to scroll to and focus, or the server's
// refusal when it names no field.

/** One field of the form, in the order the form shows it: `name` is its control's name, `label` its visible label. */
export type SummaryField = { readonly name: string; readonly label: string; readonly error: string | undefined };

export type FormSummary =
  /** The fields in error, by label in the form's order, and the name of the first, which the form scrolls to and focuses. */
  | { readonly kind: "fields"; readonly labels: readonly string[]; readonly first: string }
  /** A refusal the server gave that no field carries. */
  | { readonly kind: "refusal"; readonly message: string };

/** The summary of `fields`, given in the form's order: null when none is in error. */
export function fieldSummaryOf(fields: readonly SummaryField[]): FormSummary | null {
  const wrong = fields.filter((f) => f.error !== undefined);
  if (wrong.length === 0) return null;
  return { kind: "fields", labels: wrong.map((f) => f.label), first: wrong[0].name };
}

/** The summary's line: "Fix 1 field: Phone", "Fix 2 fields: Phone, LinkedIn", or the refusal itself. */
export function summaryLine(summary: FormSummary): string {
  if (summary.kind === "refusal") return summary.message;
  const n = summary.labels.length;
  return `Fix ${n} ${n === 1 ? "field" : "fields"}: ${summary.labels.join(", ")}`;
}
