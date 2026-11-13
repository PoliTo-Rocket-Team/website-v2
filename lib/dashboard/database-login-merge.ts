import { and, eq, inArray, is, isNull, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getTableConfig, PgTable, type PgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { applications, betterAuthAccounts, betterAuthSessions, betterAuthUsers, logs, teamJoins, users } from "@/db/schema";
import { isBreakGlassEmail } from "@/lib/break-glass";
import { failUnless, isGuardFailure } from "@/lib/db-guard";
import { GOOGLE_ACCOUNT_OPERATIONS } from "./google-accounts";
import { planLoginMerge, type LoginMerge, type LoginMergeOutcome, type MergeLogin } from "./login-merge";

// Merging an empty second login on the database (issue #907, epic #902). The
// rules are ./login-merge.ts; this file reads the two logins they judge and
// writes the merge they allow, in one batch behind both rows' locks and a
// guard, in the shape of the sign-in email move (`moveWrites`,
// ./database-sign-in-email.ts). lib/auth.ts hands it to Better Auth
// (lib/google-accounts-plugin.ts), so, as ./database-google-accounts.ts, it
// is not marked server-only. It never reads or writes a token column of
// `better_auth.account`.

type Db = ReturnType<typeof getDb>;

/** The id of the `public.users` row a statement reads, named with its table so a subquery never reads its own `id`. */
const userIdOf = sql`${users}.${sql.identifier(users.id.name)}`;

/** One login as the rules read it, or null when no `public.users` row has that id. */
export async function readMergeLogin(userId: string): Promise<MergeLogin | null> {
  const [row] = await getDb()
    .select({
      userId: users.id,
      email: users.email,
      member: users.member,
      deleted: sql<boolean>`${users.deletedAt} is not null`,
      waiting: sql<boolean>`exists (select 1 from ${teamJoins} where ${teamJoins.userId} = ${userIdOf})`,
      accountEmail: sql<string | null>`(select account.email from ${betterAuthUsers} as account where account.id = ${userIdOf})`,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (row === undefined) return null;
  const live = await getDb()
    .select({ position: applications.applyPositionId })
    .from(applications)
    .where(and(eq(applications.userId, userId), isNull(applications.withdrawnAt)));
  const { accountEmail, ...login } = row;
  return {
    ...login,
    breakGlass: isBreakGlassEmail(accountEmail),
    livePositions: live.flatMap(({ position }) => (position === null ? [] : [position])),
  };
}

/**
 * Every column of this repo's own tables that points at a `public.users` row,
 * read off the schema's foreign keys, so a table added later moves with the
 * rest. The Activity log's own rows (`logs`) are left out: they record who
 * made each write at the time, and a merge rewrites no history.
 */
export const USER_REFERENCES: readonly { readonly table: PgTable; readonly column: PgColumn }[] = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable) && value !== logs)
  .flatMap((table) =>
    getTableConfig(table).foreignKeys.flatMap((key) => {
      const { columns, foreignColumns } = key.reference();
      return foreignColumns.length === 1 && foreignColumns[0] === users.id ? [{ table, column: columns[0] }] : [];
    }),
  );

/** The text profile fields the login merged into takes from the merged one where its own are empty, never over a filled one. */
const TEXT_FIELDS = ["firstName", "lastName", "origin", "levelOfStudy", "linkedin", "politoId", "program", "phone", "gender", "referralSource", "country"] as const;

/** A column of the merged login's row, read inside a statement on the other row; that row is named `merged`, so the column is never read off the row being written. */
const mergedColumn = (column: keyof typeof users.$inferSelect, fromUserId: string) =>
  sql`(select merged.${sql.identifier(users[column].name)} from ${users} as merged where merged.${sql.identifier(users.id.name)} = ${fromUserId})`;

/** The positions of a login's applications that are not withdrawn. */
const livePositionsOf = (userId: string) =>
  sql`select ${applications.applyPositionId} from ${applications} where ${applications.userId} = ${userId} and ${applications.withdrawnAt} is null`;

const waitsFor = (userId: string) => sql`exists (select 1 from ${teamJoins} where ${teamJoins.userId} = ${userId})`;

/**
 * Both rows still as the plan read them, checked inside the batch: the merged
 * login open, holding no member record and waiting exactly when it was; the
 * login it goes into open, holding the same member record (or none) and
 * waiting exactly when it was; and no position with an open application on
 * both.
 */
function stillMergeable({ into, from }: LoginMerge): SQL {
  const waiting = (userId: string, was: boolean) => (was ? waitsFor(userId) : sql`not ${waitsFor(userId)}`);
  const intoMember = into.member === null ? sql`${users.member} is null` : sql`${users.member} = ${into.member}`;
  return sql`exists (select 1 from ${users} where ${users.id} = ${from.userId} and ${users.member} is null and ${users.deletedAt} is null)
    and ${waiting(from.userId, from.waiting)}
    and exists (select 1 from ${users} where ${users.id} = ${into.userId} and ${intoMember} and ${users.deletedAt} is null)
    and ${waiting(into.userId, into.waiting)}
    and not exists (${livePositionsOf(from.userId)} intersect ${livePositionsOf(into.userId)})`;
}

/**
 * The merge's writes, in order, behind both rows' locks and the guard. The
 * login merged into takes the merged one's profile fields where its own are
 * empty, and every access grant it lacks. Every row that points at the merged
 * login moves to it: applications and their files, a wait for Confirm NDA the
 * plan allowed, every other table's reference (`USER_REFERENCES`) and its
 * Google accounts. Then the merged login's sessions end, and its `public.users`
 * row is closed (`deleted_at`), never deleted; its `better_auth.user` row
 * stays. Last, the one Activity log entry of the merge, naming the merged
 * login's email and nothing else.
 *
 * The batch sets no writer for the audit trigger, so the row changes it logs
 * name no one and stay out of the Activity log, which shows the merge as that
 * one entry under the person.
 */
function mergeWrites(db: Db, merge: LoginMerge): [BatchItem<"pg">, ...BatchItem<"pg">[]] {
  const into = merge.into.userId;
  const from = merge.from.userId;
  const filled = Object.fromEntries(TEXT_FIELDS.map((key) => [key, sql`coalesce(nullif(${users[key]}, ''), ${mergedColumn(key, from)})`]));
  return [
    db.select({ id: users.id }).from(users).where(inArray(users.id, [from, into])).orderBy(users.id).for("update"),
    failUnless(db, stillMergeable(merge)),
    db
      .update(users)
      .set({
        ...filled,
        dateOfBirth: sql`coalesce(${users.dateOfBirth}, ${mergedColumn("dateOfBirth", from)})`,
        access: sql`coalesce(${users.access}, '{}') || array(select grant_name from unnest(coalesce(${mergedColumn("access", from)}, '{}')) as grant_name where grant_name <> all(coalesce(${users.access}, '{}')))`,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, into)),
    ...USER_REFERENCES.map(({ table, column }) => db.execute(sql`update ${table} set ${sql.identifier(column.name)} = ${into} where ${column} = ${from}`)),
    db.update(betterAuthAccounts).set({ userId: into, updatedAt: new Date() }).where(eq(betterAuthAccounts.userId, from)),
    db.delete(betterAuthSessions).where(eq(betterAuthSessions.userId, from)),
    db
      .update(users)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(users.id, from), isNull(users.member), isNull(users.deletedAt))),
    // Beside the link and unlink entries ./database-google-accounts.ts writes, which the Activity log reads the same way.
    db.insert(logs).values({
      schemaName: "better_auth",
      tableName: "account",
      operation: GOOGLE_ACCOUNT_OPERATIONS.merge,
      recordId: from,
      newData: { email: merge.from.email },
      changedBy: into,
    }),
  ];
}

/**
 * Merges the login `fromUserId`, which Google just signed in, into the
 * signed-in login `userId`, when the rules allow it; otherwise changes
 * nothing. A guard that finds either row changed since the read fails the
 * whole batch, which answers as changed.
 */
export async function mergeLogin(request: { readonly userId: string; readonly fromUserId: string; readonly viewingAs: boolean }): Promise<LoginMergeOutcome> {
  const [into, from] = await Promise.all([readMergeLogin(request.userId), readMergeLogin(request.fromUserId)]);
  const plan = planLoginMerge(into, from, request.viewingAs);
  return plan.kind === "refused" ? plan : writeLoginMerge(plan.merge);
}

/** Writes a planned merge in one batch; a guard that finds either row changed since the plan fails it whole, and that answers as changed. */
export async function writeLoginMerge(merge: LoginMerge): Promise<LoginMergeOutcome> {
  const db = getDb();
  try {
    await db.batch(mergeWrites(db, merge));
  } catch (error) {
    if (isGuardFailure(error)) return { kind: "refused", refusal: "changed" };
    throw error;
  }
  return { kind: "merged", email: merge.from.email };
}
