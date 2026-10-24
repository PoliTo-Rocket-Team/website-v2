import { testDb } from "../test-database";

// Stands in for `@/db/client` in the server-side access tests: the database
// is the migrated in-memory Postgres of ../test-database.ts.

export function isDatabaseConfigured(): boolean {
  return true;
}

export function getDb() {
  return testDb;
}
