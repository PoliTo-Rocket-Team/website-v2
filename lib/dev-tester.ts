// Tester sign-in (issues #129, #230, #608, #653). A reviewer or an agent
// signs in, without Google, as any seeded person (a seat or admin tester of
// lib/seeded-accounts.ts, or anyone else the seed writes) and gets a real
// Better Auth session, so every page and write runs the real code. Every
// tester code path asks `testerSignInOn()` first. It is on in two places
// only: under `next dev` off Vercel (the Neon `development` branch, Owner
// decision on #597), and on a Vercel preview whose database is the shared
// `preview` branch. On production, on any other Vercel environment, on a
// preview pointed at another database and under the test runner it is off,
// so the sign-in route is not registered at all.

import { isPreviewDatabase } from "@/lib/seed/target";

/** The three variables the gate reads. */
export type GateEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
  readonly DATABASE_URL?: string;
};

function processGateEnv(): GateEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
  };
}

/**
 * Whether tester sign-in is on: under `next dev` (NODE_ENV "development")
 * with no Vercel environment, or on a Vercel preview whose `DATABASE_URL` is
 * the shared `preview` branch (`isPreviewDatabase`). Never on production or
 * any other Vercel environment.
 */
export function testerSignInOn(env: GateEnv = processGateEnv()): boolean {
  const localDev = env.NODE_ENV === "development" && !env.VERCEL_ENV;
  const sharedPreview = env.VERCEL_ENV === "preview" && isPreviewDatabase(env.DATABASE_URL);
  return localDev || sharedPreview;
}
