// Deleted accounts are anonymized after a year (issue #191; the rule is in
// docs/dashboard-rules.md, section 3). Delete account closes the sign-in and
// records `users.deleted_at`. A year or more later the person's identifying
// fields are cleared, their remaining files deleted, and the same values
// removed from the audit log; every field the team counts for statistics
// stays. Rules and the plan only: the database side is
// ./database-anonymize.ts, and the daily cron route runs it.

import { getTableColumns, type InferSelectModel } from "drizzle-orm";
import { applications, members, users } from "@/db/schema";

/** One account Delete account closed, as the store reads it. */
export type DeletedAccount = {
  readonly userId: string;
  /** The `members` row linked to the account, if the person was on the team. */
  readonly memberId: number | null;
  readonly deletedAt: Date;
  readonly anonymizedAt: Date | null;
  /** A Better Auth user with this id exists again: the person signed in after deleting. */
  readonly signedInAgain: boolean;
};

/** The latest deletion time an account may have and still be anonymized at `now`: one calendar year before. */
export function anonymizationCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return cutoff;
}

/** Deleted at least a year before `now`, not yet anonymized, and not signed in again. */
export function dueForAnonymization(account: DeletedAccount, now: Date): boolean {
  return (
    account.anonymizedAt === null &&
    !account.signedInAgain &&
    account.deletedAt.getTime() <= anonymizationCutoff(now).getTime()
  );
}

/** What `users.email` reads after anonymization: the column is NOT NULL, and no sign-in can match it. */
export const ANONYMIZED_EMAIL = "anonymized@anonymized.invalid";

type UserRow = InferSelectModel<typeof users>;
type MemberRow = InferSelectModel<typeof members>;
type ApplicationRow = InferSelectModel<typeof applications>;

// The identifying fields each row loses. The statistics fields are the ones
// left out: users' gender, date of birth, origin, country, level of study,
// program, referral source, created_at and member link; members' team years
// and NDA date; every applications position, status and date column.
const CLEARED_USER_KEYS = ["email", "firstName", "lastName", "phone", "linkedin", "politoId"] as const;
const CLEARED_MEMBER_KEYS = ["prtEmail", "mobileNumber", "discord", "ndaName", "picture"] as const;
const CLEARED_APPLICATION_KEYS = ["mlName", "cvName"] as const;

export type UserClear = Pick<UserRow, (typeof CLEARED_USER_KEYS)[number] | "anonymizedAt">;
export type MemberClear = Pick<MemberRow, (typeof CLEARED_MEMBER_KEYS)[number]>;
export type ApplicationClear = Pick<ApplicationRow, (typeof CLEARED_APPLICATION_KEYS)[number]>;

/** The `users` columns anonymization sets, the time it ran among them. */
export function clearedUser(now: Date): UserClear {
  return {
    email: ANONYMIZED_EMAIL,
    firstName: null,
    lastName: null,
    phone: null,
    linkedin: null,
    politoId: null,
    anonymizedAt: now.toISOString(),
  };
}

export const CLEARED_MEMBER: MemberClear = {
  prtEmail: null,
  mobileNumber: null,
  discord: null,
  ndaName: null,
  picture: null,
};

export const CLEARED_APPLICATION: ApplicationClear = { mlName: null, cvName: null };

/** SQL column names, as the audit trigger writes them into `logs` (`to_jsonb` of the row). */
const userColumns = getTableColumns(users);
const memberColumns = getTableColumns(members);
const applicationColumns = getTableColumns(applications);

/**
 * How a log row is known to be about the person: its `record_id` is their
 * user id or their member id, or its JSON copy names their user id in
 * `column` (when `record_id` is the row's own id, not theirs).
 */
export type LogOwner =
  | { readonly by: "user-id" }
  | { readonly by: "member-id" }
  | { readonly by: "column"; readonly column: "user_id" | "userId" };

/** The audit log rows of one table whose JSON copies lose `keys`. */
export type LogScrub = {
  readonly schema: "public" | "better_auth";
  readonly table: string;
  readonly owner: LogOwner;
  readonly keys: readonly string[];
};

/**
 * Every table whose log rows hold a copy of the person's identifying values,
 * and the keys removed from their `old_data` and `new_data`. The Better Auth
 * rows went with the account; their copies keep only what is not personal.
 */
export const LOG_SCRUBS: readonly LogScrub[] = [
  {
    schema: "public",
    table: "users",
    owner: { by: "user-id" },
    keys: CLEARED_USER_KEYS.map((key) => userColumns[key].name),
  },
  {
    schema: "public",
    table: "members",
    owner: { by: "member-id" },
    keys: CLEARED_MEMBER_KEYS.map((key) => memberColumns[key].name),
  },
  {
    schema: "public",
    table: "applications",
    owner: { by: "column", column: "user_id" },
    keys: CLEARED_APPLICATION_KEYS.map((key) => applicationColumns[key].name),
  },
  {
    schema: "public",
    table: "application_files",
    owner: { by: "column", column: "user_id" },
    keys: ["r2_key", "original_filename", "file_hash"],
  },
  { schema: "better_auth", table: "user", owner: { by: "user-id" }, keys: ["name", "email", "image"] },
  {
    schema: "better_auth",
    table: "account",
    owner: { by: "column", column: "userId" },
    keys: ["accountId", "accessToken", "refreshToken", "idToken", "password", "scope"],
  },
  {
    schema: "better_auth",
    table: "session",
    owner: { by: "column", column: "userId" },
    keys: ["token", "ipAddress", "userAgent"],
  },
];

