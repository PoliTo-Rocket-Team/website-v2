import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { nonAdditiveStatements } from "./journal";

// Every preview build applies pending migrations to the shared preview
// database before a pull request merges, while other previews' code still
// reads it, so a migration only adds (ADR 0016). The alias request migration
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

// The re-seed ledger (issue #595) is one new table and nothing else.
test("0055_preview_reseeds.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), "drizzle/0055_preview_reseeds.sql"), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  assert.match(sql, /CREATE TABLE "preview_reseeds"/);
});

// The R&D department (issue #627) is data only: it adds one department where
// the Head of R&D's role sits in no unit, and re-points that one role to it.
// The re-point is its one statement that changes a row, and it touches only an
// active, unflagged core role titled "Head of R&D" in no department and no
// division, so a second run matches nothing.
test("0056_rd_department_head.sql adds a department and re-points only the Head of R&D's role", () => {
  const sql = readFileSync(resolve(process.cwd(), "drizzle/0056_rd_department_head.sql"), "utf8");
  const changed = nonAdditiveStatements(sql);
  assert.equal(changed.length, 1);
  const [update] = changed;
  assert.match(update, /^UPDATE "roles" AS r SET "type" = 'head', "dept_id" = \(SELECT d\."id" FROM "departments"/);
  for (const guard of [`r."leaved_at" IS NULL`, `r."dept_id" IS NULL`, `r."division_id" IS NULL`, `r."type" = 'core'`, `r."full_access" IS NULL`, `r."title" = 'Head of R&D'`]) {
    assert.ok(update.includes(guard), guard);
  }
  const [set] = update.split(` WHERE r."leaved_at"`);
  assert.ok(!set.includes(`"title"`) && !set.includes(`"member_id"`) && !set.includes(`"started_at"`), "the title, holder and start date stay");
  assert.match(sql, /INSERT INTO "departments" \("name", "started_at", "code", "kind"\)/);
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM "departments" AS d WHERE d\."closed_at" IS NULL AND d\."name" = 'R&D'\)/);
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
