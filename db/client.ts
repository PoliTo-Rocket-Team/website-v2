import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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
  var __dbPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

function getPool() {
  if (!globalThis.__dbPool) {
    globalThis.__dbPool = new Pool({
      connectionString: getConnectionString(),
      max: 10,
    });
  }

  return globalThis.__dbPool;
}

export function getDb() {
  if (!globalThis.__db) {
    globalThis.__db = drizzle({ client: getPool(), schema });
  }

  return globalThis.__db;
}

export async function getDbAsync() {
  return getDb();
}
