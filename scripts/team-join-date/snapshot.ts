import { asc } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { members, users } from "@/db/schema";
import type * as schema from "@/db/schema";

// What the backfill reads from the database before it plans (issue #948): the
// addresses a roster row's emails find a member by, and each member's stored
// join day. Only selects.

export type BackfillDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export type Snapshot = {
  /** The member each address belongs to, in lower case: an account's email, or a member's PRT address. */
  readonly memberEmails: readonly { readonly email: string; readonly memberId: number }[];
  /** Each member's stored join day, null when none. */
  readonly joinedTeamOn: ReadonlyMap<number, string | null>;
};

export async function readSnapshot(db: BackfillDb): Promise<Snapshot> {
  const userRows = await db.select({ email: users.email, member: users.member }).from(users);
  const memberRows = await db
    .select({ memberId: members.memberId, prtEmail: members.prtEmail, joinedTeamOn: members.joinedTeamOn })
    .from(members)
    .orderBy(asc(members.memberId));
  const lower = (e: string) => e.trim().toLowerCase();
  return {
    memberEmails: [
      ...userRows.flatMap((u) => (u.member === null ? [] : [{ email: lower(u.email), memberId: u.member }])),
      ...memberRows.flatMap((m) => (m.prtEmail === null || m.prtEmail.trim() === "" ? [] : [{ email: lower(m.prtEmail), memberId: m.memberId }])),
    ],
    joinedTeamOn: new Map(memberRows.map((m) => [m.memberId, m.joinedTeamOn])),
  };
}
