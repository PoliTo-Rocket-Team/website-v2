import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be configured");
  }

  const seedPath = resolve(process.cwd(), "db/seed.sql");
  const seedSql = await readFile(seedPath, "utf8");
  const client = postgres(connectionString, {
    max: 1,
  });

  try {
    await client.unsafe(seedSql);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Failed to seed database");
  console.error(error);
  process.exit(1);
});
