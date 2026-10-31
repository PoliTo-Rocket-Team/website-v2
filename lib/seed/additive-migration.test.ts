import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { BREAK_GLASS_SIGN_IN_OPERATION } from "../break-glass";
import { BUILT_IN_STATUSES } from "../dashboard/application-status";
import { VIEW_AS_OPERATIONS } from "../dashboard/view-as";
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
// into an empty PRT email and is not allowed any other statement. It left the
// column it reads in place; 0075_drop_members_email_alias dropped it (#569).
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
test("0059_rd_department_head.sql changes one row kind only: the Head of R&D role's type and department", () => {
  const sql = readFileSync(resolve(process.cwd(), "drizzle/0059_rd_department_head.sql"), "utf8");
  const changed = nonAdditiveStatements(sql);
  assert.equal(changed.length, 1);
  const [update] = changed;
  assert.match(update, /^UPDATE "roles" AS r SET "type" = 'head', "dept_id" = \(/);
  const [set] = update.split(` WHERE r."leaved_at"`);
  assert.ok(!set.includes(`"title"`) && !set.includes(`"member_id"`) && !set.includes(`"started_at"`), "the title, holder and start date stay");
});

// The View as base (issue #604) adds the admin plugin's columns to Better
// Auth's tables: each is new and nullable or defaulted, so it rewrites
// nothing and every session already signed in stays valid.
const VIEW_AS_TAG = "0060_view_as_admin_plugin";

test("0060_view_as_admin_plugin.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${VIEW_AS_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
});

test("0060 keeps every existing account and session as it was, and a plain session names no acting account", async () => {
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
const ATTRIBUTION_TAG = "0061_impersonated_write_attribution";

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

test("0061_impersonated_write_attribution.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${ATTRIBUTION_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
});

test("0061 only adds nullable columns and replaces the trigger function: existing rows keep every value", async () => {
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

test("after 0061 the audit trigger stores the acting account beside the writer, and none outside View as", async () => {
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

// The shared preview database already holds the View as columns from earlier
// preview builds of this epic, under the numbers these migrations had before
// the trunk took them (0055/0056, then 0056/0057). Applying them again must
// succeed.
test("0060 and 0061 apply again over a database that already holds them", async () => {
  const { db, apply } = await databaseBefore(VIEW_AS_TAG);
  const attribution = readFileSync(resolve(process.cwd(), `drizzle/${ATTRIBUTION_TAG}.sql`), "utf8");
  const runAttribution = async () => {
    for (const statement of attribution.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
  };
  await apply();
  await runAttribution();
  await apply();
  await runAttribution();
  const constraints = await db.query<{ count: number }>(
    `select count(*)::int as count from pg_constraint where conname like '%acting_account_users_id_fk'`,
  );
  assert.equal(constraints.rows[0].count, 8, "each acting-account foreign key exists once");
});

// One active holder per seat (issue #667) only created partial unique
// indexes on `roles`: no column, type or row changes. 0077 drops them again
// (epic #861), so in the migrated database no seat index stands.
const SEAT_TAG = "0062_roles_one_active_seat_holder";
const SEVERAL_HOLDERS_TAG = "0077_roles_several_seat_holders";

test("0062_roles_one_active_seat_holder.sql only creates indexes, and its header links the issue", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${SEAT_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/--.*$/gm, "").trim())
    .filter(Boolean);
  assert.equal(statements.length, 3);
  assert.ok(statements.every((s) => /^CREATE UNIQUE INDEX IF NOT EXISTS "roles_one_active_\w+" ON "roles" USING btree \("\w+"\) WHERE "roles"\."leaved_at" is null and /.test(s)), "each is a unique index over active roles");
  assert.match(sql, /https:\/\/github\.com\/PoliTo-Rocket-Team\/website-v2\/issues\/667/);
});

/** The `roles_one_active_*` indexes the database holds, by name. */
async function seatIndexes(db: PGlite): Promise<string[]> {
  const indexes = await db.query<{ name: string }>(`select indexname as name from pg_indexes where tablename = 'roles' and indexname like 'roles_one_active_%' order by 1`);
  return indexes.rows.map((r) => r.name);
}

test("0062 and then 0077 keep every existing role row as it was, each applies again, and the migrated database holds no seat index", async () => {
  const { db, apply } = await databaseBefore(SEAT_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1), (2);
    insert into departments (id, name) values (1, 'Aerodynamics');
    insert into roles (id, member_id, dept_id, title, started_at, leaved_at, type) values
      (1, 1, 1, 'Head', '2025-10-01', null, 'head'),
      (2, 2, 1, 'Head', '2024-10-01', '2025-09-30', 'head');
    set session_replication_role = origin;
  `);
  const before = await db.query(`select * from roles order by id`);
  await apply();
  await apply();
  assert.deepEqual(await seatIndexes(db), ["roles_one_active_department_head", "roles_one_active_full_access_seat", "roles_one_active_team_leader"], "0062 creates them");
  const drop = readFileSync(resolve(process.cwd(), `drizzle/${SEVERAL_HOLDERS_TAG}.sql`), "utf8");
  const runDrop = async () => {
    for (const statement of drop.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
  };
  await runDrop();
  await runDrop();
  assert.deepEqual((await db.query(`select * from roles order by id`)).rows, before.rows);
  assert.deepEqual(await seatIndexes(db), [], "0077 drops them");
});

// Several holders of one seat (epic #861, issue #867). Not additive, by
// design: it drops the three one-holder indexes of 0062 and nothing else, so
// it is pinned to exactly those three statements and any further drop or
// rewrite fails here.
test("0077_roles_several_seat_holders.sql drops the three 0062 indexes and nothing else, and its header links the epic", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${SEVERAL_HOLDERS_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), [
    'DROP INDEX IF EXISTS "roles_one_active_team_leader"',
    'DROP INDEX IF EXISTS "roles_one_active_full_access_seat"',
    'DROP INDEX IF EXISTS "roles_one_active_department_head"',
  ]);
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/--.*$/gm, "").trim())
    .filter(Boolean);
  assert.equal(statements.length, 3, "no other statement");
  assert.match(sql, /https:\/\/github\.com\/PoliTo-Rocket-Team\/website-v2\/issues\/861/);
});

test("0077 keeps every role row, lets each seat take a second active holder, and applies again over a database that already ran it", async () => {
  const { db, apply } = await databaseBefore(SEVERAL_HOLDERS_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1), (2), (3), (4);
    insert into departments (id, name) values (1, 'Aerodynamics');
    insert into roles (id, member_id, dept_id, title, started_at, leaved_at, type, full_access) values
      (1, 1, 1, 'Head', '2025-10-01', null, 'head', null),
      (2, 2, null, 'Team Leader', '2025-10-01', null, 'president', null),
      (3, 3, null, 'IT Lead', '2025-10-01', null, 'core', 'it_lead');
    set session_replication_role = origin;
  `);
  const before = await db.query(`select * from roles order by id`);
  await assert.rejects(db.exec(`insert into roles (id, member_id, title, type) values (9, 4, 'Team Leader', 'president')`), Error, "0062 still refuses a second team leader");
  await apply();
  await apply();
  assert.deepEqual((await db.query(`select * from roles order by id`)).rows, before.rows, "every role row is kept");
  await db.exec(`
    insert into roles (id, member_id, dept_id, title, type, full_access) values
      (4, 4, 1, 'Head', 'head', null),
      (5, 4, null, 'Team Leader', 'president', null),
      (6, 4, null, 'IT Lead', 'core', 'it_lead');
  `);
  assert.deepEqual(await seatIndexes(db), []);
});

// The notice acting account (issue #628) adds one nullable column to
// `dashboard_notices` and its foreign key: every stored notice keeps its
// values and names no acting account, so it reads as it does today.
const NOTICE_TAG = "0063_notice_acting_account";

test("0063_notice_acting_account.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${NOTICE_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
});

test("0063 keeps every stored notice as it was, and applies again over a database that already holds it", async () => {
  const { db, apply } = await databaseBefore(NOTICE_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1), (2);
    insert into dashboard_notices (id, recipient_id, kind, subject_id, data) values
      (1, 1, 'alias-declined', 2, '{"by":"Sara Conti"}'),
      (2, 2, 'hand-over-answered', 1, '{}');
    set session_replication_role = origin;
  `);
  const before = await db.query(`select * from dashboard_notices order by id`);
  await apply();
  await apply();
  const after = await db.query(`select * from dashboard_notices order by id`);
  assert.deepEqual(
    after.rows,
    before.rows.map((row) => ({ ...(row as object), written_by_acting_account: null })),
    "every notice is kept, naming no acting account",
  );
  const constraints = await db.query<{ count: number }>(
    `select count(*)::int as count from pg_constraint where conname = 'dashboard_notices_written_by_acting_account_users_id_fk'`,
  );
  assert.equal(constraints.rows[0].count, 1, "the foreign key exists once");
});

// Who offered an interview's times (issue #652) is one nullable column on
// `interview_slots` and its foreign key: every stored time keeps its values
// and names no setter.
const OFFERED_BY_TAG = "0064_interview_slots_offered_by";

test("0064_interview_slots_offered_by.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${OFFERED_BY_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
});

test("0064 keeps every stored interview time as it was, and applies again over a database that already holds it", async () => {
  const { db, apply } = await databaseBefore(OFFERED_BY_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into interview_slots (id, application_id, starts_at, ends_at, chosen) values
      (1, 1, '2026-10-16T15:30:00Z', '2026-10-16T16:00:00Z', true),
      (2, 2, '2026-10-17T16:00:00Z', '2026-10-17T16:30:00Z', false);
    set session_replication_role = origin;
  `);
  const before = await db.query(`select * from interview_slots order by id`);
  await apply();
  await apply();
  const after = await db.query(`select * from interview_slots order by id`);
  assert.deepEqual(
    after.rows,
    before.rows.map((row) => ({ ...(row as object), offered_by: null })),
    "every time is kept, naming no setter",
  );
});

// The migrator applies only entries journaled later than the newest one a
// database records, so every entry must be later than the one before it. The
// numbers 0056 and 0057 are not journaled: the trunk skipped them while this
// epic held them, so the numbers only climb, each tag naming its own index.
test("the journal is ordered by when, each entry later than the one before", () => {
  const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
    entries: { idx: number; when: number; tag: string }[];
  };
  journal.entries.forEach((entry, i) => {
    assert.ok(entry.tag.startsWith(String(entry.idx).padStart(4, "0")), `${entry.tag} is numbered ${entry.idx}`);
    if (i === 0) return;
    const before = journal.entries[i - 1];
    assert.ok(entry.idx > before.idx, `${entry.tag} is numbered after ${before.tag}`);
    assert.ok(entry.when > before.when, `${entry.tag} is later than ${before.tag}`);
  });
});

