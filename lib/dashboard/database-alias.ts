import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { aliasRequests, dashboardNotices, members } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import {
  aliasAnswerNotices,
  aliasAttentionFor,
  checkAliasAnswer,
  memberAliasesFor,
  planAliasAnswer,
  planAliasCancel,
  planAliasRequest,
  type AliasRequest,
  type MemberAliases,
} from "./alias-request";
import { ownAliasOf, planAliasSetUp, type OwnAlias } from "./alias-setup";
import type { DashboardIdentity } from "./database";
import { isOffTeam } from "./viewer";
import type { AttentionItem } from "./overview";
import { readTeamSnapshot, teamPeopleOf } from "./team-database";
import { refused, written, type WriteResult } from "./write";

// Alias requests on the database (epic #538, issue #541): the open requests,
// the aliases on members' records, the approvers' rows, and Request alias,
// Cancel request, Decline and Mark created. Who may do what is
// ./alias-request.ts's; this module reads and writes the rows. Both reads go
// to the tables, not the cached team snapshot, so an answer shows at once.

/** Postgres' unique_violation: the second open request `alias_requests_one_open` refuses. */
const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ((e as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
  }
  return false;
}

/** The requests still open: all of them, or one by id. */
export async function readOpenAliasRequests(filter: { readonly id?: number } = {}): Promise<AliasRequest[]> {
  const rows = await getDb()
    .select({ id: aliasRequests.id, member_id: aliasRequests.memberId, requested_by: aliasRequests.requestedBy, created_at: aliasRequests.createdAt })
    .from(aliasRequests)
    .where(and(isNull(aliasRequests.outcome), filter.id === undefined ? undefined : eq(aliasRequests.id, filter.id)));
  return rows.map((r) => ({ id: r.id, memberId: r.member_id, requesterId: r.requested_by, sentAt: r.created_at }));
}

/** Every alias on a member's record, by member id. */
async function readAliasAddresses(): Promise<Map<number, string>> {
  const rows = await getDb()
    .select({ member_id: members.memberId, alias: members.emailAlias })
    .from(members)
    .where(isNotNull(members.emailAlias));
  return new Map(rows.flatMap((r) => (r.alias === null ? [] : [[r.member_id, r.alias] as const])));
}

/** The member drawer's alias of each of `memberIds` (boards 94, 94b, 94e), as the viewer sees it. */
export async function readMemberAliases(identity: DashboardIdentity, memberIds: readonly number[]): Promise<MemberAliases> {
  if (memberIds.length === 0) return {};
  const [snapshot, addresses, open] = await Promise.all([readTeamSnapshot(), readAliasAddresses(), readOpenAliasRequests()]);
  return memberAliasesFor({ viewerId: identity.memberId, memberIds, team: teamPeopleOf(snapshot), org: snapshot.org, addresses, open, now: new Date() });
}

/** The open requests as the viewer's rows under "Needs your attention" (board 94c): the three approver seats only. */
export async function readAliasAttention(identity: DashboardIdentity, now: Date): Promise<AttentionItem[]> {
  if (identity.memberId === null) return [];
  const [open, snapshot] = await Promise.all([readOpenAliasRequests(), readTeamSnapshot()]);
  return aliasAttentionFor(identity, open, teamPeopleOf(snapshot), snapshot.org, now);
}

/** Request alias (board 94): the request is stored as open; the index refuses a second one. */
export async function requestAlias(identity: DashboardIdentity, memberId: number): Promise<WriteResult<null>> {
  const [snapshot, addresses, open] = await Promise.all([readTeamSnapshot(), readAliasAddresses(), readOpenAliasRequests()]);
  const planned = planAliasRequest({
    requesterId: identity.memberId,
    memberId,
    team: teamPeopleOf(snapshot),
    org: snapshot.org,
    alias: addresses.get(memberId) ?? null,
    open,
  });
  if (!planned.ok) return refused(planned.error);
  try {
    await runAuditQuery((db) => db.insert(aliasRequests).values({ memberId, requestedBy: planned.value.requesterId }));
  } catch (error) {
    if (isUniqueViolation(error)) return refused("An alias for this member is already requested.");
    throw error;
  }
  return written(null);
}

