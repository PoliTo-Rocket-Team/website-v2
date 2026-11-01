import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import { getDb } from "@/db/client";
import { members, prtEmailRemovals } from "@/db/schema";
import { refreshAfter } from "@/lib/cache-tags";
import { runAuditBatch } from "@/lib/db-audit";
import { answersAliasRequests } from "./alias-request";
import type { DashboardIdentity } from "./database";
import type { AttentionItem } from "./overview";
import {
  checkPrtEmailRemovalAnswer,
  planPrtEmailRemovalAnswer,
  PRT_EMAIL_REMOVAL_ALREADY_ANSWERED,
  prtEmailRemovalAttentionFor,
  type OpenPrtEmailRemoval,
} from "./prt-email-removal";
import { memberNamesOf, readTeamSnapshot } from "./team-database";
import { refused, written, type WriteResult } from "./write";

// Personal PRT email removals on the database (issue #931): the open rows of
// `prt_email_removals` as the approvers' rows, and their Mark done and Keep
// address. The database opens and cancels the rows itself when a `roles`
// write commits (drizzle/0084); what they mean and who answers them are
// ./prt-email-removal.ts's. The reads go to the table, not the cached team
// snapshot, so an answer shows at once.

/** The removals still open: all of them, or one by id. */
async function readOpenPrtEmailRemovals(filter: { readonly id?: number } = {}): Promise<OpenPrtEmailRemoval[]> {
  const rows = await getDb()
    .select({ id: prtEmailRemovals.id, member_id: prtEmailRemovals.memberId, address: prtEmailRemovals.address, created_at: prtEmailRemovals.createdAt })
    .from(prtEmailRemovals)
    .where(and(isNull(prtEmailRemovals.outcome), filter.id === undefined ? undefined : eq(prtEmailRemovals.id, filter.id)));
  return rows.map((r) => ({ id: r.id, memberId: r.member_id, address: r.address, openedAt: r.created_at }));
}

/** The open removals as the viewer's rows under Needs your attention: the alias approver seats only. */
export async function readPrtEmailRemovalAttention(identity: DashboardIdentity, now: Date): Promise<AttentionItem[]> {
  // By the seat alone, so the break-glass admin with no member row answers too (issue #646).
  if (!answersAliasRequests(identity)) return [];
  const [open, snapshot] = await Promise.all([readOpenPrtEmailRemovals(), readTeamSnapshot()]);
  // Named off every member record: the member has left the team.
  return prtEmailRemovalAttentionFor(identity, open, memberNamesOf(snapshot), now);
}

/** Postgres' division_by_zero: how the claim fails its batch when the removal is answered already. */
const DIVISION_BY_ZERO = "22012";

function isClaimGuardFailure(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === DIVISION_BY_ZERO) return true;
  }
  return false;
}

/**
 * Mark done (`removed`) or Keep address (`kept`) on an open removal, checked
 * by `planPrtEmailRemovalAnswer`. One batch claims the removal, recording the
 * answer and who gave it, and for Mark done clears the member's PRT email
 * and its set-up time, only while it is still the address removed, so an
 * address the member was given since stays. Of two answers on one removal,
 * the second waits for the first's row lock, claims nothing, and its batch
 * rolls back, so it is refused and writes nothing; so is an answer on a
 * removal a rejoin cancelled meanwhile.
 */
export async function answerPrtEmailRemoval(identity: DashboardIdentity, removalId: number, input: unknown): Promise<WriteResult<null>> {
  const checked = checkPrtEmailRemovalAnswer(input);
  if (!checked.ok) return refused(checked.error);
  const planned = planPrtEmailRemovalAnswer(identity);
  if (!planned.ok) return refused(planned.error);
  const [removal] = await readOpenPrtEmailRemovals({ id: removalId });
  if (!removal) return refused(PRT_EMAIL_REMOVAL_ALREADY_ANSWERED);
  const answer = checked.value;
  try {
    await runAuditBatch((db) => {
      const claimed = db.$with("claimed").as(
        db
          .update(prtEmailRemovals)
          .set({ outcome: answer, answeredBy: identity.memberId, answeredByActingAccount: identity.actingAccountId, answeredAt: new Date().toISOString() })
          .where(and(eq(prtEmailRemovals.id, removalId), isNull(prtEmailRemovals.outcome)))
          .returning({ id: prtEmailRemovals.id }),
      );
      // Division by zero is how one plain statement fails its transaction.
      const claim = db.with(claimed).select({ claimed: sql<number>`1 / (count(*) = 1)::int` }).from(claimed);
      if (answer === "kept" || removal.memberId === null) return [claim];
      return [
        claim,
        db
          .update(members)
          .set({ prtEmail: null, emailAliasSetUpAt: null })
          .where(and(eq(members.memberId, removal.memberId), eq(sql`lower(btrim(${members.prtEmail}))`, removal.address.toLowerCase()))),
      ];
    });
  } catch (error) {
    if (isClaimGuardFailure(error)) return refused(PRT_EMAIL_REMOVAL_ALREADY_ANSWERED);
    throw error;
  }
  if (answer === "removed") refreshAfter("team", updateTag);
  return written(null);
}
