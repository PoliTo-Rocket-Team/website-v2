import "server-only";

import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { isDatabaseConfigured } from "@/db/client";
import { getAuth } from "@/lib/auth";
import { accountUserOf, type CurrentUser } from "@/lib/session-user";

export type { CurrentUser } from "@/lib/session-user";

/**
 * The signed-in person, or null: only a real Better Auth session answers
 * (issue #612), read through Better Auth itself. Its signed cookie cache
 * (10 minutes, lib/auth.ts) still answers first, but only while the cache
 * and the session it holds are both unexpired; past that Better Auth reads
 * the session from the database. Reading the cache cookie directly once
 * skipped both checks (issue #899): a View as session's cache cookie lasts
 * as long as the browser, so a View as session that had run out kept opening
 * the dashboard as the person, and Stop then found no session to end. A View
 * as session answers the person viewed as, with the acting account read from
 * the session's own `impersonatedBy` (issue #604), never from anything the
 * request names.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const requestHeaders = await headers();

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
