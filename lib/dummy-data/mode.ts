// Dummy mode (issue #150, ADR 0016): where the pages read the arrays in this
// folder in place of the database. Only a run with no database does: a Vercel
// preview whose build was given none, or `next dev` on a machine with no
// DATABASE_URL. A preview that has a database reads it, because its build
// migrated and seeded that database or failed (issue #307, db/preview-build.ts).
// Production never reads dummy data, with or without a database, and neither
// does a local production build. Every page asks this one function, at
// request time.

/** The three variables the gate reads. */
export type DummyModeEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
  readonly DATABASE_URL?: string;
};

export function processDummyModeEnv(): DummyModeEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
  };
}

/** Whether pages read dummy data: on a Vercel preview or under `next dev`, and only with no database. */
export function dummyDataOn(env: DummyModeEnv = processDummyModeEnv()): boolean {
  if (env.DATABASE_URL) return false;
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "preview";
  return env.NODE_ENV === "development";
}
