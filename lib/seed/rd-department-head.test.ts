import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

// Migration 0059 (issues #627 and #600) attaches the Head of R&D's role, kept
// in no unit, to the R&D department as its head (Owner decision on #600,
// https://github.com/PoliTo-Rocket-Team/website-v2/issues/600#issuecomment-6385921817).
// This builds the schema from the journaled migrations before it on an
// in-memory Postgres (PGlite), loads each shape of data the migration meets,
// and runs the file itself twice: it never makes a second R&D department,
// never gives a department two heads, keeps the role's title, holder and
// start date, and a second run changes nothing.

const root = join(__dirname, "..", "..");
const TAG = "0059_rd_department_head";
const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as {
  entries: { tag: string }[];
};
const file = (tag: string) => readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");

async function run(db: PGlite, sql: string) {
  for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
}

/** A database built from every journaled migration before 0059. */
async function schemaBefore(): Promise<PGlite> {
  const db = new PGlite();
  const tags = journal.entries.map((e) => e.tag);
  assert.ok(tags.includes(TAG), `${TAG} is journaled`);
  for (const tag of tags.slice(0, tags.indexOf(TAG))) await run(db, file(tag));
  return db;
}

async function load(db: PGlite, sql: string) {
  // Fixture rows are not history: load them with the audit trigger off.
  await db.exec(`set session_replication_role = replica; ${sql} set session_replication_role = origin;`);
}

type Department = { id: number; name: string; code: string | null; closed: boolean };
type Role = { id: number; member_id: number; dept_id: number | null; division_id: number | null; title: string; started_at: string; type: string };

async function state(db: PGlite) {
  const departments = (await db.query<Department>(`select id, name, code, closed_at is not null as closed from departments order by id`)).rows;
  const roles = (await db.query<Role>(`select id, member_id, dept_id, division_id, title, started_at::text, type::text from roles order by id`)).rows;
  return { departments, roles };
}

/** Runs the migration twice and answers the state after each run. */
async function migrate(rows: string) {
  const db = await schemaBefore();
  await load(db, rows);
  const before = await state(db);
  await run(db, file(TAG));
  const once = await state(db);
  await run(db, file(TAG));
  const twice = await state(db);
  await db.close();
  return { before, once, twice };
}

const MEMBERS = `insert into members (member_id) values (9), (12), (904);`;
/** The Head of R&D's role as the old seed and the public data stored it: in no unit (role 11 on the preview). */
const HEAD_OF_RD = `insert into roles (id, member_id, title, started_at, type) values (11, 9, 'Head of R&D', '2025-10-01', 'core');`;

test("on the preview as it is, whose R&D department has a head, nothing changes", async () => {
  const { before, once, twice } = await migrate(`
    ${MEMBERS}
    insert into departments (id, name, code) values (8, 'Research and Development', 'RND');
    insert into divisions (id, dept_id, name, started_at, code) values (19, 8, 'Payload Integration', '2025-10-01', 'PLI');
    insert into roles (id, member_id, dept_id, title, started_at, type) values (15, 904, 8, 'Head of Research and Development', '2025-10-01', 'head');
    ${HEAD_OF_RD}
  `);
  assert.deepEqual(once, before);
  assert.deepEqual(twice, before);
});

test("an R&D department with no head gets the Head of R&D's role as its head, and no second department", async () => {
  const { before, once, twice } = await migrate(`
    ${MEMBERS}
    insert into departments (id, name, code) values (8, 'Research and Development', 'RND');
    ${HEAD_OF_RD}
  `);
  assert.deepEqual(once.departments, before.departments);
  assert.deepEqual(
    once.roles.find((r) => r.id === 11),
    { id: 11, member_id: 9, dept_id: 8, division_id: null, title: "Head of R&D", started_at: "2025-10-01", type: "head" },
  );
  assert.deepEqual(twice, once);
});

test("an R&D department is found by its code or either name", async () => {
  for (const [name, code] of [
    ["R&D", null],
    ["Research and Development", null],
    ["Ricerca", " rnd "],
  ] as const) {
    const { before, once } = await migrate(`
      ${MEMBERS}
      insert into departments (id, name, code) values (5, 'Electronics', 'ELT'), (7, '${name}', ${code === null ? "null" : `'${code}'`});
      ${HEAD_OF_RD}
    `);
    assert.deepEqual(once.departments, before.departments, name);
    assert.equal(once.roles.find((r) => r.id === 11)?.dept_id, 7, name);
  }
});

test("with no R&D department open, one is added and the role heads it", async () => {
  const { once, twice } = await migrate(`
    ${MEMBERS}
    insert into departments (id, name, code, closed_at) values (5, 'Electronics', 'ELT', null), (6, 'R&D', 'RD', '2024-09-30');
    ${HEAD_OF_RD}
  `);
  const added = once.departments.filter((d) => !d.closed && d.name === "Research and Development");
  assert.equal(added.length, 1);
  assert.equal(added[0].code, "RND");
  assert.deepEqual(once.roles.find((r) => r.id === 11), { id: 11, member_id: 9, dept_id: added[0].id, division_id: null, title: "Head of R&D", started_at: "2025-10-01", type: "head" });
  assert.deepEqual(twice, once);
});

test("of two Head of R&D roles in no unit, only the oldest becomes the head", async () => {
  const { once, twice } = await migrate(`
    ${MEMBERS}
    insert into departments (id, name, code) values (8, 'Research and Development', 'RND');
    ${HEAD_OF_RD}
    insert into roles (id, member_id, title, started_at, type) values (12, 12, 'Head of R&D', '2024-10-01', 'core');
  `);
  const heads = once.roles.filter((r) => r.type === "head" && r.dept_id === 8);
  assert.deepEqual(heads.map((r) => r.id), [12]);
  assert.equal(once.roles.find((r) => r.id === 11)?.type, "core");
  assert.deepEqual(twice, once);
});

test("a database without the Head of R&D's role in no unit, the seeded one included, changes nothing", async () => {
  const { before, once } = await migrate(`
    ${MEMBERS}
    insert into departments (id, name, code) values (8, 'Research and Development', 'RND');
    insert into roles (id, member_id, dept_id, title, started_at, type) values (11, 9, 8, 'Head of R&D', '2025-10-01', 'head');
    insert into roles (id, member_id, title, started_at, type, full_access) values (13, 12, 'Head of R&D', '2025-10-01', 'core', 'chief_engineer');
  `);
  assert.deepEqual(once, before);
});
