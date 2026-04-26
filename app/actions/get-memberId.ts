import "server-only";

import { eq } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

async function getMemberIdByUserId(userId: string): Promise<number | null> {
  "use cache";
  cacheLife("hours");

  const db = getDb();
  const [userData] = await db
    .select({ member: users.member })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userData?.member ?? null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  });
  return session?.userId ?? null;
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
