import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || undefined;
}

// A deployment may run with no database at all (for example a preview build).
// Callers that can render without one branch on this instead of catching
// getDb()'s error.
export function isDatabaseConfigured(): boolean {
  return databaseUrl() !== undefined;
}

export function getDb() {
  const connectionString = databaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  const client = neon(connectionString);

  return drizzle(client, { schema });
}
