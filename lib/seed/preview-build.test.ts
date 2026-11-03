import assert from "node:assert/strict";
import { test } from "node:test";
import {
  prepareBuildDatabase,
  previewBuildPlan,
  type BuildDatabaseSteps,
  type PreviewBuildEnv,
  type PreviewBuildSteps,
  type ProductionBuildSteps,
} from "./preview-build";
import { guardSeedTarget, PREVIEW_ENDPOINT } from "./target";

const POOLED = `postgresql://app@${PREVIEW_ENDPOINT}-pooler.eu-central-1.aws.neon.tech/neondb`;
const DIRECT = `postgresql://app@${PREVIEW_ENDPOINT}.eu-central-1.aws.neon.tech/neondb`;
const OTHER = "postgresql://app@ep-other-branch-999999.eu-central-1.aws.neon.tech/neondb";
const OTHER_POOLED = "postgresql://app@ep-other-branch-999999-pooler.eu-central-1.aws.neon.tech/neondb";

/**
 * Steps that record what ran, with a real one-at-a-time lock and the real
 * guard. The database starts empty unless `holdsData` is set, and a seed
 * fills it. `served` lists the re-seed requests the database already served.
 * `pending` lists the migrations a production database has not applied yet;
 * a production migration applies them all.
 */
function recorded(env: PreviewBuildEnv, { holdsData = false, served = [] as string[], pending = [] as string[] } = {}) {
  const events: string[] = [];
  let filled = holdsData;
  const ledger = new Set(served);
  let unapplied = [...pending];
  let held: Promise<void> = Promise.resolve();
  const pause = () => new Promise<void>((resolve) => setImmediate(resolve));
  async function exclusive<T>(work: () => Promise<T>): Promise<T> {
    const before = held;
    let release!: () => void;
    held = new Promise((resolve) => (release = resolve));
    await before;
    events.push("lock");
    try {
      return await work();
    } finally {
      events.push("unlock");
      release();
    }
  }
  const production: ProductionBuildSteps = {
    exclusive: (_database, work) => exclusive(work),
    migrate: async (database) => {
      events.push(`migrate ${database.kind}`);
      await pause();
      const applied = unapplied;
      unapplied = [];
      return applied;
    },
  };
  const preview: PreviewBuildSteps = {
    guard: async (url) => {
      events.push(`guard ${url}`);
      return guardSeedTarget(url, { VERCEL_ENV: env.VERCEL_ENV });
    },
    exclusive: (_target, work) => exclusive(work),
    migrate: async (target) => {
      events.push(`migrate ${target.label}`);
      await pause();
    },
    contents: async (target) => {
      const contents = filled ? "has-data" : "empty";
      events.push(`read ${target.label}: ${contents}`);
      await pause();
      return contents;
    },
    seed: async (target) => {
      events.push(`seed ${target.label}`);
      await pause();
      filled = true;
      return { target, modules: ["structure", "people"] };
    },
    served: async (target, request) => {
      const served = ledger.has(request.id);
      events.push(`read ${target.label}: ${request.id} ${served ? "served" : "not served"}`);
      await pause();
      return served;
    },
    reseed: async (target, request) => {
      events.push(`reseed ${target.label}: ${request.id}`);
      await pause();
      filled = true;
      ledger.add(request.id);
      return { target, modules: ["reseed", "structure", "people"] };
    },
  };
  const steps: BuildDatabaseSteps = { preview, production };
  return { events, steps };
}

