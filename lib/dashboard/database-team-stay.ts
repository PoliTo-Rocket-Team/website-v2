import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { members, roles } from "@/db/schema";
import type { TeamStay } from "./team";

/**
 * The stored join day and earliest role start, ended roles included, that
 * `departureOf` reads the years from (issue #980). Every way of leaving the
 * team reads it here (issues #986, #987).
 */
export async function teamStayOf(personId: number): Promise<TeamStay> {
  const [row] = await getDb()
    .select({
      joinedTeamOn: members.joinedTeamOn,
      firstRoleStart: sql<string | null>`(select min(${roles.startedAt})::text from ${roles} where ${roles.memberId} = ${members.memberId})`,
    })
    .from(members)
    .where(eq(members.memberId, personId));
  return { joinedTeamOn: row?.joinedTeamOn ?? null, firstRoleStart: row?.firstRoleStart ?? null };
}
