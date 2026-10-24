import assert from "node:assert/strict";
import { test } from "node:test";
import { preparePreviewDatabase, previewBuildPlan, type PreviewBuildEnv, type PreviewBuildSteps } from "./preview-build";
import { guardSeedTarget, PREVIEW_ENDPOINT } from "./target";

const POOLED = `postgresql://app@${PREVIEW_ENDPOINT}-pooler.eu-central-1.aws.neon.tech/neondb`;
const DIRECT = `postgresql://app@${PREVIEW_ENDPOINT}.eu-central-1.aws.neon.tech/neondb`;
const OTHER = "postgresql://app@ep-other-branch-999999.eu-central-1.aws.neon.tech/neondb";
const OTHER_POOLED = "postgresql://app@ep-other-branch-999999-pooler.eu-central-1.aws.neon.tech/neondb";

/**
 * Steps that record what ran, with a real one-at-a-time lock and the real
 * guard. The database starts empty unless `holdsData` is set, and a seed
 * fills it. `served` lists the re-seed requests the database already served.
 */
function recorded(env: PreviewBuildEnv, { holdsData = false, served = [] as string[] } = {}) {
  const events: string[] = [];
  let filled = holdsData;
  const ledger = new Set(served);
  let held: Promise<void> = Promise.resolve();
  const pause = () => new Promise<void>((resolve) => setImmediate(resolve));
  const steps: PreviewBuildSteps = {
    guard: async (url) => {
      events.push(`guard ${url}`);
      return guardSeedTarget(url, { VERCEL_ENV: env.VERCEL_ENV });
    },
    async exclusive(_target, work) {
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
    },
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
  return { events, steps };
}

test("production and development builds never touch a database", async () => {
  for (const VERCEL_ENV of ["production", "development", undefined, ""]) {
    const env = { VERCEL_ENV, DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
    const { events, steps } = recorded(env);
    const outcome = await preparePreviewDatabase(env, steps);
    assert.equal(outcome.kind, "skipped", String(VERCEL_ENV));
    assert.deepEqual(events, [], String(VERCEL_ENV));
  }
});

test("a preview with no database is skipped, so its pages fall back to the dummy arrays", async () => {
  const env = { VERCEL_ENV: "preview" };
  const { events, steps } = recorded(env);
  assert.equal((await preparePreviewDatabase(env, steps)).kind, "skipped");
  assert.deepEqual(events, []);
});

test("an approved preview build always migrates first under the lock, whether the database is empty or not", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  for (const holdsData of [false, true]) {
    const { events, steps } = recorded(env, { holdsData });
    await preparePreviewDatabase(env, steps);
    assert.deepEqual(events.slice(0, 3), [`guard ${DIRECT}`, "lock", "migrate preview"], String(holdsData));
  }
});

test("an empty database is migrated, then seeded, under one lock", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  const outcome = await preparePreviewDatabase(env, steps);
  assert.equal(outcome.kind, "migrated-and-seeded");
  assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate preview", "read preview: empty", "seed preview", "unlock"]);
});

test("a build with no re-seed request migrates a database that holds data and never seeds or resets it, so what testers made stays", async () => {
  for (const PREVIEW_RESEED_REQUEST of [undefined, "", "  "]) {
    const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT, PREVIEW_RESEED_REQUEST };
    const { events, steps } = recorded(env, { holdsData: true });
    const outcome = await preparePreviewDatabase(env, steps);
    assert.deepEqual(outcome.kind === "migrated" && outcome.servedRequest, null, String(PREVIEW_RESEED_REQUEST));
    assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate preview", "read preview: has-data", "unlock"], String(PREVIEW_RESEED_REQUEST));
  }
});

