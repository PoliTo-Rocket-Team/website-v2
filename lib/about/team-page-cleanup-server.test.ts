// The public read imports server-only modules; the access matrix's stand-ins let it load outside Next.
import "@/lib/dashboard/access-matrix/install";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { teamPageLayerVersions } from "@/db/schema";
import { changeRows, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { seeded } from "@/lib/dashboard/access-matrix/whole-seed";
import { teamPageData } from "./team-data";

// The public /about/the-team read across migration 0088 (issue #855): a
// stored layer that still holds the people fields epic #835 kept for one
// release is not one this code reads, and once the migration strips them the
// page draws as it did. The migration runs again on this file's own
// in-memory Postgres, which no other test file shares.

test("/about/the-team draws the same page once migration 0088 strips the people fields a stored layer still held", async () => {
  await seeded();
  const drawn = await teamPageData();
  const [row] = await tableRows(teamPageLayerVersions);
  const legacy = { leader: {}, spots: {}, addedLeaders: [], departments: {}, addedDepartments: [] };
  await changeRows(teamPageLayerVersions, { id: row.id }, { layer: { ...(row.layer as object), ...legacy } });
  assert.notDeepEqual(await teamPageData(), drawn, "a layer still holding people fields is skipped");

  const migration = readFileSync(resolve(process.cwd(), "drizzle/0088_team_page_layer_cleanup.sql"), "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) if (statement.trim()) await testDb.execute(sql.raw(statement));
  const [after] = await tableRows(teamPageLayerVersions);
  assert.deepEqual(Object.keys(after.layer as object).sort(), Object.keys(row.layer as object).sort(), "only the layer's text is left");
  assert.deepEqual(await teamPageData(), drawn);
});
