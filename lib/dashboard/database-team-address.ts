import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { teamAddresses, teamAddressRequests } from "@/db/schema";
import { runAuditQuery } from "@/lib/db-audit";
import type { DashboardIdentity } from "./database";
import {
  alreadyRequested,
  checkTeamAddressRequest,
  memberTeamAddressesFor,
  movesWithOf,
  NO_TEAM_ADDRESSES,
  planTeamAddressRequest,
  storedTieOf,
  type MemberTeamAddresses,
  type TeamAddress,
} from "./team-address";
import { readTeamSnapshot, teamPeopleOf } from "./team-database";
import { refused, written, type WriteResult } from "./write";

// Shared team addresses on the database (epic #578, issues #786 and #787):
// the rows `team_addresses` holds for the members the side view opens, and
// Request team address, stored in `team_address_requests`. What a row means,
// how the side view lists it and who may ask are ./team-address.ts's; this
// module reads and writes the rows. The reads go to the tables, not the
// cached team snapshot, so a write shows at once.

/** Postgres' unique_violation: the second open request `team_address_requests_one_open` refuses. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

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
 * The member side view's Team addresses row of each of `memberIds` (boards
 * 102 and 102b), as the viewer sees it. It shows to every viewer of the PRT
 * email row, so it is read for the same members the alias read is; the
 * caller checks the viewer reaches Members.
 */
export async function readMemberTeamAddresses(identity: DashboardIdentity, memberIds: readonly number[]): Promise<MemberTeamAddresses> {
  if (memberIds.length === 0) return NO_TEAM_ADDRESSES;
  const [snapshot, held] = await Promise.all([readTeamSnapshot(), readHeldAddresses(memberIds)]);
  return memberTeamAddressesFor({ viewerId: identity.memberId, standing: identity, memberIds, team: teamPeopleOf(snapshot), org: snapshot.org, held });
}

/** The stored team addresses and open requests equal to `address` in any letter case. */
async function readSameAddress(address: string): Promise<{ held: string[]; open: string[] }> {
  const db = getDb();
  const [held, open] = await Promise.all([
    db.select({ address: teamAddresses.address }).from(teamAddresses).where(eq(sql`lower(${teamAddresses.address})`, address)),
    db
      .select({ address: teamAddressRequests.address })
      .from(teamAddressRequests)
      .where(and(eq(sql`lower(${teamAddressRequests.address})`, address), isNull(teamAddressRequests.outcome))),
  ]);
  return { held: held.map((r) => r.address), open: open.map((r) => r.address) };
}

/**
 * Request team address (board 102b), checked by `checkTeamAddressRequest`
 * and `planTeamAddressRequest`: the request is stored as open. A second open
 * request for the address sent between the check and the insert is refused by
 * `team_address_requests_one_open`, with the check's own message.
 */
export async function requestTeamAddress(identity: DashboardIdentity, input: unknown): Promise<WriteResult<null>> {
  const snapshot = await readTeamSnapshot();
  const checked = checkTeamAddressRequest(input, snapshot.org);
  if (!checked.ok) return refused(checked.error);
  const { held, open } = await readSameAddress(checked.value.address);
  const planned = planTeamAddressRequest({
    requesterId: identity.memberId,
    standing: identity,
    request: checked.value,
    team: teamPeopleOf(snapshot),
    org: snapshot.org,
    held,
    open,
  });
  if (!planned.ok) return refused(planned.error);
  const request = planned.value;
  const tie = storedTieOf(request.movesWith);
  try {
    await runAuditQuery((db) =>
      db.insert(teamAddressRequests).values({
        memberId: request.memberId,
        address: request.address,
        purpose: request.purpose,
        movesWith: tie.moves_with,
        movesWithSeat: tie.moves_with_seat,
        movesWithDeptId: tie.moves_with_dept_id,
        movesWithDivisionId: tie.moves_with_division_id,
        requestedBy: request.requesterId,
        requestedByActingAccount: identity.actingAccountId,
      }),
    );
  } catch (error) {
    if (isUniqueViolation(error)) return refused(alreadyRequested(request.address));
    throw error;
  }
  return written(null);
}
