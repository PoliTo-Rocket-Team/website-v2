import "server-only";

import { headers } from "next/headers";
import { getCookieCache } from "better-auth/cookies";
import { getAuth } from "@/lib/auth";

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

  const session = await getAuth().api.getSession({
    headers: requestHeaders,
  });

  return session?.userId ?? session?.user?.id ?? null;
}
