// Who the request in a server-side access test is signed in as (issue #477):
// the fake `@/lib/current-user` answers this, and the fake `next/headers`
// carries a session cookie exactly when someone is signed in.

let signedIn: string | null = null;

/** Signs the next calls in as the user with this id; null signs out. */
export function signInAs(userId: string | null): void {
  signedIn = userId;
}

export function signedInUser(): string | null {
  return signedIn;
}
