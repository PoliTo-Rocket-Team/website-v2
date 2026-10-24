// The preview build's database step (issue #307, ADR 0016). Every preview
// deployment reads one shared Neon branch named `preview`. Before
// `next build`, a Vercel preview build migrates the database it is given and
// seeds it only when it is still empty; an ordinary build never resets it, so
// what testers make on a preview lasts across preview builds (issue #465, ADR
// 0016 amendment of 2026-10-21). The one exception is a re-seed the owner
// asked for with `PREVIEW_RESEED_REQUEST` (issue #595, ./reseed.ts): the
// first build that sees a value the branch has not served yet empties the
// branch and seeds it again, and records the value so no later build repeats
// it. Production and development builds, and a preview given no database,
// never touch a database here. The steps run against a target the seed guard
// approved, one build at a time: they hold one lock across the migration, the
// reads and the seed, and each seed is one transaction, so a second build
// that runs anyway cannot leave the branch half-seeded.

import { RESEED_REQUEST_VARIABLE, ReseedRequest, reseedVerdictOf } from "./reseed";
import type { SeedReport } from "./runner";
import { parseTarget, type ApprovedSeedTarget, type GuardVerdict } from "./target";

/** The variables the step reads. */
export type PreviewBuildEnv = {
  readonly VERCEL_ENV?: string;
  /** What the pages read: the pooled connection string. */
  readonly DATABASE_URL?: string;
  /** The direct connection string to the same database. The lock, the migration and the seed all run on it (ADR 0016). */
  readonly DATABASE_URL_UNPOOLED?: string;
  /** A new value asks for one re-seed of the `preview` branch (./reseed.ts); unset or a served value asks for none. */
  readonly PREVIEW_RESEED_REQUEST?: string;
};

/** What this build does with its database, decided from the environment alone. */
export type PreviewBuildPlan =
  | { readonly kind: "skip"; readonly why: string }
  | { readonly kind: "refuse"; readonly why: string }
  | { readonly kind: "prepare"; readonly connectionString: string; readonly reseed: ReseedRequest | null };

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
    return { kind: "skip", why: "this preview has no DATABASE_URL, so its pages stop at their first database read (lib/database-required.ts)" };
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
  const reseed = ReseedRequest.read(env.PREVIEW_RESEED_REQUEST);
  if (reseed.kind === "invalid") return { kind: "refuse", why: reseed.why };
  return { kind: "prepare", connectionString: direct, reseed: reseed.kind === "requested" ? reseed.request : null };
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
  /** Reads, and never writes, whether `target` already served `request`. */
  served(target: ApprovedSeedTarget, request: ReseedRequest): Promise<boolean>;
  /** Empties `target`, seeds it and records `request`, in one transaction (./reseed.ts). */
  reseed(target: ApprovedSeedTarget, request: ReseedRequest): Promise<SeedReport>;
};

/** What the emptiness read found: a database the seed never filled, or one that holds rows. */
export type PreviewDatabaseContents = "empty" | "has-data";

export type PreviewBuildOutcome =
  | { readonly kind: "skipped"; readonly why: string }
  | { readonly kind: "refused"; readonly why: string }
  /** The database was empty: it was migrated, then seeded. */
  | { readonly kind: "migrated-and-seeded"; readonly report: SeedReport }
  /** The owner asked for a re-seed the branch had not served: it was migrated, emptied and seeded. */
  | { readonly kind: "migrated-and-reseeded"; readonly report: SeedReport; readonly request: ReseedRequest }
  /**
   * The database already held rows: it was migrated and its rows were left
   * as they were. `servedRequest` is the re-seed request this build carried
   * and an earlier build already served, or null when it carried none.
   */
  | { readonly kind: "migrated"; readonly target: ApprovedSeedTarget; readonly servedRequest: ReseedRequest | null };

/**
 * Migrates the preview's database, then re-seeds it when the owner asked for
 * a re-seed it has not served, else seeds it only when it is empty. Nothing
 * runs unless the plan says prepare and the guard approves the exact target;
 * a re-seed also needs that target to be the `preview` branch. The
 * migration, the reads and the seed run under one lock, in that order.
 */
export async function preparePreviewDatabase(env: PreviewBuildEnv, steps: PreviewBuildSteps): Promise<PreviewBuildOutcome> {
  const plan = previewBuildPlan(env);
  if (plan.kind === "skip") return { kind: "skipped", why: plan.why };
  if (plan.kind === "refuse") return { kind: "refused", why: plan.why };
  const verdict = await steps.guard(plan.connectionString);
  if (!verdict.ok) {
    return { kind: "refused", why: `the seed guard refused (${verdict.refusal.reason}): ${verdict.refusal.detail}` };
  }
  const { reseed } = plan;
  if (reseed !== null) {
    const allowed = reseedVerdictOf(verdict);
    if (!allowed.ok) return { kind: "refused", why: `${RESEED_REQUEST_VARIABLE} is set, but ${allowed.why}` };
  }
  const { target } = verdict;
  return steps.exclusive(target, async (): Promise<PreviewBuildOutcome> => {
    await steps.migrate(target);
    if (reseed !== null && !(await steps.served(target, reseed))) {
      return { kind: "migrated-and-reseeded", report: await steps.reseed(target, reseed), request: reseed };
    }
    if ((await steps.contents(target)) === "has-data") return { kind: "migrated", target, servedRequest: reseed };
    return { kind: "migrated-and-seeded", report: await steps.seed(target) };
  });
}
