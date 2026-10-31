import "server-only";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { betterAuthUsers, teamJoins, users } from "@/db/schema";
import { isBreakGlassEmail } from "@/lib/break-glass";
import { runAuditBatch } from "@/lib/db-audit";
import { failUnless, isGuardFailure } from "@/lib/db-guard";
import type { DashboardIdentity } from "./database";
import {
  checkLoginLink,
  LOGIN_LINK_REFUSALS,
  planLoginLink,
  planSignInEmailCorrection,
  type EmailHolderRow,
  type LoginLinkRequest,
  type SignInEmailCorrection,
  type SignInEmailRow,
} from "./sign-in-email";
import { refused, written, type WriteResult } from "./write";

// The sign-in email in Edit details and Fill details on the database: the
// correction of issue #741 and the link of an empty login of issue #860. The
// rules are ./sign-in-email.ts; this file reads what they need and writes
// what they allow, in the caller's audited batch or in its own.

type Db = ReturnType<typeof getDb>;

/** The id of the `public.users` row a statement reads, named with its table so a subquery never reads its own `id`. */
const userIdOf = (table: typeof users) => sql`${table}.${sql.identifier(users.id.name)}`;

/**
 * Whether a sign-in account holds the `public.users` row: a Better Auth user
 * with its id, as the `sync_auth_users` trigger (drizzle/0001) leaves it once
 * the person signs in. Only read here: nothing in this file writes the
 * `better_auth` schema. Both ids are named with their table: a one-table
 * select names its columns bare, and a bare `id` inside the subquery would
 * read the Better Auth row's own.
 */
export const signedIn = sql<boolean>`exists (select 1 from ${betterAuthUsers} as account where account.id = ${userIdOf(users)})`;

/** The user row a sign-in email correction is aimed at, with whether a sign-in account holds it; null unless exactly one row matches. */
async function signInEmailRowOf(where: SQL): Promise<SignInEmailRow | null> {
  const rows = await getDb().select({ id: users.id, email: users.email, linked: signedIn, member: users.member }).from(users).where(where);
  return rows.length === 1 ? rows[0] : null;
}

/**
 * Other user rows as the rules read them (`EmailHolderRow`): each one's name,
 * member record, first sign-in day in the team's time zone, whether it was
 * closed, whether it waits for Confirm NDA, and its sign-in account's email,
 * which the break-glass setting is matched against.
 */
async function emailHoldersOf(where: SQL): Promise<EmailHolderRow[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      member: users.member,
      deleted: sql<boolean>`${users.deletedAt} is not null`,
      waiting: sql<boolean>`exists (select 1 from ${teamJoins} where ${teamJoins.userId} = ${userIdOf(users)})`,
      firstSignIn: sql<string | null>`(select to_char(account."createdAt" at time zone 'Europe/Rome', 'YYYY-MM-DD') from ${betterAuthUsers} as account where account.id = ${userIdOf(users)})`,
      accountEmail: sql<string | null>`(select account.email from ${betterAuthUsers} as account where account.id = ${userIdOf(users)})`,
    })
    .from(users)
    .where(where)
    .orderBy(users.id);
  return rows.map((row) => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
    return {
      userId: row.userId,
      email: row.email,
      name: name === "" ? null : name,
      member: row.member,
      firstSignIn: row.firstSignIn,
      deleted: row.deleted,
      waiting: row.waiting,
      breakGlass: isBreakGlassEmail(row.accountEmail),
    };
  });
}

/** The correction Edit details sent for the user row `where` names (`planSignInEmailCorrection`, ./sign-in-email.ts), read for the rule. */
export async function planCorrection(identity: DashboardIdentity, sent: string | null, where: SQL): Promise<SignInEmailCorrection> {
  if (sent === null) return planSignInEmailCorrection(identity, null, null, []);
  const row = await signInEmailRowOf(where);
  // Every user row but the target's that holds the address, compared case-insensitively: a member, someone waiting, or an account.
  const holders = row === null ? [] : await emailHoldersOf(sql`lower(${users.email}) = ${sent} and ${users.id} <> ${row.id}`);
  return planSignInEmailCorrection(identity, sent, row, holders);
}

/**
 * The write of a planned correction, in the caller's audited batch: the
 * `public.users` email alone, on a row no sign-in account holds, which the
 * `where` checks again so a sign-in between the read and the write keeps it.
 */
export function correctionWrites(db: Db, correction: SignInEmailCorrection): BatchItem<"pg">[] {
  if (correction.kind !== "write") return [];
  return [
    db
      .update(users)
      .set({ email: correction.email, updatedAt: sql`now()` })
      .where(and(eq(users.id, correction.userId), sql`not ${signedIn}`)),
  ];
}

