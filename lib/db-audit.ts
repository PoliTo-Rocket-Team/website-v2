import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getCurrentUserId } from "@/lib/current-user";

export { getCurrentUserId } from "@/lib/current-user";

type AuditDb = ReturnType<typeof getDb>;

function buildAuditContext(userId: string, db: AuditDb) {
  return db
    .$with("audit_context", {
      auditUser: sql<string>`set_config('request.jwt.claim.sub', ${userId}, true)`,
    })
    .as(
      sql`select set_config('request.jwt.claim.sub', ${userId}, true) as audit_user`,
    );
}

export async function getAuditDb(): Promise<AuditDb> {
  const db = getDb();
  const userId = await getCurrentUserId();

  return userId ? (db.with(buildAuditContext(userId, db)) as AuditDb) : db;
}
