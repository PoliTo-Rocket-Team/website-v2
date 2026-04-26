import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  const client = postgres(connectionString, {
    max: 1,
  });

  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to run Drizzle migrations");
  console.error(error);
  process.exit(1);
});
