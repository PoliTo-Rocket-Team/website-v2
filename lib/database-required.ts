// Every page reads a database under `next dev` and on previews (issue #609,
// epic #597). There is no fallback: a run there with no DATABASE_URL stops
// with a message naming the database it needs, in place of the dummy arrays
// it once read. Production keeps its own rule: it may run with no database,
// and the callers that can render without one still do (db/client.ts).

/** The three variables the rule reads. */
export type DatabaseEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
  readonly DATABASE_URL?: string;
};

export function processDatabaseEnv(): DatabaseEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
  };
}

/**
 * The database a run must read: the Neon `development` branch under
 * `next dev`, the shared `preview` branch on a Vercel preview. Production,
 * any other Vercel environment, a local production build and the test runner
 * have none they must read.
 */
export type RequiredDatabase = "development" | "preview";

export function requiredDatabase(env: DatabaseEnv): RequiredDatabase | null {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "preview" ? "preview" : null;
  return env.NODE_ENV === "development" ? "development" : null;
}

const HOW_TO_GET_IT: Record<RequiredDatabase, string> = {
  development:
    "`next dev` reads the Neon `development` branch: set DATABASE_URL to that branch's connection string and start again.",
  preview:
    "A preview reads the shared Neon `preview` branch: its build needs the Preview DATABASE_URL.",
};

/** A run that must read a database and has none. Its message names the database. */
export class DatabaseRequired extends Error {
  constructor(readonly database: RequiredDatabase) {
    super(`No database: DATABASE_URL is not set. ${HOW_TO_GET_IT[database]} No page falls back to dummy data.`);
    this.name = "DatabaseRequired";
  }
}

/** Stops the run, with DatabaseRequired, where it must read a database and has none; else does nothing. */
export function assertDatabaseWhereRequired(env: DatabaseEnv = processDatabaseEnv()): void {
  if (env.DATABASE_URL) return;
  const database = requiredDatabase(env);
  if (database !== null) throw new DatabaseRequired(database);
}