// Earlier builds of the epic branch journaled the View as migrations as
// 0055/0056 (newest when 1793726400000) and then 0056/0057 (newest when
// 1793899200000), and the shared preview database applied them. It may have
// done so before or after recording the trunk's 0058 and 0059. Drizzle's own
// migrator applies only entries later than the newest one recorded, so on
// either shape both renumbered entries must still apply, and their second run
// over columns that already exist must succeed.
const OLD_EPIC_WHENS = [1793726400000, 1793812800000, 1793899200000];

for (const [shape, lastRecordedTag] of [
  ["recorded the old epic entries before the trunk's 0058", "0055_preview_reseeds"],
  ["recorded the old epic entries and the trunk's 0058 and 0059", "0059_rd_department_head"],
] as const) {
  test(`the migrator applies 0060 and 0061 over a database that ${shape}`, async () => {
    const journal = JSON.parse(readFileSync(resolve(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: { when: number; tag: string }[];
    };
    const recordedEntries = journal.entries.slice(0, journal.entries.findIndex((e) => e.tag === lastRecordedTag) + 1);
    const db = new PGlite();
    const run = async (name: string) => {
      const sql = readFileSync(resolve(process.cwd(), `drizzle/${name}.sql`), "utf8");
      for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
    };
    for (const entry of recordedEntries) await run(entry.tag);
    await run(VIEW_AS_TAG);
    await run(ATTRIBUTION_TAG);
    await db.exec(`
      create schema drizzle;
      create table drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint);
      insert into drizzle.__drizzle_migrations (hash, created_at) values
        ${[...recordedEntries.map((e) => e.when), ...OLD_EPIC_WHENS].map((when) => `('recorded', ${when})`).join(", ")};
    `);

    await migrate(drizzle(db), { migrationsFolder: resolve(process.cwd(), "drizzle") });

    const columns = await db.query<{ column: string }>(`
      select table_name || '.' || column_name as column from information_schema.columns
      where table_schema = 'better_auth' and column_name in ('role', 'banned', 'banReason', 'banExpires', 'impersonatedBy')
      order by 1
    `);
    assert.deepEqual(
      columns.rows.map((r) => r.column),
      ["session.impersonatedBy", "user.banExpires", "user.banReason", "user.banned", "user.role"],
      "the admin plugin columns reached the database",
    );
    const newest = await db.query<{ created_at: string }>(`select created_at from drizzle.__drizzle_migrations order by created_at desc limit 1`);
    assert.equal(Number(newest.rows[0].created_at), journal.entries.at(-1)?.when, "the newest recorded entry is the journal's last");
    // The migrator runs the whole journal, so the later acting-account keys
    // (0063's on notices) are here too; each key is listed once.
    const constraints = await db.query<{ name: string }>(
      `select conname as name from pg_constraint where conname like '%acting_account_users_id_fk' order by 1`,
    );
    assert.deepEqual(
      constraints.rows.map((r) => r.name),
      [
        "alias_requests_answered_by_acting_account_users_id_fk",
        "alias_requests_requested_by_acting_account_users_id_fk",
        "dashboard_notices_written_by_acting_account_users_id_fk",
        "hand_over_requests_decided_by_acting_account_users_id_fk",
        "logs_changed_by_acting_account_users_id_fk",
        "members_nda_confirmed_by_acting_account_users_id_fk",
        "orders_reviewed_by_acting_account_users_id_fk",
        "scopes_given_by_acting_account_users_id_fk",
        "team_address_removals_done_by_acting_account_users_id_fk",
        "team_address_removals_removed_by_acting_account_users_id_fk",
        "team_address_requests_answered_by_acting_account_users_id_fk",
        "team_address_requests_requested_by_acting_account_users_id_fk",
        "team_address_reroutes_done_by_acting_account_users_id_fk",
        "team_joins_added_by_acting_account_users_id_fk",
      ],
      "each acting-account foreign key exists once",
    );
  });
}

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

// The application status list (issue #748) adds one table with its ten
// built-in rows and one nullable reference on `applications`. Existing
// applications are test data and keep every value; with no reference they
// read as New (lib/dashboard/application-status.ts).
const STATUS_TAG = "0065_application_statuses";

test("0065_application_statuses.sql drops, renames and rewrites nothing", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${STATUS_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  assert.match(sql, /issue #748/);
});

test("0065 inserts the ten built-in statuses in order, keeps every application as it was, and applies again", async () => {
  const { db, apply } = await databaseBefore(STATUS_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into applications (id, apply_position_id, user_id, status, applied_at) values
      (1, null, null, 'accepted', '2026-09-01 10:00:00+02'),
      (2, null, null, 'pending', '2026-09-02 10:00:00+02');
    set session_replication_role = origin;
  `);
  const before = await db.query(`select * from applications order by id`);
  await apply();
  await apply();
  const after = await db.query(`select * from applications order by id`);
  assert.deepEqual(
    after.rows,
    before.rows.map((row) => ({ ...(row as object), status_key: null })),
    "every application keeps its values and references no status",
  );
  const statuses = await db.query<{ key: string; name: string; colour: string; sort_order: number; parent_key: string | null }>(
    `select key, name, colour, sort_order, parent_key from application_statuses order by sort_order`,
  );
  assert.deepEqual(
    statuses.rows,
    BUILT_IN_STATUSES.map((s, i) => ({ key: s.key, name: s.name, colour: s.colour, sort_order: i + 1, parent_key: null })),
    "the built-in rows are the module's, once each, in order",
  );
});

test("after 0065 the table takes an added status only under a built-in parent, and keeps one in use", async () => {
  const { db, apply } = await databaseBefore(STATUS_TAG);
  await apply();
  const refuses = async (sql: string, what: string) => {
    await assert.rejects(db.exec(sql), Error, what);
  };
  await db.exec(`insert into application_statuses (key, name, colour, sort_order, parent_key) values ('second_interview', 'Second interview', '#FF7526', 1, 'interview')`);
  await refuses(`insert into application_statuses (key, name, colour, sort_order) values ('on_hold', 'On hold', '#FF7526', 11)`, "an added status with no parent");
  await refuses(`insert into application_statuses (key, name, colour, sort_order, parent_key) values ('third', 'Third', '#FF7526', 2, 'second_interview')`, "a parent that is not built-in");
  await refuses(`insert into application_statuses (key, name, colour, sort_order, parent_key) values ('joined', 'Joined', '#FF7526', 3, 'new')`, "a built-in key with a parent");
  await refuses(`insert into application_statuses (key, name, colour, sort_order, parent_key) values ('later', 'Later', 'orange', 4, 'new')`, "a colour that is not hex");
  await refuses(`insert into application_statuses (key, name, colour, sort_order, parent_key) values ('again', 'Again', '#FF7526', 1, 'interview')`, "two statuses in one place");
  await db.exec(`
    set session_replication_role = replica;
    insert into applications (id, status, status_key, applied_at) values (1, 'interview', 'second_interview', now());
    set session_replication_role = origin;
  `);
  await refuses(`delete from application_statuses where key = 'second_interview'`, "an added status in use");
  await refuses(`update applications set status_key = 'no_such_status' where id = 1`, "a reference to no status");
  await db.exec(`update applications set status_key = 'interview' where id = 1; delete from application_statuses where key = 'second_interview'`);
  assert.equal((await db.query(`select 1 from application_statuses where key = 'second_interview'`)).rows.length, 0, "an unused added status is deleted");
});

// Shared team addresses (issue #786) add one type and one table with its
// indexes, check and audit trigger. The table keeps one holder per address
// in any letter case, and each tie holds exactly the reference its kind needs
// (lib/dashboard/team-address.ts).
const TEAM_ADDRESS_TAG = "0066_team_addresses";

test("0066_team_addresses.sql drops, renames and rewrites nothing, and applies again", async () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${TEAM_ADDRESS_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const { apply } = await databaseBefore(TEAM_ADDRESS_TAG);
  await apply();
  await apply();
});

test("after 0066 the database refuses a second holder of an address in any case, and a tie whose kind and reference disagree", async () => {
  const { db, apply } = await databaseBefore(TEAM_ADDRESS_TAG);
  await apply();
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1), (2);
    insert into departments (id, name) values (1, 'Operations');
    insert into divisions (id, dept_id, name) values (1, 1, 'Logistics');
    set session_replication_role = origin;
  `);
  const add = (values: string) =>
    db.exec(`insert into team_addresses (address, purpose, holder_id, moves_with, moves_with_seat, moves_with_dept_id, moves_with_division_id) values ${values}`);
  await add(`('logistics@politorocketteam.it', 'Logistics', 1, 'division_lead', null, null, 1)`);
  await add(`('recruitment@politorocketteam.it', 'Recruitment', 1, null, null, null, null)`);
  await add(`('it@politorocketteam.it', 'IT', 2, 'full_access_seat', 'it_lead', null, null)`);
  await add(`('team@politorocketteam.it', 'Team', 2, 'team_leader', null, null, null)`);
  await add(`('ops@politorocketteam.it', 'Operations', 2, 'department_head', null, 1, null)`);
  await assert.rejects(add(`('Logistics@PoliToRocketTeam.it', 'Logistics', 2, null, null, null, null)`), Error, "the same address in another case");
  const disagree = [
    `('a@politorocketteam.it', 'A', 1, 'division_lead', null, 1, null)`,
    `('b@politorocketteam.it', 'B', 1, 'department_head', null, null, 1)`,
    `('c@politorocketteam.it', 'C', 1, 'full_access_seat', null, null, null)`,
    `('d@politorocketteam.it', 'D', 1, 'team_leader', 'it_lead', null, null)`,
    `('e@politorocketteam.it', 'E', 1, null, null, null, 1)`,
  ];
  for (const values of disagree) await assert.rejects(add(values), Error, values);
});

// Team address requests (issue #787) add one type and one table with its
// indexes, checks and audit trigger. The table keeps one open request per
// address in any letter case, so a race between two requests is refused by
// the database too; an answered request frees the address.
const TEAM_ADDRESS_REQUEST_TAG = "0067_team_address_requests";

test("0067_team_address_requests.sql drops, renames and rewrites nothing, and applies again", async () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${TEAM_ADDRESS_REQUEST_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const { apply } = await databaseBefore(TEAM_ADDRESS_REQUEST_TAG);
  await apply();
  await apply();
});

test("after 0067 the database refuses a second open request for an address in any case, and takes one once the first is answered", async () => {
  const { db, apply } = await databaseBefore(TEAM_ADDRESS_REQUEST_TAG);
  await apply();
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1), (2);
    set session_replication_role = origin;
  `);
  const ask = (address: string) =>
    db.exec(`insert into team_address_requests (member_id, address, purpose, moves_with, requested_by) values (1, '${address}', 'Events', 'team_leader', 2)`);
  await ask("events@politorocketteam.it");
  await assert.rejects(ask("Events@PoliToRocketTeam.it"), Error, "the same address in another case while one is open");
  await db.exec(`update team_address_requests set outcome = 'declined', answered_at = now()`);
  await ask("events@politorocketteam.it");
  await assert.rejects(
    db.exec(`insert into team_address_requests (member_id, address, purpose, moves_with) values (1, 'it@politorocketteam.it', 'IT', 'division_lead')`),
    Error,
    "a tie whose kind and reference disagree",
  );
});

// Team address routing items (issue #789) add one table with its foreign
// keys, its one-open index, its check and its audit trigger. The table keeps
// one open item per address, so a second role change before Mark done adds
// no second one; a done item frees the address.
const TEAM_ADDRESS_REROUTE_TAG = "0068_team_address_reroutes";

test("0068_team_address_reroutes.sql drops, renames and rewrites nothing, and applies again", async () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${TEAM_ADDRESS_REROUTE_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const { apply } = await databaseBefore(TEAM_ADDRESS_REROUTE_TAG);
  await apply();
  await apply();
});

test("after 0068 the database keeps one open routing item per address, and takes another once it is done", async () => {
  const { db, apply } = await databaseBefore(TEAM_ADDRESS_REROUTE_TAG);
  await apply();
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1), (2), (3);
    set session_replication_role = origin;
    insert into team_addresses (id, address, purpose, holder_id, moves_with) values (1, 'events@politorocketteam.it', 'Events', 1, 'team_leader');
  `);
  const route = (to: number) => db.exec(`insert into team_address_reroutes (address_id, to_member, from_member) values (1, ${to}, 1)`);
  await route(2);
  await assert.rejects(route(3), Error, "a second open item for the address");
  await db.exec(`update team_address_reroutes set done_by = 1, done_at = now()`);
  await route(3);
  await assert.rejects(db.exec(`update team_address_reroutes set done_by = 1 where done_at is null`), Error, "done by with no done at");
});

// A team address's set-up (owner finding on PR #794) adds one nullable
// column; an address already stored reads as not set up, so its holder gets
// the ready card.
const TEAM_ADDRESS_SET_UP_TAG = "0069_team_address_set_up";

test("0069_team_address_set_up.sql drops, renames and rewrites nothing, applies again and leaves stored addresses not set up", async () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${TEAM_ADDRESS_SET_UP_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const { db, apply } = await databaseBefore(TEAM_ADDRESS_SET_UP_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1);
    set session_replication_role = origin;
    insert into team_addresses (address, purpose, holder_id) values ('events@politorocketteam.it', 'Events', 1);
  `);
  await apply();
  await apply();
  assert.deepEqual((await db.query(`select set_up_at from team_addresses`)).rows, [{ set_up_at: null }]);
});

// Team address removals (issue #797) add one table with its foreign keys,
// its one-open index, its checks and its audit trigger. The table keeps one
// open removal per address; deleting the address at Mark done keeps the
// removal row, with its address text, as history.
const TEAM_ADDRESS_REMOVAL_TAG = "0070_team_address_removals";

test("0070_team_address_removals.sql drops, renames and rewrites nothing, applies again and carries the audit trigger", async () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${TEAM_ADDRESS_REMOVAL_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const { db, apply } = await databaseBefore(TEAM_ADDRESS_REMOVAL_TAG);
  await apply();
  await apply();
  const triggers = await db.query(`select 1 from pg_trigger where tgname = 'audit_row_changes' and tgrelid = 'public.team_address_removals'::regclass`);
  assert.equal(triggers.rows.length, 1);
});

test("after 0070 the database keeps one open removal per address, and the removal outlives the address it removed", async () => {
  const { db, apply } = await databaseBefore(TEAM_ADDRESS_REMOVAL_TAG);
  await apply();
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1), (2);
    set session_replication_role = origin;
    insert into team_addresses (id, address, purpose, holder_id) values (1, 'events@politorocketteam.it', 'Events', 1);
  `);
  const remove = () => db.exec(`insert into team_address_removals (address_id, address, from_member, removed_by) values (1, 'events@politorocketteam.it', 1, 2)`);
  await remove();
  await assert.rejects(remove(), Error, "a second open removal for the address");
  await assert.rejects(db.exec(`update team_address_removals set address_id = null`), Error, "an open removal with no address");
  await db.exec(`update team_address_removals set done_by = 2, done_at = now(); delete from team_addresses where id = 1`);
  assert.deepEqual((await db.query(`select address_id, address, from_member, removed_by, done_by from team_address_removals`)).rows, [
    { address_id: null, address: "events@politorocketteam.it", from_member: 1, removed_by: 2, done_by: 2 },
  ]);
});

