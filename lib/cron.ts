import { createHash, timingSafeEqual } from "node:crypto";

// The scheduled jobs under app/api/cron/ (vercel.json `crons`). Vercel calls
// each route with `Authorization: Bearer <CRON_SECRET>`; every route checks it
// here first, so there is one secret check for all of them. With no secret
// set, nothing is let in.

const digest = (text: string) => createHash("sha256").update(text).digest();

/** Whether the request's Authorization header carries the cron secret. */
export function cronAuthorized(authorization: string | null, secret: string | undefined): boolean {
  if (!secret || authorization === null) return false;
  // Equal-length digests, so the comparison takes the same time for any guess.
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}

/** The 401 a cron route answers when `cronAuthorized` refuses. */
export function cronRefused(): Response {
  return new Response("Unauthorized", { status: 401 });
}
