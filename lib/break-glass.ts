// The break-glass admin (issue #646): a Google account the owner chooses,
// which signs in with the team leader's dashboard rights plus View as on the
// live site, so the team keeps an admin path when the seats change hands.
// Which account it is lives in one server environment setting, read at
// request time; nothing in the code names an account. Google stays the only
// way to sign in (lib/auth.ts).

/** The environment variable that holds the break-glass sign-in emails, comma-separated. */
export const BREAK_GLASS_SETTING = "BREAK_GLASS_ADMIN_EMAILS";

/** The sign-in emails the setting allows, trimmed and lower-cased. */
export type BreakGlassEmails = ReadonlySet<string>;

/** One sign-in email as the setting compares it: trimmed and lower-cased. */
function normalEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The emails a setting value allows: each comma-separated entry, trimmed and lower-cased; unset, empty or blank entries allow none. */
export function breakGlassEmailsOf(value: string | undefined): BreakGlassEmails {
  if (value === undefined) return new Set();
  return new Set(value.split(",").map(normalEmail).filter((email) => email !== ""));
}

/** The emails the setting allows now, read from the environment at request time. */
export function readBreakGlassEmails(env: Readonly<Record<string, string | undefined>> = process.env): BreakGlassEmails {
  return breakGlassEmailsOf(env[BREAK_GLASS_SETTING]);
}

/** Whether a sign-in email is a break-glass one: an exact match, after trimming and lower-casing, of an allowed email. */
export function isBreakGlassEmail(email: string | null | undefined, allowed: BreakGlassEmails = readBreakGlassEmails()): boolean {
  if (email === null || email === undefined) return false;
  const normal = normalEmail(email);
  return normal !== "" && allowed.has(normal);
}

/** One sign-in of the break-glass admin: the session it opened and the account. */
export type BreakGlassSignIn = { readonly sessionId: string; readonly userId: string };

/** The `logs.operation` a break-glass sign-in is written under, beside the row changes the audit trigger writes. */
export const BREAK_GLASS_SIGN_IN_OPERATION = "BREAK_GLASS_SIGN_IN";

/** A session as the sign-in hook reads it: its id, its account, and the acting account when it is a View as one. */
type OpenedSession = { readonly id: string; readonly userId: string; readonly impersonatedBy: string | null };

/**
 * The sign-in a newly opened session is, when it is the break-glass admin's;
 * null for anyone else. A View as session is no sign-in of the person it is
 * for, so it is never one.
 */
export function breakGlassSignInOf(session: OpenedSession, signInEmail: string | null, allowed: BreakGlassEmails = readBreakGlassEmails()): BreakGlassSignIn | null {
  if (session.impersonatedBy !== null || !isBreakGlassEmail(signInEmail, allowed)) return null;
  return { sessionId: session.id, userId: session.userId };
}
