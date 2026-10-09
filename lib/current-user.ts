import "server-only";

import { headers } from "next/headers";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { isDatabaseConfigured } from "@/db/client";
import { getAuth } from "@/lib/auth";

/**
 * The signed-in account's user id, or null. The signed cookie cache answers
 * first; it lives 10 minutes (lib/auth.ts) while the session token lives 7
 * days, so once it lapses a request that still holds a token asks Better
 * Auth for the session.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const requestHeaders = await headers();

  const sessionCookie = await getCookieCache(requestHeaders, {
    secret: process.env.BETTER_AUTH_SECRET,
  });

  const cachedUserId =
    sessionCookie?.session.userId ?? sessionCookie?.user.id ?? null;

  if (cachedUserId) {
    return cachedUserId;
  }

  if (!isDatabaseConfigured() || getSessionCookie(new Headers(requestHeaders)) === null) {
    return null;
  }

  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session?.user.id ?? null;
}
