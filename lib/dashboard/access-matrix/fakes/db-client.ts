import { fakeDb } from "../fake-db";

// Stands in for `@/db/client` in the server-side access tests.

export function isDatabaseConfigured(): boolean {
  return true;
}

export function getDb() {
  return fakeDb;
}