test("a preview with no direct connection string is refused, so no lock is ever held through the pooler", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED };
  assert.equal(previewBuildPlan(env).kind, "refuse");
  const { events, steps } = recorded(env);
  assert.equal((await preparePreviewDatabase(env, steps)).kind, "refused");
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
  assert.equal((await preparePreviewDatabase(production, refusedByGuard.steps)).kind, "refused");
  assert.deepEqual(refusedByGuard.events, [`guard ${OTHER}`]);

  const mismatched = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: OTHER };
  const split = recorded(mismatched);
  assert.equal((await preparePreviewDatabase(mismatched, split.steps)).kind, "refused");
  assert.deepEqual(split.events, []);
});

test("the lock is released when the migration fails, and the seed does not run", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  steps.migrate = async () => {
    events.push("migrate failed");
    throw new Error("migration failed");
  };
  await assert.rejects(preparePreviewDatabase(env, steps), /migration failed/);
  assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate failed", "unlock"]);
});

test("two concurrent preview builds take turns, never interleaved, and only the first seeds the empty database", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  const outcomes = await Promise.all([preparePreviewDatabase(env, steps), preparePreviewDatabase(env, steps)]);
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
    const outcome = await preparePreviewDatabase(RESEED, steps);
    assert.equal(outcome.kind, "migrated-and-reseeded", String(holdsData));
    assert.equal(outcome.kind === "migrated-and-reseeded" && outcome.request.id, "2026-10-25");
    assert.deepEqual(events, [
      `guard ${DIRECT}`, "lock", "migrate preview", "read preview: 2026-10-25 not served", "reseed preview: 2026-10-25", "unlock",
    ], String(holdsData));
  }
});

test("a re-seed request the branch already served runs no second time, so every later build leaves the rows in place", async () => {
  const { events, steps } = recorded(RESEED, { holdsData: true, served: ["2026-10-25"] });
  const outcome = await preparePreviewDatabase(RESEED, steps);
  assert.equal(outcome.kind, "migrated");
  assert.equal(outcome.kind === "migrated" && outcome.servedRequest?.id, "2026-10-25");
  assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate preview", "read preview: 2026-10-25 served", "read preview: has-data", "unlock"]);
});

test("two builds carrying one request take turns, and only the first re-seeds", async () => {
  const { events, steps } = recorded(RESEED, { holdsData: true });
  const outcomes = await Promise.all([preparePreviewDatabase(RESEED, steps), preparePreviewDatabase(RESEED, steps)]);
  assert.deepEqual(outcomes.map((outcome) => outcome.kind), ["migrated-and-reseeded", "migrated"]);
  assert.equal(events.filter((event) => event.startsWith("reseed")).length, 1);
});

test("the re-seed is refused for production: a production build touches no database, whatever it carries", async () => {
  const env = { ...RESEED, VERCEL_ENV: "production" };
  const { events, steps } = recorded(env);
  assert.equal((await preparePreviewDatabase(env, steps)).kind, "skipped");
  assert.deepEqual(events, []);
});

test("the re-seed is refused for any endpoint but the preview branch's, production's among them, and for a local database", async () => {
  for (const [name, direct, pooled] of [
    ["another Neon endpoint", OTHER, OTHER_POOLED],
    ["a local database", "postgres://dev@localhost/prt", "postgres://dev@localhost/prt"],
  ] as const) {
    const env = { ...RESEED, DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct };
    const { events, steps } = recorded(env, { holdsData: true });
    const outcome = await preparePreviewDatabase(env, steps);
    assert.equal(outcome.kind, "refused", name);
    assert.deepEqual(events, [`guard ${direct}`], name);
  }
});

test("a request value the build cannot read is refused before any connection", async () => {
  for (const PREVIEW_RESEED_REQUEST of ["yes please", "-x", "a".repeat(65), "x;drop"]) {
    const env = { ...RESEED, PREVIEW_RESEED_REQUEST };
    assert.equal(previewBuildPlan(env).kind, "refuse", PREVIEW_RESEED_REQUEST);
    const { events, steps } = recorded(env);
    assert.equal((await preparePreviewDatabase(env, steps)).kind, "refused", PREVIEW_RESEED_REQUEST);
    assert.deepEqual(events, [], PREVIEW_RESEED_REQUEST);
  }
});