// A personal PRT email request carries its address (issue #798): one nullable
// column on `alias_requests`; a request already stored reads as carrying none,
// so its Mark created starts from the member's name as before.
const ALIAS_REQUEST_ADDRESS_TAG = "0071_alias_request_address";

test("0071_alias_request_address.sql drops, renames and rewrites nothing, applies again and leaves stored requests with no address", async () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${ALIAS_REQUEST_ADDRESS_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const { db, apply } = await databaseBefore(ALIAS_REQUEST_ADDRESS_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id) values (1);
    set session_replication_role = origin;
    insert into alias_requests (member_id) values (1);
  `);
  await apply();
  await apply();
  assert.deepEqual((await db.query(`select address from alias_requests`)).rows, [{ address: null }]);
});

// The two steps that make `page` the only stored record of a project version
// (issue #535). These are not additive, by design: the backfill rewrites the
// rows still without a `page`, and the drop removes `content` once no code
// reads or writes it. Each is pinned to exactly its own statements, so any
// further drop or rewrite fails here. The PGlite run of both over stored
// versions is lib/project-content/page-only-migration.test.ts.
test("0072_project_page_backfill.sql rewrites only the versions with no page, by 0050's own statement", () => {
  const read = (tag: string) => readFileSync(resolve(process.cwd(), `drizzle/${tag}.sql`), "utf8");
  const fill = nonAdditiveStatements(read("0050_project_page_blocks"));
  assert.equal(fill.length, 1, "0050 holds one statement that changes rows: its fill");
  assert.match(fill[0], /^UPDATE "project_versions" SET "page" = .* WHERE "page" IS NULL$/);
  const sql = read("0072_project_page_backfill");
  assert.deepEqual(nonAdditiveStatements(sql), fill);
  assert.match(sql, /ALTER TABLE "project_versions" ALTER COLUMN "page" SET NOT NULL;/);
  assert.match(sql, /ADD CONSTRAINT "project_versions_page_is_record" CHECK \(jsonb_typeof\("page"\) = 'object'\)/);
});

test("0073_drop_project_content.sql drops the content column and its check, and nothing else", () => {
  const sql = readFileSync(resolve(process.cwd(), "drizzle/0073_drop_project_content.sql"), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), [
    'ALTER TABLE "project_versions" DROP CONSTRAINT IF EXISTS "project_versions_content_is_record"',
    'ALTER TABLE "project_versions" DROP COLUMN IF EXISTS "content"',
  ]);
});

// The drop of the old `members.email_alias` column (issue #569). Not additive,
// by design: no code reads or writes the column since #563, so it runs 0053's
// guarded copy into an empty `prt_email` once more and then drops the column.
// Both steps run only while the column exists (issue #827): the shared preview
// database lost the column without recording 0075. The copy sits inside a
// `DO` block, which nonAdditiveStatements does not split into its own
// statement, so the file is pinned whole, statement by statement, and any
// further drop or rewrite fails here.
const DROP_EMAIL_ALIAS_TAG = "0075_drop_members_email_alias";

test("0075_drop_members_email_alias.sql copies the alias into an empty PRT email, then drops the column, both only while it exists, and nothing else", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${DROP_EMAIL_ALIAS_TAG}.sql`), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.replace(/--.*$/gm, "").trim().replace(/\s+/g, " "))
    .filter(Boolean);
  assert.deepEqual(statements, [
    "DO $$ BEGIN IF EXISTS ( SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'email_alias' ) THEN " +
      `UPDATE "members" SET "prt_email" = "email_alias" WHERE "email_alias" IS NOT NULL AND ("prt_email" IS NULL OR "prt_email" = ''); END IF; END $$;`,
    'ALTER TABLE "members" DROP COLUMN IF EXISTS "email_alias";',
  ]);
  assert.deepEqual(nonAdditiveStatements(sql), ['ALTER TABLE "members" DROP COLUMN IF EXISTS "email_alias"']);
});

