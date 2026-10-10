import "server-only";

import { and, eq, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { applicationFiles, applications, betterAuthUsers, logs, members, users } from "@/db/schema";
import { parsePrivatePathname, parsePublicPathname } from "@/lib/storage/pathname";
import { deletePrivateFile } from "@/lib/storage/private-store";
import { deletePublicFile } from "@/lib/storage/public-store";
import type { AnonymizationStep, AnonymizationStore, DeletedAccount, LogScrub, PersonalFile } from "./anonymize";
import { storedPhotoPathname } from "./database-self";

// The database and file-store side of ./anonymize.ts. The daily cron route
// runs it with no one signed in, so the audit trigger logs its writes with no
// `changed_by`; the plan's last step scrubs those log rows too.

type Db = ReturnType<typeof getDb>;

async function deletedAccounts(cutoff: Date): Promise<DeletedAccount[]> {
  const rows = await getDb()
    .select({
      userId: users.id,
      memberId: users.member,
      deletedAt: users.deletedAt,
      anonymizedAt: users.anonymizedAt,
      liveUser: betterAuthUsers.id,
    })
    .from(users)
    .leftJoin(betterAuthUsers, eq(betterAuthUsers.id, users.id))
    .where(and(isNotNull(users.deletedAt), isNull(users.anonymizedAt), lte(users.deletedAt, cutoff.toISOString())));
  return rows.flatMap((row) =>
    row.deletedAt === null
      ? []
      : [
          {
            userId: row.userId,
            memberId: row.memberId,
            deletedAt: new Date(row.deletedAt),
            anonymizedAt: row.anonymizedAt === null ? null : new Date(row.anonymizedAt),
            signedInAgain: row.liveUser !== null,
          },
        ],
  );
}

async function personalFiles(account: DeletedAccount): Promise<PersonalFile[]> {
  const db = getDb();
  const [files, member] = await Promise.all([
    db.select({ pathname: applicationFiles.pathname }).from(applicationFiles).where(eq(applicationFiles.userId, account.userId)),
    account.memberId === null
      ? Promise.resolve([])
      : db.select({ picture: members.picture }).from(members).where(eq(members.memberId, account.memberId)).limit(1),
  ]);
  const photo = storedPhotoPathname(member[0]?.picture ?? null);
  return [
    ...files.map((file) => ({ store: "private", pathname: file.pathname }) as const),
    ...(photo === null ? [] : [{ store: "public", pathname: photo } as const]),
  ];
}

/** Deletes one stored file. A pathname outside the store's own folders names no file of ours. */
async function deleteFile(file: PersonalFile): Promise<void> {
  if (file.store === "private") {
    const pathname = parsePrivatePathname(file.pathname);
    if (pathname !== null) await deletePrivateFile(pathname);
  } else {
    const pathname = parsePublicPathname(file.pathname);
    if (pathname !== null) await deletePublicFile(pathname);
  }
}

/** The log rows `scrub` reaches for this person: ./anonymize.ts `scrubReaches`, in SQL. */
function scrubOwner(scrub: LogScrub, userId: string, memberId: number | null): SQL | undefined {
  switch (scrub.owner.by) {
    case "user-id":
      return eq(logs.recordId, userId);
    case "member-id":
      return memberId === null ? undefined : eq(logs.recordId, String(memberId));
    case "column":
      return or(
        sql`${logs.oldData} ->> ${scrub.owner.column} = ${userId}`,
        sql`${logs.newData} ->> ${scrub.owner.column} = ${userId}`,
      );
  }
}

function scrubQuery(db: Db, scrub: LogScrub, userId: string, memberId: number | null) {
  const owner = scrubOwner(scrub, userId, memberId);
  if (owner === undefined) return [];
  const keys = sql`array[${sql.join(scrub.keys.map((key) => sql`${key}`), sql`, `)}]::text[]`;
  return [
    db
      .update(logs)
      .set({ oldData: sql`${logs.oldData} - ${keys}`, newData: sql`${logs.newData} - ${keys}` })
      .where(and(eq(logs.schemaName, scrub.schema), eq(logs.tableName, scrub.table), owner)),
  ];
}

function stepQueries(db: Db, step: AnonymizationStep): BatchItem<"pg">[] {
  switch (step.kind) {
    case "clear-user":
      return [db.update(users).set(step.set).where(eq(users.id, step.userId))];
    case "clear-member":
      return [db.update(members).set(step.set).where(eq(members.memberId, step.memberId))];
    case "clear-applications":
      return [db.update(applications).set(step.set).where(eq(applications.userId, step.userId))];
    case "delete-application-files":
      return [db.delete(applicationFiles).where(eq(applicationFiles.userId, step.userId))];
    case "scrub-logs":
      return step.scrubs.flatMap((scrub) => scrubQuery(db, scrub, step.userId, step.memberId));
  }
}

/** The plan's writes as one `db.batch`, which the neon-http driver runs as one transaction. */
async function run(plan: readonly AnonymizationStep[]): Promise<void> {
  const db = getDb();
  const [first, ...rest] = plan.flatMap((step) => stepQueries(db, step));
  if (first === undefined) return;
  await db.batch([first, ...rest]);
}

export const databaseAnonymizationStore: AnonymizationStore = { deletedAccounts, personalFiles, deleteFile, run };
