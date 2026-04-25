import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db/client";
import { auth } from "@/lib/auth";

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session?.userId ?? session?.user?.id ?? null;
}

export async function withAuditUser<T>(
  callback: (
    tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  ) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const userId = await getCurrentUserId();

  return db.transaction(async (tx) => {
    if (userId) {
      await tx.execute(
        sql`select set_config('request.jwt.claim.sub', ${userId}, true)`,
      );
    }

    return callback(tx);
  });
}
