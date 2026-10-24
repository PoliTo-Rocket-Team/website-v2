import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import { DRIZZLE_MAPPED_TYPES } from "../../db/seed/connection";
import { SEED_MODULES } from "../../db/seed/registry";
import type { TableSeed } from "../../db/seed/rows";
import { TESTERS } from "../dev-tester";
import {
  RESEED_LEDGER_TABLE,
  RESEED_RECORD,
  RESEED_SERVED,
  RESEED_WIPE,
  ReseedRequest,
  reseedVerdictOf,
  runReseed,
  type RunStatement,
} from "./reseed";
import { runSeed, type SeedConnection, type SeedModule } from "./runner";
import { guardSeedTarget, PREVIEW_ENDPOINT, type ApprovedSeedTarget } from "./target";

// The on-demand re-seed of the shared `preview` branch (issue #595).

const DIRECT = `postgresql://app:secret@${PREVIEW_ENDPOINT}.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require`;
const POOLED = `postgresql://app:secret@${PREVIEW_ENDPOINT}-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require`;
/** Another Neon endpoint in the same region: production's, or any other branch's. */
const OTHER = "postgresql://app:secret@ep-cool-darkness-123456-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const OTHER_DIRECT = "postgresql://app:secret@ep-cool-darkness-123456.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const LOCAL = "postgres://dev@localhost:5432/prt";

function request(id: string): ReseedRequest {
  const read = ReseedRequest.read(id);
  assert.equal(read.kind, "requested", id);
  return read.kind === "requested" ? read.request : (undefined as never);
}

/** The re-seed's target, the one way the build gets it: the seed guard's verdict, narrowed. */
function reseedTarget(url: string, VERCEL_ENV: string | undefined) {
  return reseedVerdictOf(guardSeedTarget(url, { VERCEL_ENV }));
}

// What a run sends, through a connection that records instead of writing.
type Sent = { readonly sql: string; readonly params: readonly unknown[] };
type FakeTx = { readonly sent: Sent[] };
const recordRun: RunStatement<FakeTx> = async (tx, sql, params) => {
  tx.sent.push({ sql, params: [...params] });
};
function recordingModule(name: string): SeedModule<FakeTx> {
  return {
    name,
    reset: (tx) => recordRun(tx, `reset ${name}`, []),
    insert: (tx) => recordRun(tx, `insert ${name}`, []),
  };
}

test("the re-seed runs against the preview branch's endpoint, by its direct and its pooled host, with the target the seed guard approved", async () => {
  for (const url of [DIRECT, POOLED]) {
    const verdict = reseedTarget(url, "preview");
    assert.ok(verdict.ok, url);
    assert.equal(verdict.target.kind, "preview");
    assert.equal(verdict.target.connectionString, url);
    const connected: string[] = [];
    const sent: Sent[] = [];
    const report = await runReseed(verdict.target, request("2026-10-25"), [recordingModule("structure"), recordingModule("audit")], recordRun, (cs) => {
      connected.push(cs);
      return { transaction: (work) => work({ sent }), close: async () => {} };
    });
    assert.deepEqual(connected, [url]);
    assert.equal(report.target, verdict.target);
    // Every module's own reset, then the wipe, then the record, then every module's rows: one transaction.
    assert.deepEqual(sent, [
      { sql: "reset audit", params: [] },
      { sql: "reset structure", params: [] },
      { sql: RESEED_WIPE, params: [] },
      { sql: RESEED_RECORD, params: ["2026-10-25"] },
      { sql: "insert structure", params: [] },
      { sql: "insert audit", params: [] },
    ]);
  }
});

test("the re-seed is refused for a production build, for any other Neon endpoint, and for a local database", () => {
  for (const url of [DIRECT, POOLED, OTHER, LOCAL]) {
    const verdict = reseedTarget(url, "production");
    assert.equal(verdict.ok, false, `VERCEL_ENV=production: ${url}`);
    assert.match(verdict.ok ? "" : verdict.why, /\(production\)/);
  }
  for (const VERCEL_ENV of ["preview", undefined, "development"]) {
    for (const url of [OTHER, OTHER_DIRECT, `postgresql://app@${PREVIEW_ENDPOINT}x.c-2.eu-central-1.aws.neon.tech/neondb`]) {
      const verdict = reseedTarget(url, VERCEL_ENV);
      assert.equal(verdict.ok, false, `${url} on ${VERCEL_ENV}`);
      assert.match(verdict.ok ? "" : verdict.why, /unproven-preview/);
    }
  }
  // The preview branch from a laptop: the guard lets it through on a preview build only.
  assert.equal(reseedTarget(DIRECT, undefined).ok, false);
  // A local database passes the seed guard, and the re-seed still refuses it.
  const local = reseedTarget(LOCAL, "preview");
  assert.equal(local.ok, false);
  assert.match(local.ok ? "" : local.why, /only the "preview" branch/);
});

