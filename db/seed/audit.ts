// The last seed module: it leaves the audit table `logs` empty. The audit
// trigger writes a `logs` row stamped now() for each seeded write, so keeping
// them would make two runs differ. Registered last, so its insert runs after
// every other module has written.

import type { SeedModule } from "@/lib/seed/runner";
import type { SeedTx } from "./tx";

/** Empties `logs` before the run. */
export const AUDIT_RESET = "TRUNCATE logs RESTART IDENTITY";

/**
 * Removes the audit rows the run's own inserts just added. The reset's
 * TRUNCATE holds `logs` locked until the transaction ends, so every row in it
 * now is one this run wrote.
 */
export const AUDIT_CLEAR = "DELETE FROM logs";

/**
 * Every trigger the migrations leave on the database, and how the seed keeps
 * what it writes the same on every run. A test reads drizzle/*.sql and fails
 * when a migration adds a trigger missing here.
 */
export const SEED_TRIGGERS = {
  audit_row_changes: "writes a logs row stamped now() for each seeded write; this module empties logs before and after the inserts",
  sync_public_users_from_better_auth_user:
    "sets users.updated_at to NOW() for each tester's better_auth row; the people module sets it back to a fixed time after that insert",
  lapse_hand_over_requests:
    "closes a waiting hand-over request when its sender's roles change; the people module's reset empties members with CASCADE, so hand_over_requests is empty before any role is written and the trigger changes no row",
  lapse_hand_over_requests_on_change:
    "the same rule on a role update; it changes no row for the same reason",
} as const;

export const audit: SeedModule<SeedTx> = {
  name: "audit",
  async reset(tx) {
    await tx.unsafe(AUDIT_RESET);
  },
  async insert(tx) {
    await tx.unsafe(AUDIT_CLEAR);
  },
};
