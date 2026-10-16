import "server-only";

import { isDatabaseConfigured } from "@/db/client";
import { cachedTeamPageLayer } from "@/lib/dashboard/database-team-page";
import { readTeamSnapshot, recordsOf, rosterOf } from "@/lib/dashboard/team-database";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import { dummyTeamPageLayerSeed, dummyTeamRoles } from "@/lib/dummy-data/team-page";
import { team } from "./team";
import { publicTeamPage } from "./team-page-editor";
import { teamPeopleOf, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

/** The team as the database's cached roles hold it (tag `team-roster`, which every role write refreshes). */
export async function databaseTeamRoles(): Promise<TeamRoles> {
  const snapshot = await readTeamSnapshot();
  return { org: snapshot.org, people: teamPeopleOf(rosterOf(snapshot), recordsOf(snapshot)) };
}

/**
 * What /about/the-team shows (issues #282 and #283), read from the
 * environment alone so the page prerenders: the team built from the
 * database's cached roles with the published visual layer laid on (tag
 * `team-page-layer`, which every layer write refreshes), or the dummy team
 * with the dummy seed's published layer in dummy mode
 * (lib/dummy-data/mode.ts). A draft never reaches it. With no database the
 * hand-typed ./team.ts; with roles that cannot fill the page yet, the same
 * with the layer's intro text and group photo (`publicTeamPage`).
 */
export async function teamPageData(): Promise<TeamPage> {
  if (dummyDataOn()) return publicTeamPage(dummyTeamRoles(), team, dummyTeamPageLayerSeed());
  if (!isDatabaseConfigured()) return team;
  const [roles, layer] = await Promise.all([databaseTeamRoles(), cachedTeamPageLayer()]);
  return publicTeamPage(roles, team, layer);
}
