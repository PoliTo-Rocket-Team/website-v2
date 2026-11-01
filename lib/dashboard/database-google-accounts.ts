import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betterAuthAccounts, betterAuthUsers, logs, users } from "@/db/schema";
import { failUnless, isGuardFailure } from "@/lib/db-guard";
import {
  GOOGLE_ACCOUNT_OPERATIONS,
  memberGoogleEmailsOf,
  NO_GOOGLE_EMAILS,
  type GoogleAccountEntry,
  type GoogleAccountRefusal,
  type GoogleAccountRemoval,
  type LinkedGoogleAccount,
  type MemberGoogleEmails,
} from "./google-accounts";

// The database side of linked Google accounts (issue #906, epic #902): the
// read the "Google accounts" section and the later slices of #902 share, the
// Activity log entry each link writes, and each removal with its entry.
// lib/auth.ts hands them to Better Auth (lib/google-accounts-plugin.ts), so
// this file is not marked server-only, as lib/auth.ts is not. None ever reads
// or writes a token column of `better_auth.account`.

/** The linked Google accounts of each login named, keyed by user id, each list oldest first and newest last; a login with none is absent. */
export async function readLinkedGoogleAccounts(userIds: readonly string[]): Promise<ReadonlyMap<string, readonly LinkedGoogleAccount[]>> {
  if (userIds.length === 0) return new Map();
  const rows = await getDb()
    .select({ id: betterAuthAccounts.id, userId: betterAuthAccounts.userId, googleId: betterAuthAccounts.accountId, email: betterAuthAccounts.email })
    .from(betterAuthAccounts)
    .where(and(inArray(betterAuthAccounts.userId, [...new Set(userIds)]), eq(betterAuthAccounts.providerId, "google")))
    .orderBy(asc(betterAuthAccounts.createdAt), asc(betterAuthAccounts.id));
  const byUser = new Map<string, LinkedGoogleAccount[]>();
  for (const { userId, ...account } of rows) byUser.set(userId, [...(byUser.get(userId) ?? []), account]);
  return byUser;
}

/** One login's linked Google accounts, oldest first and newest last. */
export async function linkedGoogleAccountsOf(userId: string): Promise<readonly LinkedGoogleAccount[]> {
  return (await readLinkedGoogleAccounts([userId])).get(userId) ?? [];
}

/**
 * The linked Google emails beside the sign-in email of each of `memberIds`
 * (issue #908), from every login that holds their member record. Callers pass
 * only the members the viewer's Members page lists, whose emails the viewer
 * already sees.
 */
export async function readMemberGoogleEmails(memberIds: readonly number[]): Promise<MemberGoogleEmails> {
  if (memberIds.length === 0) return NO_GOOGLE_EMAILS;
  const logins = await getDb()
    .select({ userId: users.id, memberId: users.member, signInEmail: users.email })
    .from(users)
    .where(inArray(users.member, [...new Set(memberIds)]));
  const accounts = await readLinkedGoogleAccounts(logins.map((l) => l.userId));
  return memberGoogleEmailsOf(
    logins.flatMap((l) => (l.memberId === null ? [] : [{ memberId: l.memberId, signInEmail: l.signInEmail, accounts: accounts.get(l.userId) ?? [] }])),
  );
}

/**
 * The one Activity log entry of a link or an unlink: on the account row,
 * under the person whose login it is, naming the Google account's email and
 * nothing else.
 */
function entryRow(entry: GoogleAccountEntry): typeof logs.$inferInsert {
  return {
    schemaName: "better_auth",
    tableName: "account",
    operation: GOOGLE_ACCOUNT_OPERATIONS[entry.event],
    recordId: entry.accountRowId,
    newData: { email: entry.email },
    changedBy: entry.userId,
  };
}

/** Writes the Activity log entry of a link. */
export async function recordGoogleAccountChange(entry: GoogleAccountEntry): Promise<void> {
  await getDb().insert(logs).values(entryRow(entry));
}

const isGoogle = eq(betterAuthAccounts.providerId, "google");

/**
 * Removes one linked Google account and writes its Activity log entry, in one
 * batch that never leaves the login without a Google account (epic #902). The
 * batch first locks the login's `better_auth.user` row, so two removals on one
 * login run one after the other; Read Committed reads each later statement
 * afresh, so the guard after the lock sees what a removal before it committed.
 * The guard then needs the account still on this login and another Google
 * account beside it, and a guard that fails writes nothing. Answers null when
 * the account was removed, or why it was not.
 */
export async function removeGoogleAccount(removal: GoogleAccountRemoval): Promise<GoogleAccountRefusal | null> {
  const db = getDb();
  const { userId, accountRowId } = removal;
  const ofLogin = and(eq(betterAuthAccounts.userId, userId), isGoogle);
  try {
    await db.batch([
      db.select({ id: betterAuthUsers.id }).from(betterAuthUsers).where(eq(betterAuthUsers.id, userId)).for("update"),
      failUnless(
        db,
        sql`exists (select 1 from ${betterAuthAccounts} where ${and(ofLogin, eq(betterAuthAccounts.id, accountRowId))})
          and exists (select 1 from ${betterAuthAccounts} where ${and(ofLogin, ne(betterAuthAccounts.id, accountRowId))})`,
      ),
      db.delete(betterAuthAccounts).where(and(ofLogin, eq(betterAuthAccounts.id, accountRowId))),
      db.insert(logs).values(entryRow({ event: "unlink", ...removal })),
    ]);
  } catch (error) {
    if (!isGuardFailure(error)) throw error;
    const accounts = await linkedGoogleAccountsOf(userId);
    return accounts.some((account) => account.id === accountRowId) ? "last" : "not-yours";
  }
  return null;
}
