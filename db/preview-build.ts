// The first half of `pnpm build` (issue #307, ADR 0016). On a Vercel preview
// build that was given a database, it migrates that database and seeds it
// only when it is still empty, holding a Postgres advisory lock so concurrent
// preview builds take turns on the one shared `preview` branch. It never
// resets that branch, so rows made on a preview last across preview builds
// (issue #465). Every other build skips it and touches no database. A refusal
// or a failure fails the build: a preview whose database was not migrated, or
// not seeded while empty, must not deploy, because its pages read that
// database (lib/dummy-data/mode.ts).
//
// It reads the real environment only, never a .env file, so a local build
// never seeds.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { preparePreviewDatabase, type PreviewBuildSteps } from "@/lib/seed/preview-build";
import { runSeed } from "@/lib/seed/runner";
import { guardSeedTarget } from "@/lib/seed/target";
import { readPrivateFile, uploadPrivateFile } from "@/lib/storage/private-blob";
import { seedConnection } from "./seed/connection";
import { SEED_SAMPLE_DOCUMENT } from "./seed/recruitment";
import { SEED_MODULES } from "./seed/registry";

/** The advisory lock every preview build takes before it migrates and seeds. */
const PREVIEW_SEED_LOCK = "prt-website-preview-seed";

const steps: PreviewBuildSteps = {
  guard: async (connectionString) => guardSeedTarget(connectionString, { VERCEL_ENV: process.env.VERCEL_ENV }),
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
  // `departments` is the first table the first seed module (`structure`)
  // fills, and the seed never leaves it empty, so a database with no
  // department is one the seed never filled. It reads on its own direct
  // connection and writes nothing.
  async contents(target) {
    const client = postgres(target.connectionString, { max: 1 });
    try {
      const [row] = await client<{ seeded: boolean }[]>`select exists (select 1 from departments) as seeded`;
      return row?.seeded ? "has-data" : "empty";
    } finally {
      await client.end();
    }
  },
  // The sample document is stored inside the lock too, so two preview builds
  // never both find it missing and both upload it.
  async seed(target) {
    const report = await runSeed(target, SEED_MODULES, seedConnection);
    await storeSampleDocument();
    return report;
  },
};

/**
 * Uploads the one sample PDF every seeded application document points at
 * (issue #406) to the private store, at its fixed pathname, unless it is
 * already there. It writes nothing else. A preview with no store token stores
 * nothing, and says so.
 */
async function storeSampleDocument(): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log("Sample document skipped: this preview has no BLOB_READ_WRITE_TOKEN, so its document cards answer that no file is stored.");
    return;
  }
  const { pathname, bytes } = SEED_SAMPLE_DOCUMENT;
  const stored = await readPrivateFile(pathname);
  if (stored !== null) {
    await stored.stream.cancel();
    console.log(`Sample document already stored at ${pathname}.`);
    return;
  }
  await uploadPrivateFile(pathname, bytes, "application/pdf");
  console.log(`Stored the sample document at ${pathname}.`);
}

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
    case "migrated-and-seeded": {
      const { target, modules } = outcome.report;
      console.log(`Migrated and seeded ${target.kind} ${target.label}, which was empty: ${modules.join(", ")}.`);
      return;
    }
    case "migrated":
      console.log(`Migrated ${outcome.target.kind} ${outcome.target.label}; it already holds data, so it was not seeded and its rows were left as they were.`);
      return;
  }
}

main().catch((error) => {
  console.error("Preview database step failed");
  console.error(error);
  process.exit(1);
});
