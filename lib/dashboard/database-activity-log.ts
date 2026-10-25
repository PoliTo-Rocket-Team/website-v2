import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { applications, applyPositions, betterAuthSessions, departments, divisions, logs, roles, users } from "@/db/schema";
import { VIEW_AS_SESSION_SECONDS } from "@/lib/view-as-plugin";
import {
  ACTIVITY_WINDOW_DAYS,
  activityOf,
  UNKNOWN_ACCOUNT,
  type ActivityLogPage,
  type ActivityNames,
  type LoggedAccount,
  type LogRow,
} from "./activity-log";
import { readActingTitles } from "./database-acting-account";
import { roleLabelOf } from "./role-label";
import { VIEW_AS_OPERATIONS } from "./view-as";

// The database side of the Activity log (board 101, issue #642): the `logs`
// rows of the last 12 months the dashboard wrote under a signed-in account,
// the View as starts and stops, and what their sentences name. Only reads;
// the page that calls it is reached by the `activity-log` row of ./access.ts.

/** Keys the sentences never read and that can be large (page blocks, post bodies, photos): left in the database. */
const HEAVY_KEYS = sql.raw(
  `'{content,page,body,photos,channels,gallery,layer,advisor,editions,story,custom_answers,answer,about,support,description,data}'::text[]`,
);

