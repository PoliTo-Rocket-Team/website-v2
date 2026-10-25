import { eq, inArray, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { roles, users } from "@/db/schema";
import { actingTitleOf } from "./acting-account";
import { viewAsSiteOf, type ViewAsSite } from "./view-as";
import { SEAT_OF_FLAG } from "./viewer";

/** The title each acting account's writes show under (`actingTitleOf`), by account id. */
export type ActingTitles = ReadonlyMap<string, string>;

/** One role an acting account holds or held, as its title is read from it. */
export type ActingSeat = { readonly user_id: string; readonly full_access: keyof typeof SEAT_OF_FLAG | null };

/**
 * The title of each acting account a set of rows names (issue #605), read
 * from every role it holds or held and the site this request runs on
 * (issue #646). Every id given gets one, so a recorded
 * acting account never reads as the person alone.
 */
export async function readActingTitles(accountIds: Iterable<string | null>, site: ViewAsSite = viewAsSiteOf()): Promise<ActingTitles> {
  const ids = accountIdsOf(accountIds);
  if (ids.length === 0) return new Map();
  return actingTitlesOf(ids, await readActingSeats(inArray(users.id, ids)), site);
}

/**
 * The roles of the acting accounts `which` selects on `users`. A read whose
 * rows name acting accounts can select them by its own condition and read
 * these beside its rows rather than after them (issue #397), then name the
 * titles with `actingTitlesOf`.
 */
export function readActingSeats(which: SQL): Promise<ActingSeat[]> {
  return getDb()
    .select({ user_id: users.id, full_access: roles.fullAccess })
    .from(roles)
    .innerJoin(users, eq(users.member, roles.memberId))
    .where(which);
}

/** The title of each acting account given, from the seats read for them; every id given gets one. */
export function actingTitlesOf(accountIds: Iterable<string | null>, seats: readonly ActingSeat[], site: ViewAsSite = viewAsSiteOf()): ActingTitles {
  return new Map(
    accountIdsOf(accountIds).map((id) => [
      id,
      actingTitleOf(seats.filter((s) => s.user_id === id).map((s) => (s.full_access === null ? null : SEAT_OF_FLAG[s.full_access])), site),
    ]),
  );
}

/** The acting title of one row's acting account; null when it names none. */
export function actingTitleIn(titles: ActingTitles, accountId: string | null): string | null {
  return accountId === null ? null : (titles.get(accountId) ?? null);
}

function accountIdsOf(accountIds: Iterable<string | null>): string[] {
  return [...new Set([...accountIds].filter((id): id is string => id !== null))];
}
