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

import { put } from "@vercel/blob";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { preparePreviewDatabase, type PreviewBuildSteps } from "@/lib/seed/preview-build";
import { runSeed } from "@/lib/seed/runner";
import { guardSeedTarget } from "@/lib/seed/target";
import { seedConnection } from "./seed/connection";
import { SEED_APPLICATION_FILES } from "./seed/recruitment";
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
      await storeSeedFiles();
      return;
    }
  }
}

/**
 * Writes the seeded applications' PDFs to the private store (issue #406), at
 * the seed-only pathnames their `application_files` rows name, so the
 * Applications panel's document cards open on a preview. Every build writes
 * the same bytes, so writing over a file a build before stored changes
 * nothing. A preview with no store token stores none, and says so.
 */
async function storeSeedFiles(): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.log("Seed files skipped: this preview has no BLOB_READ_WRITE_TOKEN, so its document cards answer that no file is stored.");
    return;
  }
  for (const file of SEED_APPLICATION_FILES) {
    await put(file.row.pathname, Buffer.from(file.bytes), {
      access: "private",
      token,
      contentType: "application/pdf",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  }
  console.log(`Stored ${SEED_APPLICATION_FILES.length} seed application files in the private store.`);
}

main().catch((error) => {
  console.error("Preview database step failed");
  console.error(error);
  process.exit(1);
});
