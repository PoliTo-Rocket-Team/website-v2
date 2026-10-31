import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { betterAuthSessions, betterAuthUsers, teamJoins, users } from "@/db/schema";
import { isBreakGlassEmail } from "@/lib/break-glass";
import { failUnless } from "@/lib/db-guard";
import type { DashboardIdentity } from "./database";
import { planSignInEmailCorrection, type EmailHolderRow, type RecordMove, type SignInEmailCorrection, type SignInEmailRow } from "./sign-in-email";

// The sign-in email in Edit details and Fill details on the database (issues
// #741 and #864). The rules are ./sign-in-email.ts; this file reads what
// they need and writes what they allow, in the caller's audited batch.

type Db = ReturnType<typeof getDb>;

/** The id of the `public.users` row a statement reads, named with its table so a subquery never reads its own `id`. */
const userIdOf = (table: typeof users) => sql`${table}.${sql.identifier(users.id.name)}`;

/**
 * Whether a sign-in account holds the `public.users` row: a Better Auth user
 * with its id, as the `sync_auth_users` trigger (drizzle/0001) leaves it once
 * the person signs in. Both ids are named with their table: a one-table
 * select names its columns bare, and a bare `id` inside the subquery would
 * read the Better Auth row's own.
 */
export const signedIn = sql<boolean>`exists (select 1 from ${betterAuthUsers} as account where account.id = ${userIdOf(users)})`;

/** The user row a sign-in email change is aimed at, with whether a sign-in account holds it; null unless exactly one row matches. */
async function signInEmailRowOf(where: SQL): Promise<SignInEmailRow | null> {
  const rows = await getDb().select({ id: users.id, email: users.email, linked: signedIn, member: users.member }).from(users).where(where);
  return rows.length === 1 ? rows[0] : null;
}

/**
 * Other user rows as the rules read them (`EmailHolderRow`): each one's name,
 * member record, whether a sign-in account holds it, whether it was closed,
 * whether it waits for Confirm NDA, and its sign-in account's email, which
 * the break-glass setting is matched against.
 */
async function emailHoldersOf(where: SQL): Promise<EmailHolderRow[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      member: users.member,
      linked: signedIn,
      deleted: sql<boolean>`${users.deletedAt} is not null`,
      waiting: sql<boolean>`exists (select 1 from ${teamJoins} where ${teamJoins.userId} = ${userIdOf(users)})`,
      accountEmail: sql<string | null>`(select account.email from ${betterAuthUsers} as account where account.id = ${userIdOf(users)})`,
    })
    .from(users)
    .where(where)
    .orderBy(users.id);
  return rows.map((row) => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
    return {
      userId: row.userId,
      name: name === "" ? null : name,
      member: row.member,
      linked: row.linked,
      deleted: row.deleted,
      waiting: row.waiting,
      breakGlass: isBreakGlassEmail(row.accountEmail),
    };
  });
}

/** The change Edit details sent for the user row `where` names (`planSignInEmailCorrection`, ./sign-in-email.ts), read for the rule. */
export async function planCorrection(identity: DashboardIdentity, sent: string | null, where: SQL): Promise<SignInEmailCorrection> {
  if (sent === null) return planSignInEmailCorrection(identity, null, null, []);
  const row = await signInEmailRowOf(where);
  // Every user row but the target's that holds the address, compared case-insensitively: a member, someone waiting, or an account.
  const holders = row === null ? [] : await emailHoldersOf(sql`lower(${users.email}) = ${sent} and ${users.id} <> ${row.id}`);
  return planSignInEmailCorrection(identity, sent, row, holders);
}

/** A column of the user row the record leaves, read inside a statement on another row. That row is named `moved_from`, so the column is never read off the row being written. */
const fromColumn = (column: keyof typeof users.$inferSelect, fromUserId: string) =>
  sql`(select moved_from.${sql.identifier(users[column].name)} from ${users} as moved_from where moved_from.${sql.identifier(users.id.name)} = ${fromUserId})`;

/** The text profile fields the record's new row takes from the old one where its own are empty. */
const TEXT_FIELDS = ["firstName", "lastName", "origin", "levelOfStudy", "linkedin", "politoId", "program", "phone", "gender", "referralSource", "country"] as const;

/**
 * Both rows still as the plan read them, checked inside the batch: the old
 * row open, holding the record, and held by a sign-in account exactly when it
 * was; and the address still the empty login's alone, or still nobody's for a
 * new row.
 */
