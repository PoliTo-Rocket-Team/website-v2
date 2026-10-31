import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { betterAuthAccounts, logs, users } from "@/db/schema";
import {
  GOOGLE_ACCOUNT_OPERATIONS,
  memberGoogleEmailsOf,
  NO_GOOGLE_EMAILS,
  type GoogleAccountEntry,
  type LinkedGoogleAccount,
  type MemberGoogleEmails,
} from "./google-accounts";

// The database side of linked Google accounts (issue #906, epic #902): the
// read the "Google accounts" section and the later slices of #902 share, and
// the Activity log entry each link and unlink writes. lib/auth.ts hands the
// log to Better Auth (lib/google-accounts-plugin.ts), so this file is not
// marked server-only, as lib/auth.ts is not. Neither ever reads or writes a
// token column of `better_auth.account`.

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
 * Writes the one Activity log entry of a link or an unlink: on the account
 * row, under the person whose login it is, naming the Google account's email
 * and nothing else.
 */
export async function recordGoogleAccountChange(entry: GoogleAccountEntry): Promise<void> {
  await getDb()
    .insert(logs)
    .values({
      schemaName: "better_auth",
      tableName: "account",
      operation: GOOGLE_ACCOUNT_OPERATIONS[entry.event],
      recordId: entry.accountRowId,
      newData: { email: entry.email },
      changedBy: entry.userId,
    });
}
