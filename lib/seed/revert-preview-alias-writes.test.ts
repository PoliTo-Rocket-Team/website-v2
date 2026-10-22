import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Migration 0054 (issue #572) undoes the other test writes made on the shared
// preview database on 2026-10-22 (alias requests, aliases, their notices and
// Tester Member's profile edits), and every preview build applies it before
// merge. This builds the schema from the journaled migrations on an in-memory
// Postgres (PGlite), loads the rows those writes left beside rows they did
// not touch, and runs the migration file itself: it must undo exactly those
// writes, keep the audit rows, give the same result before or after #563's
// `email_alias` to `prt_email` copy, and change nothing on a database that
// lacks them, the local seed's lookalike tester alias rows included.

const root = join(__dirname, "..", "..");
const TAG = "0054_revert_preview_alias_test_writes";
const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const file = (tag: string) => readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");

async function run(db: PGlite, sql: string) {
  for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
}

/** A database built from every journaled migration before 0054, #563's 0053 copy included. */
async function schemaBefore(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec("set time zone 'UTC'"); // timestamps read back as text in UTC
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(TAG), `${TAG} is journaled`);
  for (const tag of tags.slice(0, tags.indexOf(TAG))) await run(db, file(tag));
  return db;
}

/** #563's copy (0053, PR #575), which a database may hold before 0054 runs or gain after it. */
const COPY_563 = file("0053_prt_email_from_email_alias");

const AS_ANDREA = "5eed0000-0000-4000-8000-000000000001";
const MARCO = "5eed0000-0000-4000-8000-000000000002";
const BEATRICE = "5eed0000-0000-4000-8000-000000000119";
const FILIPPO = "5eed0000-0000-4000-8000-000000000140";
const TESTER_MEMBER = "7e57e500-0000-4000-8000-000000000002";
const DIVISION_LEAD = "7e57e500-0000-4000-8000-000000000003";
const OPERATIONS_LEAD = "7e57e500-0000-4000-8000-000000000004";

const PEOPLE = `
insert into members (member_id, prt_email) values
  (1, 'andrea.pantano@prt.example.com'), (119, 'beatrice.la.motta@prt.example.com'),
  (140, 'filippo.prosperi@prt.example.com'), (903, 'operations-lead.tester@example.com');
insert into users (id, email, first_name, last_name, member, polito_id, level_of_study, updated_at) values
  ('${AS_ANDREA}', 'a@example.com', 'Andrea', 'Pantano', 1, 's100001', 'Bachelor', null),
  ('${MARCO}', 'm@example.com', 'Marco', 'Delogu', 2, 's100002', 'Master', null),
  ('${BEATRICE}', 'b@example.com', 'Beatrice', 'La Motta', 119, 's100119', 'Master', null),
  ('${FILIPPO}', 'f@example.com', 'Filippo', 'Prosperi', 140, 's100140', 'Master', null),
  ('${TESTER_MEMBER}', 'member.tester@example.com', 'Tester', 'Member', 901, '%TESTER_POLITO%', %TESTER_LEVEL%, '%TESTER_UPDATED%'),
  ('${DIVISION_LEAD}', 'division-lead.tester@example.com', 'Tester', 'Division Lead', 902, 's900003', 'Master', '2026-10-09 08:00:00+00'),
  ('${OPERATIONS_LEAD}', 'operations-lead.tester@example.com', 'Tester', 'Operations Lead', 903, 's900004', 'Master', '2026-10-09 08:00:00+00');
`;

