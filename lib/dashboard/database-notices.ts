import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dashboardNotices, divisions, roles, scopes, users } from "@/db/schema";
import { runAuditQuery } from "@/lib/db-audit";
import type { DashboardIdentity } from "./database";
import { attentionOf, memberLeftNotices, noticeOf, type AddressedNotice, type DivisionLead } from "./notices";
import type { AttentionItem } from "./overview";
import { refused, written, type WriteResult } from "./write";

// Dashboard notices on the database (issue #201): the viewer's undismissed
// ones as attention rows, Dismiss, and who a member leaving tells. What a
// notice says and who is told is ./notices.ts's; this module only reads and
// writes the rows.

/** The viewer's undismissed notices, newest first, as "Needs your attention" rows. */
export async function readNoticeAttention(identity: DashboardIdentity, now: Date): Promise<AttentionItem[]> {
  if (identity.memberId === null) return [];
  const rows = await getDb()
    .select({
      id: dashboardNotices.id,
      kind: dashboardNotices.kind,
      data: dashboardNotices.data,
      created_at: dashboardNotices.createdAt,
      first_name: users.firstName,
      last_name: users.lastName,
      email: users.email,
    })
    .from(dashboardNotices)
    .innerJoin(users, eq(users.member, dashboardNotices.subjectId))
    .where(and(eq(dashboardNotices.recipientId, identity.memberId), isNull(dashboardNotices.dismissedAt)))
    .orderBy(desc(dashboardNotices.createdAt));
  return rows.flatMap((r) => {
    const subject = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email;
    const notice = noticeOf({ id: r.id, kind: r.kind, subject, createdAt: r.created_at, data: r.data });
    return notice === null ? [] : [attentionOf(notice, now)];
  });
}

/** Dismiss: the notice leaves the viewer's list. Only the viewer's own, and only once. */
export async function dismissNotice(identity: DashboardIdentity, noticeId: number): Promise<WriteResult<null>> {
  const memberId = identity.memberId;
  if (memberId === null) return refused("This notice is not yours.");
  const dismissed = await runAuditQuery((db) =>
    db
      .update(dashboardNotices)
      .set({ dismissedAt: new Date().toISOString() })
      .where(
        and(
          eq(dashboardNotices.id, noticeId),
          eq(dashboardNotices.recipientId, memberId),
          isNull(dashboardNotices.dismissedAt),
        ),
      )
      .returning({ id: dashboardNotices.id }),
  );
  return dismissed.length > 0 ? written(null) : refused("This notice is not yours, or it was already dismissed.");
}

/**
 * The notices a member leaving now writes: their divisions are those of
 * their active roles, and each division's leads are its active lead roles
 * and its `division` scopes (./notices.ts decides who of them is told).
 */
export async function memberLeftNoticesFor(memberId: number, reason: string | null): Promise<AddressedNotice[]> {
  const db = getDb();
  const left = await db
    .selectDistinct({ id: divisions.id, name: divisions.name })
    .from(roles)
    .innerJoin(divisions, eq(roles.divisionId, divisions.id))
    .where(and(eq(roles.memberId, memberId), isNull(roles.leavedAt)));
  if (left.length === 0) return [];
  const ids = left.map((d) => d.id);
  const [leadRoles, divisionScopes] = await Promise.all([
    db
      .select({ memberId: roles.memberId, divisionId: roles.divisionId })
      .from(roles)
      .where(and(inArray(roles.divisionId, ids), isNull(roles.leavedAt), eq(roles.type, "lead"))),
    // A grant that outlived its holder's last role tells nobody: they are off the team.
    db
      .selectDistinct({ memberId: scopes.memberId, divisionId: scopes.divisionId })
      .from(scopes)
      .innerJoin(roles, and(eq(roles.memberId, scopes.memberId), isNull(roles.leavedAt)))
      .where(and(eq(scopes.scope, "division"), inArray(scopes.divisionId, ids))),
  ]);
  const leads = [...leadRoles, ...divisionScopes].flatMap((l): DivisionLead[] =>
    l.memberId === null || l.divisionId === null ? [] : [{ memberId: l.memberId, divisionId: l.divisionId }],
  );
  return memberLeftNotices(memberId, left, leads, reason);
}
