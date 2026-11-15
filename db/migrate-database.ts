// What every migration entry point runs on a database: every pending
// migration in drizzle/. `pnpm db:migrate` (./migrate.ts) and the preview and
// production builds (./preview-build.ts, each under its lock) call this and
// nothing else, so all of them migrate a database the same way. The Team
// page layout's first fill, the one post-migration step there was (issue
// #850), ran its course and left with issue #855.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Sql } from "postgres";

export async function migrateDatabase(client: Sql): Promise<void> {
  await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
}