/** The rows on the preview database as the 2026-10-22 test writes left them, read that day, with neighbours they did not touch. */
const ROWS = `
insert into members (member_id, prt_email, email_alias, email_alias_set_up_at) values
  (2, 'marco.delogu@prt.example.com', 'preview.reviewer@politorocketteam.it', null),
  (901, null, 'tester.member@politorocketteam.it', '2026-10-22 09:31:08.055+00'),
  (902, 'division-lead.tester@example.com', 'tester.divisionlead@politorocketteam.it', null);
${PEOPLE.replace("'%TESTER_POLITO%'", "'900002'").replace("%TESTER_LEVEL%", "null").replace("%TESTER_UPDATED%", "2026-10-22 12:14:08.726698+00")}
insert into alias_requests (id, member_id, requested_by, created_at, outcome, answered_by, answered_at) values
  (1, 901, 902, '2026-10-22 09:25:21.677914+00', 'created', 1, '2026-10-22 09:27:08.785+00'),
  (2, 119, 902, '2026-10-22 09:28:40.825501+00', null, null, null),
  (3, 2, 1, '2026-10-22 09:32:37.114556+00', 'created', 1, '2026-10-22 09:33:15.918+00'),
  (6, 140, 902, '2026-10-22 10:53:34.188771+00', 'cancelled', 902, '2026-10-22 10:53:34.524+00'),
  (7, 902, 1, '2026-10-22 12:08:13.350155+00', 'created', 1, '2026-10-22 12:08:41.114+00'),
  (8, 903, 902, '2026-10-22 12:30:00+00', null, null, null);
insert into dashboard_notices (id, recipient_id, kind, subject_id, data, created_at) values
  (1, 902, 'alias-created', 901, '{"address": "tester.member@politorocketteam.it"}', '2026-10-22 09:27:08.8045+00'),
  (2, 901, 'alias-ready', 901, '{"address": "tester.member@politorocketteam.it"}', '2026-10-22 09:27:08.8045+00'),
  (3, 1, 'alias-created', 2, '{"address": "preview.reviewer@politorocketteam.it"}', '2026-10-22 09:33:15.956572+00'),
  (4, 2, 'alias-ready', 2, '{"address": "preview.reviewer@politorocketteam.it"}', '2026-10-22 09:33:15.956572+00'),
  (6, 1, 'alias-created', 902, '{"address": "tester.divisionlead@politorocketteam.it"}', '2026-10-22 12:08:41.134798+00'),
  (7, 903, 'alias-created', 903, '{"address": "tester.member@politorocketteam.it"}', '2026-10-22 09:27:08.8045+00');
`;

/** The audit rows the migration keys on (logs 896-925 on the preview database), with #567's (908-913) between them. */
const AUDIT = `
insert into logs (id, schema_name, table_name, operation, record_id, old_data, new_data, changed_by, changed_at) values
  (896, 'public', 'alias_requests', 'INSERT', '1', null, '{"id": 1}', '${DIVISION_LEAD}', '2026-10-22 09:25:21.677+00'),
  (897, 'public', 'alias_requests', 'UPDATE', '1', '{"outcome": null}', '{"outcome": "created"}', '${AS_ANDREA}', '2026-10-22 09:27:08.788+00'),
  (898, 'public', 'members', 'UPDATE', '901', '{"email_alias": null}', '{"email_alias": "tester.member@politorocketteam.it"}', '${AS_ANDREA}', '2026-10-22 09:27:08.804+00'),
  (899, 'public', 'dashboard_notices', 'INSERT', '1', null, '{"id": 1}', '${AS_ANDREA}', '2026-10-22 09:27:08.804+00'),
  (900, 'public', 'dashboard_notices', 'INSERT', '2', null, '{"id": 2}', '${AS_ANDREA}', '2026-10-22 09:27:08.804+00'),
  (901, 'public', 'alias_requests', 'INSERT', '2', null, '{"id": 2}', '${DIVISION_LEAD}', '2026-10-22 09:28:40.825+00'),
  (902, 'public', 'members', 'UPDATE', '901', '{"email_alias_set_up_at": null}', '{"email_alias_set_up_at": "2026-10-22T09:31:08.055+00:00"}', '${TESTER_MEMBER}', '2026-10-22 09:31:08.058+00'),
  (903, 'public', 'alias_requests', 'INSERT', '3', null, '{"id": 3}', '${AS_ANDREA}', '2026-10-22 09:32:37.114+00'),
  (904, 'public', 'alias_requests', 'UPDATE', '3', '{"outcome": null}', '{"outcome": "created"}', '${AS_ANDREA}', '2026-10-22 09:33:15.933+00'),
  (905, 'public', 'members', 'UPDATE', '2', '{"email_alias": null}', '{"email_alias": "preview.reviewer@politorocketteam.it"}', '${AS_ANDREA}', '2026-10-22 09:33:15.956+00'),
  (906, 'public', 'dashboard_notices', 'INSERT', '3', null, '{"id": 3}', '${AS_ANDREA}', '2026-10-22 09:33:15.956+00'),
  (907, 'public', 'dashboard_notices', 'INSERT', '4', null, '{"id": 4}', '${AS_ANDREA}', '2026-10-22 09:33:15.956+00'),
  (908, 'public', 'alias_requests', 'INSERT', '4', null, '{"id": 4}', '${DIVISION_LEAD}', '2026-10-22 10:49:48.950+00'),
  (909, 'public', 'divisions', 'UPDATE', '1', '{"name": "Test Bench"}', '{"name": "Test Bench Division"}', '${MARCO}', '2026-10-22 10:52:32.173+00'),
  (910, 'public', 'roles', 'UPDATE', '120', '{"type": "core"}', '{"type": "lead"}', '${MARCO}', '2026-10-22 10:52:32.173+00'),
  (911, 'public', 'alias_requests', 'INSERT', '5', null, '{"id": 5}', '${MARCO}', '2026-10-22 10:52:32.173+00'),
  (912, 'public', 'alias_requests', 'UPDATE', '4', '{"outcome": null}', '{"outcome": "declined"}', '${OPERATIONS_LEAD}', '2026-10-22 10:53:14.004+00'),
  (913, 'public', 'dashboard_notices', 'INSERT', '5', null, '{"id": 5}', '${OPERATIONS_LEAD}', '2026-10-22 10:53:14.025+00'),
  (914, 'public', 'alias_requests', 'INSERT', '6', null, '{"id": 6}', '${DIVISION_LEAD}', '2026-10-22 10:53:34.188+00'),
  (915, 'public', 'alias_requests', 'UPDATE', '6', '{"outcome": null}', '{"outcome": "cancelled"}', '${DIVISION_LEAD}', '2026-10-22 10:53:34.527+00'),
  (916, 'public', 'alias_requests', 'INSERT', '7', null, '{"id": 7}', '${AS_ANDREA}', '2026-10-22 12:08:13.350+00'),
  (917, 'public', 'alias_requests', 'UPDATE', '7', '{"outcome": null}', '{"outcome": "created"}', '${AS_ANDREA}', '2026-10-22 12:08:41.117+00'),
  (918, 'public', 'members', 'UPDATE', '902', '{"email_alias": null}', '{"email_alias": "tester.divisionlead@politorocketteam.it"}', '${AS_ANDREA}', '2026-10-22 12:08:41.134+00'),
  (919, 'public', 'dashboard_notices', 'INSERT', '6', null, '{"id": 6}', '${AS_ANDREA}', '2026-10-22 12:08:41.134+00'),
  (920, 'public', 'roles', 'UPDATE', '142', '{"type": "core"}', '{"type": "core"}', '${DIVISION_LEAD}', '2026-10-22 12:13:54.068+00'),
  (921, 'public', 'users', 'UPDATE', '${TESTER_MEMBER}', '{"polito_id": "s900002", "level_of_study": "Master", "updated_at": "2026-10-09T08:00:00+00:00"}', '{"polito_id": "900002", "level_of_study": null, "updated_at": "2026-10-22T12:13:54.068456+00:00"}', '${DIVISION_LEAD}', '2026-10-22 12:13:54.068+00'),
  (922, 'public', 'members', 'UPDATE', '901', '{"prt_email": "member.tester@example.com"}', '{"prt_email": null}', '${DIVISION_LEAD}', '2026-10-22 12:13:54.068+00'),
  (923, 'public', 'roles', 'UPDATE', '142', '{"type": "core"}', '{"type": "core"}', '${DIVISION_LEAD}', '2026-10-22 12:14:08.726+00'),
  (924, 'public', 'users', 'UPDATE', '${TESTER_MEMBER}', '{"polito_id": "900002", "level_of_study": null}', '{"polito_id": "900002", "level_of_study": null, "updated_at": "2026-10-22T12:14:08.726698+00:00"}', '${DIVISION_LEAD}', '2026-10-22 12:14:08.726+00'),
  (925, 'public', 'members', 'UPDATE', '901', '{"prt_email": null}', '{"prt_email": null}', '${DIVISION_LEAD}', '2026-10-22 12:14:08.726+00');
`;

