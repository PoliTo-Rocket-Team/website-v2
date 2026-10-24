import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { roles, users } from "@/db/schema";
import { actingTitleOf } from "./acting-account";
import { SEAT_OF_FLAG } from "./viewer";

/** The title each acting account's writes show under (`actingTitleOf`), by account id. */
export type ActingTitles = ReadonlyMap<string, string>;

/**
 * The title of each acting account a set of rows names (issue #605), read
 * from every role it holds or held. Every id given gets one, so a recorded
 * acting account never reads as the person alone.
 */
export async function readActingTitles(accountIds: Iterable<string | null>): Promise<ActingTitles> {
  const ids = [...new Set([...accountIds].filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const seats = await getDb()
    .select({ user_id: users.id, full_access: roles.fullAccess })
    .from(roles)
    .innerJoin(users, eq(users.member, roles.memberId))
    .where(inArray(users.id, ids));
  return new Map(
    ids.map((id) => [
      id,
      actingTitleOf(seats.filter((s) => s.user_id === id).map((s) => (s.full_access === null ? null : SEAT_OF_FLAG[s.full_access]))),
    ]),
  );
}

/** The acting title of one row's acting account; null when it names none. */
export function actingTitleIn(titles: ActingTitles, accountId: string | null): string | null {
  return accountId === null ? null : (titles.get(accountId) ?? null);
}
