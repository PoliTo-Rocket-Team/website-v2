import "server-only";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUserId } from "@/lib/current-user";

export { getCurrentUserId } from "@/lib/current-user";

async function getMemberIdByUserId(userId: string): Promise<number | null> {
  const db = getDb();
  const [userData] = await db
    .select({ member: users.member })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userData?.member ?? null;
}

/**
 * Get the current authenticated user's member ID
 * @returns Promise<number | null> - Returns member ID or null if not found/authenticated
 */
export async function getCurrentMemberId(): Promise<number | null> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return null;
  }

  return getMemberIdByUserId(userId);
}
