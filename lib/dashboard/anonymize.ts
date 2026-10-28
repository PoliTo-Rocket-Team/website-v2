// Deleted accounts are anonymized after a year (issue #191; the rule is in
// docs/dashboard-rules.md, section 3). Delete account closes the sign-in and
// records `users.deleted_at`. A year or more later the person's identifying
// fields are cleared, their remaining files deleted, and the same values
// removed from the audit log; every field the team counts for statistics
// stays. The person's alumni entry (name, years, roles, founder mark) stays
// as part of the team's history, unless they ticked "Remove my name from the
// Alumni page" (issue #257). Rules and the plan only: the database side is
// ./database-anonymize.ts, and the daily cron route runs it.

import { getTableColumns, type InferSelectModel } from "drizzle-orm";
import { alumniEntries, applications, members, users } from "@/db/schema";

/** One account Delete account closed, as the store reads it. */
export type DeletedAccount = {
  readonly userId: string;
  /** The `members` row linked to the account, if the person was on the team. */
  readonly memberId: number | null;
  readonly deletedAt: Date;
  readonly anonymizedAt: Date | null;
  /** A Better Auth user with this id exists again: the person signed in after deleting. */
  readonly signedInAgain: boolean;
  /**
   * For someone who was on the team: their name on the team record, which
   * their alumni entry keeps, and whether they asked to be removed from the
   * Alumni page (boards 55b, 55c). Null for someone never on the team.
   */
  readonly alumni: { readonly name: string | null; readonly removed: boolean } | null;
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
type AlumniEntryRow = InferSelectModel<typeof alumniEntries>;

// The identifying fields each row loses. The statistics fields are the ones
// left out: users' gender, date of birth, origin, country, level of study,
// program, referral source, created_at and member link; members' team years
// and NDA date; every applications position, status and date column. The
// free-text answers to a position's questions can name or describe the
// person, so they are cleared too (issue #729, ADR 0012 amendment).
const CLEARED_USER_KEYS = ["email", "firstName", "lastName", "phone", "linkedin", "politoId"] as const;
const CLEARED_MEMBER_KEYS = ["prtEmail", "mobileNumber", "discord", "ndaName", "picture"] as const;
const CLEARED_APPLICATION_KEYS = ["mlName", "cvName", "customAnswers"] as const;

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
  // The PRT email is also their team email alias, firstname.lastname (epic
  // #538, issue #563): it names them.
  prtEmail: null,
  mobileNumber: null,
  discord: null,
  ndaName: null,
  picture: null,
};

export const CLEARED_APPLICATION: ApplicationClear = { mlName: null, cvName: null, customAnswers: null };

/**
 * What a removed person's alumni entry loses: every name and the photo. The
 * entry stays, still marked removed, so the page never lists their roles
 * under any name; their per-year role text goes with it.
 */
const CLEARED_ALUMNI_KEYS = ["recordName", "name", "photo"] as const;
export type AlumniEntryClear = Pick<AlumniEntryRow, (typeof CLEARED_ALUMNI_KEYS)[number]>;
export const CLEARED_ALUMNI_ENTRY: AlumniEntryClear = { recordName: null, name: null, photo: null };

/** SQL column names, as the audit trigger writes them into `logs` (`to_jsonb` of the row). */
const userColumns = getTableColumns(users);
const memberColumns = getTableColumns(members);
const applicationColumns = getTableColumns(applications);
const alumniColumns = getTableColumns(alumniEntries);

/**
 * How a log row is known to be about the person: its `record_id` is their
 * user id or their member id, or its JSON copy names their user id in
 * `column` (when `record_id` is the row's own id, not theirs).
 */
export type LogOwner =
  | { readonly by: "user-id" }
  | { readonly by: "member-id" }
  | { readonly by: "column"; readonly column: "user_id" | "userId" }
  /** Its JSON copy names their member id in `member_id` (the row's own id is its `record_id`). */
  | { readonly by: "member-column" };

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
    case "member-column":
      return person.memberId !== null && (row.oldData?.member_id === person.memberId || row.newData?.member_id === person.memberId);
  }
}

/**
 * The alumni entry's log rows lose its photo always, and its names too when
 * the person asked to be removed; a kept entry's name stays, as the entry does.
 */
function alumniScrub(removed: boolean): LogScrub {
  const keys: readonly (keyof AlumniEntryClear)[] = removed ? CLEARED_ALUMNI_KEYS : ["photo"];
  return { schema: "public", table: "alumni_entries", owner: { by: "member-column" }, keys: keys.map((key) => alumniColumns[key].name) };
}

/** Every log scrub one account's anonymization runs: LOG_SCRUBS, and the alumni entry's for someone on the team. */
export function logScrubsOf(account: Pick<DeletedAccount, "memberId" | "alumni">): readonly LogScrub[] {
  return account.memberId === null || account.alumni === null ? LOG_SCRUBS : [...LOG_SCRUBS, alumniScrub(account.alumni.removed)];
}

/** A log row's JSON copy without `keys`: what the SQL `jsonb - text[]` does. */
export function scrubLogData(data: Record<string, unknown> | null, keys: readonly string[]): Record<string, unknown> | null {
  if (data === null) return null;
  return Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key)));
}

