import { sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/current-user";

export { getCurrentUserId } from "@/lib/current-user";

type AuditDb = ReturnType<typeof getDb>;
type AuditQuery<TResult> = BatchItem<"pg"> & Promise<TResult>;

function buildAuditSetupQuery(db: AuditDb, userId: string) {
  return db.execute(
    sql`select set_config('request.jwt.claim.sub', ${userId}, true) as audit_user`,
  );
}

export async function runAuditQuery<TResult>(
  buildQuery: (db: AuditDb) => AuditQuery<TResult>,
): Promise<TResult> {
  const db = getDb();
  const userId = await getCurrentUserId();
  const query = buildQuery(db);

  if (!userId) {
    return query;
  }

  const [, result] = await db.batch([
    buildAuditSetupQuery(db, userId),
    query,
  ] as const);

  return result;
}