/**
 * A profile field of the row the record leaves, read inside the login row's
 * update. That row is named `linked_from`, so the field is never read off the
 * row being updated.
 */
const fromValue = (column: keyof typeof users.$inferSelect, request: LoginLinkRequest) =>
  sql`(select linked_from.${sql.identifier(users[column].name)} from ${users} as linked_from where linked_from.${sql.identifier(users.id.name)} = ${request.fromUserId})`;

/** The text profile fields the login takes from the record's row where its own are empty. */
const TEXT_FIELDS = ["firstName", "lastName", "origin", "levelOfStudy", "linkedin", "politoId", "program", "phone", "gender", "referralSource", "country"] as const;

/**
 * Both rows still as Link login read them: the record's row unlinked and
 * open, the login empty and holding the address the confirmation named.
 * Checked inside the batch.
 */
function stillLinkable(request: LoginLinkRequest): SQL {
  return sql`exists (select 1 from ${users} where ${users.id} = ${request.fromUserId} and ${users.member} = ${request.memberId} and ${users.deletedAt} is null and not ${signedIn})
    and exists (select 1 from ${users} where ${users.id} = ${request.loginUserId} and lower(${users.email}) = ${request.email}
      and ${users.member} is null and ${users.deletedAt} is null and ${signedIn}
      and not exists (select 1 from ${teamJoins} where ${teamJoins.userId} = ${request.loginUserId}))`;
}

/**
 * Both rows, locked until the batch ends. A sign-in writes the user row (the
 * users sync of drizzle/0001) and a second Link login writes these two, so
 * either one under way is waited for, and the guard after this reads what it
 * committed.
 */
function lockRows(db: Db, request: LoginLinkRequest) {
  return db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.id} in (${request.fromUserId}, ${request.loginUserId})`)
    .orderBy(users.id)
    .for("update");
}

/**
 * The link's writes, in order: the login row takes the member record, the
 * record row's profile fields where its own are empty and every access grant
 * it lacks; then the record row lets the member go and is closed
 * (`deleted_at`), never deleted. Its `member` is cleared first, so the yearly
 * anonymization of closed rows (./anonymize.ts) never reaches the member.
 */
function loginLinkWrites(db: Db, request: LoginLinkRequest): BatchItem<"pg">[] {
  const filled = Object.fromEntries(
    TEXT_FIELDS.map((key) => [key, sql`coalesce(nullif(${users[key]}, ''), ${fromValue(key, request)})`]),
  );
  return [
    db
      .update(users)
      .set({
        ...filled,
        dateOfBirth: sql`coalesce(${users.dateOfBirth}, ${fromValue("dateOfBirth", request)})`,
        access: sql`coalesce(${users.access}, '{}') || array(select grant_name from unnest(coalesce(${fromValue("access", request)}, '{}')) as grant_name where grant_name <> all(coalesce(${users.access}, '{}')))`,
        member: request.memberId,
        updatedAt: sql`now()`,
      })
      .where(and(eq(users.id, request.loginUserId), isNull(users.member))),
    db
      .update(users)
      .set({ member: null, deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(users.id, request.fromUserId), eq(users.member, request.memberId))),
  ];
}

/**
 * Link login (issue #860): the empty login `loginUserId` takes the member
 * record `memberId` off the row `fromUserId`, in one audited batch, so the
 * person reaches their own record on their next visit. Full access only
 * (`planLoginLink`). Refused, with nothing written, when either row changed
 * since the confirmation opened: read here first, and checked again inside
 * the batch, behind both rows' locks.
 */
export async function linkLogin(identity: DashboardIdentity, input: unknown): Promise<WriteResult<null>> {
  const request = checkLoginLink(input);
  if (request === null) return refused(LOGIN_LINK_REFUSALS.changed);
  const [from, [login]] = await Promise.all([signInEmailRowOf(eq(users.id, request.fromUserId)), emailHoldersOf(eq(users.id, request.loginUserId))]);
  const plan = planLoginLink(identity, request, from, login ?? null);
  if (plan.kind === "refused") return refused(plan.error);
  try {
    await runAuditBatch((db) => [lockRows(db, plan.request), failUnless(db, stillLinkable(plan.request)), ...loginLinkWrites(db, plan.request)]);
  } catch (error) {
    if (isGuardFailure(error)) return refused(LOGIN_LINK_REFUSALS.changed);
    throw error;
  }
  return written(null);
}
