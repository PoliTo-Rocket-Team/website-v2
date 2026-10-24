import { sql } from "drizzle-orm";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { AUDIT_SETTINGS, auditWriterFor, type AuditWriter } from "@/lib/audit-writer";
import { getCurrentUser } from "@/lib/current-user";

export { getCurrentUserId } from "@/lib/current-user";

/**
 * Who the next write is logged under. Every signed-in write goes through
 * this file, so this is where a test developer's write is logged under their
 * seeded person on a preview, and refused before it is sent anywhere else
 * (lib/test-developer.ts, ADR 0016), and where a View as session's acting
 * account is read from the session for the log (issue #605).
 */
async function writer(): Promise<AuditWriter | null> {
  return auditWriterFor(await getCurrentUser());
}

type AuditDb = ReturnType<typeof getDb>;
type AuditQuery<TResult> = BatchItem<"pg"> & Promise<TResult>;

/**
 * Sets who the batch's writes are logged under, for this transaction only.
 * The acting account is always set, empty outside View as, so no write is
 * logged under an acting account its own session does not name.
 */
function buildAuditSetupQuery(db: AuditDb, by: AuditWriter) {
  return db.execute(
    sql`select set_config(${AUDIT_SETTINGS.writer}, ${by.userId}, true) as audit_user, set_config(${AUDIT_SETTINGS.actingAccount}, ${by.actingAccountId ?? ""}, true) as audit_acting_account`,
  );
}

export async function runAuditQuery<TResult>(
  buildQuery: (db: AuditDb) => AuditQuery<TResult>,
): Promise<TResult> {
  const by = await writer();
  const db = getDb();
  const query = buildQuery(db);

  if (!by) {
    return query;
  }

  const [, result] = await db.batch([
    buildAuditSetupQuery(db, by),
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
  const by = await writer();
  const db = getDb();
  if (!by) {
    throw new Error("runAuditBatch needs a signed-in user");
  }
  const [, ...results] = await db.batch([buildAuditSetupQuery(db, by), ...buildQueries(db)]);
  return results as BatchResponse<TBatch>;
}
