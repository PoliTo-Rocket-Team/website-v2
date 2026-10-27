import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { BUILT_IN_STATUSES } from "../dashboard/application-status";
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

// One active holder per seat (issue #667) only creates partial unique
// indexes on `roles`: no column, type or row changes. What the indexes refuse
// is run in lib/dashboard/roles-one-active-seat-server.test.ts.
const SEAT_TAG = "0062_roles_one_active_seat_holder";

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

test("0062 keeps every existing role row as it was, and applies again over a database that already holds it", async () => {
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
  assert.deepEqual((await db.query(`select * from roles order by id`)).rows, before.rows);
  const indexes = await db.query<{ name: string }>(`select indexname as name from pg_indexes where tablename = 'roles' and indexname like 'roles_one_active_%' order by 1`);
  assert.deepEqual(indexes.rows.map((r) => r.name), ["roles_one_active_department_head", "roles_one_active_full_access_seat", "roles_one_active_team_leader"]);
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
