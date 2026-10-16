// The first half of `pnpm build` (issue #307, ADR 0016). On a Vercel preview
// build that was given a database, it migrates that database and then resets
// and re-seeds it, holding a Postgres advisory lock so concurrent preview
// builds take turns on the one shared `preview` branch. Every other build
// skips it and touches no database. A refusal or a failure fails the build:
// a preview whose database was not seeded must not deploy, because its pages
// read that database (lib/dummy-data/mode.ts).
//
// It reads the real environment only, never a .env file, so a local build
// never seeds.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { neonBranchLookup } from "@/lib/seed/neon-branch";
import { preparePreviewDatabase, type PreviewBuildSteps } from "@/lib/seed/preview-build";
import { runSeed } from "@/lib/seed/runner";
import { guardSeedTarget } from "@/lib/seed/target";
import { seedConnection } from "./seed/connection";
import { SEED_MODULES } from "./seed/registry";

/** The advisory lock every preview build takes before it migrates and seeds. */
const PREVIEW_SEED_LOCK = "prt-website-preview-seed";

const steps: PreviewBuildSteps = {
  guard: (connectionString) =>
    guardSeedTarget(
      connectionString,
      neonBranchLookup({ NEON_API_KEY: process.env.NEON_API_KEY, NEON_PROJECT_ID: process.env.NEON_PROJECT_ID }),
      { VERCEL_ENV: process.env.VERCEL_ENV },
    ),
  async exclusive(target, work) {
    // A session lock on its own direct connection: it lasts until unlocked or
    // until this process ends, whichever comes first.
    const lock = postgres(target.connectionString, { max: 1 });
    try {
      await lock`select pg_advisory_lock(hashtext(${PREVIEW_SEED_LOCK}))`;
      try {
        return await work();
      } finally {
        await lock`select pg_advisory_unlock(hashtext(${PREVIEW_SEED_LOCK}))`;
      }
    } finally {
      await lock.end();
    }
  },
  async migrate(target) {
    const client = postgres(target.connectionString, { max: 1 });
    try {
      await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    } finally {
      await client.end();
    }
  },
  seed: (target) => runSeed(target, SEED_MODULES, seedConnection),
};

async function main() {
  const outcome = await preparePreviewDatabase(
    {
      VERCEL_ENV: process.env.VERCEL_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED,
    },
    steps,
  );
  switch (outcome.kind) {
    case "skipped":
      console.log(`Preview database step skipped: ${outcome.why}.`);
      return;
    case "refused":
      console.error(`Preview database step refused: ${outcome.why}.`);
      process.exit(2);
    case "seeded": {
      const { target, modules } = outcome.report;
      console.log(`Migrated and seeded ${target.kind} ${target.label}: ${modules.join(", ")}.`);
      return;
    }
  }
}

main().catch((error) => {
  console.error("Preview database step failed");
  console.error(error);
  process.exit(1);
});
