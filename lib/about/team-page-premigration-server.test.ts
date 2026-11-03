// The public read imports server-only modules; the access matrix's stand-ins let it load outside Next.
import "@/lib/dashboard/access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { sql } from "drizzle-orm";
import { testDb } from "@/lib/dashboard/access-matrix/test-database";
import { seeded } from "@/lib/dashboard/access-matrix/whole-seed";
import { teamPageData } from "./team-data";

// The public /about/the-team read on a database migration 0076 has not
// reached yet (issue #850): with no `layout` column, each stored version
// draws the layout its layer snapshots to, so the order of deploy and
// migration does not matter. The column is dropped from this file's own
// in-memory Postgres, which no other test file shares.

test("/about/the-team reads each version's derived layout on a database with no layout column", async () => {
  await seeded();
  const stored = await teamPageData();
  await testDb.execute(sql`ALTER TABLE "team_page_layer_versions" DROP COLUMN "layout"`);
  const { rows } = await testDb.execute<Record<string, unknown>>(sql`SELECT * FROM "team_page_layer_versions"`);
  assert.ok(rows.length > 0 && rows.every((row) => !("layout" in row)), "the seeded versions are there, with no layout column");
  // The seed stores each layer's snapshot layout, so the derived layout draws the same page.
  assert.deepEqual(await teamPageData(), stored);
});
