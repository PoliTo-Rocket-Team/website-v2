import type { TransactionSql } from "postgres";

/** What a seed module writes through: one postgres.js transaction. */
export type SeedTx = TransactionSql;