test("the re-seed throws before connecting when handed any target but the preview branch's", async () => {
  const verdict = guardSeedTarget(LOCAL);
  assert.ok(verdict.ok);
  let connected = false;
  await assert.rejects(
    runReseed(verdict.target, request("x"), [], recordRun, () => {
      connected = true;
      throw new Error("connected");
    }),
    /only the "preview" branch/,
  );
  assert.equal(connected, false);
});

test("a request names one re-seed by a short typed value, and an unset or blank one asks for none", () => {
  assert.deepEqual(ReseedRequest.read(undefined), { kind: "none" });
  assert.deepEqual(ReseedRequest.read("   "), { kind: "none" });
  assert.equal(request(" 2026-10-25.2 ").id, "2026-10-25.2");
  for (const bad of ["two words", "'; drop table logs; --", "-leading", "a".repeat(65)]) assert.equal(ReseedRequest.read(bad).kind, "invalid", bad);
});

// Nothing on the re-seed path calls a Neon API: it imports only the database
// driver, drizzle's migrator and the private file store, and names no Neon
// API host, client or branch operation.

const root = join(__dirname, "..", "..");
const RESEED_PATH = [
  "db/preview-build.ts",
  "db/seed/connection.ts",
  "db/seed/rows.ts",
  "db/seed/registry.ts",
  "lib/seed/preview-build.ts",
  "lib/seed/reseed.ts",
  "lib/seed/runner.ts",
  "lib/seed/target.ts",
];
const ALLOWED_PACKAGES = ["postgres", "drizzle-orm", "drizzle-orm/postgres-js", "drizzle-orm/postgres-js/migrator", "drizzle-orm/pg-core"];
const NEON_API = /neon\.tech\/api|console\.neon\.tech|@neondatabase\/api-client|neonctl|\bbranches\b|reset[_ -]?(?:from|to)[_ -]?parent|restore_branch/i;

test("nothing on the re-seed path calls a Neon reset or branch API", () => {
  for (const file of RESEED_PATH) {
    const source = readFileSync(join(root, file), "utf8");
    const imports = [...source.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map(([, from]) => from);
    for (const from of imports) {
      const local = from.startsWith(".") || from.startsWith("@/");
      assert.ok(local || ALLOWED_PACKAGES.includes(from), `${file} imports ${from}`);
      assert.ok(!from.includes("neon"), `${file} imports ${from}`);
    }
    const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(code, NEON_API, file);
  }
});

// The re-seed on a real Postgres (PGlite), built from every journaled
// migration: a branch that holds test writes, sign-ins and audit rows comes
// out holding only the dummy set.

const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };

async function migrated(): Promise<PGlite> {
  const db = new PGlite();
  for (const { tag } of journal.entries) {
    const sql = readFileSync(join(root, "drizzle", `${tag}.sql`), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) if (statement.trim()) await db.exec(statement);
  }
  return db;
}

// The seed sends values drizzle already mapped, as db/seed/connection.ts does for postgres-js.
const AS_SENT = Object.fromEntries(DRIZZLE_MAPPED_TYPES.map((type) => [type, (value: unknown) => String(value)]));
const runOnPglite: RunStatement<Transaction> = async (tx, sql, params) => {
  await tx.query(sql, [...params], { serializers: AS_SENT });
};
const SEED_ON_PGLITE: readonly SeedModule<Transaction>[] = SEED_MODULES.map((module) => ({
  name: module.name,
  reset: (tx) => (module as unknown as SeedModule<{ unsafe(sql: string, params?: unknown[]): Promise<unknown> }>).reset(adapter(tx)),
  insert: (tx) => (module as unknown as SeedModule<{ unsafe(sql: string, params?: unknown[]): Promise<unknown> }>).insert(adapter(tx)),
}));
function adapter(tx: Transaction) {
  return { unsafe: (sql: string, params: unknown[] = []) => runOnPglite(tx, sql, params) };
}
function onPglite(db: PGlite): (url: string) => SeedConnection<Transaction> {
  return () => ({ transaction: async (work) => void (await db.transaction(work)), close: async () => {} });
}

/** Every table of the two schemas the re-seed empties, with its row count. */
async function rowCounts(db: PGlite): Promise<Record<string, number>> {
  const tables = await db.query<{ name: string }>(
    "select format('%I.%I', schemaname, tablename) as name from pg_tables where schemaname in ('public', 'better_auth') order by 1",
  );
  const counts: Record<string, number> = {};
  for (const { name } of tables.rows) counts[name] = (await db.query<{ n: number }>(`select count(*)::int as n from ${name}`)).rows[0].n;
  return counts;
}