test("0075 moves an alias into an empty PRT email, keeps a PRT email already set, and leaves no email_alias column", async () => {
  const { db, apply } = await databaseBefore(DROP_EMAIL_ALIAS_TAG);
  await db.exec(`
    set session_replication_role = replica;
    insert into members (member_id, prt_email, email_alias) values
      (1, '', 'giulia.rossi@politorocketteam.it'),
      (2, 'marco.bianchi@politorocketteam.it', 'other.alias@politorocketteam.it');
    set session_replication_role = origin;
  `);
  await apply();
  assert.deepEqual((await db.query(`select member_id, prt_email from members order by member_id`)).rows, [
    { member_id: 1, prt_email: "giulia.rossi@politorocketteam.it" },
    { member_id: 2, prt_email: "marco.bianchi@politorocketteam.it" },
  ]);
  const columns = await db.query(
    `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'members' and column_name = 'email_alias'`,
  );
  assert.deepEqual(columns.rows, [], "members has no email_alias column");
});

test("0075 succeeds and leaves every member as it was on a database whose members has no email_alias column", async () => {
  const { db, apply } = await databaseBefore(DROP_EMAIL_ALIAS_TAG);
  await db.exec(`
    alter table members drop column email_alias;
    set session_replication_role = replica;
    insert into members (member_id, prt_email) values
      (1, ''),
      (2, 'marco.bianchi@politorocketteam.it'),
      (3, null);
    set session_replication_role = origin;
  `);
  const before = await db.query(`select * from members order by member_id`);
  await apply();
  assert.deepEqual((await db.query(`select * from members order by member_id`)).rows, before.rows);
});

