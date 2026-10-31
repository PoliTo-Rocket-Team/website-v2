// What a failed run prints. Restored as it was from the removed import tool
// (scripts/import, issue #824). A database error reaches the CLI wrapped: a
// Drizzle query error whose message is the failed query and its parameters,
// with the driver's Postgres error as its cause. The CLI prints each error of
// the cause chain, outermost first: the first line of its message, and the
// Postgres fields it carries (code, constraint, table, column). It never
// prints a query's parameters or a Postgres detail: both may hold roster values.

/** Each field printed, and the property names drivers give it. */
const FIELDS = [
  ["code", ["code"]],
  ["constraint", ["constraint_name", "constraint"]],
  ["table", ["table_name", "table"]],
  ["column", ["column_name", "column"]],
] as const;

/** How many errors of a chain are printed, and how long a first line may be: a failed insert's query runs long. */
const MAX_DEPTH = 8;
const MAX_LINE = 240;

/** One error of the chain: the first line of its message, then its Postgres fields. */
function lineOf(error: unknown): string {
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;
  const message = error instanceof Error ? error.message : String(error);
  const first = message.split(/\r?\n/, 1)[0].trim();
  const text = first.length > MAX_LINE ? `${first.slice(0, MAX_LINE)}…` : first;
  const fields = FIELDS.flatMap(([label, names]) => {
    const value = names.map((n) => record?.[n]).find((v) => typeof v === "string" && v !== "");
    return value === undefined ? [] : [`${label} ${value}`];
  });
  return fields.length === 0 ? text : `${text} (${fields.join(", ")})`;
}

/** The lines a failed run prints for an error: one per error of its cause chain, outermost first. */
export function failureLines(error: unknown): string[] {
  const lines: string[] = [];
  const seen = new Set<unknown>();
  for (let e = error; e !== undefined && e !== null && !seen.has(e) && lines.length < MAX_DEPTH; e = (e as { cause?: unknown }).cause) {
    seen.add(e);
    lines.push(`${lines.length === 0 ? "" : "caused by: "}${lineOf(e)}`);
  }
  return lines;
}
