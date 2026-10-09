// Dummy mode (issue #150): where the public pages read the arrays in this
// folder in place of the database. Vercel previews have no database, so they
// always do; so does `next dev` on a machine with no DATABASE_URL. Production
// never does, with or without a database, and neither does a local
// production build. Every page asks this one function, at request time.

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

/** Whether pages read dummy data: on a Vercel preview, or under `next dev` with no Vercel environment and no database. */
export function dummyDataOn(env: DummyModeEnv = processDummyModeEnv()): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "preview";
  return env.NODE_ENV === "development" && !env.DATABASE_URL;
}
