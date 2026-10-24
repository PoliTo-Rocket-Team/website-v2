import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { nonAdditiveStatements } from "./journal";

// Migration 0056 (issue #589) gives each holder of the old Alumni grant a
// Content grant, now that the Alumni page is site content. This builds the
// schema from the journaled migrations on an in-memory Postgres (PGlite),
// loads `website` rows of every kind, and runs the migration file itself: it
// must add exactly one Content row at Can edit per old holder with none, keep
// every old row, and add nothing on a second run.

const root = join(__dirname, "..", "..");
const TAG = "0056_alumni_grants_to_content";
const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const file = (tag: string) => readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");

async function run(db: PGlite, sql: string) {
  for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
}

/** A database built from every journaled migration before 0056. */
async function schemaBefore(): Promise<PGlite> {
  const db = new PGlite();
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(TAG), `${TAG} is journaled`);
  for (const tag of tags.slice(0, tags.indexOf(TAG))) await run(db, file(tag));
  return db;
}

// 1 gave every grant. 2 holds the old Alumni grant at Can edit, 3 at Can view;
// 4 holds it and Content already; 5 holds Content alone; 6 holds an older
// `website` row on another target and on `all`; 7 holds no `website` row.
const ROWS = `
insert into members (member_id) values (1), (2), (3), (4), (5), (6), (7);
insert into scopes (id, member_id, given_by, scope, target, access_level) values
  (10, 2, 1, 'website', 'all', 'edit'),
  (11, 3, 1, 'website', 'all', 'view'),
  (12, 4, 1, 'website', 'all', 'edit'),
  (13, 4, 1, 'website', 'content', 'edit'),
  (14, 5, 1, 'website', 'content', 'edit'),
  (15, 6, null, 'website', 'faq', 'view'),
  (16, 6, 1, 'website', 'all', 'view'),
  (17, 7, 1, 'team', 'members', 'view');
`;

type Row = { member_id: number; given_by: number | null; scope: string; target: string; access_level: string };

async function rows(db: PGlite): Promise<Row[]> {
  const { rows } = await db.query<Row>("select member_id, given_by, scope::text, target::text, access_level::text from scopes order by member_id, id");
  return rows;
}

test("0056 only inserts: no DELETE, no UPDATE and no DROP", () => {
  const sql = file(TAG);
  assert.deepEqual(nonAdditiveStatements(sql), []);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ""), /\b(DELETE|UPDATE|DROP)\b/i);
});

test("0056 gives each old Alumni grant holder with no Content grant one Content grant at Can edit, keeps every old row, and adds nothing on a second run", async () => {
  const db = await schemaBefore();
  await db.exec(ROWS);
  const before = await rows(db);

  await run(db, file(TAG));
  const after = await rows(db);
  const added = after.filter((r) => !before.some((b) => JSON.stringify(b) === JSON.stringify(r)));
  assert.deepEqual(added, [
    { member_id: 2, given_by: 1, scope: "website", target: "content", access_level: "edit" },
    { member_id: 3, given_by: 1, scope: "website", target: "content", access_level: "edit" },
    // The giver of their earliest old row, here none.
    { member_id: 6, given_by: null, scope: "website", target: "content", access_level: "edit" },
  ]);
  for (const row of before) assert.ok(after.some((r) => JSON.stringify(r) === JSON.stringify(row)), `kept ${JSON.stringify(row)}`);
  assert.equal(after.length, before.length + added.length);

  await run(db, file(TAG));
  assert.deepEqual(await rows(db), after, "a second run inserts nothing");
});