// The Team page's own layout (issue #850, ADR 0019): one nullable column
// beside each stored layer version. The post-migration step that fills it is
// TypeScript (lib/about/team-layout-fill.ts), so the migration changes no row.
const TEAM_PAGE_LAYOUT_TAG = "0076_team_page_layout";

test("0076_team_page_layout.sql only adds the nullable layout column, applies again and leaves every stored layer version as it was", async () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${TEAM_PAGE_LAYOUT_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  const { db, apply } = await databaseBefore(TEAM_PAGE_LAYOUT_TAG);
  await db.exec(`insert into team_page_layer_versions (version, layer) values ('published', '{"intro":"Kept"}'), ('draft', '{"intro":"Draft"}')`);
  const before = await db.query(`select id, version, layer, updated_at from team_page_layer_versions order by id`);
  await apply();
  await apply();
  assert.deepEqual((await db.query(`select id, version, layer, updated_at from team_page_layer_versions order by id`)).rows, before.rows);
  assert.deepEqual((await db.query(`select layout from team_page_layer_versions order by id`)).rows, [{ layout: null }, { layout: null }]);
  const column = await db.query(
    `select data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'team_page_layer_versions' and column_name = 'layout'`,
  );
  assert.deepEqual(column.rows, [{ data_type: "jsonb", is_nullable: "YES" }]);
});

// The sign-in sync takes over only a free, open row (issue #910): the
// function only refuses an email match it made before, so it changes no
// stored row, and a row it still matches is taken over as before.
const FREE_ROWS_TAG = "0078_sync_auth_users_skip_held_and_closed_rows";

test("0078_sync_auth_users_skip_held_and_closed_rows.sql drops, renames and rewrites nothing, and its header links the issue", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${FREE_ROWS_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  assert.match(sql, /https:\/\/github\.com\/PoliTo-Rocket-Team\/website-v2\/issues\/910/);
});

test("0078 keeps every row, applies again, and a new login takes over a free row with its email but never a held or closed one", async () => {
  const { db, apply } = await databaseBefore(FREE_ROWS_TAG);
  const login = (id: string, email: string) => `insert into better_auth."user" (id, name, email, "emailVerified") values ('${id}', '${id}', '${email}', true)`;
  await db.exec(`
    ${login("held", "held@example.com")};
    update users set email = 'shared@example.com' where id = 'held';
    insert into users (id, email, first_name) values ('added:free', 'free@example.com', 'Imported');
    insert into users (id, email, first_name, deleted_at) values ('closed', 'closed@example.com', 'Closed', now());
  `);
  const before = await db.query(`select * from users order by id`);
  await apply();
  await apply();
  assert.deepEqual((await db.query(`select * from users order by id`)).rows, before.rows, "every row is kept");

  await db.exec(`${login("second", "shared@example.com")}; ${login("returning", "free@example.com")}; ${login("reopening", "closed@example.com")};`);
  const rows = await db.query<{ id: string; email: string; first_name: string | null }>(`select id, email, first_name from users order by id`);
  assert.deepEqual(rows.rows, [
    { id: "closed", email: "closed@example.com", first_name: "Closed" },
    { id: "held", email: "shared@example.com", first_name: null },
    { id: "reopening", email: "closed@example.com", first_name: null },
    { id: "returning", email: "free@example.com", first_name: "Imported" },
    { id: "second", email: "shared@example.com", first_name: null },
  ]);
});

// A first sign-in never fails on a refused take-over (issue #917,
// https://github.com/PoliTo-Rocket-Team/website-v2/issues/917): when
// applications, uploaded files or audit rows point at the free row the
// sign-in sync would take over, the database refuses the id change, and the
// login now gets a fresh row instead of failing. The function replacement
// changes no stored row.
const REFUSED_TAKE_OVER_TAG = "0079_sync_auth_users_fresh_row_on_refused_take_over";

test("0079_sync_auth_users_fresh_row_on_refused_take_over.sql drops, renames and rewrites nothing, and its header links the issue", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${REFUSED_TAKE_OVER_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  assert.match(sql, /https:\/\/github\.com\/PoliTo-Rocket-Team\/website-v2\/issues\/917/);
});

test("0079 keeps every row, applies again, and a first sign-in on a free row that applications, files and audit rows point at succeeds on a fresh row, leaving those rows as they were", async () => {
  const { db, apply } = await databaseBefore(REFUSED_TAKE_OVER_TAG);
  const login = (id: string, email: string) => `insert into better_auth."user" (id, name, email, "emailVerified") values ('${id}', '${id}', '${email}', true)`;
  await db.exec(`
    insert into users (id, email, first_name) values ('applicant', 'applicant@example.com', 'Imported');
    insert into applications (user_id) values ('applicant');
    insert into application_files (r2_key, original_filename, user_id) values ('applications/applicant/cv.pdf', 'cv.pdf', 'applicant');
    insert into logs (schema_name, table_name, operation, record_id, changed_by) values ('public', 'users', 'UPDATE', 'applicant', 'applicant');
  `);
  const snapshot = async () => ({
    users: (await db.query<{ id: string }>(`select * from users order by id`)).rows,
    applications: (await db.query(`select * from applications order by id`)).rows,
    files: (await db.query(`select * from application_files order by id`)).rows,
    logs: (await db.query(`select * from logs order by id`)).rows,
  });
  const before = await snapshot();
  await apply();
  await apply();
  assert.deepEqual(await snapshot(), before, "every row is kept");

  await db.exec(login("new-login", "applicant@example.com"));
  const rows = await db.query<{ id: string; email: string; first_name: string | null }>(`select id, email, first_name from users order by id`);
  assert.deepEqual(rows.rows, [
    { id: "applicant", email: "applicant@example.com", first_name: "Imported" },
    { id: "new-login", email: "applicant@example.com", first_name: null },
  ]);
  const after = await snapshot();
  assert.deepEqual(after.users.find((u) => u.id === "applicant"), before.users.find((u) => u.id === "applicant"), "the matched row is unchanged");
  assert.deepEqual(after.applications, before.applications, "every application still points at the unchanged row");
  assert.deepEqual(after.files, before.files, "every uploaded file still points at the unchanged row");
  for (const row of before.logs) assert.ok(after.logs.some((l) => JSON.stringify(l) === JSON.stringify(row)), "every audit row is kept as it was");
});

