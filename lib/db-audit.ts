import { sql } from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
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

type AuditBatch = [BatchItem<"pg">, ...BatchItem<"pg">[]];

/**
 * Runs several writes as one transaction (the neon-http driver sends a
 * `db.batch` as one), with the audit user set first, as runAuditQuery does
 * for one write. The batch cannot read one write's result in the next, so a
 * later write finds an earlier row by a unique value instead. It answers each
 * write's result in order, so a guarded write can tell whether it changed a
 * row. A write with no signed-in user is refused here: it would log no one.
 */
export async function runAuditBatch<TBatch extends AuditBatch>(
  buildQueries: (db: AuditDb) => TBatch,
): Promise<BatchResponse<TBatch>> {
  const db = getDb();
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("runAuditBatch needs a signed-in user");
  }
  const [, ...results] = await db.batch([buildAuditSetupQuery(db, userId), ...buildQueries(db)]);
  return results as BatchResponse<TBatch>;
}
