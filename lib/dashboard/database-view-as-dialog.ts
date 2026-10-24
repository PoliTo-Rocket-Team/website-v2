import "server-only";

import { and, asc, eq, ilike, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { alumniEntries, betterAuthUsers, departments, divisions, members, roles, users } from "@/db/schema";
import type { CurrentUser } from "@/lib/current-user";
import { actingTitleIn, readActingTitles } from "./database-acting-account";
import { readViewAsAccount } from "./database-view-as";
import {
  VIEW_AS_REFUSAL_MESSAGES,
  VIEW_AS_SHOWN,
  mayUseViewAs,
  viewAsPeopleOf,
  viewAsSiteOf,
  type ViewAsCandidate,
  type ViewAsOpening,
  type ViewAsRole,
  type ViewAsSearch,
  type ViewAsSite,
} from "./view-as";
import { SEAT_OF_FLAG } from "./viewer";

// The View as dialog's server side (issue #610, board 96): whether the
// signed-in account may open it, and the people its search finds. Both ask
// the same rule the start itself asks (lib/dashboard/view-as.ts), so an
// account the gate refuses never gets the dialog nor a single name from it,
// whatever address it opens.

/**
 * The dialog's opening for this account, or null when it may not have one:
 * a View as session (one is stopped before another starts) and anyone the
 * gate refuses on this site.
 */
export async function readViewAsOpening(user: CurrentUser | null, site: ViewAsSite = viewAsSiteOf()): Promise<ViewAsOpening | null> {
  if (user === null || user.actingAccountId !== null) return null;
  const account = await readViewAsAccount(user.id);
  if (account === null || !mayUseViewAs(account, site)) return null;
  const actingTitle = actingTitleIn(await readActingTitles([user.id]), user.id);
  return actingTitle === null ? null : { actingTitle };
}

/** How many accounts one search reads before the gate's own rule drops the ones it would refuse. */
const READ_AHEAD = VIEW_AS_SHOWN * 5;

/** A LIKE pattern that holds `text` anywhere, its own wildcards matched as plain characters. */
function containing(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * The people whose name holds `text` (case-insensitive), by name, for the
 * account that opened the dialog; refused for an account with no opening.
 */
export async function searchViewAsPeople(user: CurrentUser | null, text: string, site: ViewAsSite = viewAsSiteOf()): Promise<ViewAsSearch> {
  if (user === null || (await readViewAsOpening(user, site)) === null) {
    return { kind: "refused", message: VIEW_AS_REFUSAL_MESSAGES["not-allowed"] };
  }
  const candidates = await readCandidates(user.id, text.trim());
  return { kind: "people", people: viewAsPeopleOf(candidates, user.id, site) };
}

async function readCandidates(actingAccountId: string, text: string): Promise<ViewAsCandidate[]> {
  const db = getDb();
  // The name the dashboard shows (readIdentity in ./database.ts): first and last name, else the account's own.
  const name = sql<string>`coalesce(nullif(trim(concat_ws(' ', ${users.firstName}, ${users.lastName})), ''), ${betterAuthUsers.name})`;
  const accounts = await db
    .select({
      id: betterAuthUsers.id,
      name,
      memberId: users.member,
      picture: members.picture,
      teamTo: members.teamTo,
      alumniEntry: alumniEntries.id,
    })
    .from(betterAuthUsers)
    .leftJoin(users, eq(users.id, betterAuthUsers.id))
    .leftJoin(members, eq(members.memberId, users.member))
    .leftJoin(alumniEntries, eq(alumniEntries.memberId, users.member))
    .where(and(ne(betterAuthUsers.id, actingAccountId), isNull(users.deletedAt), text === "" ? undefined : ilike(name, containing(text))))
    .orderBy(asc(name))
    .limit(READ_AHEAD);

  const memberIds = accounts.flatMap((a) => (a.memberId === null ? [] : [a.memberId]));
  const roleRows =
    memberIds.length === 0
      ? []
      : await db
          .select({
            memberId: roles.memberId,
            type: roles.type,
            title: roles.title,
            fullAccess: roles.fullAccess,
            startedAt: roles.startedAt,
            unitName: sql<string | null>`coalesce(${divisions.name}, ${departments.name})`,
          })
          .from(roles)
          .leftJoin(divisions, eq(roles.divisionId, divisions.id))
          // A head's role names its department; a lead's names it through the division (issue #230).
          .leftJoin(departments, eq(departments.id, sql`coalesce(${roles.deptId}, ${divisions.deptId})`))
          .where(and(inArray(roles.memberId, memberIds), isNull(roles.leavedAt)));

  return accounts.map((a) => {
    const held: ViewAsRole[] = roleRows
      .filter((r) => a.memberId !== null && r.memberId === a.memberId)
      .map((r) => ({ type: r.type, title: r.title, seat: r.fullAccess === null ? null : SEAT_OF_FLAG[r.fullAccess], startedAt: r.startedAt, unitName: r.unitName }));
    return {
      id: a.id,
      name: a.name,
      photoUrl: a.picture,
      roles: held,
      alumnus: held.length === 0 && a.alumniEntry !== null ? { teamTo: a.teamTo } : null,
    };
  });
}
