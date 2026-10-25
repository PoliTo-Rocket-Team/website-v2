import { getDb } from "@/db/client";
import { logs } from "@/db/schema";
import { BREAK_GLASS_SIGN_IN_OPERATION, type BreakGlassSignIn } from "@/lib/break-glass";

// The audit entry each break-glass sign-in writes (issue #646). lib/auth.ts
// hands this to Better Auth's session hook, which calls it only for an
// account the break-glass setting names. Not marked server-only, as
// lib/auth.ts is not.

/**
 * Writes the one log entry for a break-glass sign-in: on the session it
 * opened, under the account, beside the row changes the audit trigger writes
 * (lib/db-audit.ts).
 */
export async function recordBreakGlassSignIn(signIn: BreakGlassSignIn): Promise<void> {
  await getDb()
    .insert(logs)
    .values({
      schemaName: "better_auth",
      tableName: "session",
      operation: BREAK_GLASS_SIGN_IN_OPERATION,
      recordId: signIn.sessionId,
      newData: { userId: signIn.userId },
      changedBy: signIn.userId,
    });
}
