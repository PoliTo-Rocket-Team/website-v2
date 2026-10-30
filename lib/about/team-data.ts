import "server-only";

import { isDatabaseConfigured } from "@/db/client";
import { cachedPublishedAdvisors } from "@/lib/dashboard/database-team-advisors";
import { cachedTeamPageLayer } from "@/lib/dashboard/database-team-page";
import { readTeamSnapshot, teamRolesOf } from "@/lib/dashboard/team-database";
import { publicAdvisors, withAdvisors } from "./advisors";
import { team } from "./team";
import { publicTeamPage } from "./team-page-editor";
import type { TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

/** The team as the database's cached roles hold it (tag `team-roster`, which every role write refreshes). */
export async function databaseTeamRoles(): Promise<TeamRoles> {
  return teamRolesOf(await readTeamSnapshot());
}

/**
 * What /about/the-team shows (issues #282 and #283), read from the
 * environment alone so the page prerenders: the team built from the
 * database's cached roles with the published visual layer laid on (tag
 * `team-page-layer`, which every layer write refreshes). A draft never
 * reaches it. With no database, which only production may run without
 * (lib/database-required.ts), the hand-typed ./team.ts; with roles that cannot fill the page yet, the same
 * with the layer's intro text and group photo (`publicTeamPage`). The
 * advisors are the published hand-added list (issue #286, tag
 * `team-page-advisors`), the record's own until the advisors' migration runs.
 */
export async function teamPageData(): Promise<TeamPage> {
  if (!isDatabaseConfigured()) return team;
  const [roles, layer, advisors] = await Promise.all([databaseTeamRoles(), cachedTeamPageLayer(), cachedPublishedAdvisors()]);
  const page = publicTeamPage(roles, team, layer);
  return advisors === null ? page : withAdvisors(page, advisors);
}