test("after 0079 the sign-in sync still matches its own id, takes over a free unreferenced row, skips held and closed rows, and makes a fresh row on no match", async () => {
  const { db, apply } = await databaseBefore(REFUSED_TAKE_OVER_TAG);
  await apply();
  const login = (id: string, email: string) => `insert into better_auth."user" (id, name, email, "emailVerified") values ('${id}', '${id}', '${email}', true)`;
  await db.exec(`
    ${login("held", "held@example.com")};
    update users set email = 'shared@example.com' where id = 'held';
    insert into users (id, email, first_name) values ('own', 'old@example.com', 'Own');
    insert into users (id, email, first_name) values ('added:free', 'free@example.com', 'Imported');
    insert into users (id, email, first_name, deleted_at) values ('closed', 'closed@example.com', 'Closed', now());
  `);
  await db.exec(`
    ${login("own", "own@example.com")};
    ${login("second", "shared@example.com")};
    ${login("returning", "free@example.com")};
    ${login("reopening", "closed@example.com")};
    ${login("stranger", "stranger@example.com")};
  `);
  const rows = await db.query<{ id: string; email: string; first_name: string | null }>(`select id, email, first_name from users order by id`);
  assert.deepEqual(rows.rows, [
    { id: "closed", email: "closed@example.com", first_name: "Closed" },
    { id: "held", email: "shared@example.com", first_name: null },
    { id: "own", email: "own@example.com", first_name: "Own" },
    { id: "reopening", email: "closed@example.com", first_name: null },
    { id: "returning", email: "free@example.com", first_name: "Imported" },
    { id: "second", email: "shared@example.com", first_name: null },
    { id: "stranger", email: "stranger@example.com", first_name: null },
  ]);
});

// The audit log keeps no Better Auth secret (issue #937,
// https://github.com/PoliTo-Rocket-Team/website-v2/issues/937): the trigger
// leaves each Better Auth table's secret keys out of the row it stores, and
// the copies already stored lose them. Every value below is a made-up
// placeholder, so a leftover copy shows up as the text "placeholder-".
const AUTH_SECRETS_TAG = "0081_audit_log_skip_auth_secrets";

const SECRET_KEYS: Readonly<Record<string, readonly string[]>> = {
  account: ["accessToken", "refreshToken", "idToken", "password"],
  session: ["token"],
  verification: ["value"],
};

/** An insert, an update and a delete on each Better Auth table that holds a secret. */
const AUTH_WRITES = `
  insert into better_auth."user" (id, name, email, "emailVerified") values ('u-1', 'Sara Conti', 'sara@example.com', true);
  insert into better_auth.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", password, "updatedAt")
    values ('a-1', 'google-1', 'google', 'u-1', 'placeholder-access', 'placeholder-refresh', 'placeholder-id', 'placeholder-password', now());
  update better_auth.account set "accessToken" = 'placeholder-access-2', scope = 'email' where id = 'a-1';
  delete from better_auth.account where id = 'a-1';
  insert into better_auth.session (id, "expiresAt", token, "updatedAt", "userId")
    values ('s-1', now() + interval '7 days', 'placeholder-session', now(), 'u-1');
  update better_auth.session set token = 'placeholder-session-2', "ipAddress" = '127.0.0.1' where id = 's-1';
  delete from better_auth.session where id = 's-1';
  insert into better_auth.verification (id, identifier, value, "expiresAt", "updatedAt")
    values ('v-1', 'state-1', 'placeholder-state', now() + interval '10 minutes', now());
  update better_auth.verification set value = 'placeholder-state-2' where id = 'v-1';
  delete from better_auth.verification where id = 'v-1';
`;

type StoredData = Record<string, unknown> | null;

/** Every `logs` row, with its data both as stored text and as read back. */
async function storedLogs(db: PGlite) {
  const rows = await db.query<{
    id: number;
    schema_name: string;
    table_name: string;
    operation: string;
    record_id: string | null;
    old_text: string | null;
    new_text: string | null;
    old_data: StoredData;
    new_data: StoredData;
    changed_at: string;
    changed_by: string | null;
    changed_by_acting_account: string | null;
  }>(`
    select id, schema_name, table_name, operation, record_id, old_data::text as old_text, new_data::text as new_text,
      old_data, new_data, changed_at::text as changed_at, changed_by, changed_by_acting_account
    from logs order by id
  `);
  return rows.rows;
}

