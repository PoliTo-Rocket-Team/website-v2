// The signed-in person as lib/current-user.ts answers them, built from a
// Better Auth session. Kept apart from that file, which reads Next's request,
// so the session rules here are tested on their own.

/**
 * The signed-in person, as much as the pages need of it: always a real
 * Better Auth session (issue #612), plain or View as. `actingAccountId` is
 * the account behind a View as session (issue #604): `id` is then the person
 * viewed as, and `actingAccountId` who is viewing; it is null for a plain
 * session.
 */
export type CurrentUser = { readonly id: string; readonly name: string; readonly actingAccountId: string | null };

/** The acting account a Better Auth session names in `impersonatedBy`; null for a plain session, or one from before the column. */
export function impersonatorOf(session: object): string | null {
  const by = (session as { impersonatedBy?: unknown }).impersonatedBy;
  return typeof by === "string" && by !== "" ? by : null;
}

/** The account a session belongs to: the person it is for, and the acting account when it is a View as session. */
export function accountUserOf(session: { readonly userId: string; readonly name: string; readonly impersonatedBy: string | null }): CurrentUser {
  return { id: session.userId, name: session.name, actingAccountId: session.impersonatedBy };
}
