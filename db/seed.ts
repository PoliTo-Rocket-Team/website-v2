// `pnpm db:seed`: guard the target, then run every registered module.
// `pnpm db:seed --check` runs the guard alone and writes nothing.

import "dotenv/config";
import { runSeed } from "@/lib/seed/runner";
import { guardSeedTarget } from "@/lib/seed/target";
import { seedConnection } from "./seed/connection";
import { SEED_MODULES } from "./seed/registry";

async function main() {
  const verdict = guardSeedTarget(process.env.DATABASE_URL, { VERCEL_ENV: process.env.VERCEL_ENV });
  if (!verdict.ok) {
    console.error(`Seed refused (${verdict.refusal.reason}): ${verdict.refusal.detail}`);
    process.exit(2);
  }
  const { kind, label } = verdict.target;
  if (process.argv.includes("--check")) {
    console.log(`Seed target allowed: ${kind} ${label}`);
    return;
  }
  const report = await runSeed(verdict.target, SEED_MODULES, seedConnection);
  console.log(`Seeded ${kind} ${label}: ${report.modules.join(", ")}`);
}

main().catch((error) => {
  console.error("Failed to seed database");
  console.error(error);
  process.exit(1);
});
