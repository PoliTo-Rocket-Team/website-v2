// The rows db/seed.sql still holds: orders and recruitment (positions and
// applications). Its tables are filled only by the seed, so its reset empties
// them and restarts their ids; seed.sql refers to rows by those ids, and to
// the people and units the typed modules before it seed. Later area modules
// (epic #260) replace this one with typed rows of their own.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SeedModule } from "@/lib/seed/runner";
import type { SeedTx } from "./tx";

/** Every table db/seed.sql writes, emptied by the reset. */
export const BASELINE_TABLES = ["orders", "apply_positions", "applications"] as const;

export const BASELINE_SQL_PATH = resolve(process.cwd(), "db/seed.sql");

export const baseline: SeedModule<SeedTx> = {
  name: "baseline",
  async reset(tx) {
    await tx.unsafe(`TRUNCATE ${BASELINE_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  },
  async insert(tx) {
    await tx.unsafe(await readFile(BASELINE_SQL_PATH, "utf8"));
  },
};