test("0081_audit_log_skip_auth_secrets.sql drops, renames and deletes nothing: it only strips each table's secret keys from Better Auth log rows", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${AUTH_SECRETS_TAG}.sql`), "utf8");
  assert.match(sql, /https:\/\/github\.com\/PoliTo-Rocket-Team\/website-v2\/issues\/937/);
  const changed = nonAdditiveStatements(sql);
  assert.deepEqual(
    changed.map((s) => /WHERE "schema_name" = 'better_auth' AND "table_name" = '(\w+)' AND /.exec(s)?.[1]),
    ["account", "session", "verification"],
    "three scrubs, one per table, each only over that table's Better Auth log rows",
  );
  for (const statement of changed) {
    const table = /"table_name" = '(\w+)'/.exec(statement)?.[1] ?? "";
    assert.match(statement, /^UPDATE "public"\."logs" SET /);
    assert.doesNotMatch(statement, /\b(DROP|RENAME|DELETE)\b/i);
    const [set] = statement.split(" WHERE ");
    assert.deepEqual([...set.matchAll(/"(\w+)" = CASE/g)].map(([, column]) => column), ["old_data", "new_data"], "only the two data columns change");
    const removed = [...set.matchAll(/" - (ARRAY\[[^\]]*\]|'\w+')/g)].map(([, keys]) => [...keys.matchAll(/'(\w+)'/g)].map(([, key]) => key));
    assert.deepEqual(removed, [SECRET_KEYS[table], SECRET_KEYS[table]], `each data column loses exactly the ${table} secret keys`);
  }
});

test("after 0081 the audit trigger stores no Better Auth secret on an insert, update or delete, and keeps every other key", async () => {
  const { db, apply } = await databaseBefore(AUTH_SECRETS_TAG);
  await apply();
  await db.exec(AUTH_WRITES);

  const rows = (await storedLogs(db)).filter((r) => r.schema_name === "better_auth" && r.table_name in SECRET_KEYS);
  assert.deepEqual(
    rows.map((r) => `${r.table_name} ${r.operation}`),
    ["account", "session", "verification"].flatMap((table) => ["INSERT", "UPDATE", "DELETE"].map((op) => `${table} ${op}`)),
    "the trigger still logs every write to the three tables",
  );
  for (const row of rows) {
    for (const data of [row.old_data, row.new_data]) {
      if (data === null) continue;
      for (const key of SECRET_KEYS[row.table_name]) assert.ok(!(key in data), `${row.table_name} ${row.operation} stores no ${key}`);
      assert.equal(data.id, row.record_id, "the row's id is kept");
    }
  }
  const account = rows.find((r) => r.table_name === "account" && r.operation === "UPDATE");
  assert.deepEqual([account?.new_data?.userId, account?.new_data?.providerId, account?.new_data?.scope], ["u-1", "google", "email"]);
  const session = rows.find((r) => r.table_name === "session" && r.operation === "UPDATE");
  assert.deepEqual([session?.new_data?.userId, session?.new_data?.ipAddress], ["u-1", "127.0.0.1"]);
  const verification = rows.find((r) => r.table_name === "verification" && r.operation === "DELETE");
  assert.equal(verification?.old_data?.identifier, "state-1");
  for (const row of await storedLogs(db)) assert.doesNotMatch(`${row.old_text} ${row.new_text}`, /placeholder-/, "no log row holds a secret");
});

test("after 0081 a write to a public table is still logged whole, with its writer and acting account", async () => {
  const { db, apply } = await databaseBefore(AUTH_SECRETS_TAG);
  await apply();
  await db.exec(`
    insert into better_auth."user" (id, name, email, "emailVerified") values
      ('person', 'Sara Conti', 'sara@example.com', true),
      ('it-lead', 'Marco Bianchi', 'marco@example.com', true);
  `);
  const asPerson = (write: string) =>
    db.exec(`begin; select set_config('request.jwt.claim.sub', 'person', true); select set_config('request.acting_account', 'it-lead', true); ${write}; commit;`);
  const department = async () => (await db.query<{ data: StoredData }>(`select to_jsonb(d) as data from departments d where id = (select max(id) from departments)`)).rows[0].data;

  await asPerson(`insert into public.departments (name) values ('Avionics')`);
  const inserted = await department();
  await asPerson(`update public.departments set name = 'Avionics and software' where name = 'Avionics'`);
  const updated = await department();

  const rows = (await storedLogs(db)).filter((r) => r.table_name === "departments");
  assert.deepEqual(
    rows.map(({ operation, old_data, new_data, changed_by, changed_by_acting_account }) => ({ operation, old_data, new_data, changed_by, changed_by_acting_account })),
    [
      { operation: "INSERT", old_data: null, new_data: inserted, changed_by: "person", changed_by_acting_account: "it-lead" },
      { operation: "UPDATE", old_data: inserted, new_data: updated, changed_by: "person", changed_by_acting_account: "it-lead" },
    ],
  );
});

test("0081 strips the secret keys from stored Better Auth log rows, keeps every other row, column and key as it was, and applies again changing nothing", async () => {
  const { db, apply } = await databaseBefore(AUTH_SECRETS_TAG);
  // The trigger as 0061 left it stores the secrets whole.
  await db.exec(AUTH_WRITES);
  await db.exec(`begin; select set_config('request.jwt.claim.sub', 'u-1', true); insert into public.departments (name) values ('Recovery'); commit;`);
  await db.query(
    `insert into logs (schema_name, table_name, operation, record_id, new_data, changed_by) values
      ('better_auth', 'session', $1, 's-2', '{"personId": "u-1", "actingAccountId": "u-1"}', 'u-1'),
      ('better_auth', 'session', $2, 's-2', '{"personId": "u-1", "actingAccountId": "u-1"}', 'u-1'),
      ('better_auth', 'session', $3, 's-3', '{"userId": "u-1"}', 'u-1')`,
    [VIEW_AS_OPERATIONS.start, VIEW_AS_OPERATIONS.stop, BREAK_GLASS_SIGN_IN_OPERATION],
  );
  const before = await storedLogs(db);
  assert.ok(before.some((r) => `${r.old_text} ${r.new_text}`.includes("placeholder-")), "the old trigger stored the secrets");

  await apply();
  const after = await storedLogs(db);

  assert.deepEqual(after.map((r) => r.id), before.map((r) => r.id), "no log row is deleted");
  for (const [i, was] of before.entries()) {
    const now = after[i];
    const keys = was.schema_name === "better_auth" ? (SECRET_KEYS[was.table_name] ?? []) : [];
    const strip = (data: StoredData) => (data === null ? null : Object.fromEntries(Object.entries(data).filter(([key]) => !keys.includes(key))));
    const rest = ({ old_text, new_text, old_data, new_data, ...columns }: typeof was) => columns;
    assert.deepEqual(rest(now), rest(was), `log row ${was.id} keeps every other column`);
    assert.deepEqual([now.old_data, now.new_data], [strip(was.old_data), strip(was.new_data)], `log row ${was.id} loses only its secret keys`);
    const heldSecret = [was.old_data, was.new_data].some((data) => data !== null && keys.some((key) => key in data));
    if (!heldSecret) assert.deepEqual([now.old_text, now.new_text], [was.old_text, was.new_text], `log row ${was.id} is stored byte for byte as it was`);
  }
  for (const row of after) assert.doesNotMatch(`${row.old_text} ${row.new_text}`, /placeholder-/, "no log row holds a secret");

  const kept = (r: (typeof after)[number]) => r.table_name === "departments" || r.operation === BREAK_GLASS_SIGN_IN_OPERATION || Object.values(VIEW_AS_OPERATIONS).includes(r.operation);
  assert.deepEqual(after.filter(kept), before.filter(kept), "the public row, the View as rows and the break-glass row are unchanged");
  const viewAs = await db.query<{ operation: string; new_data: StoredData }>(
    `select operation, new_data from logs where schema_name = 'better_auth' and table_name = 'session' and operation = any($1) order by id`,
    [Object.values(VIEW_AS_OPERATIONS)],
  );
  assert.deepEqual(viewAs.rows, [
    { operation: VIEW_AS_OPERATIONS.start, new_data: { personId: "u-1", actingAccountId: "u-1" } },
    { operation: VIEW_AS_OPERATIONS.stop, new_data: { personId: "u-1", actingAccountId: "u-1" } },
  ], "the Activity log still reads the View as start and stop");

  const definition = async () => (await db.query<{ def: string }>(`select pg_get_functiondef('public.log_db_changes'::regproc) as def`)).rows[0].def;
  const function_ = await definition();
  await apply();
  assert.deepEqual(await storedLogs(db), after, "a second run changes no log row");
  assert.equal(await definition(), function_, "a second run leaves the trigger function as it was");
});

// The Google account's email on each linked account (epic #902, issue #906):
// one nullable column and a fill from the login's own email, with the audit
// trigger off for the fill alone so no token is copied into `logs`. The fill
// is the one statement that changes rows, so the file is pinned to it.
const ACCOUNT_EMAIL_TAG = "0083_account_google_email";

test("0083_account_google_email.sql adds the nullable email column and fills it, and nothing else", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${ACCOUNT_EMAIL_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), [
    `UPDATE "better_auth"."account" SET "email" = "user"."email" FROM "better_auth"."user" WHERE "user"."id" = "account"."userId" AND "account"."email" IS NULL`,
  ]);
  assert.match(sql, /https:\/\/github\.com\/PoliTo-Rocket-Team\/website-v2\/issues\/902/);
});

test("0083 fills each existing account's email from its login, copies no token into logs, keeps every other value and applies again", async () => {
  const { db, apply } = await databaseBefore(ACCOUNT_EMAIL_TAG);
  await db.exec(`
    insert into better_auth."user" (id, name, email, "emailVerified") values ('u-1', 'Sara Conti', 'sara@example.com', true), ('u-2', 'Luca Neri', 'luca@example.com', true);
    insert into better_auth.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "updatedAt") values
      ('a-1', 'g-1', 'google', 'u-1', 'access-1', 'refresh-1', 'id-1', now()),
      ('a-2', 'g-2', 'google', 'u-2', 'access-2', null, 'id-2', now());
  `);
  const columns = `id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", scope, "createdAt", "updatedAt"`;
  const before = await db.query(`select ${columns} from better_auth.account order by id`);
  const logs = async () => (await db.query<{ n: number }>(`select count(*)::int as n from public.logs`)).rows[0].n;
  const logged = await logs();
  await apply();
  await db.exec(`update better_auth.account set email = 'kept@example.com' where id = 'a-2'`);
  const afterEdit = await logs();
  await apply();
  assert.deepEqual((await db.query(`select id, email from better_auth.account order by id`)).rows, [
    { id: "a-1", email: "sara@example.com" },
    { id: "a-2", email: "kept@example.com" },
  ], "the fill reads the login's email, and a second run leaves an email already set");
  assert.deepEqual((await db.query(`select ${columns} from better_auth.account order by id`)).rows, before.rows, "no other value changes");
  assert.equal(afterEdit, logged + 1, "the fill logged nothing; the audit trigger is on again after it");
  assert.equal(await logs(), afterEdit, "the second run logged nothing either");
  const column = await db.query(
    `select data_type, is_nullable from information_schema.columns where table_schema = 'better_auth' and table_name = 'account' and column_name = 'email'`,
  );
  assert.deepEqual(column.rows, [{ data_type: "text", is_nullable: "YES" }]);
});

