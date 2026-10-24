import { actingAccount, signedInUser } from "../session";

// Stands in for `@/lib/current-user` in the server-side access tests: the
// signed-in account is the one the test names, never a cookie, in a plain
// session or, after `viewAs`, a View as session whose acting account the
// session names (issue #605).

export type CurrentUser = { readonly id: string; readonly name: string; readonly actingAccountId: string | null };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = signedInUser();
  return id === null ? null : { id, name: id, actingAccountId: actingAccount() };
}

export async function getCurrentUserId(): Promise<string | null> {
  return signedInUser();
}
