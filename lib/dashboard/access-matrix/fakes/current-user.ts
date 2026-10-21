import { signedInUser } from "../session";

// Stands in for `@/lib/current-user` in the server-side access tests: the
// signed-in account is the one the test names, never a cookie.

export type CurrentUser = { readonly session: "account"; readonly id: string; readonly name: string };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = signedInUser();
  return id === null ? null : { session: "account", id, name: id };
}

export async function getCurrentUserId(): Promise<string | null> {
  return signedInUser();
}
