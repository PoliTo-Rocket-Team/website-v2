import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db/client";
import { TEAM_ROSTER_CACHE_TAG } from "@/lib/cache-tags";
import { queryTeamSnapshot, type TeamSnapshot } from "./team-snapshot";

// The database side of the Team pages (issue #143). One cached snapshot of
// every role, the open org chart and every scope (ADR 0003: full-directory
// reads are cached, tagged, never per view); ./database.ts filters it by
// the viewer after the cache hit. What the pages read from the snapshot is
// ./team-snapshot.ts. The Alumni pages read their own record
// (./database-alumni.ts).

/** Tag for the snapshot; a write that changes who is on the team invalidates it (lib/cache-tags.ts). */
export { TEAM_ROSTER_CACHE_TAG };

export { aliasTeamOf, memberNamesOf, recordsOf, rosterOf, seatsOf, teamPeopleOf, teamRolesOf, type TeamSnapshot } from "./team-snapshot";

export async function readTeamSnapshot(): Promise<TeamSnapshot> {
  "use cache";
  cacheTag(TEAM_ROSTER_CACHE_TAG);
  cacheLife("hours");
  return queryTeamSnapshot(getDb());
}
