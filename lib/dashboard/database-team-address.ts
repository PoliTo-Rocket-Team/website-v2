import "server-only";

import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dashboardNotices, teamAddresses, teamAddressRequests } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { answersAliasRequests } from "./alias-request";
import { actingTitleIn, readActingTitles } from "./database-acting-account";
import type { DashboardIdentity } from "./database";
import type { AttentionItem } from "./overview";
import {
  alreadyHeld,
  alreadyRequested,
  checkTeamAddressAnswer,
  checkTeamAddressRequest,
  memberTeamAddressesFor,
  movesWithOf,
  NO_TEAM_ADDRESSES,
  planTeamAddressAnswer,
  planTeamAddressRequest,
  storedTieOf,
  teamAddressAnswerNotices,
  teamAddressAttentionFor,
  type MemberTeamAddresses,
  type OpenTeamAddressRequest,
  type TeamAddress,
} from "./team-address";
import { readTeamSnapshot, teamPeopleOf } from "./team-database";
import { refused, written, type WriteResult } from "./write";

// Shared team addresses on the database (epic #578, issues #786 to #788):
// the rows `team_addresses` holds for the members the side view opens,
// Request team address, stored in `team_address_requests`, and the
// approvers' Decline and Mark created. What a row means, how the side view
// lists it, who may ask and who answers are ./team-address.ts's; this module
// reads and writes the rows. The reads go to the tables, not the cached team
// snapshot, so a write shows at once.

/**
 * Postgres' unique_violation: the second open request
 * `team_address_requests_one_open` refuses, or the second holder
 * `team_addresses_address` refuses.
 */
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

// Decline and Mark created (the alias boards 94c and 94d, issue #788) -------------

/** The requests still open: all of them, or one by id. */
async function readOpenTeamAddressRequests(filter: { readonly id?: number } = {}): Promise<OpenTeamAddressRequest[]> {
  const rows = await getDb()
    .select({
      id: teamAddressRequests.id,
      member_id: teamAddressRequests.memberId,
      address: teamAddressRequests.address,
      purpose: teamAddressRequests.purpose,
      moves_with: teamAddressRequests.movesWith,
      moves_with_seat: teamAddressRequests.movesWithSeat,
      moves_with_dept_id: teamAddressRequests.movesWithDeptId,
      moves_with_division_id: teamAddressRequests.movesWithDivisionId,
      requested_by: teamAddressRequests.requestedBy,
      requested_by_acting_account: teamAddressRequests.requestedByActingAccount,
      created_at: teamAddressRequests.createdAt,
    })
    .from(teamAddressRequests)
    .where(and(isNull(teamAddressRequests.outcome), filter.id === undefined ? undefined : eq(teamAddressRequests.id, filter.id)));
  const titles = await readActingTitles(rows.map((r) => r.requested_by_acting_account));
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    address: r.address,
    purpose: r.purpose,
    movesWith: movesWithOf(r),
    requesterId: r.requested_by,
    requesterActingTitle: actingTitleIn(titles, r.requested_by_acting_account),
    sentAt: r.created_at,
  }));
}

/** The open requests as the viewer's rows under Needs your attention: the alias approver seats only. */
export async function readTeamAddressAttention(identity: DashboardIdentity, now: Date): Promise<AttentionItem[]> {
  // By the seat alone, so the break-glass admin with no member row answers too (issue #646).
  if (!answersAliasRequests(identity)) return [];
  const [open, snapshot] = await Promise.all([readOpenTeamAddressRequests(), readTeamSnapshot()]);
  return teamAddressAttentionFor(identity, open, teamPeopleOf(snapshot), snapshot.org, now);
}

/** The stored team addresses equal to `address` in any letter case, and the open requests for it other than `requestId`. */
async function readSameAddressElsewhere(address: string, requestId: number): Promise<{ held: string[]; openElsewhere: string[] }> {
  const db = getDb();
  const [held, open] = await Promise.all([
    db.select({ address: teamAddresses.address }).from(teamAddresses).where(eq(sql`lower(${teamAddresses.address})`, address)),
    db
      .select({ address: teamAddressRequests.address })
      .from(teamAddressRequests)
      .where(
        and(eq(sql`lower(${teamAddressRequests.address})`, address), isNull(teamAddressRequests.outcome), ne(teamAddressRequests.id, requestId)),
      ),
  ]);
  return { held: held.map((r) => r.address), openElsewhere: open.map((r) => r.address) };
}

