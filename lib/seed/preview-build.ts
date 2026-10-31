// The build's database step (issue #307, ADR 0016; production, issue #874,
// ADR 0020). Before `next build`, a Vercel build acts on the database it is
// given in one of two ways, and every other build touches no database.
//
// A preview build: every preview deployment reads one shared Neon branch named
// `preview`. The build migrates it and seeds it only when it is still empty;
// an ordinary build never resets it, so what testers make on a preview lasts
// across preview builds (issue #465, ADR 0016 amendment of 2026-10-21). The
// one exception is a re-seed the owner asked for with `PREVIEW_RESEED_REQUEST`
// (issue #595, ./reseed.ts): the first build that sees a value the branch has
// not served yet empties the branch and seeds it again, and records the value
// so no later build repeats it. The steps run against a target the seed guard
// approved, one build at a time: they hold one lock across the migration, the
// reads and the seed, and each seed is one transaction, so a second build that
// runs anyway cannot leave the branch half-seeded.
//
// A production build: it applies the pending migrations to production's
// database under the same kind of lock, and nothing else. Its steps hold no
// read, seed or reset, and it never asks the seed guard, which refuses every
// production build (./target.ts), so no seed path is reachable from it.

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
  /** A new value asks for one re-seed of the `preview` branch (./reseed.ts); unset or a served value asks for none. A production build ignores it. */
  readonly PREVIEW_RESEED_REQUEST?: string;
};

/**
 * Production's database, as the build step's plan named it: the direct
 * connection string of a Vercel production build. Only `previewBuildPlan`
 * makes one, and nothing that seeds accepts one.
 */
export type ProductionDatabase = { readonly kind: "production"; readonly connectionString: string };

/** What this build does with its database, decided from the environment alone. */
export type PreviewBuildPlan =
  | { readonly kind: "skip"; readonly why: string }
  | { readonly kind: "refuse"; readonly why: string }
  | { readonly kind: "prepare"; readonly connectionString: string; readonly reseed: ReseedRequest | null }
  /** A Vercel production build given a database: migrate it, and nothing else. */
  | { readonly kind: "migrate-production"; readonly database: ProductionDatabase };

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

/** The Vercel builds that act on a database here. */
type ActingBuild = "preview" | "production";

/**
 * The direct connection string a preview or production build works on, or why
 * it skips or refuses. Both builds hold a session lock, so both need the
 * direct string, and both refuse two strings that name different databases.
 */
function directConnectionOf(
  build: ActingBuild,
  env: PreviewBuildEnv,
): { readonly kind: "skip" | "refuse"; readonly why: string } | { readonly kind: "direct"; readonly connectionString: string } {
  const pooled = env.DATABASE_URL || undefined;
  const direct = env.DATABASE_URL_UNPOOLED || undefined;
  if (!pooled) {
    return build === "preview"
      ? { kind: "skip", why: "this preview has no DATABASE_URL, so its pages stop at their first database read (lib/database-required.ts)" }
      : { kind: "skip", why: "this production build has no DATABASE_URL, so there is no database to migrate" };
  }
  if (!direct) {
    // The lock is a session lock. Through Neon's pooler the lock and the
    // unlock can land on different server connections, so the lock could stay
    // held and stall every later build. Refuse rather than lock there.
    // Production refuses for the same reason (ADR 0020).
    return build === "preview"
      ? { kind: "refuse", why: "this preview has a DATABASE_URL but no DATABASE_URL_UNPOOLED, and the seed lock is held only on a direct connection" }
      : { kind: "refuse", why: "this production build has a DATABASE_URL but no DATABASE_URL_UNPOOLED, and the migration lock is held only on a direct connection" };
  }
  if (databaseOf(direct) !== databaseOf(pooled)) {
    return { kind: "refuse", why: "DATABASE_URL and DATABASE_URL_UNPOOLED name different databases" };
  }
  return { kind: "direct", connectionString: direct };
}

export function previewBuildPlan(env: PreviewBuildEnv): PreviewBuildPlan {
  if (env.VERCEL_ENV !== "preview" && env.VERCEL_ENV !== "production") {
    return { kind: "skip", why: `not a Vercel preview or production build (VERCEL_ENV is ${env.VERCEL_ENV ? `"${env.VERCEL_ENV}"` : "not set"})` };
  }
  const connection = directConnectionOf(env.VERCEL_ENV, env);
  if (connection.kind !== "direct") return connection;
  if (env.VERCEL_ENV === "production") {
    return { kind: "migrate-production", database: { kind: "production", connectionString: connection.connectionString } };
  }
  const reseed = ReseedRequest.read(env.PREVIEW_RESEED_REQUEST);
  if (reseed.kind === "invalid") return { kind: "refuse", why: reseed.why };
  return { kind: "prepare", connectionString: connection.connectionString, reseed: reseed.kind === "requested" ? reseed.request : null };
}

/** The real work of a preview build, behind seams the unit test replaces. */
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

/**
 * The real work of a production build: a lock and the migration, and nothing
 * that reads, seeds or empties rows, so a production build has no step that
 * could.
 */
export type ProductionBuildSteps = {
  /** Runs `work` while this build holds the production-migration lock on `database`; releases it however `work` ends. */
  exclusive<T>(database: ProductionDatabase, work: () => Promise<T>): Promise<T>;
  /** Applies every pending migration and the post-migration steps (db/migrate-database.ts); answers the names of the migrations it applied, in order. */
  migrate(database: ProductionDatabase): Promise<readonly string[]>;
};

/** Each build's steps, kept apart so a production build is handed no seed step. */
export type BuildDatabaseSteps = {
  readonly preview: PreviewBuildSteps;
  readonly production: ProductionBuildSteps;
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
  | { readonly kind: "migrated"; readonly target: ApprovedSeedTarget; readonly servedRequest: ReseedRequest | null }
  /** A production build: its database was migrated and nothing else; `applied` names each migration this build applied, in order. */
  | { readonly kind: "production-migrated"; readonly applied: readonly string[] };

/**
 * The build's database step. A production build migrates its database under
 * the lock and does nothing else. A preview build migrates the preview's
 * database, then re-seeds it when the owner asked for a re-seed it has not
 * served, else seeds it only when it is empty; nothing runs unless the guard
 * approves the exact target, and a re-seed also needs that target to be the
 * `preview` branch. The migration, the reads and the seed run under one lock,
 * in that order. Every other build touches no database.
 */
export async function prepareBuildDatabase(env: PreviewBuildEnv, steps: BuildDatabaseSteps): Promise<PreviewBuildOutcome> {
  const plan = previewBuildPlan(env);
  switch (plan.kind) {
    case "skip":
      return { kind: "skipped", why: plan.why };
    case "refuse":
      return { kind: "refused", why: plan.why };
    case "migrate-production":
      return migrateProductionDatabase(plan.database, steps.production);
    case "prepare":
      return preparePreviewDatabase(plan.connectionString, plan.reseed, steps.preview);
  }
}

async function migrateProductionDatabase(database: ProductionDatabase, steps: ProductionBuildSteps): Promise<PreviewBuildOutcome> {
  const applied = await steps.exclusive(database, () => steps.migrate(database));
  return { kind: "production-migrated", applied };
}

async function preparePreviewDatabase(
  connectionString: string,
  reseed: ReseedRequest | null,
  steps: PreviewBuildSteps,
): Promise<PreviewBuildOutcome> {
  const verdict = await steps.guard(connectionString);
  if (!verdict.ok) {
    return { kind: "refused", why: `the seed guard refused (${verdict.refusal.reason}): ${verdict.refusal.detail}` };
  }
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
