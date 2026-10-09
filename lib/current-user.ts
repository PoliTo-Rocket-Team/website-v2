import "server-only";

import { headers } from "next/headers";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { isDatabaseConfigured } from "@/db/client";
import { getAuth } from "@/lib/auth";

/** The signed-in account, as much as the pages need of it. */
export type CurrentUser = { readonly id: string; readonly name: string };

/**
 * The signed-in account, or null. The signed cookie cache answers first; it
 * lives 10 minutes (lib/auth.ts) while the session token lives 7 days, so
 * once it lapses a request that still holds a token asks Better Auth for the
 * session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const requestHeaders = await headers();

  const sessionCookie = await getCookieCache(requestHeaders, {
    secret: process.env.BETTER_AUTH_SECRET,
  });

  if (sessionCookie?.user) {
    return { id: sessionCookie.session.userId ?? sessionCookie.user.id, name: sessionCookie.user.name };
  }

  if (!isDatabaseConfigured() || getSessionCookie(new Headers(requestHeaders)) === null) {
    return null;
  }

  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session ? { id: session.user.id, name: session.user.name } : null;
}

/** The signed-in account's user id, or null (getCurrentUser). */
export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}