test("development and local builds never touch a database", async () => {
  for (const VERCEL_ENV of ["development", undefined, ""]) {
    const env = { VERCEL_ENV, DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
    const { events, steps } = recorded(env, { pending: ["0076_team_page_layout"] });
    const outcome = await prepareBuildDatabase(env, steps);
    assert.equal(outcome.kind, "skipped", String(VERCEL_ENV));
    assert.deepEqual(events, [], String(VERCEL_ENV));
  }
});

// The production build migrates its database and does nothing else (issue #874, ADR 0020).

const PROD_POOLED = "postgresql://app@ep-production-main-123456-pooler.eu-central-1.aws.neon.tech/neondb";
const PROD_DIRECT = "postgresql://app@ep-production-main-123456.eu-central-1.aws.neon.tech/neondb";
const PRODUCTION = { VERCEL_ENV: "production", DATABASE_URL: PROD_POOLED, DATABASE_URL_UNPOOLED: PROD_DIRECT };

test("a production build migrates its database on the direct connection, under the lock, and never asks the guard, reads rows or seeds", async () => {
  assert.deepEqual(previewBuildPlan(PRODUCTION), {
    kind: "migrate-production",
    database: { kind: "production", connectionString: PROD_DIRECT },
  });
  for (const holdsData of [false, true]) {
    const { events, steps } = recorded(PRODUCTION, { holdsData, pending: ["0075_drop_members_email_alias", "0076_team_page_layout"] });
    const outcome = await prepareBuildDatabase(PRODUCTION, steps);
    assert.deepEqual(outcome, { kind: "production-migrated", applied: ["0075_drop_members_email_alias", "0076_team_page_layout"] }, String(holdsData));
    assert.deepEqual(events, ["lock", "migrate production", "unlock"], String(holdsData));
  }
});

test("a production build with nothing pending migrates and names no migration", async () => {
  const { events, steps } = recorded(PRODUCTION);
  assert.deepEqual(await prepareBuildDatabase(PRODUCTION, steps), { kind: "production-migrated", applied: [] });
  assert.deepEqual(events, ["lock", "migrate production", "unlock"]);
});

test("a production build with no direct string, or two strings naming different databases, is refused before any connection", async () => {
  for (const env of [
    { VERCEL_ENV: "production", DATABASE_URL: PROD_POOLED },
    { VERCEL_ENV: "production", DATABASE_URL: PROD_POOLED, DATABASE_URL_UNPOOLED: OTHER },
  ]) {
    assert.equal(previewBuildPlan(env).kind, "refuse", JSON.stringify(env));
    const { events, steps } = recorded(env);
    assert.equal((await prepareBuildDatabase(env, steps)).kind, "refused", JSON.stringify(env));
    assert.deepEqual(events, [], JSON.stringify(env));
  }
});

test("a production build with no database touches none", async () => {
  const env = { VERCEL_ENV: "production" };
  const { events, steps } = recorded(env);
  assert.equal((await prepareBuildDatabase(env, steps)).kind, "skipped");
  assert.deepEqual(events, []);
});

test("a failing production migration fails the step and releases the lock", async () => {
  const { events, steps } = recorded(PRODUCTION);
  steps.production.migrate = async () => {
    events.push("migrate failed");
    throw new Error("migration failed");
  };
  await assert.rejects(prepareBuildDatabase(PRODUCTION, steps), /migration failed/);
  assert.deepEqual(events, ["lock", "migrate failed", "unlock"]);
});

test("two concurrent production builds take turns, and only the first applies the pending migrations", async () => {
  const { events, steps } = recorded(PRODUCTION, { pending: ["0076_team_page_layout"] });
  const outcomes = await Promise.all([prepareBuildDatabase(PRODUCTION, steps), prepareBuildDatabase(PRODUCTION, steps)]);
  assert.deepEqual(outcomes, [
    { kind: "production-migrated", applied: ["0076_team_page_layout"] },
    { kind: "production-migrated", applied: [] },
  ]);
  assert.deepEqual(events, ["lock", "migrate production", "unlock", "lock", "migrate production", "unlock"]);
});

test("the seed guard still refuses every target on a production build", () => {
  for (const url of [PROD_DIRECT, DIRECT, POOLED, "postgres://dev@localhost/prt"]) {
    const verdict = guardSeedTarget(url, { VERCEL_ENV: "production" });
    assert.equal(verdict.ok, false, url);
    assert.equal(!verdict.ok && verdict.refusal.reason, "production", url);
  }
});

// Preview builds (issues #307, #465, #595): unchanged by the production step.

test("a preview with no database is skipped: the build step touches nothing", async () => {
  const env = { VERCEL_ENV: "preview" };
  const { events, steps } = recorded(env);
  assert.equal((await prepareBuildDatabase(env, steps)).kind, "skipped");
  assert.deepEqual(events, []);
});

test("an approved preview build always migrates first under the lock, whether the database is empty or not", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  for (const holdsData of [false, true]) {
    const { events, steps } = recorded(env, { holdsData });
    await prepareBuildDatabase(env, steps);
    assert.deepEqual(events.slice(0, 3), [`guard ${DIRECT}`, "lock", "migrate preview"], String(holdsData));
  }
});

test("an empty database is migrated, then seeded, under one lock", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  const outcome = await prepareBuildDatabase(env, steps);
  assert.equal(outcome.kind, "migrated-and-seeded");
  assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate preview", "read preview: empty", "seed preview", "unlock"]);
});

test("a build with no re-seed request migrates a database that holds data and never seeds or resets it, so what testers made stays", async () => {
  for (const PREVIEW_RESEED_REQUEST of [undefined, "", "  "]) {
    const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT, PREVIEW_RESEED_REQUEST };
    const { events, steps } = recorded(env, { holdsData: true });
    const outcome = await prepareBuildDatabase(env, steps);
    assert.deepEqual(outcome.kind === "migrated" && outcome.servedRequest, null, String(PREVIEW_RESEED_REQUEST));
    assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate preview", "read preview: has-data", "unlock"], String(PREVIEW_RESEED_REQUEST));
  }
});

test("a preview with no direct connection string is refused, so no lock is ever held through the pooler", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED };
  assert.equal(previewBuildPlan(env).kind, "refuse");
  const { events, steps } = recorded(env);
  assert.equal((await prepareBuildDatabase(env, steps)).kind, "refused");
  assert.deepEqual(events, []);
});

test("the lock, the migration and the seed all run on the direct connection string", () => {
  assert.deepEqual(previewBuildPlan({ VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT }), {
    kind: "prepare",
    connectionString: DIRECT,
    reseed: null,
  });
});

