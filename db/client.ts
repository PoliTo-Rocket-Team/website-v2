import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";
import { assertDatabaseWhereRequired } from "@/lib/database-required";

function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined;
}

// Production may run with no database at all; callers that can render
// without one branch on this instead of catching getDb()'s error. Under
// `next dev` and on a preview there is no such run: both stop here with a
// message naming the database they need (issue #609, lib/database-required.ts).
export function isDatabaseConfigured(): boolean {
  assertDatabaseWhereRequired();
  return databaseUrl() !== undefined;
}

export function getDb() {
  assertDatabaseWhereRequired();
  const connectionString = databaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  const client = neon(connectionString);

  return drizzle(client, { schema });
}
