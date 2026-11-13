// What a failed run prints (issue #948), in the alumni repair's shape
// (scripts/alumni-repair/failure.ts, issue #913): a head line that says
// whether the backfill was written, then the cause chain, outermost first: the
// first line of each error's message, and the Postgres fields it carries
// (code, constraint, table, column). It never prints a query's parameters or
// a Postgres detail: both may hold roster values.

/** Each field printed, and the property names drivers give it. */
const FIELDS = [
  ["code", ["code"]],
  ["constraint", ["constraint_name", "constraint"]],
  ["table", ["table_name", "table"]],
  ["column", ["column_name", "column"]],
] as const;

/** How many errors of a chain are printed, and how long a first line may be: a failed update's query runs long. */
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

/** A failure after a real run's transaction committed: the backfill is written, and `step` is what failed after it. */
export class FailedAfterWrite extends Error {
  constructor(
    readonly step: string,
    readonly reason: unknown,
  ) {
    super(`${step} failed after the backfill was written`);
  }
}

/** Runs `act`, a step after a real run's commit: its failure becomes a `FailedAfterWrite` naming `step`. */
export async function afterWrite<T>(step: string, act: () => T | Promise<T>): Promise<T> {
  try {
    return await act();
  } catch (reason) {
    throw new FailedAfterWrite(step, reason);
  }
}

/** What a failed run prints: whether its backfill was written, then the cause chain of what failed. */
export function failureReport(error: unknown): string {
  const [head, cause] =
    error instanceof FailedAfterWrite
      ? [`Team join date backfill was written: its transaction committed. Then ${error.step} failed.`, error.reason]
      : ["Team join date backfill failed; nothing was written.", error];
  const lines: string[] = [];
  const seen = new Set<unknown>();
  for (let e = cause; e !== undefined && e !== null && !seen.has(e) && lines.length < MAX_DEPTH; e = (e as { cause?: unknown }).cause) {
    seen.add(e);
    lines.push(`${lines.length === 0 ? "" : "caused by: "}${lineOf(e)}`);
  }
  return [head, ...lines.map((line) => `  ${line}`)].join("\n");
}
