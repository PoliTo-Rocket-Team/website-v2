// The first seed module: the rows db/seed.sql has always held (members,
// structure, roles, orders, recruitment, scopes and the local testers). Its
// tables are filled only by the seed, so its reset empties them and restarts
// their ids; seed.sql refers to rows by those ids. Later area modules (epic
// #260) replace this one with typed rows of their own.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SeedModule } from "@/lib/seed/runner";
import type { SeedTx } from "./tx";

/** Every table db/seed.sql writes, emptied by the reset. */
export const BASELINE_TABLES = [
  "members",
  "users",
  "departments",
  "divisions",
  "roles",
  "orders",
  "apply_positions",
  "applications",
  "scopes",
] as const;

/** The local testers' sign-in rows (lib/dev-tester.ts), matched by id or email. */
export const BASELINE_AUTH_RESET = `DELETE FROM better_auth."user"
WHERE id LIKE '7e57e500-0000-4000-8000-00000000000_'
   OR email LIKE '%.tester@example.com'`;

export const BASELINE_SQL_PATH = resolve(process.cwd(), "db/seed.sql");

export const baseline: SeedModule<SeedTx> = {
  name: "baseline",
  async reset(tx) {
    await tx.unsafe(BASELINE_AUTH_RESET);
    await tx.unsafe(`TRUNCATE ${BASELINE_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  },
  async insert(tx) {
    await tx.unsafe(await readFile(BASELINE_SQL_PATH, "utf8"));
  },
};
