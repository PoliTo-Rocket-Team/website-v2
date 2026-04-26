import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  return connectionString;
}

declare global {
  // eslint-disable-next-line no-var
  var __dbClient: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function getClient() {
  if (!globalThis.__dbClient) {
    globalThis.__dbClient = postgres(getConnectionString(), {
      max: 10,
    });
  }

  return globalThis.__dbClient;
}

export function getDb() {
  if (!globalThis.__db) {
    globalThis.__db = drizzle(getClient(), { schema });
  }

  return globalThis.__db;
}

export async function getDbAsync() {
  return getDb();
}
