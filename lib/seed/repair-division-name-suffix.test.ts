import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { nonAdditiveStatements } from "./journal";

// Migration 0081 (issue #938) restores division names the dashboard's
// division save renamed by adding " Division", keyed on the audit rows in
// `logs`. Every preview build and every production build applies it, so this
// builds the schema from the journaled migrations on an in-memory Postgres
// (PGlite), loads divisions beside the audit rows their writes left, and runs
// the migration file itself: it must repair only the app-added suffix, leave
// every other name, and change nothing when run again.

const root = join(__dirname, "..", "..");
const TAG = "0081_repair_division_name_suffix";
const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const file = (tag: string) => readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");

async function run(db: PGlite, sql: string) {
  for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
}

/** A database built from every journaled migration before 0081. */
async function schemaBefore(): Promise<PGlite> {
  const db = new PGlite();
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(TAG), `${TAG} is journaled`);
  for (const tag of tags.slice(0, tags.indexOf(TAG))) await run(db, file(tag));
  return db;
}

const EDITOR = "5eed0000-0000-4000-8000-000000000002";

const ROWS = `
insert into departments (id, name) values (1, 'Recovery');
insert into members (member_id) values (2);
insert into users (id, email, first_name, last_name, member) values ('${EDITOR}', 'e@example.com', 'Marco', 'Delogu', 2);
insert into divisions (id, dept_id, name, started_at, code) values
  (1, 1, 'Recovery Systems Division', '2022-09-01', 'RS'),
  (2, 1, 'Flight Dynamics Division', '2026-10-20', 'FD'),
  (3, 1, 'Test Bench Division', '2022-09-01', 'TB'),
  (4, 1, 'Electronics Division', '2022-09-01', 'EL'),
  (5, 1, 'Payload Division', '2022-09-01', 'PL'),
  (6, 1, 'Information Technology', '2022-09-01', 'IT');
`;

/**
 * The audit rows those names came from. 1: an Edit division save added the
 * suffix. 2: New division stored it. 3: no row, as a seed or import leaves it.
 * 4: an Edit division save added it, then a later write by hand renamed the
 * division. 5: a write with no signed-in user (a migration, seed or import)
 * added it. 6: a save added it and was already undone by a later write.
 */
const AUDIT = `
insert into logs (id, schema_name, table_name, operation, record_id, old_data, new_data, changed_by, changed_at) values
  (90100, 'public', 'divisions', 'UPDATE', '1', '{"name": "Recovery Systems"}', '{"name": "Recovery Systems Division"}', '${EDITOR}', '2026-10-30 10:00:00+00'),
  (90101, 'public', 'divisions', 'UPDATE', '1', '{"name": "Recovery Systems Division"}', '{"name": "Recovery Systems Division"}', '${EDITOR}', '2026-10-30 11:00:00+00'),
  (90102, 'public', 'divisions', 'INSERT', '2', null, '{"name": "Flight Dynamics Division"}', '${EDITOR}', '2026-10-20 09:00:00+00'),
  (90103, 'public', 'divisions', 'UPDATE', '4', '{"name": "Avionics"}', '{"name": "Avionics Division"}', '${EDITOR}', '2026-10-25 09:00:00+00'),
  (90104, 'public', 'divisions', 'UPDATE', '4', '{"name": "Avionics Division"}', '{"name": "Electronics Division"}', null, '2026-10-26 09:00:00+00'),
  (90105, 'public', 'divisions', 'UPDATE', '5', '{"name": "Payload"}', '{"name": "Payload Division"}', null, '2026-10-25 09:00:00+00'),
  (90106, 'public', 'divisions', 'UPDATE', '6', '{"name": "Information Technology"}', '{"name": "Information Technology Division"}', '${EDITOR}', '2026-10-24 09:00:00+00'),
  (90107, 'public', 'divisions', 'UPDATE', '6', '{"name": "Information Technology Division"}', '{"name": "Information Technology"}', null, '2026-10-24 10:00:00+00');
`;

async function load(db: PGlite, sql: string) {
  // Fixture rows are not history: load them with the audit trigger off.
  await db.exec(`set session_replication_role = replica; ${sql} set session_replication_role = origin;`);
}

async function names(db: PGlite) {
  return (await db.query<{ id: number; name: string }>("select id, name from divisions order by id")).rows.map((r) => r.name);
}

test("0081 changes one thing only: the name of a division", () => {
  const changed = nonAdditiveStatements(file(TAG));
  assert.equal(changed.length, 1);
  const [update] = changed;
  assert.match(update, /^UPDATE "divisions" AS d SET "name" = left\(d\."name", length\(d\."name"\) - length\(' Division'\)\) FROM \(/);
});

test("0081 repairs an app-added suffix, leaves an unlogged or later-renamed name, and a second run changes nothing", async () => {
  const db = await schemaBefore();
  await load(db, ROWS + AUDIT);
  await run(db, file(TAG));
  const repaired = [
    "Recovery Systems",
    "Flight Dynamics",
    "Test Bench Division",
    "Electronics Division",
    "Payload Division",
    "Information Technology",
  ];
  assert.deepEqual(await names(db), repaired);
  const logged = async () => (await db.query<{ n: number }>("select count(*)::int as n from logs")).rows[0].n;
  const before = await logged();
  await run(db, file(TAG));
  assert.deepEqual(await names(db), repaired, "a second run changes nothing");
  assert.equal(await logged(), before, "and writes nothing");
});

test("0081 changes nothing on a database without app-write audit rows", async () => {
  const unlogged = await schemaBefore();
  await load(unlogged, ROWS);
  const before = await names(unlogged);
  await run(unlogged, file(TAG));
  assert.deepEqual(await names(unlogged), before);
  const empty = await schemaBefore();
  await run(empty, file(TAG));
  assert.deepEqual(await names(empty), []);
});
