import "server-only";

import { and, desc, eq, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { dashboardNotices, divisions, roles, scopes, users } from "@/db/schema";
import { runAuditQuery } from "@/lib/db-audit";
import type { DashboardIdentity } from "./database";
import {
  attentionOf,
  memberLeftNotices,
  noticeOf,
  promotedNotice,
  untoldOfPromotion,
  type AddressedNotice,
  type DivisionLead,
  type Promotion,
} from "./notices";
import type { AttentionItem } from "./overview";
import type { PromoteMode } from "./team";
import { refused, written, type WriteResult } from "./write";

// Dashboard notices on the database (issue #201): the viewer's undismissed
// ones as attention rows, Dismiss, and who a member leaving or a promotion
// (#188) tells. What a notice says and who is told is ./notices.ts's; this
// module only reads and writes the rows.

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

/**
 * The promotion Promote is about to write (#188): the division's name and
 * department and the promoting lead's name. Null when the division has no
 * department or the lead is not a user. Who is told is not read here: the
 * notice insert selects the heads itself (promotedNoticesInsert).
 */
export async function promotionOf(
  personId: number,
  divisionId: number,
  mode: PromoteMode,
  leadId: number,
): Promise<Promotion | null> {
  const db = getDb();
  const [[division], [lead]] = await Promise.all([
    db.select({ name: divisions.name, dept_id: divisions.deptId }).from(divisions).where(eq(divisions.id, divisionId)).limit(1),
    db
      .select({ first_name: users.firstName, last_name: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.member, leadId))
      .limit(1),
  ]);
  if (!division || division.dept_id === null || !lead) return null;
  const leadName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.email;
  return { personId, division: { name: division.name, departmentId: division.dept_id }, mode, lead: { id: leadId, name: leadName } };
}

/**
 * The statement that writes a promotion's notices, for Promote's
 * runAuditBatch. It reads the department's heads in the same statement
 * (`INSERT ... SELECT`), so a head added before the batch runs is told too:
 * the batch cannot hand one statement's rows to the next (lib/db-audit.ts).
 * It applies ./notices.ts's rule (headsToldOfPromotion): the active head
 * roles of the department, whose department is the role's own or its
 * division's (as the roster places a head), each member once (`DISTINCT`),
 * leaving out untoldOfPromotion. With no head left it writes no row.
 */
export function promotedNoticesInsert(db: ReturnType<typeof getDb>, promotion: Promotion) {
  const { personId, division, lead } = promotion;
  const notice = promotedNotice(promotion);
  const untold = untoldOfPromotion({ personId, leadId: lead.id });
  const column = (c: { readonly name: string }) => sql.identifier(c.name);
  const told = and(
    eq(roles.type, "head"),
    isNull(roles.leavedAt),
    isNotNull(roles.memberId),
    notInArray(roles.memberId, [...untold]),
    or(eq(roles.deptId, division.departmentId), and(isNull(roles.deptId), eq(divisions.deptId, division.departmentId))),
  );
  const into = sql.join(
    [dashboardNotices.recipientId, dashboardNotices.subjectId, dashboardNotices.kind, dashboardNotices.data].map(column),
    sql`, `,
  );
  return db.execute(
    sql`insert into ${dashboardNotices} (${into}) select distinct ${roles.memberId}, ${personId}::integer, ${notice.kind}::text, ${JSON.stringify(notice.data)}::jsonb from ${roles} left join ${divisions} on ${eq(roles.divisionId, divisions.id)} where ${told}`,
  );
}

