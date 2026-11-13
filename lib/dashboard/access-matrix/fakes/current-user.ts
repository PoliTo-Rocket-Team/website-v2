import { seatSignedIn } from "../fixture";
import { actingAccount, signedInUser } from "../session";

// Stands in for `@/lib/current-user` in the server-side access tests: the
// signed-in account is the one the test names, never a cookie, in a plain
// session or, after `viewAs`, a View as session whose acting account the
// session names (issue #605). A matrix viewer who shares a seat with an
// earlier one takes that seat as the call reads them (`seatSignedIn`).

export type CurrentUser = { readonly id: string; readonly name: string; readonly actingAccountId: string | null };

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const id = await getCurrentUserId();
  return id === null ? null : { id, name: id, actingAccountId: actingAccount() };
}

export async function getCurrentUserId(): Promise<string | null> {
  const id = signedInUser();
  if (id !== null) await seatSignedIn(id);
  return id;
}
