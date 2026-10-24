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

// Two-person write attribution (issue #605) adds a nullable acting-account
// column to `logs` and beside each member-id "by" column, and replaces the
// audit trigger function in place.
const ATTRIBUTION_TAG = "0056_impersonated_write_attribution";

/** A database with every journaled migration before `tag` applied, and a way to apply one more. */
async function databaseBefore(tag: string) {
  const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as { entries: { tag: string }[] };
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(tag), `${tag} is journaled`);
  const db = new PGlite();
  const run = async (name: string) => {
    const sql = readFileSync(resolve(process.cwd(), `drizzle/${name}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
  };
  for (const name of tags.slice(0, tags.indexOf(tag))) await run(name);
  return { db, apply: () => run(tag) };
}

test("0056_impersonated_write_attribution.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${ATTRIBUTION_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
});

test("0056 only adds nullable columns and replaces the trigger function: existing rows keep every value", async () => {
  const { db, apply } = await databaseBefore(ATTRIBUTION_TAG);
  await db.exec(`
    insert into better_auth."user" (id, name, email, "emailVerified") values ('u-1', 'Sara Conti', 'sara@example.com', true);
    begin;
    select set_config('request.jwt.claim.sub', 'u-1', true);
    insert into public.departments (name) values ('Before');
    commit;
  `);
  const before = await db.query(`select id, table_name, operation, record_id, changed_by from public.logs order by id`);

  await apply();

  const after = await db.query(`select id, table_name, operation, record_id, changed_by, changed_by_acting_account from public.logs order by id`);
  assert.deepEqual(
    after.rows,
    before.rows.map((row) => ({ ...(row as object), changed_by_acting_account: null })),
    "every log row is kept, naming no acting account",
  );
  const added = await db.query<{ table_name: string; column_name: string; is_nullable: string; column_default: string | null }>(`
    select table_name, column_name, is_nullable, column_default from information_schema.columns
    where table_schema = 'public' and column_name like '%acting_account' order by table_name, column_name
  `);
  assert.deepEqual(
    added.rows.map((r) => `${r.table_name}.${r.column_name}`),
    [
      "alias_requests.answered_by_acting_account",
      "alias_requests.requested_by_acting_account",
      "hand_over_requests.decided_by_acting_account",
      "logs.changed_by_acting_account",
      "members.nda_confirmed_by_acting_account",
      "orders.reviewed_by_acting_account",
      "scopes.given_by_acting_account",
      "team_joins.added_by_acting_account",
    ],
  );
  assert.ok(added.rows.every((r) => r.is_nullable === "YES" && r.column_default === null), "each is nullable with no default");
});

test("after 0056 the audit trigger stores the acting account beside the writer, and none outside View as", async () => {
  const { db, apply } = await databaseBefore(ATTRIBUTION_TAG);
  await apply();
  const write = async (name: string, settings: Record<string, string>) => {
    const set = Object.entries(settings).map(([key, value]) => `select set_config('${key}', '${value}', true);`);
    await db.exec(`begin; ${set.join(" ")} insert into public.departments (name) values ('${name}'); commit;`);
  };
  await db.exec(`
    insert into better_auth."user" (id, name, email, "emailVerified") values
      ('person', 'Sara Conti', 'sara@example.com', true),
      ('it-lead', 'Marco Bianchi', 'marco@example.com', true);
  `);
  await write("Viewed as", { "request.jwt.claim.sub": "person", "request.acting_account": "it-lead" });
  await write("Plain", { "request.jwt.claim.sub": "person", "request.acting_account": "" });
  await write("No setting", { "request.jwt.claim.sub": "person" });
  await write("Unknown acting", { "request.jwt.claim.sub": "person", "request.acting_account": "nobody" });
  const rows = await db.query<{ name: string; changed_by: string | null; acting: string | null }>(`
    select l.new_data ->> 'name' as name, l.changed_by, l.changed_by_acting_account as acting
    from public.logs l where l.table_name = 'departments' order by l.id
  `);
  assert.deepEqual(rows.rows, [
    { name: "Viewed as", changed_by: "person", acting: "it-lead" },
    { name: "Plain", changed_by: "person", acting: null },
    { name: "No setting", changed_by: "person", acting: null },
    { name: "Unknown acting", changed_by: "person", acting: null },
  ]);
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
