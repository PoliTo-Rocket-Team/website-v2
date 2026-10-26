import "server-only";

import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { teamAddresses } from "@/db/schema";
import { memberTeamAddressesFor, movesWithOf, type MemberTeamAddresses, type TeamAddress } from "./team-address";
import { readTeamSnapshot, teamPeopleOf } from "./team-database";

// Shared team addresses on the database (epic #578, issue #786): the rows
// `team_addresses` holds for the members the side view opens. What a row
// means and how the side view lists it is ./team-address.ts's; this module
// reads the rows. The read goes to the table, not the cached team snapshot,
// so a later slice's write shows at once.

/** The team addresses `holderIds` hold, as stored. */
async function readHeldAddresses(holderIds: readonly number[]): Promise<TeamAddress[]> {
  const rows = await getDb()
    .select({
      address: teamAddresses.address,
      purpose: teamAddresses.purpose,
      holder_id: teamAddresses.holderId,
      moves_with: teamAddresses.movesWith,
      moves_with_seat: teamAddresses.movesWithSeat,
      moves_with_dept_id: teamAddresses.movesWithDeptId,
      moves_with_division_id: teamAddresses.movesWithDivisionId,
    })
    .from(teamAddresses)
    .where(inArray(teamAddresses.holderId, [...holderIds]));
  return rows.map((r) => ({ address: r.address, purpose: r.purpose, holderId: r.holder_id, movesWith: movesWithOf(r) }));
}

/**
 * The member side view's Team addresses row of each of `memberIds` (board
 * 102). It shows to every viewer of the PRT email row, so it is read for the
 * same members the alias read is; the caller checks the viewer reaches
 * Members.
 */
export async function readMemberTeamAddresses(memberIds: readonly number[]): Promise<MemberTeamAddresses> {
  if (memberIds.length === 0) return {};
  const [snapshot, held] = await Promise.all([readTeamSnapshot(), readHeldAddresses(memberIds)]);
  return memberTeamAddressesFor({ memberIds, team: teamPeopleOf(snapshot), org: snapshot.org, held });
}
