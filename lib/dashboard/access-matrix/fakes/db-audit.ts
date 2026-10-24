import { auditWriterFor } from "@/lib/audit-writer";
import { fakeDb, inBatch, recordAuditWriter } from "../fake-db";
import { getCurrentUser } from "./current-user";

// Stands in for `@/lib/db-audit` in the server-side access tests: an audited
// write runs against the fake database, which records each row it would
// change and stores nothing. Who it is logged under is read as the real file
// reads it (`auditWriterFor`) and noted, so a test can check the settings the
// audit trigger would store (issue #605).

export { getCurrentUserId } from "./current-user";

type Built = PromiseLike<unknown>;

async function noteWriter(): Promise<void> {
  const writer = auditWriterFor(await getCurrentUser());
  if (writer !== null) recordAuditWriter(writer);
}

export async function runAuditQuery(buildQuery: (db: typeof fakeDb) => Built): Promise<unknown> {
  await noteWriter();
  return buildQuery(fakeDb);
}

export async function runAuditBatch(buildQueries: (db: typeof fakeDb) => readonly Built[]): Promise<unknown[]> {
  await noteWriter();
  return inBatch(() => Promise.all(buildQueries(fakeDb)));
}