/** Cancel request (board 94b): the request closes as cancelled; nobody is told. */
export async function cancelAliasRequest(identity: DashboardIdentity, requestId: number): Promise<WriteResult<null>> {
  const [[request], snapshot] = await Promise.all([readOpenAliasRequests({ id: requestId }), readTeamSnapshot()]);
  if (!request) return refused("This alias request was already answered.");
  const planned = planAliasCancel({ viewerId: identity.memberId, request, team: teamPeopleOf(snapshot), org: snapshot.org });
  if (!planned.ok) return refused(planned.error);
  const closed = await runAuditQuery((db) =>
    db
      .update(aliasRequests)
      .set({ outcome: "cancelled", answeredBy: identity.memberId, answeredAt: new Date().toISOString() })
      .where(and(eq(aliasRequests.id, requestId), isNull(aliasRequests.outcome)))
      .returning({ id: aliasRequests.id }),
  );
  return closed.length === 0 ? refused("This alias request was already answered.") : written(null);
}

/**
 * Decline or Mark created (boards 94c, 94d), checked by `planAliasAnswer`.
 * The request is closed first, so a second answer finds it gone; then one
 * batch saves the address on the member's record (Mark created) and writes
 * the notices. If that batch fails, the request is open again.
 */
export async function answerAlias(identity: DashboardIdentity, requestId: number, input: unknown): Promise<WriteResult<null>> {
  const checked = checkAliasAnswer(input);
  if (!checked.ok) return refused(checked.error);
  const [request] = await readOpenAliasRequests({ id: requestId });
  if (!request || identity.memberId === null) return refused("This alias request was already answered.");
  const planned = planAliasAnswer({ viewer: identity, request, answer: checked.value });
  if (!planned.ok) return refused(planned.error);
  const plan = planned.value;
  const notices = aliasAnswerNotices(plan, identity.name);
  const claimed = await runAuditQuery((db) =>
    db
      .update(aliasRequests)
      .set({ outcome: plan.kind === "created" ? "created" : "declined", answeredBy: identity.memberId, answeredAt: new Date().toISOString() })
      .where(and(eq(aliasRequests.id, requestId), isNull(aliasRequests.outcome)))
      .returning({ id: aliasRequests.id }),
  );
  if (claimed.length === 0) return refused("This alias request was already answered.");
  // A declined request the site made tells nobody, so nothing else is written.
  if (plan.kind === "decline" && notices.length === 0) return written(null);
  try {
    await runAuditBatch((db) => {
      const told = notices.map(({ recipientId, notice }) =>
        db.insert(dashboardNotices).values({ recipientId, subjectId: request.memberId, kind: notice.kind, data: notice.data }),
      );
      const [first, ...rest] = told;
      return plan.kind === "created"
        ? [db.update(members).set({ emailAlias: plan.address }).where(eq(members.memberId, request.memberId)), ...told]
        : [first!, ...rest];
    });
  } catch (error) {
    await runAuditQuery((db) =>
      db.update(aliasRequests).set({ outcome: null, answeredBy: null, answeredAt: null }).where(eq(aliasRequests.id, requestId)),
    );
    throw error;
  }
  return written(null);
}

// The member's own alias (issue #542, boards 94f and 94g) ---------------------

/** The viewer's own alias and whether they set it up: their own `members` row alone. */
export async function readOwnAlias(identity: DashboardIdentity): Promise<OwnAlias | null> {
  if (identity.memberId === null || isOffTeam(identity.kind)) return null;
  const [row] = await getDb()
    .select({ alias: members.emailAlias, set_up_at: members.emailAliasSetUpAt })
    .from(members)
    .where(eq(members.memberId, identity.memberId));
  return row ? ownAliasOf({ kind: identity.kind, alias: row.alias, setUpAt: row.set_up_at }) : null;
}

/**
 * "I've set it up" (board 94g), checked by `planAliasSetUp`: the time is
 * stored on the viewer's own record, and only while it is still unset, so a
 * second press writes nothing.
 */
export async function confirmAliasSetUp(identity: DashboardIdentity): Promise<WriteResult<null>> {
  const planned = planAliasSetUp(await readOwnAlias(identity));
  if (!planned.ok || identity.memberId === null) return refused(planned.ok ? "You have no email alias to set up." : planned.error);
  const memberId = identity.memberId;
  const stored = await runAuditQuery((db) =>
    db
      .update(members)
      .set({ emailAliasSetUpAt: new Date().toISOString() })
      .where(and(eq(members.memberId, memberId), isNotNull(members.emailAlias), isNull(members.emailAliasSetUpAt)))
      .returning({ id: members.memberId }),
  );
  return stored.length === 0 ? refused("You already set up your email alias.") : written(null);
}
