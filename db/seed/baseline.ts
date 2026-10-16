// The first seed module: the rows db/seed.sql has always held (members,
// structure, roles, orders, recruitment, scopes and the local testers). Its
// tables are filled only by the seed, so its reset empties them and restarts
// their ids; seed.sql refers to rows by those ids. Later area modules (epic
// #260) replace this one with typed rows of their own.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SeedModule } from "@/lib/seed/runner";
import type { SeedTx } from "./tx";

/**
 * Every table db/seed.sql writes, emptied by the reset, plus `logs`. The
 * audit trigger writes a `logs` row for each seeded write, and `logs` already
 * empties with `users` through its `changed_by` foreign key; it is named here
 * so the reset says so.
 */
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
  "logs",
] as const;

/** The local testers' sign-in rows (lib/dev-tester.ts), matched by id or email. */
export const BASELINE_AUTH_RESET = `DELETE FROM better_auth."user"
WHERE id LIKE '7e57e500-0000-4000-8000-00000000000_'
   OR email LIKE '%.tester@example.com'`;

/**
 * Removes the audit rows the seed's own inserts just added. The reset's
 * TRUNCATE holds `logs` locked until the transaction ends, so every row in it
 * now is one this run wrote. Those rows carry the clock (`changed_at`) and the
 * trigger-set `users.updated_at`, so keeping them would make two runs differ.
 */
export const BASELINE_AUDIT_CLEAR = "DELETE FROM logs";

/**
 * Every trigger the migrations leave on the database, and how the seed keeps
 * what it writes the same on every run. A test reads drizzle/*.sql and fails
 * when a migration adds a trigger missing here.
 */
export const SEED_TRIGGERS = {
  audit_row_changes:
    "writes a logs row stamped now() for each seeded write; the reset empties logs and the insert ends with BASELINE_AUDIT_CLEAR",
  sync_public_users_from_better_auth_user:
    "sets users.updated_at to NOW() for each tester's better_auth row; db/seed.sql sets it back to a fixed time after that insert",
} as const;

export const BASELINE_SQL_PATH = resolve(process.cwd(), "db/seed.sql");

export const baseline: SeedModule<SeedTx> = {
  name: "baseline",
  async reset(tx) {
    await tx.unsafe(BASELINE_AUTH_RESET);
    await tx.unsafe(`TRUNCATE ${BASELINE_TABLES.join(", ")} RESTART IDENTITY CASCADE`);
  },
  async insert(tx) {
    await tx.unsafe(await readFile(BASELINE_SQL_PATH, "utf8"));
    await tx.unsafe(BASELINE_AUDIT_CLEAR);
  },
};
