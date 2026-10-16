import "server-only";

import { cookies, headers } from "next/headers";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { isDatabaseConfigured } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { TEST_DEVELOPER_COOKIE, testDeveloperStandIn } from "@/lib/test-developer";

/**
 * The signed-in person, as much as the pages need of it. `session` says how:
 * a real account, or a test developer read as a seeded person (issue #307),
 * who has no name of its own here and may never write.
 */
export type CurrentUser =
  | { readonly session: "account"; readonly id: string; readonly name: string }
  | { readonly session: "test-developer"; readonly id: string; readonly name: null };

/**
 * The signed-in person, or null. A test developer where the pages read a
 * database is their viewer's seeded person (lib/test-developer.ts). Else the
 * signed cookie cache answers first; it lives 10 minutes (lib/auth.ts) while
 * the session token lives 7 days, so once it lapses a request that still
 * holds a token asks Better Auth for the session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const standIn = testDeveloperStandIn((await cookies()).get(TEST_DEVELOPER_COOKIE)?.value);
  if (standIn !== null) return { session: "test-developer", id: standIn.userId, name: null };

  const requestHeaders = await headers();

  const sessionCookie = await getCookieCache(requestHeaders, {
    secret: process.env.BETTER_AUTH_SECRET,
  });

  if (sessionCookie?.user) {
    return { session: "account", id: sessionCookie.session.userId ?? sessionCookie.user.id, name: sessionCookie.user.name };
  }

  if (!isDatabaseConfigured() || getSessionCookie(new Headers(requestHeaders)) === null) {
    return null;
  }

  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session ? { session: "account", id: session.user.id, name: session.user.name } : null;
}

/** The signed-in person's user id, or null (getCurrentUser). */
export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}