/** What the dummy set holds per table: the rows the seed modules list, and nothing anywhere else. */
function dummySetCounts(tables: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(tables.map((name) => [name, 0]));
  for (const module of SEED_MODULES) {
    if (!("seed" in module)) continue;
    for (const set of (module.seed as TableSeed).rows) {
      const { name, schema } = getTableConfig(set.table as PgTable);
      const key = `${schema ?? "public"}.${name === "user" ? '"user"' : name}`;
      counts[key] = (counts[key] ?? 0) + set.rows.length;
    }
  }
  return counts;
}

test("after a re-seed the branch holds only the dummy set, even in tables no seed module owns, and the ledger holds the request", async () => {
  const db = await migrated();
  const preview = reseedTarget(DIRECT, "preview");
  assert.ok(preview.ok);
  const target: ApprovedSeedTarget = preview.target;
  await runSeed(target, SEED_ON_PGLITE, onPglite(db));

  // What previews leave behind: a grant given through the Access page, its
  // audit row, a team join and a leave, a real person's sign-in with a
  // session, and the summit rows an import migration carried in.
  const member = TESTERS.member.id;
  await db.exec(`
    insert into scopes (member_id, scope, target, access_level) values (901, 'org', 'members', 'edit');
    insert into logs (schema_name, table_name, operation, record_id, changed_by) values ('public', 'scopes', 'INSERT', '99', '${member}');
    insert into team_leaves (member_id, reason) values (901, 'test write');
    insert into users (id, email) values ('added:test', 'someone@example.com');
    insert into team_joins (user_id, division_id) values ('added:test', 1);
    insert into better_auth."user" (id, name, email, "emailVerified") values ('real-account', 'Someone', 'someone.real@example.com', true);
    insert into better_auth.session (id, "expiresAt", token, "updatedAt", "userId") values ('s1', now() + interval '1 day', 't1', now(), 'real-account');
    insert into better_auth.verification (id, identifier, value, "expiresAt") values ('v1', 'someone', 'x', now() + interval '1 day');
  `);
  const dirty = await rowCounts(db);
  for (const table of ["public.logs", "public.team_leaves", "public.team_joins", "public.outreach_summit_versions", "better_auth.session", "better_auth.verification"]) {
    assert.ok(dirty[table] > 0, `${table} holds rows before the re-seed`);
  }

  await runReseed(target, request("2026-10-25"), SEED_ON_PGLITE, runOnPglite, onPglite(db));

  const after = await rowCounts(db);
  const expected: Record<string, number> = { ...dummySetCounts(Object.keys(after)), [`public.${RESEED_LEDGER_TABLE}`]: 1 };
  assert.deepEqual(after, expected);
  assert.equal(after["public.logs"], 0, "the audit table is empty");
  const served = await db.query<{ served: boolean }>(RESEED_SERVED, ["2026-10-25"]);
  assert.equal(served.rows[0].served, true);

  // Ids restart, so the app's next insert takes the id after the seeded ones.
  const [{ id }] = (await db.query<{ id: number }>("insert into team_leaves (member_id) values (901) returning id")).rows;
  assert.equal(id, 1);
});

test("a second request re-seeds again and keeps the first in the ledger; drizzle's own migration journal is never touched", async () => {
  const db = await migrated();
  // Where drizzle's migrator keeps its journal on a real branch.
  await db.exec(`create schema drizzle; create table drizzle.__drizzle_migrations (id serial primary key, hash text not null); insert into drizzle.__drizzle_migrations (hash) values ('h');`);
  const preview = reseedTarget(POOLED, "preview");
  assert.ok(preview.ok);
  await runReseed(preview.target, request("first"), SEED_ON_PGLITE, runOnPglite, onPglite(db));
  const once = await rowCounts(db);
  await runReseed(preview.target, request("second"), SEED_ON_PGLITE, runOnPglite, onPglite(db));
  const twice = await rowCounts(db);
  assert.deepEqual(twice, { ...once, [`public.${RESEED_LEDGER_TABLE}`]: 2 });
  const ledger = await db.query<{ request: string }>(`select request from ${RESEED_LEDGER_TABLE} order by request`);
  assert.deepEqual(ledger.rows.map((r) => r.request), ["first", "second"]);
  const journaled = await db.query<{ n: number }>("select count(*)::int as n from drizzle.__drizzle_migrations");
  assert.equal(journaled.rows[0].n, 1);
});
