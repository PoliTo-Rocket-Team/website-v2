import { signedInUser } from "../session";

// Stands in for `@/lib/current-user` in the server-side access tests: the
// signed-in account is the one the test names, never a cookie, in a plain
// session (no acting account behind it).

export type CurrentUser = { readonly session: "account"; readonly id: string; readonly name: string; readonly actingAccountId: null };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = signedInUser();
  return id === null ? null : { session: "account", id, name: id, actingAccountId: null };
}

export async function getCurrentUserId(): Promise<string | null> {
  return signedInUser();
}
