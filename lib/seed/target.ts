// The seed guard (issue #303, ADR 0015). Before the seed writes anything it
// reads the connection target and refuses unless that target is a local
// database or a Neon preview branch it can prove is not the production branch.
// The answer comes from the target itself: its host, and for a Neon host the
// branch that host's endpoint belongs to. No flag can turn a refusal into a
// pass; VERCEL_ENV=production can only add one.

/** What the guard knows about the Neon branch behind an endpoint, read from Neon itself. */
export type NeonBranchFacts = {
  readonly name: string;
  /** Neon's default branch: the one production reads. */
  readonly isDefault: boolean;
  readonly isProtected: boolean;
};

/** Reads the branch behind a Neon endpoint id; undefined when it cannot be read. */
export type NeonBranchLookup = (endpointId: string) => Promise<NeonBranchFacts | undefined>;

/** The host part of a connection target, classified. */
export type ParsedTarget =
  | { readonly kind: "local"; readonly host: string }
  | { readonly kind: "neon"; readonly host: string; readonly endpointId: string }
  | { readonly kind: "unclassifiable"; readonly why: string };

/** Why the guard refused. Each one is read off the target, never off a flag. */
export type SeedRefusal =
  | { readonly reason: "production"; readonly detail: string }
  | { readonly reason: "unclassifiable"; readonly detail: string }
  | { readonly reason: "unproven-preview"; readonly detail: string };

/** Neon's preview branches, as the Neon integration for Vercel names them. */
export const PREVIEW_BRANCH_PREFIX = "preview/";

const LOCAL_HOSTS = new Set(["localhost", "::1", "[::1]"]);
// ep-<words>-<digits>[-pooler].<region>.<cloud>.neon.tech
const NEON_HOST = /^(ep-[a-z0-9]+(?:-[a-z0-9]+)*?)(?:-pooler)?\.(?:[a-z0-9-]+\.)+neon\.tech$/;

function isLocalHost(host: string): boolean {
  return LOCAL_HOSTS.has(host) || /^127(?:\.\d{1,3}){3}$/.test(host);
}

/** Classifies a connection string by its host alone. */
export function parseTarget(connectionString: string | undefined): ParsedTarget {
  if (!connectionString) return { kind: "unclassifiable", why: "DATABASE_URL is not set" };
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    return { kind: "unclassifiable", why: "DATABASE_URL is not a URL" };
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return { kind: "unclassifiable", why: `scheme ${url.protocol} is not postgres` };
  }
  const host = url.hostname.toLowerCase();
  if (!host) return { kind: "unclassifiable", why: "the target names no host" };
  if (isLocalHost(host)) return { kind: "local", host };
  const neon = NEON_HOST.exec(host);
  if (neon) return { kind: "neon", host, endpointId: neon[1] };
  return { kind: "unclassifiable", why: `host ${host} is neither local nor a Neon endpoint` };
}

const approved = Symbol("approved seed target");

/**
 * A connection target the guard let through. Only `guardSeedTarget` makes
 * one, so a seed run that holds one has passed the guard on that exact URL.
 */
export class ApprovedSeedTarget {
  private constructor(
    readonly connectionString: string,
    readonly kind: "local" | "preview",
    /** The host, and for a preview the Neon branch name. */
    readonly label: string,
  ) {}

  /** The guard's one way in: the symbol is not exported. */
  static [approved](connectionString: string, kind: "local" | "preview", label: string): ApprovedSeedTarget {
    return new ApprovedSeedTarget(connectionString, kind, label);
  }
}

export type GuardVerdict =
  | { readonly ok: true; readonly target: ApprovedSeedTarget }
  | { readonly ok: false; readonly refusal: SeedRefusal };

/** The variables the guard reads besides the target. */
export type GuardEnv = { readonly VERCEL_ENV?: string };

function refuse(reason: SeedRefusal["reason"], detail: string): GuardVerdict {
  return { ok: false, refusal: { reason, detail } };
}

/**
 * Decides whether the seed may write to `connectionString`. A local host
 * passes. A Neon host passes only when Neon says its branch is not the
 * default branch, not protected, and is named `preview/…`. Everything else,
 * including a branch that cannot be read, is refused.
 */
export async function guardSeedTarget(
  connectionString: string | undefined,
  lookupBranch: NeonBranchLookup,
  env: GuardEnv = {},
): Promise<GuardVerdict> {
  if (env.VERCEL_ENV === "production") {
    return refuse("production", "this is a Vercel production build");
  }
  const parsed = parseTarget(connectionString);
  switch (parsed.kind) {
    case "unclassifiable":
      return refuse("unclassifiable", parsed.why);
    case "local":
      return { ok: true, target: ApprovedSeedTarget[approved](connectionString!, "local", parsed.host) };
    case "neon": {
      let branch: NeonBranchFacts | undefined;
      try {
        branch = await lookupBranch(parsed.endpointId);
      } catch {
        branch = undefined;
      }
      if (!branch) {
        return refuse("unproven-preview", `could not read the Neon branch behind ${parsed.endpointId}`);
      }
      if (branch.isDefault) {
        return refuse("production", `${parsed.endpointId} is on the default branch "${branch.name}"`);
      }
      if (branch.isProtected) {
        return refuse("production", `${parsed.endpointId} is on the protected branch "${branch.name}"`);
      }
      if (!branch.name.startsWith(PREVIEW_BRANCH_PREFIX)) {
        return refuse("unproven-preview", `branch "${branch.name}" is not a ${PREVIEW_BRANCH_PREFIX}… branch`);
      }
      return { ok: true, target: ApprovedSeedTarget[approved](connectionString!, "preview", branch.name) };
    }
  }
}
