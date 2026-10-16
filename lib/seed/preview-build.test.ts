import assert from "node:assert/strict";
import { test } from "node:test";
import { preparePreviewDatabase, previewBuildPlan, type PreviewBuildEnv, type PreviewBuildSteps } from "./preview-build";
import { guardSeedTarget, type NeonBranchFacts } from "./target";

const POOLED = "postgresql://app@ep-cool-darkness-123456-pooler.eu-central-1.aws.neon.tech/neondb";
const DIRECT = "postgresql://app@ep-cool-darkness-123456.eu-central-1.aws.neon.tech/neondb";
const OTHER = "postgresql://app@ep-other-branch-999999.eu-central-1.aws.neon.tech/neondb";
const SHARED: NeonBranchFacts = { name: "preview", isDefault: false, isProtected: false };

/** Steps that record what ran, with a real one-at-a-time lock and the real guard over a fixed Neon branch. */
function recorded(env: PreviewBuildEnv, branch: NeonBranchFacts | null = SHARED) {
  const events: string[] = [];
  let held: Promise<void> = Promise.resolve();
  const pause = () => new Promise<void>((resolve) => setImmediate(resolve));
  const steps: PreviewBuildSteps = {
    guard: async (url) => {
      events.push(`guard ${url}`);
      // null: Neon could not be read.
      return guardSeedTarget(url, async () => branch ?? undefined, { VERCEL_ENV: env.VERCEL_ENV });
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
    seed: async (target) => {
      events.push(`seed ${target.label}`);
      await pause();
      return { target, modules: ["structure", "people"] };
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

test("a preview build migrates, then resets and re-seeds, the database it is given, under one lock", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  const outcome = await preparePreviewDatabase(env, steps);
  assert.equal(outcome.kind, "seeded");
  assert.deepEqual(events, [`guard ${DIRECT}`, "lock", "migrate preview", "seed preview", "unlock"]);
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
  });
});

test("nothing runs when the guard refuses the target or the two strings name different databases", async () => {
  const production = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const refusedByGuard = recorded(production, { name: "main", isDefault: true, isProtected: false });
  assert.equal((await preparePreviewDatabase(production, refusedByGuard.steps)).kind, "refused");
  assert.deepEqual(refusedByGuard.events, [`guard ${DIRECT}`]);

  const unread = recorded(production, null);
  assert.equal((await preparePreviewDatabase(production, unread.steps)).kind, "refused");
  assert.deepEqual(unread.events, [`guard ${DIRECT}`]);

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

test("two concurrent preview builds migrate and seed one after the other, never interleaved", async () => {
  const env = { VERCEL_ENV: "preview", DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT };
  const { events, steps } = recorded(env);
  const outcomes = await Promise.all([preparePreviewDatabase(env, steps), preparePreviewDatabase(env, steps)]);
  assert.deepEqual(outcomes.map((outcome) => outcome.kind), ["seeded", "seeded"]);
  const locked = events.filter((event) => !event.startsWith("guard"));
  assert.deepEqual(locked, [
    "lock", "migrate preview", "seed preview", "unlock",
    "lock", "migrate preview", "seed preview", "unlock",
  ]);
});
