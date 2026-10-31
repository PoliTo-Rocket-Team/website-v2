// What every migration entry point runs on a database (issue #850): every
// pending migration in drizzle/, then the post-migration steps, which are
// TypeScript because no SQL may rebuild what they derive. `pnpm db:migrate`
// (./migrate.ts) and the preview and production builds (./preview-build.ts,
// each under its lock) call this and nothing else, so none can run the
// migrations without the steps. Each step changes only rows it has not filled yet, so a second run
// writes nothing.

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Sql } from "postgres";
import { fillTeamPageLayouts } from "@/lib/about/team-layout-fill";

export async function migrateDatabase(client: Sql): Promise<void> {
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  const filled = await fillTeamPageLayouts(db);
  console.log(`Team page layouts filled: ${filled} stored version${filled === 1 ? "" : "s"} had none (lib/about/team-layout-fill.ts).`);
}