test("nothing runs when the guard refuses the target or the two strings name different databases", async () => {
  // Another endpoint, such as production's, given to a preview build by mistake.
  const production = { VERCEL_ENV: "preview", DATABASE_URL: OTHER_POOLED, DATABASE_URL_UNPOOLED: OTHER };
  const refusedByGuard = recorded(production);
  assert.equal((await prepareBuildDatabase(production, refusedByGuard.steps)).kind, "refused");
  assert.deepEqual(refusedByGuard.events, [`guard ${OTHER}`]);

  const mismatched = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: OTHER };
  const split = recorded(mismatched);
  assert.equal((await prepareBuildDatabase(mismatched, split.steps)).kind, "refused");
  assert.deepEqual(split.events, []);
});

test("the lock is released when the migration fails, and the seed does not run", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  steps.preview.migrate = async () => {
    events.push("migrate failed");
    throw new Error("migration failed");
  };
  await assert.rejects(prepareBuildDatabase(env, steps), /migration failed/);
  assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate failed", "unlock"]);
});

test("two concurrent preview builds take turns, never interleaved, and only the first seeds the empty database", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  const outcomes = await Promise.all([prepareBuildDatabase(env, steps), prepareBuildDatabase(env, steps)]);
  assert.deepEqual(outcomes.map((outcome) => outcome.kind), ["migrated-and-seeded", "migrated"]);
  const locked = events.filter((event) => !event.startsWith("guard"));
  assert.deepEqual(locked, [
    "lock", "migrate preview", "read preview: empty", "seed preview", "unlock",
    "lock", "migrate preview", "read preview: has-data", "unlock",
  ]);
});

// The re-seed the owner asks for with PREVIEW_RESEED_REQUEST (issue #595).

const RESEED = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT, PREVIEW_RESEED_REQUEST: "2026-10-25" };

test("a new re-seed request empties and re-seeds the preview branch once, after the migration, under the lock", async () => {
  for (const holdsData of [true, false]) {
    const { events, steps } = recorded(RESEED, { holdsData });
    const outcome = await prepareBuildDatabase(RESEED, steps);
    assert.equal(outcome.kind, "migrated-and-reseeded", String(holdsData));
    assert.equal(outcome.kind === "migrated-and-reseeded" && outcome.request.id, "2026-10-25");
    assert.deepEqual(events, [
      `guard ${DIRECT}`, "lock", "migrate preview", "read preview: 2026-10-25 not served", "reseed preview: 2026-10-25", "unlock",
    ], String(holdsData));
  }
});

test("a re-seed request the branch already served runs no second time, so every later build leaves the rows in place", async () => {
  const { events, steps } = recorded(RESEED, { holdsData: true, served: ["2026-10-25"] });
  const outcome = await prepareBuildDatabase(RESEED, steps);
  assert.equal(outcome.kind, "migrated");
  assert.equal(outcome.kind === "migrated" && outcome.servedRequest?.id, "2026-10-25");
  assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate preview", "read preview: 2026-10-25 served", "read preview: has-data", "unlock"]);
});

test("two builds carrying one request take turns, and only the first re-seeds", async () => {
  const { events, steps } = recorded(RESEED, { holdsData: true });
  const outcomes = await Promise.all([prepareBuildDatabase(RESEED, steps), prepareBuildDatabase(RESEED, steps)]);
  assert.deepEqual(outcomes.map((outcome) => outcome.kind), ["migrated-and-reseeded", "migrated"]);
  assert.equal(events.filter((event) => event.startsWith("reseed")).length, 1);
});

test("the re-seed never runs on production: a production build only migrates, whatever it carries", async () => {
  const env = { ...RESEED, VERCEL_ENV: "production" };
  const { events, steps } = recorded(env, { holdsData: true });
  assert.equal((await prepareBuildDatabase(env, steps)).kind, "production-migrated");
  assert.deepEqual(events, ["lock", "migrate production", "unlock"]);
});

test("the re-seed is refused for any endpoint but the preview branch's, production's among them, and for a local database", async () => {
  for (const [name, direct, pooled] of [
    ["another Neon endpoint", OTHER, OTHER_POOLED],
    ["a local database", "postgres://dev@localhost/prt", "postgres://dev@localhost/prt"],
  ] as const) {
    const env = { ...RESEED, DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct };
    const { events, steps } = recorded(env, { holdsData: true });
    const outcome = await prepareBuildDatabase(env, steps);
    assert.equal(outcome.kind, "refused", name);
    assert.deepEqual(events, [`guard ${direct}`], name);
  }
});

test("a request value the build cannot read is refused before any connection", async () => {
  for (const PREVIEW_RESEED_REQUEST of ["yes please", "-x", "a".repeat(65), "x;drop"]) {
    const env = { ...RESEED, PREVIEW_RESEED_REQUEST };
    assert.equal(previewBuildPlan(env).kind, "refuse", PREVIEW_RESEED_REQUEST);
    const { events, steps } = recorded(env);
    assert.equal((await prepareBuildDatabase(env, steps)).kind, "refused", PREVIEW_RESEED_REQUEST);
    assert.deepEqual(events, [], PREVIEW_RESEED_REQUEST);
  }
});
