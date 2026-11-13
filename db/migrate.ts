import "dotenv/config";
import postgres from "postgres";
import { migrateDatabase } from "./migrate-database";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  const client = postgres(connectionString, {
    max: 1,
  });

  try {
    await migrateDatabase(client);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to run Drizzle migrations");
  console.error(error);
  process.exit(1);
});
