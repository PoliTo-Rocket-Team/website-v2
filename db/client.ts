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

export function getDb() {
  const client = postgres(getConnectionString(), {
    max: 1,
  });

  return drizzle(client, { schema });
}

export async function getDbAsync() {
  return getDb();
}
