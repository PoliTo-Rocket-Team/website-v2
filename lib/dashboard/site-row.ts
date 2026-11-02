// A login whose site row is gone (issue #910). A returning Google sign-in
// finds its login through the linked Google account and never writes
// `better_auth."user"`, so the `sync_auth_users` trigger (drizzle/0001) never
// runs for it: a login whose `public.users` row was removed stays without
// one, and the dashboard cannot open. Each new session repairs that first
// (./database-site-row.ts): the login takes over the one unclaimed row that
// carries its email, as the trigger does, or gets a fresh empty row.

/** The login a session belongs to: its id and the email it signs in with. */
export type Login = { readonly id: string; readonly email: string };

/**
 * A `public.users` row the login may land on: one with the login's id, or one
 * whose email matches it. `heldByLogin` says a `better_auth."user"` has the
 * row's id; `closed` says Delete account set its `deleted_at`.
 */
export type SiteRowCandidate = {
  readonly id: string;
  readonly email: string;
  readonly heldByLogin: boolean;
  readonly closed: boolean;
};

/**
 * What a new session does for its login's site row: nothing when the login
 * has one, take over an unclaimed row with its email, or create a fresh
 * empty row.
 */
export type SiteRowStep =
  | { readonly kind: "present" }
  | { readonly kind: "attach"; readonly rowId: string }
  | { readonly kind: "create" };

/** Two emails name the same address whatever their case and the spaces around them. */
export function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The step for `login` over the rows it may land on. A row with the login's
 * id is its own. Otherwise the login takes over the one row with its email
 * that no other login holds and that was not closed: a row another live login
 * holds is that person's, and re-opening a closed account is not this step's
 * call. With no such row, or with several, where picking one would be a
 * guess, the login gets a fresh row and every other row is left as it is.
 */
export function siteRowStepOf(login: Login, rows: readonly SiteRowCandidate[]): SiteRowStep {
  if (rows.some((row) => row.id === login.id)) return { kind: "present" };
  const free = rows.filter((row) => sameEmail(row.email, login.email) && !row.heldByLogin && !row.closed);
  return free.length === 1 ? { kind: "attach", rowId: free[0].id } : { kind: "create" };
}