function stillMovable(move: RecordMove, toUserId: string): SQL {
  const fromHeld = sql`exists (select 1 from ${users} where ${users.id} = ${move.from.userId} and ${users.member} = ${move.memberId} and ${users.deletedAt} is null
    and ${move.from.linked ? signedIn : sql`not ${signedIn}`})`;
  const holders = sql`select 1 from ${users} where lower(${users.email}) = ${move.email} and ${users.id} <> ${move.from.userId}`;
  if (move.to.kind === "new-row") return sql`${fromHeld} and not exists (${holders})`;
  return sql`${fromHeld}
    and exists (select 1 from ${users} where ${users.id} = ${toUserId} and lower(${users.email}) = ${move.email}
      and ${users.member} is null and ${users.deletedAt} is null and ${signedIn}
      and not exists (select 1 from ${teamJoins} where ${teamJoins.userId} = ${toUserId}))
    and not exists (${holders} and ${users.id} <> ${toUserId})`;
}

/**
 * The rows a move writes, locked until the batch ends. A sign-in writes the
 * user row (the users sync of drizzle/0001) and a second Save writes these,
 * so either one under way is waited for, and the guard after this reads what
 * it committed.
 */
function lockRows(db: Db, ids: readonly string[]) {
  return db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.id} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`)
    .orderBy(users.id)
    .for("update");
}

/**
 * The move's writes, in order, behind both rows' locks and the guard: a new
 * row for the address when no login holds it; that row takes the record, the
 * old row's profile fields where its own are empty and every access grant it
 * lacks, and keeps anything else it holds, applications included; the wait
 * for Confirm NDA moves with the record. Then the old row lets the record go:
 * a login on it keeps the row, and every session of it ends; a row no sign-in
 * holds is closed (`deleted_at`), never deleted. Its `member` is cleared, so
 * the yearly anonymization of closed rows (./anonymize.ts) never reaches the
 * member.
 */
function moveWrites(db: Db, move: RecordMove): BatchItem<"pg">[] {
  const toUserId = move.to.kind === "login" ? move.to.userId : `added:${randomUUID()}`;
  const from = move.from.userId;
  const filled = Object.fromEntries(TEXT_FIELDS.map((key) => [key, sql`coalesce(nullif(${users[key]}, ''), ${fromColumn(key, from)})`]));
  return [
    lockRows(db, move.to.kind === "login" ? [from, toUserId] : [from]),
    failUnless(db, stillMovable(move, toUserId)),
    ...(move.to.kind === "new-row" ? [db.insert(users).values({ id: toUserId, email: move.email, updatedAt: sql`now()` })] : []),
    db
      .update(users)
      .set({
        ...filled,
        dateOfBirth: sql`coalesce(${users.dateOfBirth}, ${fromColumn("dateOfBirth", from)})`,
        access: sql`coalesce(${users.access}, '{}') || array(select grant_name from unnest(coalesce(${fromColumn("access", from)}, '{}')) as grant_name where grant_name <> all(coalesce(${users.access}, '{}')))`,
        member: move.memberId,
        updatedAt: sql`now()`,
      })
      .where(and(eq(users.id, toUserId), isNull(users.member))),
    db.update(teamJoins).set({ userId: toUserId }).where(eq(teamJoins.userId, from)),
    db
      .update(users)
      .set({ member: null, ...(move.from.linked ? {} : { deletedAt: sql`now()` }), updatedAt: sql`now()` })
      .where(and(eq(users.id, from), eq(users.member, move.memberId))),
    ...(move.from.linked ? [db.delete(betterAuthSessions).where(eq(betterAuthSessions.userId, from))] : []),
  ];
}

/**
 * The writes of a planned change, first in the caller's audited batch: the
 * `public.users` email alone, on a row no sign-in account holds, which the
 * `where` checks again so a sign-in between the read and the write keeps it;
 * or the record's move (`moveWrites`), whose guard fails the whole batch
 * (`isGuardFailure`) when either row changed since the plan read them.
 */
export function correctionWrites(db: Db, correction: SignInEmailCorrection): BatchItem<"pg">[] {
  if (correction.kind === "move") return moveWrites(db, correction.move);
  if (correction.kind !== "write") return [];
  return [
    db
      .update(users)
      .set({ email: correction.email, updatedAt: sql`now()` })
      .where(and(eq(users.id, correction.userId), sql`not ${signedIn}`)),
  ];
}