/** What a second answer, or one on a request gone meanwhile, reads. */
const ALREADY_ANSWERED = "This team address request was already answered.";

/**
 * Decline or Mark created on the Overview, checked by `planTeamAddressAnswer`.
 * The request is closed first, so a second answer finds it gone; then one
 * batch stores the address under the member (Mark created) and writes the
 * notice to the requester. If that batch fails, the request is open again
 * (`undoTeamAddressClaim`): when the address became a team address meanwhile,
 * `team_addresses_address` refuses the insert and the answer is refused with
 * the request left open; when a newer request for the address came in
 * meanwhile, that one is kept and the answer is refused.
 */
export async function answerTeamAddress(identity: DashboardIdentity, requestId: number, input: unknown): Promise<WriteResult<null>> {
  const checked = checkTeamAddressAnswer(input);
  if (!checked.ok) return refused(checked.error);
  const [request] = await readOpenTeamAddressRequests({ id: requestId });
  if (!request) return refused(ALREADY_ANSWERED);
  const answer = checked.value;
  const same =
    answer.kind === "created" ? await readSameAddressElsewhere(answer.address.trim().toLowerCase(), requestId) : { held: [], openElsewhere: [] };
  const planned = planTeamAddressAnswer({ viewer: identity, request, answer, ...same });
  if (!planned.ok) return refused(planned.error);
  const plan = planned.value;
  const notices = teamAddressAnswerNotices(plan, identity.name);
  const claimed = await runAuditQuery((db) =>
    db
      .update(teamAddressRequests)
      .set({
        outcome: plan.kind === "created" ? "created" : "declined",
        answeredBy: identity.memberId,
        answeredByActingAccount: identity.actingAccountId,
        answeredAt: new Date().toISOString(),
      })
      .where(and(eq(teamAddressRequests.id, requestId), isNull(teamAddressRequests.outcome)))
      .returning({ id: teamAddressRequests.id }),
  );
  if (claimed.length === 0) return refused(ALREADY_ANSWERED);
  // A declined request whose requester is gone tells nobody, so nothing else is written.
  if (plan.kind === "decline" && notices.length === 0) return written(null);
  try {
    await runAuditBatch((db) => {
      const told = notices.map(({ recipientId, notice }) =>
        db.insert(dashboardNotices).values({
          recipientId,
          subjectId: request.memberId,
          kind: notice.kind,
          data: notice.data,
          writtenByActingAccount: identity.actingAccountId,
        }),
      );
      if (plan.kind === "decline") {
        const [first, ...rest] = told;
        return [first!, ...rest];
      }
      const tie = storedTieOf(request.movesWith);
      return [
        db.insert(teamAddresses).values({
          address: plan.address,
          purpose: request.purpose,
          holderId: request.memberId,
          movesWith: tie.moves_with,
          movesWithSeat: tie.moves_with_seat,
          movesWithDeptId: tie.moves_with_dept_id,
          movesWithDivisionId: tie.moves_with_division_id,
        }),
        ...told,
      ];
    });
  } catch (error) {
    const undone = await undoTeamAddressClaim(requestId);
    if (undone === "superseded") return refused(SUPERSEDED_ANSWER);
    if (plan.kind === "created" && isUniqueViolation(error)) return refused(alreadyHeld(plan.address));
    throw error;
  }
  return written(null);
}

/** What the approver reads when their answer failed and a newer request for the address came in meanwhile. */
const SUPERSEDED_ANSWER = "Your answer was not saved: a newer request for this address is open. Answer that one instead.";

/**
 * Takes back a claim whose follow-up batch failed: the request is open
 * again. While it was claimed the address had no open request, so a newer
 * one may have landed; then `team_address_requests_one_open` refuses the
 * reopen, the newer request is kept, and the claimed one closes as
 * cancelled, so no row says an answer was saved that was not.
 */
async function undoTeamAddressClaim(requestId: number): Promise<"reopened" | "superseded"> {
  try {
    await runAuditQuery((db) =>
      db
        .update(teamAddressRequests)
        .set({ outcome: null, answeredBy: null, answeredByActingAccount: null, answeredAt: null })
        .where(eq(teamAddressRequests.id, requestId)),
    );
    return "reopened";
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  await runAuditQuery((db) => db.update(teamAddressRequests).set({ outcome: "cancelled" }).where(eq(teamAddressRequests.id, requestId)));
  return "superseded";
}
