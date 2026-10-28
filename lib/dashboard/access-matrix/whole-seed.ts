import type { Transaction } from "@electric-sql/pglite";
import { DRIZZLE_MAPPED_TYPES } from "@/db/seed/connection";
import { SEED_MODULES } from "@/db/seed/registry";
import { restore, testDb } from "./test-database";

// The whole seed (db/seed/registry.ts), as `pnpm db:seed` runs it, on the
// migrated in-memory Postgres of ./test-database.ts (issues #649, #653): a
// server-side test that signs in as a seeded person, rather than as one of
// the access matrix fixture's viewers (./fixture.ts), starts from this.

// The seed sends values drizzle already mapped, as db/seed/connection.ts does for postgres-js.
const AS_SENT = Object.fromEntries(DRIZZLE_MAPPED_TYPES.map((type) => [type, (value: unknown) => String(value)]));
type SeedTxOn = { unsafe(sql: string, params?: unknown[]): Promise<unknown> };

/** Every seed module's reset, last first, then every module's rows, in one transaction (lib/seed/runner.ts). */
async function seedEverything(): Promise<void> {
  await testDb.$client.transaction(async (tx: Transaction) => {
    const seedTx: SeedTxOn = { unsafe: (sql, params = []) => tx.query(sql, params, { serializers: AS_SENT }) };
    const modules = SEED_MODULES as unknown as readonly { reset(tx: SeedTxOn): Promise<void>; insert(tx: SeedTxOn): Promise<void> }[];
    for (const module of [...modules].reverse()) await module.reset(seedTx);
    for (const module of modules) await module.insert(seedTx);
  });
}

/** Puts the database in the state the whole seed leaves, with nothing a test before wrote and an empty write journal. */
export const seeded = (): Promise<void> => restore("seeded", seedEverything);