// A first sign-in finds its imported record whatever the letter case or stray
// spaces (issue #920, https://github.com/PoliTo-Rocket-Team/website-v2/issues/920):
// the sign-in sync matches `lower(trim(email))`, as the session repair does,
// and takes over none of several free rows that match. The function
// replacement changes no stored row.
const EMAIL_CASE_TAG = "0080_sync_auth_users_email_case";

/** Every migration up to and including 0080 applied, with a way to add a login. */
async function databaseWithEmailCase() {
  const { db, apply } = await databaseBefore(EMAIL_CASE_TAG);
  await apply();
  const login = (id: string, email: string) => db.exec(`insert into better_auth."user" (id, name, email, "emailVerified") values ('${id}', '${id}', '${email}', true)`);
  const rows = async () => (await db.query<{ id: string; email: string; first_name: string | null }>(`select id, email, first_name from users order by id`)).rows;
  return { db, login, rows };
}

test("0080_sync_auth_users_email_case.sql drops, renames and rewrites nothing, and its header links the issue", () => {
  const sql = readFileSync(resolve(process.cwd(), `drizzle/${EMAIL_CASE_TAG}.sql`), "utf8");
  assert.deepEqual(nonAdditiveStatements(sql), []);
  assert.match(sql, /https:\/\/github\.com\/PoliTo-Rocket-Team\/website-v2\/issues\/920/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.sync_auth_users\(\)/);
});

test("0080 keeps every row on a database that already holds rows, and applies again", async () => {
  const { db, apply } = await databaseBefore(EMAIL_CASE_TAG);
  await db.exec(`
    insert into better_auth."user" (id, name, email, "emailVerified") values ('held', 'held', 'held@example.com', true);
    insert into users (id, email, first_name) values ('added:free', 'Mover@mail.test', 'Imported');
    insert into users (id, email, first_name, deleted_at) values ('closed', 'closed@example.com', 'Closed', now());
    insert into applications (user_id) values ('added:free');
  `);
  const snapshot = async () => ({
    users: (await db.query(`select * from users order by id`)).rows,
    applications: (await db.query(`select * from applications order by id`)).rows,
  });
  const before = await snapshot();
  await apply();
  await apply();
  assert.deepEqual(await snapshot(), before, "every row is kept");
});

test("after 0080 a first sign-in takes over a free row whose email differs only in letter case", async () => {
  const { db, login, rows } = await databaseWithEmailCase();
  await db.exec(`insert into users (id, email, first_name) values ('added:mover', 'Mover@mail.test', 'Imported')`);
  await login("mover", "mover@mail.test");
  assert.deepEqual(await rows(), [{ id: "mover", email: "mover@mail.test", first_name: "Imported" }]);
  const withId = await db.query(`select id from users where id = 'mover'`);
  assert.equal(withId.rows.length, 1, "no second row has the login's id");
});

test("after 0080 a first sign-in takes over a free row whose email has leading and trailing spaces", async () => {
  const { db, login, rows } = await databaseWithEmailCase();
  await db.exec(`insert into users (id, email, first_name) values ('added:mover', '  mover@mail.test  ', 'Imported')`);
  await login("mover", "mover@mail.test");
  assert.deepEqual(await rows(), [{ id: "mover", email: "mover@mail.test", first_name: "Imported" }]);
});

test("after 0080 a first sign-in matching two free rows takes over neither and gets a fresh row", async () => {
  const { db, login, rows } = await databaseWithEmailCase();
  await db.exec(`
    insert into users (id, email, first_name) values ('added:upper', 'Mover@mail.test', 'Upper');
    insert into users (id, email, first_name) values ('added:lower', 'mover@mail.test', 'Lower');
  `);
  await login("mover", "mover@mail.test");
  assert.deepEqual(await rows(), [
    { id: "added:lower", email: "mover@mail.test", first_name: "Lower" },
    { id: "added:upper", email: "Mover@mail.test", first_name: "Upper" },
    { id: "mover", email: "mover@mail.test", first_name: null },
  ]);
});

test("after 0080 the sign-in sync still matches its own id first, skips held and closed rows, and makes a fresh row on no match", async () => {
  const { db, login, rows } = await databaseWithEmailCase();
  await login("held", "held@example.com");
  await db.exec(`
    update users set email = 'Shared@example.com' where id = 'held';
    insert into users (id, email, first_name) values ('own', 'old@example.com', 'Own');
    insert into users (id, email, first_name) values ('added:own-email', 'own@example.com', 'Other');
    insert into users (id, email, first_name, deleted_at) values ('closed', 'Closed@example.com', 'Closed', now());
  `);
  await login("own", "own@example.com");
  await login("second", "shared@example.com");
  await login("reopening", "closed@example.com");
  await login("stranger", "stranger@example.com");
  assert.deepEqual(await rows(), [
    { id: "added:own-email", email: "own@example.com", first_name: "Other" },
    { id: "closed", email: "Closed@example.com", first_name: "Closed" },
    { id: "held", email: "Shared@example.com", first_name: null },
    { id: "own", email: "own@example.com", first_name: "Own" },
    { id: "reopening", email: "closed@example.com", first_name: null },
    { id: "second", email: "shared@example.com", first_name: null },
    { id: "stranger", email: "stranger@example.com", first_name: null },
  ]);
});

test("after 0080 a first sign-in on a free row that applications, files and audit rows point at gets a fresh row, leaving the matched row as it was", async () => {
  const { db, login } = await databaseWithEmailCase();
  await db.exec(`
    insert into users (id, email, first_name) values ('applicant', 'Applicant@example.com', 'Imported');
    insert into applications (user_id) values ('applicant');
    insert into application_files (r2_key, original_filename, user_id) values ('applications/applicant/cv.pdf', 'cv.pdf', 'applicant');
    insert into logs (schema_name, table_name, operation, record_id, changed_by) values ('public', 'users', 'UPDATE', 'applicant', 'applicant');
  `);
  const snapshot = async () => ({
    users: (await db.query<{ id: string }>(`select * from users order by id`)).rows,
    applications: (await db.query(`select * from applications order by id`)).rows,
    files: (await db.query(`select * from application_files order by id`)).rows,
  });
  const before = await snapshot();
  await login("new-login", "applicant@example.com");
  const after = await snapshot();
  assert.deepEqual(after.users.find((u) => u.id === "applicant"), before.users.find((u) => u.id === "applicant"), "the matched row is unchanged");
  assert.deepEqual(
    after.users.map((u) => u.id),
    ["applicant", "new-login"],
    "the login gets a fresh row",
  );
  assert.deepEqual(after.applications, before.applications, "every application still points at the unchanged row");
  assert.deepEqual(after.files, before.files, "every uploaded file still points at the unchanged row");
});