/**
 * One account's anonymization, as the writes run in one transaction, in this
 * order. The alumni step is first, while the person's name is still on the
 * user row it copies. The log scrub is last so it also reaches the log rows
 * the updates before it write. Deleting the remaining application files and
 * a removed person's per-year role text are the only deletes: the person's
 * applications, roles and team leaves stay.
 */
export type AnonymizationStep =
  /** Their alumni entry keeps the record's name (made when they had none yet); its photo goes. */
  | { readonly kind: "keep-alumni-entry"; readonly memberId: number; readonly name: string | null }
  /** They asked to be removed: their entry loses every name and the photo, and its role text goes. */
  | { readonly kind: "clear-alumni-entry"; readonly memberId: number; readonly set: AlumniEntryClear }
  | { readonly kind: "clear-user"; readonly userId: string; readonly set: UserClear }
  | { readonly kind: "clear-member"; readonly memberId: number; readonly set: MemberClear }
  | { readonly kind: "clear-applications"; readonly userId: string; readonly set: ApplicationClear }
  | { readonly kind: "delete-application-files"; readonly userId: string }
  | { readonly kind: "scrub-logs"; readonly userId: string; readonly memberId: number | null; readonly scrubs: readonly LogScrub[] };

function alumniStep(account: DeletedAccount): AnonymizationStep[] {
  if (account.memberId === null || account.alumni === null) return [];
  return account.alumni.removed
    ? [{ kind: "clear-alumni-entry", memberId: account.memberId, set: CLEARED_ALUMNI_ENTRY }]
    : [{ kind: "keep-alumni-entry", memberId: account.memberId, name: account.alumni.name }];
}

export function anonymizationPlan(account: DeletedAccount, now: Date): AnonymizationStep[] {
  return [
    ...alumniStep(account),
    { kind: "clear-user", userId: account.userId, set: clearedUser(now) },
    ...(account.memberId === null
      ? []
      : [{ kind: "clear-member", memberId: account.memberId, set: CLEARED_MEMBER } as const]),
    { kind: "clear-applications", userId: account.userId, set: CLEARED_APPLICATION },
    { kind: "delete-application-files", userId: account.userId },
    { kind: "scrub-logs", userId: account.userId, memberId: account.memberId, scrubs: logScrubsOf(account) },
  ];
}

/** A stored file the anonymization deletes: an application file in the private store, or a member or alumni photo in the public one. */
export type PersonalFile = { readonly store: "private" | "public"; readonly pathname: string };

/** What anonymization needs from the database and the file stores. */
export interface AnonymizationStore {
  /** Deleted, not yet anonymized accounts deleted at or before `cutoff`. */
  deletedAccounts(cutoff: Date): Promise<readonly DeletedAccount[]>;
  /** The person's stored files: their remaining application files, their member photo and their alumni photo. */
  personalFiles(account: DeletedAccount): Promise<readonly PersonalFile[]>;
  /** Deletes one stored file; deleting one already gone is not an error. */
  deleteFile(file: PersonalFile): Promise<void>;
  /**
   * Runs the plan's writes as one transaction, which first checks again that
   * the account `userId` is still deleted, not anonymized, and has no sign-in
   * (issue #831). Answers the files of `files` no row names once the writes
   * landed; null when the check failed, and then nothing was written.
   */
  run(userId: string, plan: readonly AnonymizationStep[], files: readonly PersonalFile[]): Promise<readonly PersonalFile[] | null>;
}

export type AnonymizationRun = {
  readonly anonymized: readonly string[];
  /** Accounts the run did not finish: the write failed, so the next run retries it, or a file was left in a store. */
  readonly failed: readonly string[];
};

/**
 * Anonymizes every account due at `now`. The rows go first, in one batch
 * that checks again that the person is still due: someone who signed in
 * again after the accounts were read keeps their data and their files
 * (issue #831). Then their files go. A file that cannot be deleted then is
 * logged and the account counted as failed; its rows are already cleared, so
 * the next run does not find it again.
 */
export async function anonymizeDeletedAccounts(now: Date, store: AnonymizationStore): Promise<AnonymizationRun> {
  const anonymized: string[] = [];
  const failed: string[] = [];
  const accounts = await store.deletedAccounts(anonymizationCutoff(now));
  for (const account of accounts) {
    if (!dueForAnonymization(account, now)) continue;
    let freed: readonly PersonalFile[] | null;
    try {
      freed = await store.run(account.userId, anonymizationPlan(account, now), await store.personalFiles(account));
    } catch (error) {
      console.error(`Anonymizing deleted account ${account.userId} failed; the next run retries it.`, error);
      failed.push(account.userId);
      continue;
    }
    // They signed in again, or another run anonymized them, since the accounts were read.
    if (freed === null) continue;
    try {
      for (const file of freed) await store.deleteFile(file);
      anonymized.push(account.userId);
    } catch (error) {
      console.error(`Deleted account ${account.userId} is anonymized, but one of its files could not be deleted and stays in the store.`, error);
      failed.push(account.userId);
    }
  }
  return { anonymized, failed };
}