/**
 * The local seed's tester alias rows as they stand since #563 (db/seed/aliases.ts, people.ts): the
 * same request and notice ids, the member tester's alias as their PRT email on the reserved test
 * domain, and the members still owed one with no PRT email, on other dates.
 */
const SEED = `
insert into members (member_id, prt_email, email_alias, email_alias_set_up_at) values
  (2, 'marco.delogu@prt.example.com', null, null),
  (901, 'member.tester@example.com', null, null),
  (902, 'division-lead.tester@example.com', null, null),
  (13, null, null, null), (134, null, null, null), (168, null, null, null);
${PEOPLE.replace("'%TESTER_POLITO%'", "'s900002'").replace("%TESTER_LEVEL%", "'Master'").replace("%TESTER_UPDATED%", "2026-10-09 08:00:00+00")}
insert into alias_requests (id, member_id, requested_by, created_at, outcome, answered_by, answered_at) values
  (1, 134, 902, '2026-10-20 09:15:00+00', null, null, null),
  (2, 13, null, '2026-10-21 08:00:00+00', null, null, null),
  (3, 901, 902, '2026-10-15 10:00:00+00', 'created', 1, '2026-10-16 14:30:00+00'),
  (4, 168, 902, '2026-10-17 11:00:00+00', 'declined', 903, '2026-10-18 16:45:00+00');
insert into dashboard_notices (id, recipient_id, kind, subject_id, data, created_at) values
  (1, 902, 'alias-created', 901, '{"address": "member.tester@example.com"}', '2026-10-16 14:30:00+00'),
  (2, 902, 'alias-declined', 168, '{"by": "Tester Operations Lead"}', '2026-10-18 16:45:00+00');
`;