/** One `public.logs` row, as far as the scrub reads it. */
export type LogRow = {
  readonly schemaName: string;
  readonly tableName: string;
  readonly recordId: string | null;
  readonly oldData: Record<string, unknown> | null;
  readonly newData: Record<string, unknown> | null;
};

/** Whether `scrub` reaches `row` for this person: the same test the database side writes in SQL. */
export function scrubReaches(scrub: LogScrub, person: Pick<DeletedAccount, "userId" | "memberId">, row: LogRow): boolean {
  if (row.schemaName !== scrub.schema || row.tableName !== scrub.table) return false;
  switch (scrub.owner.by) {
    case "user-id":
      return row.recordId === person.userId;
    case "member-id":
      return person.memberId !== null && row.recordId === String(person.memberId);
    case "column": {
      const column = scrub.owner.column;
      return row.oldData?.[column] === person.userId || row.newData?.[column] === person.userId;
    }
  }
}

/** A log row's JSON copy without `keys`: what the SQL `jsonb - text[]` does. */
export function scrubLogData(data: Record<string, unknown> | null, keys: readonly string[]): Record<string, unknown> | null {
  if (data === null) return null;
  return Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key)));
}

/**
 * One account's anonymization, as the writes run in one transaction, in this
 * order. The log scrub is last so it also reaches the log rows the updates
 * before it write. Deleting the remaining application files is the only
 * delete: the person's applications, roles and team leaves stay.
 */
export type AnonymizationStep =
  | { readonly kind: "clear-user"; readonly userId: string; readonly set: UserClear }
  | { readonly kind: "clear-member"; readonly memberId: number; readonly set: MemberClear }
  | { readonly kind: "clear-applications"; readonly userId: string; readonly set: ApplicationClear }
  | { readonly kind: "delete-application-files"; readonly userId: string }
  | { readonly kind: "scrub-logs"; readonly userId: string; readonly memberId: number | null; readonly scrubs: readonly LogScrub[] };

export function anonymizationPlan(account: DeletedAccount, now: Date): AnonymizationStep[] {
  return [
    { kind: "clear-user", userId: account.userId, set: clearedUser(now) },
    ...(account.memberId === null
      ? []
      : [{ kind: "clear-member", memberId: account.memberId, set: CLEARED_MEMBER } as const]),
    { kind: "clear-applications", userId: account.userId, set: CLEARED_APPLICATION },
    { kind: "delete-application-files", userId: account.userId },
    { kind: "scrub-logs", userId: account.userId, memberId: account.memberId, scrubs: LOG_SCRUBS },
  ];
}

/** A stored file the anonymization deletes: an application file in the private store, or a member photo in the public one. */
export type PersonalFile = { readonly store: "private" | "public"; readonly pathname: string };

/** What anonymization needs from the database and the file stores. */
export interface AnonymizationStore {
  /** Deleted, not yet anonymized accounts deleted at or before `cutoff`. */
  deletedAccounts(cutoff: Date): Promise<readonly DeletedAccount[]>;
  /** The person's stored files: their remaining application files, and their member photo. */
  personalFiles(account: DeletedAccount): Promise<readonly PersonalFile[]>;
  /** Deletes one stored file; deleting one already gone is not an error. */
  deleteFile(file: PersonalFile): Promise<void>;
  /** Runs the plan's writes as one transaction. */
  run(plan: readonly AnonymizationStep[]): Promise<void>;
}

export type AnonymizationRun = {
  readonly anonymized: readonly string[];
  /** Accounts left for the next run: a file or the write failed. */
  readonly failed: readonly string[];
};

/**
 * Anonymizes every account due at `now`. The files go first: when one cannot
 * be deleted, the account's rows stay as they are, so the next run finds it
 * again and nothing is left behind with no row pointing at it.
 */
export async function anonymizeDeletedAccounts(now: Date, store: AnonymizationStore): Promise<AnonymizationRun> {
  const anonymized: string[] = [];
  const failed: string[] = [];
  const accounts = await store.deletedAccounts(anonymizationCutoff(now));
  for (const account of accounts) {
    if (!dueForAnonymization(account, now)) continue;
    try {
      for (const file of await store.personalFiles(account)) await store.deleteFile(file);
      await store.run(anonymizationPlan(account, now));
      anonymized.push(account.userId);
    } catch (error) {
      console.error(`Anonymizing deleted account ${account.userId} failed; the next run retries it.`, error);
      failed.push(account.userId);
    }
  }
  return { anonymized, failed };
}
