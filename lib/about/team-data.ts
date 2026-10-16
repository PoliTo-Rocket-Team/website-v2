import "server-only";

import { isDatabaseConfigured } from "@/db/client";
import { readTeamSnapshot, recordsOf, rosterOf } from "@/lib/dashboard/team-database";
import { NO_EDITS } from "@/lib/dummy-data/edits";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import { dummyOrg, dummyRecords, editedRoster } from "@/lib/dummy-data/team-pages";
import { team } from "./team";
import { teamPageFromRoles, teamPeopleOf, type TeamRoles } from "./team-roles";
import type { TeamPage } from "./types";

/** The dummy team (lib/dummy-data/) as the test developer starts it, with none of their edits. */
function dummyTeamRoles(): TeamRoles {
  return { org: dummyOrg(NO_EDITS).org, people: teamPeopleOf(editedRoster(NO_EDITS), dummyRecords(NO_EDITS, [])) };
}

/**
 * What /about/the-team shows (issue #282), read from the environment alone so
 * the page prerenders: the team built from the database's cached roles (tag
 * `team-roster`, which every role write refreshes), or from the dummy team in
 * dummy mode (lib/dummy-data/mode.ts). With no database, or roles that cannot
 * fill the page yet (`teamPageFromRoles`), the hand-typed ./team.ts.
 */
export async function teamPageData(): Promise<TeamPage> {
  if (dummyDataOn()) return teamPageFromRoles(dummyTeamRoles(), team) ?? team;
  if (!isDatabaseConfigured()) return team;
  const snapshot = await readTeamSnapshot();
  return teamPageFromRoles({ org: snapshot.org, people: teamPeopleOf(rosterOf(snapshot), recordsOf(snapshot)) }, team) ?? team;
}
