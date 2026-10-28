// Who the request in a server-side access test is signed in as (issue #477):
// the fake `@/lib/current-user` answers this, and the fake `next/headers`
// carries a session cookie exactly when someone is signed in.

let signedIn: string | null = null;
let acting: string | null = null;

/** Signs the next calls in as the user with this id, in a plain session; null signs out. */
export function signInAs(userId: string | null): void {
  signedIn = userId;
  acting = null;
}

/**
 * Signs the next calls in as a View as session (issue #605): the session is
 * the person's, and `actingAccountId` is the account behind it, as the
 * session's own `impersonatedBy` names it.
 */
export function viewAs(personId: string, actingAccountId: string): void {
  signedIn = personId;
  acting = actingAccountId;
}

export function signedInUser(): string | null {
  return signedIn;
}

/** The account behind the session when it is a View as one; null for a plain session or nobody. */
export function actingAccount(): string | null {
  return signedIn === null ? null : acting;
}
