import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { nonAdditiveStatements } from "./journal";

// Every preview build applies pending migrations to the shared preview
// database, which is treated like production. The alias request migration
// (issue #541) must only add: a new type, a new table with its index and audit
// trigger, and nullable columns on `members`.

test("0051_alias_requests.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), "drizzle/0051_alias_requests.sql"), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
});

// The one-address migration (issue #563) is data only: it copies each alias
// into an empty PRT email and is not allowed any other statement. The column
// it reads stays; #569 drops it later.
test("0053_prt_email_from_email_alias.sql only copies the alias into an empty PRT email", () => {
  const sql = readFileSync(resolve(process.cwd(), "drizzle/0053_prt_email_from_email_alias.sql"), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), [
    `UPDATE "members" SET "prt_email" = "email_alias" WHERE "email_alias" IS NOT NULL AND ("prt_email" IS NULL OR "prt_email" = '')`,
  ]);
});

// The View as base (issue #604) adds the admin plugin's columns to Better
// Auth's tables: each is new and nullable or defaulted, so it rewrites
// nothing and every session already signed in stays valid.
const VIEW_AS_TAG = "0055_view_as_admin_plugin";

test("0055_view_as_admin_plugin.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${VIEW_AS_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
});

test("0055 keeps every existing account and session as it was, and a plain session names no acting account", async () => {
  const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(VIEW_AS_TAG), `${VIEW_AS_TAG} is journaled`);
  const db = new PGlite();
  const run = async (tag: string) => {
    const sql = readFileSync(resolve(process.cwd(), `drizzle/${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
  };
  for (const tag of tags.slice(0, tags.indexOf(VIEW_AS_TAG))) await run(tag);

  await db.exec(`
    insert into better_auth."user" (id, name, email, "emailVerified") values ('u-1', 'Sara Conti', 'sara@example.com', true);
    insert into better_auth.session (id, "expiresAt", token, "updatedAt", "userId")
      values ('s-1', now() + interval '7 days', 'token-1', now(), 'u-1');
  `);
  const before = await db.query(`select id, token, "userId", "expiresAt" from better_auth.session`);

  await run(VIEW_AS_TAG);

  const after = await db.query(`select id, token, "userId", "expiresAt", "impersonatedBy" from better_auth.session`);
  assert.deepEqual(
    after.rows,
    before.rows.map((row) => ({ ...(row as object), impersonatedBy: null })),
    "the session is untouched and names no acting account",
  );
  const account = await db.query(`select name, email, role, banned, "banReason", "banExpires" from better_auth."user"`);
  assert.deepEqual(account.rows, [{ name: "Sara Conti", email: "sara@example.com", role: null, banned: false, banReason: null, banExpires: null }]);
});

test("the check catches each statement that is not additive, and no foreign key action", () => {
  const forbidden = [
    "DROP TRIGGER IF EXISTS audit_row_changes ON public.alias_requests",
    'ALTER TABLE "members" DROP COLUMN "email_alias"',
    'ALTER TABLE "members" RENAME COLUMN "email_alias" TO "alias"',
    'ALTER TABLE "members" ALTER COLUMN "email_alias" SET DATA TYPE varchar(80)',
    'UPDATE "members" SET "email_alias" = null',
    'DELETE FROM "alias_requests"',
  ];
  assert.equal(nonAdditiveStatements(forbidden.join(";\n")).length, forbidden.length);
  const foreignKey =
    'ALTER TABLE "a" ADD CONSTRAINT "f" FOREIGN KEY ("m") REFERENCES "b"("m") ON DELETE cascade ON UPDATE no action;';
  assert.deepEqual(nonAdditiveStatements(foreignKey), []);
});
