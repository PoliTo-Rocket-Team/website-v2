import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Migration 0052 (issue #567) undoes two writes a UI reviewer made on the
// shared preview database on 2026-10-22, and every preview build applies it
// before merge. This builds the schema from the journaled migrations on an
// in-memory Postgres (PGlite), loads the rows those writes left beside rows
// they did not touch, and runs the migration file itself: it must undo exactly
// those writes, keep the reviewer's audit rows, and change nothing on a
// database that lacks them.

const root = join(__dirname, "..", "..");
const TAG = "0052_revert_preview_reviewer_writes";
const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const file = (tag: string) => readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");

async function run(db: PGlite, sql: string) {
  for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
}

/** A database built from every journaled migration before 0052. */
async function schemaBefore(): Promise<PGlite> {
  const db = new PGlite();
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(TAG), `${TAG} is journaled`);
  for (const tag of tags.slice(0, tags.indexOf(TAG))) await run(db, file(tag));
  return db;
}

const STEFANO = "5eed0000-0000-4000-8000-000000000195";
const DIMITRI = "5eed0000-0000-4000-8000-000000000134";
const DIVISION_LEAD = "7e57e500-0000-4000-8000-000000000003";
const OPERATIONS_LEAD = "7e57e500-0000-4000-8000-000000000004";
const AS_MARCO = "5eed0000-0000-4000-8000-000000000002";

/** The rows on the preview database as the reviewer left them, read 2026-10-22, with neighbours they did not touch. */
const ROWS = `
insert into departments (id, name) values (1, 'Propulsion');
insert into divisions (id, dept_id, name, started_at, code) values (1, 1, 'Test Bench Division', '2022-09-01', 'TBE');
insert into members (member_id) values (2), (134), (140), (195), (902), (903);
insert into users (id, email, first_name, last_name, member) values
  ('${AS_MARCO}', 'm@example.com', 'Marco', 'Delogu', 2),
  ('${DIMITRI}', 'd@example.com', 'Dimitri', 'Mazzone', 134),
  ('${STEFANO}', 's@example.com', 'Stefano', 'Motta', 195),
  ('${DIVISION_LEAD}', 'l@example.com', 'Tester', 'Division Lead', 902),
  ('${OPERATIONS_LEAD}', 'o@example.com', 'Tester', 'Operations Lead', 903);
insert into roles (id, member_id, dept_id, division_id, title, started_at, type) values
  (120, 195, 1, 1, 'Test Engineer', '2025-10-01', 'lead'),
  (143, 902, 1, 1, 'Test Bench Lead', '2025-10-01', 'lead');
insert into alias_requests (id, member_id, requested_by, created_at, outcome, answered_by, answered_at) values
  (4, 134, 902, '2026-10-22 10:49:48.950421+00', 'declined', 903, '2026-10-22 10:53:13.999+00'),
  (5, 195, null, '2026-10-22 10:52:32.173755+00', null, null, null),
  (6, 140, 902, '2026-10-22 10:53:34.188771+00', 'cancelled', 902, '2026-10-22 10:53:34.524+00');
insert into dashboard_notices (id, recipient_id, kind, subject_id, data, created_at) values
  (5, 902, 'alias-declined', 134, '{"by": "Tester Operations Lead"}', '2026-10-22 10:53:14.025339+00'),
  (6, 2, 'alias-declined', 140, '{"by": "Tester Operations Lead"}', '2026-10-22 10:53:14.025339+00');
`;

/** The reviewer's audit rows the migration keys on (logs 909-913 on the preview database). */
const AUDIT = `
insert into logs (id, schema_name, table_name, operation, record_id, old_data, new_data, changed_by, changed_at) values
  (909, 'public', 'divisions', 'UPDATE', '1', '{"name": "Test Bench"}', '{"name": "Test Bench Division"}', '${AS_MARCO}', '2026-10-22 10:52:32.173+00'),
  (910, 'public', 'roles', 'UPDATE', '120', '{"type": "core"}', '{"type": "lead"}', '${AS_MARCO}', '2026-10-22 10:52:32.173+00'),
  (911, 'public', 'alias_requests', 'INSERT', '5', null, '{"id": 5}', '${AS_MARCO}', '2026-10-22 10:52:32.173+00'),
  (912, 'public', 'alias_requests', 'UPDATE', '4', '{"outcome": null}', '{"outcome": "declined"}', '${OPERATIONS_LEAD}', '2026-10-22 10:53:14.004+00'),
  (913, 'public', 'dashboard_notices', 'INSERT', '5', null, '{"id": 5}', '${OPERATIONS_LEAD}', '2026-10-22 10:53:14.025+00');
`;

async function load(db: PGlite, sql: string) {
  // Fixture rows are not history: load them with the audit trigger off.
  await db.exec(`set session_replication_role = replica; ${sql} set session_replication_role = origin;`);
}

async function state(db: PGlite) {
  const ids = async (q: string) => (await db.query<{ id: number }>(q)).rows.map((r) => r.id);
  return {
    division: (await db.query<{ name: string }>("select name from divisions where id = 1")).rows[0]?.name,
    roles: (await db.query<{ id: number; type: string }>("select id, type from roles order by id")).rows,
    aliasRequests: await ids("select id from alias_requests order by id"),
    notices: await ids("select id from dashboard_notices order by id"),
  };
}

test("0052 undoes the reviewer's two writes and leaves every other row and the reviewer's audit rows", async () => {
  const db = await schemaBefore();
  await load(db, ROWS + AUDIT);
  const logged = async () => (await db.query<{ n: number }>("select count(*)::int as n from logs")).rows[0].n;
  const before = await logged();
  await run(db, file(TAG));
  assert.deepEqual(await state(db), {
    division: "Test Bench",
    roles: [
      { id: 120, type: "core" },
      { id: 143, type: "lead" },
    ],
    aliasRequests: [6],
    notices: [6],
  });
  const kept = await db.query<{ id: number }>("select id from logs where id between 909 and 913 order by id");
  assert.deepEqual(kept.rows.map((r) => r.id), [909, 910, 911, 912, 913]);
  assert.equal((await logged()) - before, 5, "the five reversals leave their own audit rows");
});

test("0052 changes nothing on a database without the reviewer's audit rows or people", async () => {
  for (const [name, fixture] of [
    ["no audit rows", ROWS],
    ["the same ids held by other people", (ROWS + AUDIT).replaceAll("'Stefano', 'Motta'", "'Ada', 'Rossi'").replaceAll("'Dimitri', 'Mazzone'", "'Ugo', 'Neri'")],
  ] as const) {
    const db = await schemaBefore();
    await load(db, fixture);
    const before = await state(db);
    await run(db, file(TAG));
    assert.deepEqual(await state(db), before, name);
  }
  const empty = await schemaBefore();
  await run(empty, file(TAG));
  assert.deepEqual(await state(empty), { division: undefined, roles: [], aliasRequests: [], notices: [] });
});
