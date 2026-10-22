import { fakeDb } from "../fake-db";

// Stands in for `@/lib/db-audit` in the server-side access tests: an audited
// write runs against the fake database, which records each row it would
// change and stores nothing.

export { getCurrentUserId } from "./current-user";

type Built = PromiseLike<unknown>;

export async function runAuditQuery(buildQuery: (db: typeof fakeDb) => Built): Promise<unknown> {
  return buildQuery(fakeDb);
}

export async function runAuditBatch(buildQueries: (db: typeof fakeDb) => readonly Built[]): Promise<unknown[]> {
  return Promise.all(buildQueries(fakeDb));
}
