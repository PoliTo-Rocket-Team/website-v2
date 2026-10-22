// The preview build's database step (issue #307, ADR 0016). Every preview
// deployment reads one shared Neon branch named `preview`. Before
// `next build`, a Vercel preview build migrates the database it is given and
// seeds it only when it is still empty; it never resets it, so what testers
// make on a preview lasts across preview builds (issue #465, ADR 0016
// amendment of 2026-10-21). Production and development builds, and a preview
// given no database, never touch a database here. The steps run against a
// target the seed guard approved, one build at a time: they hold one lock
// across the migration, the emptiness read and the seed, and the seed itself
// is one transaction, so a second build that runs anyway cannot leave the
// branch half-seeded.

import type { SeedReport } from "./runner";
import { parseTarget, type ApprovedSeedTarget, type GuardVerdict } from "./target";

/** The variables the step reads. */
export type PreviewBuildEnv = {
  readonly VERCEL_ENV?: string;
  /** What the pages read: the pooled connection string. */
  readonly DATABASE_URL?: string;
  /** The direct connection string to the same database. The lock, the migration and the seed all run on it (ADR 0016). */
  readonly DATABASE_URL_UNPOOLED?: string;
};

/** What this build does with its database, decided from the environment alone. */
export type PreviewBuildPlan =
  | { readonly kind: "skip"; readonly why: string }
  | { readonly kind: "refuse"; readonly why: string }
  | { readonly kind: "prepare"; readonly connectionString: string };

/** The database a connection string names: the Neon endpoint, or the host. */
function databaseOf(connectionString: string): string {
  const target = parseTarget(connectionString);
  switch (target.kind) {
    case "neon":
      return `neon ${target.endpointId}`;
    case "local":
      return `local ${target.host}`;
    case "unclassifiable":
      return `unclassifiable ${connectionString}`;
  }
}

export function previewBuildPlan(env: PreviewBuildEnv): PreviewBuildPlan {
  if (env.VERCEL_ENV !== "preview") {
    return { kind: "skip", why: `not a Vercel preview build (VERCEL_ENV is ${env.VERCEL_ENV ? `"${env.VERCEL_ENV}"` : "not set"})` };
  }
  const pooled = env.DATABASE_URL || undefined;
  const direct = env.DATABASE_URL_UNPOOLED || undefined;
  if (!pooled) {
    return { kind: "skip", why: "this preview has no DATABASE_URL, so its pages read the dummy arrays" };
  }
  if (!direct) {
    // The lock is a session lock. Through Neon's pooler the lock and the
    // unlock can land on different server connections, so the lock could stay
    // held and stall every later preview build. Refuse rather than lock there.
    return {
      kind: "refuse",
      why: "this preview has a DATABASE_URL but no DATABASE_URL_UNPOOLED, and the seed lock is held only on a direct connection",
    };
  }
  if (databaseOf(direct) !== databaseOf(pooled)) {
    return { kind: "refuse", why: "DATABASE_URL and DATABASE_URL_UNPOOLED name different databases" };
  }
  return { kind: "prepare", connectionString: direct };
}

/** The real work, behind seams the unit test replaces. */
export type PreviewBuildSteps = {
  /** The seed guard (./target.ts), run in this build's environment. */
  guard(connectionString: string): Promise<GuardVerdict>;
  /** Runs `work` while this build holds the one preview-seed lock on `target`; releases it however `work` ends. */
  exclusive<T>(target: ApprovedSeedTarget, work: () => Promise<T>): Promise<T>;
  migrate(target: ApprovedSeedTarget): Promise<void>;
  /** Reads, and never writes, whether `target` holds no seeded rows yet. */
  contents(target: ApprovedSeedTarget): Promise<PreviewDatabaseContents>;
  seed(target: ApprovedSeedTarget): Promise<SeedReport>;
};

/** What the emptiness read found: a database the seed never filled, or one that holds rows. */
export type PreviewDatabaseContents = "empty" | "has-data";

export type PreviewBuildOutcome =
  | { readonly kind: "skipped"; readonly why: string }
  | { readonly kind: "refused"; readonly why: string }
  /** The database was empty: it was migrated, then seeded. */
  | { readonly kind: "migrated-and-seeded"; readonly report: SeedReport }
  /** The database already held rows: it was migrated and its rows were left as they were. */
  | { readonly kind: "migrated"; readonly target: ApprovedSeedTarget };

/**
 * Migrates the preview's database, then seeds it only when it is empty. It
 * never resets it. Nothing runs unless the plan says prepare and the guard
 * approves the exact target; the migration, the emptiness read and the seed
 * run under one lock, in that order.
 */
export async function preparePreviewDatabase(env: PreviewBuildEnv, steps: PreviewBuildSteps): Promise<PreviewBuildOutcome> {
  const plan = previewBuildPlan(env);
  if (plan.kind === "skip") return { kind: "skipped", why: plan.why };
  if (plan.kind === "refuse") return { kind: "refused", why: plan.why };
  const verdict = await steps.guard(plan.connectionString);
  if (!verdict.ok) {
    return { kind: "refused", why: `the seed guard refused (${verdict.refusal.reason}): ${verdict.refusal.detail}` };
  }
  const { target } = verdict;
  return steps.exclusive(target, async (): Promise<PreviewBuildOutcome> => {
    await steps.migrate(target);
    if ((await steps.contents(target)) === "has-data") return { kind: "migrated", target };
    return { kind: "migrated-and-seeded", report: await steps.seed(target) };
  });
}
