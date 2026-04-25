import "server-only";

import { eq } from "drizzle-orm";
import { cacheLife } from "next/cache";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";

function nowMs() {
  return performance.now();
}

function formatMs(value: number) {
  return `${value.toFixed(1)}ms`;
}

function logMemberTiming(
  label: string,
  timings: Record<string, number>,
  extra?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const summary = Object.entries(timings)
    .map(([key, value]) => `${key}=${formatMs(value)}`)
    .join(" ");

  console.info(`[member-id] ${label} ${summary}`, extra ?? "");
}

const getSession = cache(async () => {
  const startedAt = nowMs();
  const requestHeaders = await headers();
  const headersAt = nowMs();
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });
  const sessionAt = nowMs();

  logMemberTiming(
    "getSession",
    {
      total: sessionAt - startedAt,
      headers: headersAt - startedAt,
      authApiGetSession: sessionAt - headersAt,
    },
    {
      hasSession: Boolean(session),
      hasUserId: Boolean(session?.userId),
    },
  );

  return session;
});

async function getMemberIdByUserId(userId: string): Promise<number | null> {
  "use cache";
  cacheLife("hours");

  const db = getDb();
  const [userData] = await db
    .select({ member: users.member })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userData?.member || null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.userId ?? null;
}

/**
 * Get the current authenticated user's member ID
 * @returns Promise<number | null> - Returns member ID or null if not found/authenticated
 */
export async function getCurrentMemberId(): Promise<number | null> {
  const startedAt = nowMs();
  const userId = await getCurrentUserId();
  const sessionAt = nowMs();

  if (!userId) {
    logMemberTiming("no-user", {
      total: sessionAt - startedAt,
      getSession: sessionAt - startedAt,
    });
    return null;
  }

  const memberId = await getMemberIdByUserId(userId);
  const memberAt = nowMs();

  logMemberTiming(
    "success",
    {
      total: memberAt - startedAt,
      getSession: sessionAt - startedAt,
      getMemberIdByUserId: memberAt - sessionAt,
    },
    {
      hasMemberId: memberId !== null,
    },
  );

  return memberId;
}
