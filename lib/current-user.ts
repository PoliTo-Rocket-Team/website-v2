import "server-only";

import { headers } from "next/headers";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { isDatabaseConfigured } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { accountUserOf, impersonatorOf, type CurrentUser } from "@/lib/session-user";

export type { CurrentUser } from "@/lib/session-user";

/**
 * The signed-in person, or null: only a real Better Auth session answers
 * (issue #612). The signed cookie cache answers first; it lives 10 minutes
 * (lib/auth.ts) while the session token lives 7 days, so once it lapses a
 * request that still holds a token asks Better Auth for the session. A View
 * as session answers the person viewed as, with the acting account read from
 * the session's own `impersonatedBy` (issue #604), never from anything the
 * request names.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const requestHeaders = await headers();

  const sessionCookie = await getCookieCache(requestHeaders, {
    secret: process.env.BETTER_AUTH_SECRET,
  });

  if (sessionCookie?.user) {
    return accountUserOf({
      userId: sessionCookie.session.userId ?? sessionCookie.user.id,
      name: sessionCookie.user.name,
      impersonatedBy: impersonatorOf(sessionCookie.session),
    });
  }

  if (!isDatabaseConfigured() || getSessionCookie(new Headers(requestHeaders)) === null) {
    return null;
  }

  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session ? accountUserOf({ userId: session.user.id, name: session.user.name, impersonatedBy: session.impersonatedBy }) : null;
}

/** The signed-in person's user id, or null (getCurrentUser). */
export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}
