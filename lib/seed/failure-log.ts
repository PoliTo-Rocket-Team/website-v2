// What the build's database step prints when it fails (issue #874). The raw
// error is never printed: `postgres()` throws a `TypeError` on a URL it cannot
// parse, and that error's `input` field holds the whole connection string,
// password included, so printing the object would put it in the build log.
// The log keeps only the error's name, message, stack, code and causes, with
// every connection string the step was given, and anything shaped like a
// Postgres URL, replaced by a placeholder.

/** What a redacted connection string reads as in the log. */
export const REDACTED_CONNECTION = "[connection string redacted]";

/** Any Postgres URL, whether or not the step was given it. */
const POSTGRES_URL = /postgres(?:ql)?:\/\/\S+/gi;

/** How deep the `cause` chain is followed, so a cycle cannot loop forever. */
const MAX_CAUSES = 5;

function redact(text: string, secrets: readonly string[]): string {
  const literal = secrets.reduce((rest, secret) => rest.split(secret).join(REDACTED_CONNECTION), text);
  return literal.replace(POSTGRES_URL, REDACTED_CONNECTION);
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return `Thrown value: ${String(error)}`;
  const head = error.stack ?? `${error.name}: ${error.message}`;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? `${head}\ncode: ${code}` : head;
}

/**
 * The failure as text safe for a build log: never a field of the error other
 * than its name, message, stack, string `code` and `cause` chain, and never
 * any of `connectionStrings` or any other Postgres URL. Unset and empty
 * strings are ignored.
 */
export function failureLogOf(error: unknown, connectionStrings: readonly (string | undefined)[]): string {
  const secrets = [...new Set(connectionStrings.filter((value): value is string => typeof value === "string" && value.length > 0))]
    // The longest first, so a string that contains another is replaced whole.
    .sort((a, b) => b.length - a.length);
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSES && current !== undefined; depth += 1) {
    parts.push(depth === 0 ? describe(current) : `Caused by: ${describe(current)}`);
    current = current instanceof Error ? current.cause : undefined;
  }
  return redact(parts.join("\n"), secrets);
}