async function load(db: PGlite, sql: string) {
  // Fixture rows are not history: load them with the audit trigger off.
  await db.exec(`set session_replication_role = replica; ${sql} set session_replication_role = origin;`);
}

async function state(db: PGlite) {
  const ids = async (q: string) => (await db.query<{ id: number }>(q)).rows.map((r) => r.id);
  return {
    members: (
      await db.query("select member_id, prt_email, email_alias, email_alias_set_up_at::text from members order by member_id")
    ).rows,
    tester: (
      await db.query("select polito_id, level_of_study, updated_at::text from users where id = $1", [TESTER_MEMBER])
    ).rows[0],
    aliasRequests: await ids("select id from alias_requests order by id"),
    notices: await ids("select id from dashboard_notices order by id"),
  };
}

const logged = async (db: PGlite) => (await db.query<{ n: number }>("select count(*)::int as n from logs")).rows[0].n;

const UNDONE = {
  members: [
    { member_id: 1, prt_email: "andrea.pantano@prt.example.com", email_alias: null, email_alias_set_up_at: null },
    { member_id: 2, prt_email: "marco.delogu@prt.example.com", email_alias: null, email_alias_set_up_at: null },
    { member_id: 119, prt_email: "beatrice.la.motta@prt.example.com", email_alias: null, email_alias_set_up_at: null },
    { member_id: 140, prt_email: "filippo.prosperi@prt.example.com", email_alias: null, email_alias_set_up_at: null },
    { member_id: 901, prt_email: "member.tester@example.com", email_alias: null, email_alias_set_up_at: null },
    { member_id: 902, prt_email: "division-lead.tester@example.com", email_alias: null, email_alias_set_up_at: null },
    { member_id: 903, prt_email: "operations-lead.tester@example.com", email_alias: null, email_alias_set_up_at: null },
  ],
  tester: { polito_id: "s900002", level_of_study: "Master", updated_at: "2026-10-09 08:00:00+00" },
  aliasRequests: [8],
  notices: [7],
};

test("0054 undoes the 2026-10-22 test writes and leaves every other row and the audit rows", async () => {
  const db = await schemaBefore();
  await load(db, ROWS + AUDIT);
  const before = await logged(db);
  await run(db, file(TAG));
  assert.deepEqual(await state(db), UNDONE);
  const kept = await db.query<{ id: number }>("select id from logs where id between 896 and 925 order by id");
  assert.deepEqual(
    kept.rows.map((r) => r.id),
    Array.from({ length: 30 }, (_, i) => 896 + i),
  );
  assert.equal((await logged(db)) - before, 14, "the fourteen reversals leave their own audit rows");
});

test("0054 gives the same result before or after #563's email_alias to prt_email copy", async () => {
  for (const order of ["copy first", "copy after"] as const) {
    const db = await schemaBefore();
    await load(db, ROWS + AUDIT);
    if (order === "copy first") {
      await db.exec(COPY_563);
      const copied = await db.query("select prt_email from members where member_id = 901");
      assert.deepEqual(copied.rows, [{ prt_email: "tester.member@politorocketteam.it" }], "the copy fills 901's cleared prt_email");
    }
    await run(db, file(TAG));
    if (order === "copy after") await db.exec(COPY_563);
    assert.deepEqual(await state(db), UNDONE, order);
  }
});

test("0054 changes nothing on a database without the audit rows or people, or shaped like the local seed", async () => {
  for (const [name, fixture] of [
    ["no audit rows", ROWS],
    [
      "the same ids held by other people",
      (ROWS + AUDIT)
        .replaceAll("'Tester', 'Member'", "'Ada', 'Rossi'")
        .replaceAll("'Tester', 'Division Lead'", "'Ugo', 'Neri'")
        .replaceAll("'Andrea', 'Pantano'", "'Eva', 'Bianchi'")
        .replaceAll("'Marco', 'Delogu'", "'Leo', 'Verdi'")
        .replaceAll("'Beatrice', 'La Motta'", "'Ida', 'Gallo'")
        .replaceAll("'Filippo', 'Prosperi'", "'Rino', 'Costa'"),
    ],
    ["the local seed's tester alias rows", SEED],
    ["the local seed's tester alias rows beside the audit rows", SEED + AUDIT],
  ] as const) {
    const db = await schemaBefore();
    await load(db, fixture);
    const before = await state(db);
    const logs = await logged(db);
    await run(db, file(TAG));
    assert.deepEqual(await state(db), before, name);
    assert.equal(await logged(db), logs, `${name}: no row changed, so no audit row is written`);
  }
  const empty = await schemaBefore();
  await run(empty, file(TAG));
  assert.deepEqual(await state(empty), { members: [], tester: undefined, aliasRequests: [], notices: [] });
});
