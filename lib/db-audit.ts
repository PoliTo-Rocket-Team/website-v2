import { sql } from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { getCurrentUser } from "@/lib/current-user";
import { auditWriterOf } from "@/lib/test-developer";

export { getCurrentUserId } from "@/lib/current-user";

/**
 * Who the next write is logged under. Every signed-in write goes through
 * this file, so this is where a test developer's write is refused before it
 * is sent (lib/test-developer.ts, ADR 0016).
 */
async function writerId(): Promise<string | null> {
  return auditWriterOf(await getCurrentUser());
}

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
  const userId = await writerId();
  const db = getDb();
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
  const userId = await writerId();
  const db = getDb();
  if (!userId) {
    throw new Error("runAuditBatch needs a signed-in user");
  }
  const [, ...results] = await db.batch([buildAuditSetupQuery(db, userId), ...buildQueries(db)]);
  return results as BatchResponse<TBatch>;
}
