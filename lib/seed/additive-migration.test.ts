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

// The R&D move (issues #627 and #600) is data only. Its one statement that
// changes a row is the guarded UPDATE the Owner decision on #600 allows
// (https://github.com/PoliTo-Rocket-Team/website-v2/issues/600#issuecomment-6385783494):
// it attaches only the oldest active, unflagged core role titled "Head of R&D"
// in no unit to the R&D department, only while that department has no head,
// so a second run matches nothing and no department gets two heads. What it
// does on each database shape is run in ./rd-department-head.test.ts.
test("0058_rd_department_head.sql changes one row kind only: the Head of R&D role's type and department", () => {
  const sql = readFileSync(resolve(process.cwd(), "drizzle/0058_rd_department_head.sql"), "utf8");
  const changed = nonAdditiveStatements(sql);
  assert.equal(changed.length, 1);
  const [update] = changed;
  assert.match(update, /^UPDATE "roles" AS r SET "type" = 'head', "dept_id" = \(/);
  const [set] = update.split(` WHERE r."leaved_at"`);
  assert.ok(!set.includes(`"title"`) && !set.includes(`"member_id"`) && !set.includes(`"started_at"`), "the title, holder and start date stay");
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