/** Every Activity log entry of the window, newest first, read at `now`. */
export async function readActivityLog(now: Date): Promise<ActivityLogPage> {
  const since = new Date(now.getTime() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const viewAsOps = Object.values(VIEW_AS_OPERATIONS);
  const stored = sql`coalesce(${logs.newData}, ${logs.oldData})`;
  const rows: LogRow[] = (
    await getDb()
      .select({
        id: logs.id,
        schema: logs.schemaName,
        table: logs.tableName,
        operation: logs.operation,
        recordId: logs.recordId,
        before: sql<Record<string, unknown> | null>`${logs.oldData} - ${HEAVY_KEYS}`,
        after: sql<Record<string, unknown> | null>`${logs.newData} - ${HEAVY_KEYS}`,
        label: sql<string | null>`coalesce(${stored} -> 'page' ->> 'name', ${stored} -> 'content' ->> 'name', ${stored} -> 'advisor' ->> 'name', ${stored} ->> 'title', ${stored} ->> 'question', ${stored} ->> 'name')`,
        at: logs.changedAt,
        stamp: sql<string>`${logs.changedAt}::text`,
        by: logs.changedBy,
        acting: logs.changedByActingAccount,
      })
      .from(logs)
      .where(
        and(
          gte(logs.changedAt, since),
          or(
            and(eq(logs.schemaName, "public"), isNotNull(logs.changedBy)),
            and(eq(logs.schemaName, "better_auth"), eq(logs.tableName, "session"), inArray(logs.operation, viewAsOps)),
          ),
        ),
      )
      .orderBy(desc(logs.changedAt), desc(logs.id))
  ).map((row) => ({ ...row, at: new Date(row.at).toISOString() }));

  const sessionIds = unique(rows.filter((r) => r.operation === VIEW_AS_OPERATIONS.start).map((r) => r.recordId));
  const [names, sessions] = await Promise.all([
    readNames(rows),
    sessionIds.length === 0
      ? []
      : getDb().select({ id: betterAuthSessions.id, expiresAt: betterAuthSessions.expiresAt }).from(betterAuthSessions).where(inArray(betterAuthSessions.id, sessionIds)),
  ]);
  // A session row that is gone leaves no expiry: the start plus the session's length stands in.
  const expiries = new Map<string, string | null>(sessionIds.map((id) => [id, null]));
  for (const s of sessions) expiries.set(s.id, s.expiresAt.toISOString());
  return { entries: activityOf(rows, names, expiries, now, VIEW_AS_SESSION_SECONDS), readAt: now.toISOString() };
}

function unique<T>(values: readonly (T | null | undefined)[]): T[] {
  return [...new Set(values.filter((v): v is T => v !== null && v !== undefined))];
}

/** A whole number a row names under `key`, as the trigger stored it. */
function idIn(data: Readonly<Record<string, unknown>> | null, key: string): number | null {
  const value = data?.[key];
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function textIn(data: Readonly<Record<string, unknown>> | null, key: string): string | null {
  const value = data?.[key];
  return typeof value === "string" ? value : null;
}

/** The keys of a row that name a member. */
const MEMBER_KEYS = ["member_id", "requester", "from_id", "to_id", "recipient_id", "subject_id"];

/** The people, units, positions and applications the rows name, and the title each acting account shows under. */
async function readNames(rows: readonly LogRow[]): Promise<ActivityNames> {
  const db = getDb();
  const data = rows.flatMap((r) => [r.before, r.after]);
  const applicationIds = unique(rows.filter((r) => r.table === "interview_slots").flatMap((r) => [idIn(r.before, "application_id"), idIn(r.after, "application_id")]));
  const appRows =
    applicationIds.length === 0
      ? []
      : await db
          .select({ id: applications.id, accountId: applications.userId, positionId: applications.applyPositionId })
          .from(applications)
          .where(inArray(applications.id, applicationIds));

  const accountIds = unique([
    ...rows.flatMap((r) => [r.by, r.acting]),
    ...data.flatMap((d) => [textIn(d, "user_id"), textIn(d, "personId"), textIn(d, "actingAccountId")]),
    ...rows.filter((r) => r.table === "users").flatMap((r) => [textIn(r.before, "id"), textIn(r.after, "id")]),
    ...appRows.map((a) => a.accountId),
  ]);
  const memberIds = unique(data.flatMap((d) => MEMBER_KEYS.map((key) => idIn(d, key))));

  const [accountRows, memberRows, divisionRows, departmentRows, positionRows, actingTitles] = await Promise.all([
    accountIds.length === 0
      ? []
      : db
          .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, memberId: users.member, anonymizedAt: users.anonymizedAt })
          .from(users)
          .where(inArray(users.id, accountIds)),
    memberIds.length === 0
      ? []
      : db
          .select({ memberId: users.member, firstName: users.firstName, lastName: users.lastName, anonymizedAt: users.anonymizedAt })
          .from(users)
          .where(inArray(users.member, memberIds)),
    db.select({ id: divisions.id, name: divisions.name }).from(divisions),
    db.select({ id: departments.id, name: departments.name }).from(departments),
    db.select({ id: applyPositions.id, title: applyPositions.title }).from(applyPositions),
    readActingTitles(rows.map((r) => r.acting)),
  ]);

  const accountMembers = unique(accountRows.map((a) => a.memberId));
  const roleRows =
    accountMembers.length === 0
      ? []
      : await db
          .select({ id: roles.id, memberId: roles.memberId, type: roles.type, title: roles.title, startedAt: roles.startedAt })
          .from(roles)
          .where(and(inArray(roles.memberId, accountMembers), isNull(roles.leavedAt)));

  const nameOf = (p: { firstName: string | null; lastName: string | null; anonymizedAt: string | null }) =>
    (p.anonymizedAt === null ? [p.firstName, p.lastName].filter(Boolean).join(" ") : "") || UNKNOWN_ACCOUNT;
  // The title of a role held now; someone who held one and left is an alumnus; anyone else shows the name alone.
  const titleOf = (memberId: number | null): string | null => {
    if (memberId === null) return null;
    const held = roleRows.filter((r) => r.memberId === memberId);
    return held.length === 0 ? "Alumni" : roleLabelOf(held);
  };

  return {
    accounts: new Map(
      accountRows.map((a): [string, LoggedAccount] => [a.id, { name: nameOf(a), memberId: a.memberId, title: titleOf(a.memberId) }]),
    ),
    members: new Map(memberRows.flatMap((m) => (m.memberId === null ? [] : [[m.memberId, nameOf(m)] as const]))),
    divisions: new Map(divisionRows.map((d) => [d.id, d.name])),
    departments: new Map(departmentRows.map((d) => [d.id, d.name])),
    positions: new Map(positionRows.flatMap((p) => (p.title === null ? [] : [[p.id, p.title] as const]))),
    applications: new Map(appRows.map((a) => [a.id, { accountId: a.accountId, positionId: a.positionId }])),
    actingTitles,
  };
}
