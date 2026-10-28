import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { nonAdditiveStatements } from "./journal";

// Migration 0074 (issue #637) deletes the old Alumni grant rows, every
// `website` row on a target other than `content`, once 0058 (issue #589) gave
// their holders a Content grant. It first runs 0058's guarded insert again, so
// nobody loses Content access. This builds the schema from the journaled
// migrations on an in-memory Postgres (PGlite), loads rows of every kind, and
// runs the migration file itself.

const root = join(__dirname, "..", "..");
const TAG = "0074_delete_old_alumni_grant_rows";
const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const file = (tag: string) => readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");

async function run(db: PGlite, sql: string) {
  for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
}

/** A database built from every journaled migration before 0074. */
async function schemaBefore(): Promise<PGlite> {
  const db = new PGlite();
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(TAG), `${TAG} is journaled`);
  for (const tag of tags.slice(0, tags.indexOf(TAG))) await run(db, file(tag));
  return db;
}

// 1 gave every grant. 2 holds only an old row at Can edit, 3 only one at Can
// view; 4 holds an old row and a Content row; 5 holds a Content row alone, 8
// one at Can view alone; 6 holds old rows on `faq` and `all`, the earliest
// given by nobody; 7 holds rows of other scopes only.
const ROWS = `
insert into members (member_id) values (1), (2), (3), (4), (5), (6), (7), (8);
insert into scopes (id, member_id, given_by, scope, target, access_level) values
  (10, 2, 1, 'website', 'all', 'edit'),
  (11, 3, 1, 'website', 'all', 'view'),
  (12, 4, 1, 'website', 'all', 'edit'),
  (13, 4, 1, 'website', 'content', 'edit'),
  (14, 5, 1, 'website', 'content', 'edit'),
  (15, 6, null, 'website', 'faq', 'view'),
  (16, 6, 1, 'website', 'all', 'view'),
  (17, 7, 1, 'team', 'members', 'view'),
  (18, 7, 1, 'org', 'all', 'edit'),
  (19, 8, 1, 'website', 'content', 'view');
`;

type Row = { member_id: number; given_by: number | null; scope: string; target: string; access_level: string };

async function rows(db: PGlite): Promise<Row[]> {
  const { rows } = await db.query<Row>("select member_id, given_by, scope::text, target::text, access_level::text from scopes order by member_id, id");
  return rows;
}

const isOld = (r: Row) => r.scope === "website" && r.target !== "content";
const same = (a: Row) => (b: Row) => JSON.stringify(a) === JSON.stringify(b);

test("0074's only non-additive statement is the delete of the old Alumni grant rows", () => {
  assert.deepEqual(nonAdditiveStatements(file(TAG)), [`DELETE FROM "scopes" WHERE "scope" = 'website' AND "target" <> 'content'`]);
});

test("0074 runs 0058's guarded insert unchanged, then the delete, and nothing else", () => {
  const statements = file(TAG)
    .replace(/--.*$/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const insert = file("0058_alumni_grants_to_content").replace(/--.*$/gm, "").trim().replace(/;$/, "");
  assert.equal(statements.length, 2);
  assert.equal(statements[0], insert);
  assert.match(statements[1], /^DELETE FROM "scopes"/);
});

test("0074 gives each old row holder with no Content grant one at Can edit, deletes every old row, and keeps every other row", async () => {
  const db = await schemaBefore();
  await db.exec(ROWS);
  const before = await rows(db);
  const oldHolders = [...new Set(before.filter(isOld).map((r) => r.member_id))];
  assert.deepEqual(oldHolders, [2, 3, 4, 6]);

  await run(db, file(TAG));
  const after = await rows(db);

  assert.deepEqual(after.filter(isOld), [], "no website row on a target other than content is left");
  for (const member of oldHolders) {
    assert.ok(
      after.some((r) => r.member_id === member && r.scope === "website" && r.target === "content" && r.access_level === "edit"),
      `member ${member} holds a Content grant`,
    );
  }
  for (const row of before.filter((r) => !isOld(r))) assert.ok(after.some(same(row)), `kept ${JSON.stringify(row)}`);
  const added = after.filter((r) => !before.some(same(r)));
  assert.deepEqual(added, [
    { member_id: 2, given_by: 1, scope: "website", target: "content", access_level: "edit" },
    { member_id: 3, given_by: 1, scope: "website", target: "content", access_level: "edit" },
    // The giver of their earliest old row, here none.
    { member_id: 6, given_by: null, scope: "website", target: "content", access_level: "edit" },
  ]);
  assert.equal(after.length, before.filter((r) => !isOld(r)).length + added.length);
});

test("after 0058 has run, 0074 inserts nothing and only deletes the old rows", async () => {
  const db = await schemaBefore();
  await db.exec(ROWS);
  await run(db, file("0058_alumni_grants_to_content"));
  const before = await rows(db);

  await run(db, file(TAG));
  assert.deepEqual(await rows(db), before.filter((r) => !isOld(r)));
});
