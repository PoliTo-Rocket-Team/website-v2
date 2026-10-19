import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { handOverRequests } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import type { DashboardIdentity } from "./database";
import {
  checkHandOverSend,
  handOverAttentionFor,
  handOverOfferOf,
  planHandOverSend,
  type HandOverOffer,
  type HandOverRequest,
  type RequestedRole,
} from "./hand-over-request";
import type { AttentionItem } from "./overview";
import { readTeamSnapshot, teamPeopleOf } from "./team-database";
import { refused, written, type WriteResult } from "./write";

// Hand-overs sent from My profile on the database (issue #262): the requests
// waiting, the approver's rows, the sender's offer, and "Send for
// confirmation". What may be sent and who answers is ./hand-over-request.ts's;
// Confirm and Decline write roles, so they sit with the other hand-over writes
// (`answerHandOver`, ./database-team.ts).

type RequestRow = {
  id: number;
  from_id: number;
  role: "lead" | "head";
  division_id: number | null;
  dept_id: number | null;
  to_id: number;
  outcome: HandOverRequest["outcome"];
  created_at: string;
};

/** The role a stored row names; null for a row the unit check would refuse. */
function roleOf(row: RequestRow): RequestedRole | null {
  if (row.role === "lead") return row.division_id === null ? null : { kind: "lead", divisionId: row.division_id };
  return row.dept_id === null ? null : { kind: "head", departmentId: row.dept_id };
}

/** The requests still waiting for an answer: all of them, one person's, or one by id. */
export async function readWaitingHandOvers(filter: { readonly fromId?: number; readonly id?: number } = {}): Promise<HandOverRequest[]> {
  const rows: RequestRow[] = await getDb()
    .select({
      id: handOverRequests.id,
      from_id: handOverRequests.fromId,
      role: handOverRequests.role,
      division_id: handOverRequests.divisionId,
      dept_id: handOverRequests.deptId,
      to_id: handOverRequests.toId,
      outcome: handOverRequests.outcome,
      created_at: handOverRequests.createdAt,
    })
    .from(handOverRequests)
    .where(
      and(
        isNull(handOverRequests.decision),
        filter.fromId === undefined ? undefined : eq(handOverRequests.fromId, filter.fromId),
        filter.id === undefined ? undefined : eq(handOverRequests.id, filter.id),
      ),
    );
  return rows.flatMap((row) => {
    const role = roleOf(row);
    return role === null ? [] : [{ id: row.id, fromId: row.from_id, role, toId: row.to_id, outcome: row.outcome, sentAt: row.created_at }];
  });
}

/** The hand-overs the viewer answers, as their top rows under "Needs your attention" (board 62c). */
export async function readHandOverAttention(identity: DashboardIdentity, now: Date): Promise<AttentionItem[]> {
  if (identity.memberId === null) return [];
  // The cached snapshot needs nothing of the requests, so both are read at once (issue #397).
  const [requests, snapshot] = await Promise.all([readWaitingHandOvers(), readTeamSnapshot()]);
  if (requests.length === 0) return [];
  return handOverAttentionFor(identity.memberId, requests, teamPeopleOf(snapshot), snapshot.org, now);
}

/** My profile's "Hand over your role" (board 55d): the viewer's role, who may take over, and their request waiting. */
export async function readHandOverOffer(identity: DashboardIdentity): Promise<HandOverOffer | null> {
  const memberId = identity.memberId;
  if (memberId === null) return null;
  const [snapshot, [waiting]] = await Promise.all([readTeamSnapshot(), readWaitingHandOvers({ fromId: memberId })]);
  const team = teamPeopleOf(snapshot);
  const person = team.find((p) => p.id === memberId);
  return person ? handOverOfferOf(person, team, snapshot.org, waiting ?? null) : null;
}

/**
 * "Send for confirmation" (board 55d): the request is stored as waiting, and
 * no role changes. The table keeps one waiting request per person
 * (`hand_over_requests_one_waiting`), so a second send is refused, and a
 * request of theirs that lapsed is closed in the same write (`hasLapsed`).
 */
export async function sendHandOver(identity: DashboardIdentity, input: unknown): Promise<WriteResult<null>> {
  const memberId = identity.memberId;
  if (memberId === null) return refused("This page is for team members.");
  const checked = checkHandOverSend(input);
  if (!checked.ok) return refused(checked.error);
  const [snapshot, waiting] = await Promise.all([readTeamSnapshot(), readWaitingHandOvers({ fromId: memberId })]);
  const planned = planHandOverSend({ senderId: memberId, send: checked.value, team: teamPeopleOf(snapshot), org: snapshot.org, waiting });
  if (!planned.ok) return refused(planned.error);
  const { send, lapsed } = planned.value;
  const request = {
    fromId: memberId,
    role: send.role.kind,
    divisionId: send.role.kind === "lead" ? send.role.divisionId : null,
    deptId: send.role.kind === "head" ? send.role.departmentId : null,
    toId: send.to,
    outcome: send.outcome,
  };
  if (lapsed.length === 0) {
    await runAuditQuery((db) => db.insert(handOverRequests).values(request));
    return written(null);
  }
  await runAuditBatch((db) => [
    db
      .update(handOverRequests)
      .set({ decision: "lapsed", decidedAt: new Date().toISOString() })
      .where(and(inArray(handOverRequests.id, [...lapsed]), isNull(handOverRequests.decision))),
    db.insert(handOverRequests).values(request),
  ]);
  return written(null);
}
