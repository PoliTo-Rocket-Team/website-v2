import "server-only";

import { headers } from "next/headers";
import { getCookieCache } from "better-auth/cookies";

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

  return null;
}
