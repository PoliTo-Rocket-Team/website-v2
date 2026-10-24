import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betterAuthUsers, logs, roles, users } from "@/db/schema";
import {
  VIEW_AS_OPERATIONS,
  viewAsRefusalOf,
  viewAsSiteOf,
  type ViewAsAccount,
  type ViewAsEntry,
  type ViewAsRefusal,
  type ViewAsSite,
} from "./view-as";
import { SEAT_OF_FLAG } from "./viewer";

// The database side of View as (issue #604): the accounts the rule in
// ./view-as.ts decides on, read at request time, and the Activity log entry
// each start and stop writes. lib/auth.ts hands both to the View as plugin
// (lib/view-as-plugin.ts). Not marked server-only, as lib/auth.ts is not.

/**
 * The account as View as reads it, or null when no Better Auth account has
 * this id: the full-access seat of each role it holds now (a role it left is
 * not read, so a hand-over takes effect at once).
 */
export async function readViewAsAccount(userId: string): Promise<ViewAsAccount | null> {
  const db = getDb();
  const [[account], seatRows] = await Promise.all([
    db.select({ id: betterAuthUsers.id }).from(betterAuthUsers).where(eq(betterAuthUsers.id, userId)).limit(1),
    db
      .select({ fullAccess: roles.fullAccess })
      .from(roles)
      .innerJoin(users, eq(users.member, roles.memberId))
      .where(and(eq(users.id, userId), isNull(roles.leavedAt))),
  ]);
  if (!account) return null;
  return {
    activeRoles: seatRows.map((r) => ({ fullAccess: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess] })),
  };
}

/** Why the acting account may not view as the person, read now; null when it may. */
export async function viewAsRefusal(
  start: { readonly actingAccountId: string; readonly viewingAs: boolean; readonly personId: string },
  site: ViewAsSite = viewAsSiteOf(),
): Promise<ViewAsRefusal | null> {
  const [acting, person] = await Promise.all([readViewAsAccount(start.actingAccountId), readViewAsAccount(start.personId)]);
  return viewAsRefusalOf({ ...start, acting, person }, site);
}

/**
 * Writes the one Activity log entry for a View as start or stop: on the
 * session, under the acting account, naming both the person viewed as and
 * the acting account.
 */
export async function recordViewAs(entry: ViewAsEntry): Promise<void> {
  await getDb()
    .insert(logs)
    .values({
      schemaName: "better_auth",
      tableName: "session",
      operation: VIEW_AS_OPERATIONS[entry.event],
      recordId: entry.sessionId,
      newData: { personId: entry.personId, actingAccountId: entry.actingAccountId },
      changedBy: entry.actingAccountId,
    });
}
