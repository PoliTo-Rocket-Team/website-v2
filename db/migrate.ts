import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  const pool = new Pool({
    connectionString,
    max: 1,
  });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Failed to run Drizzle migrations");
  console.error(error);
  process.exit(1);
});
