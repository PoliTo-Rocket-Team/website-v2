import "@/lib/dashboard/access-matrix/install";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { migrate } from "drizzle-orm/pglite/migrator";
import { testDb } from "@/lib/dashboard/access-matrix/test-database";
import { databaseProjectStore } from "@/lib/dashboard/database-projects";
import type { ContentItem } from "@/lib/content/versioned";
import { importedRecords } from "./import";
import { blocksRecordOf, type LegacyProjectRecord } from "./legacy";
import { withIntro, type ProjectRecord } from "./record";

// Migrations 0072 and 0073 (issue #535) make `page` the only stored record of
// a project version. This runs the journal on an in-memory Postgres (PGlite)
// up to the migration before them, where every imported project has a
// version. It saves one version's `page` again, as the dashboard does, and
// leaves another as code from before page blocks wrote it after 0050: its
// `page` NULL, its record only in `content`. Then Drizzle's migrator applies
// the rest, as a preview build does. Every version reads through the project
// store as the record it read as before: the `page`, or, on the row with
// none, `blocksRecordOf` of its `content` (`rowRecordOf` before 0073). The
// store's writes after the drop run in the access tests, on the whole journal.

const FOLDER = resolve(process.cwd(), "drizzle");
const LAST_BEFORE = "0071_alias_request_address";

type Journal = { readonly entries: readonly { readonly when: number; readonly tag: string }[] };

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const [cavour, ves] = importedRecords;

/** A stored record without the retired `teaser` key, which the code from before page blocks read past and 0050 leaves out. */
function withoutTeaser(record: LegacyProjectRecord): LegacyProjectRecord {
  const { teaser: _retired, ...rest } = record as LegacyProjectRecord & { teaser?: string };
  return rest as LegacyProjectRecord;
}

/** Cavour as the dashboard saved it after 0050: its `page` differs from what its `content` maps to. */
const SAVED_CAVOUR = withIntro(cavour, "Saved in the dashboard after page blocks.");

let stored: ReadonlyMap<number, ProjectRecord>;
let items: readonly ContentItem<ProjectRecord>[];

async function columns(): Promise<{ name: string; nullable: string }[]> {
  const { rows } = await testDb.$client.query<{ name: string; nullable: string }>(
    `SELECT "column_name" AS "name", "is_nullable" AS "nullable" FROM information_schema.columns
     WHERE "table_schema" = 'public' AND "table_name" = 'project_versions' ORDER BY "ordinal_position"`,
  );
  return rows;
}

before(async () => {
  const journal = JSON.parse(readFileSync(resolve(FOLDER, "meta/_journal.json"), "utf8")) as Journal;
  const recorded = journal.entries.slice(0, journal.entries.findIndex((e) => e.tag === LAST_BEFORE) + 1);
  assert.ok(recorded.length > 0 && recorded.length < journal.entries.length, `${LAST_BEFORE} is journaled before the newest entry`);
  const db = testDb.$client;
  for (const { tag } of recorded) {
    const sql = readFileSync(resolve(FOLDER, `${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
  }
  await db.exec(`
    create schema drizzle;
    create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
    insert into drizzle.__drizzle_migrations (hash, created_at) values ${recorded.map((e) => `('recorded', ${e.when})`).join(", ")};
  `);

  await db.query(`UPDATE "project_versions" SET "page" = $1::jsonb WHERE "project_id" = 1`, [JSON.stringify(SAVED_CAVOUR)]);
  await db.exec(`UPDATE "project_versions" SET "page" = NULL WHERE "project_id" = 2`);
  const { rows } = await db.query<{ project_id: number; content: LegacyProjectRecord; page: ProjectRecord | null }>(
    `SELECT "project_id", "content", "page" FROM "project_versions" ORDER BY "project_id"`,
  );
  assert.deepEqual(rows.map((r) => [r.project_id, r.page === null]), [[1, false], [2, true], [3, false]]);
  stored = new Map(rows.map((r) => [r.project_id, plain(r.page ?? blocksRecordOf(withoutTeaser(r.content)))]));

  await migrate(testDb, { migrationsFolder: FOLDER });
  items = await databaseProjectStore.list();
});

after(async () => {
  await testDb.$client.close();
});

test("the migrator applies 0072 then 0073: `content` and its check are gone, and `page` is required and checked", async () => {
  const { rows } = await testDb.$client.query<{ created_at: string }>(
    `SELECT "created_at" FROM drizzle.__drizzle_migrations WHERE "hash" <> 'recorded' ORDER BY "id"`,
  );
  const journal = JSON.parse(readFileSync(resolve(FOLDER, "meta/_journal.json"), "utf8")) as Journal;
  const whenOf = (tag: string) => journal.entries.find((e) => e.tag === tag)?.when;
  assert.deepEqual(
    rows.map((r) => Number(r.created_at)).slice(0, 2),
    [whenOf("0072_project_page_backfill"), whenOf("0073_drop_project_content")],
    "the backfill ran before the drop",
  );
  assert.deepEqual(
    (await columns()).map((c) => [c.name, c.nullable]),
    [
      ["id", "NO"],
      ["project_id", "NO"],
      ["version", "NO"],
      ["updated_at", "NO"],
      ["page", "NO"],
    ],
  );
  const checks = await testDb.$client.query<{ name: string }>(
    `SELECT "conname" AS "name" FROM pg_constraint WHERE "conrelid" = 'public.project_versions'::regclass AND "contype" = 'c' ORDER BY 1`,
  );
  assert.deepEqual(checks.rows.map((r) => r.name), ["project_versions_page_is_record"]);
});

test("a version with a page keeps it, and one with only content gets the record it read as before", () => {
  const published = (id: number) => {
    const item = items.find((i) => i.id === id);
    assert.ok(item !== undefined && item.version.state === "published", `project ${id} is published`);
    return item.version.published;
  };
  assert.deepEqual(items.map((i) => i.id), [...stored.keys()], "every project is still read");
  for (const [id, record] of stored) assert.deepEqual(published(id), record, `project ${id}`);
  assert.deepEqual(published(1), plain(SAVED_CAVOUR), "the saved page, not a new mapping of its content");
  assert.deepEqual(published(2), plain(ves), "0050's mapping of its content: the record the import gives");
});
