// The preview build's database step (issue #307, ADR 0016). Every preview
// deployment reads one shared Neon branch named `preview`. Before
// `next build`, a Vercel preview build migrates the database it is given and
// then resets and re-seeds it; production and development builds, and a
// preview given no database, never touch a database here. The steps run
// against a target the seed guard approved, one build at a time: they hold
// one lock across the migration and the seed, and the seed itself is one
// transaction, so a second build that runs anyway cannot leave the branch
// half-seeded.

import type { SeedReport } from "./runner";
import { parseTarget, type ApprovedSeedTarget, type GuardVerdict } from "./target";

/** The variables the step reads. */
export type PreviewBuildEnv = {
  readonly VERCEL_ENV?: string;
  /** What the pages read: the pooled connection string. */
  readonly DATABASE_URL?: string;
  /** The direct connection string to the same database, which a lock needs. */
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
  if (direct && databaseOf(direct) !== databaseOf(pooled)) {
    return { kind: "refuse", why: "DATABASE_URL and DATABASE_URL_UNPOOLED name different databases" };
  }
  return { kind: "prepare", connectionString: direct ?? pooled };
}

/** The real work, behind seams the unit test replaces. */
export type PreviewBuildSteps = {
  /** The seed guard (./target.ts), run in this build's environment. */
  guard(connectionString: string): Promise<GuardVerdict>;
  /** Runs `work` while this build holds the one preview-seed lock on `target`; releases it however `work` ends. */
  exclusive<T>(target: ApprovedSeedTarget, work: () => Promise<T>): Promise<T>;
  migrate(target: ApprovedSeedTarget): Promise<void>;
  seed(target: ApprovedSeedTarget): Promise<SeedReport>;
};

export type PreviewBuildOutcome =
  | { readonly kind: "skipped"; readonly why: string }
  | { readonly kind: "refused"; readonly why: string }
  | { readonly kind: "seeded"; readonly report: SeedReport };

/**
 * Migrates, then resets and re-seeds, the preview's database. Nothing runs
 * unless the plan says prepare and the guard approves the exact target; the
 * migration and the seed run under one lock, in that order.
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
  const report = await steps.exclusive(target, async () => {
    await steps.migrate(target);
    return steps.seed(target);
  });
  return { kind: "seeded", report };
}
