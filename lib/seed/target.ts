// The seed guard (issue #303, ADR 0016). Before the seed writes anything it
// reads the connection target and refuses unless that target is a local
// database or the compute endpoint of the shared Neon branch named `preview`,
// on a Vercel preview build. The answer comes from the target's host alone:
// the guard calls no API and reads no credential beside the target (issue
// #311). No flag can turn a refusal into a pass; VERCEL_ENV=production can
// only add one.

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

/** The one schema-only branch every preview deployment shares (ADR 0016, issue #307). */
export const SHARED_PREVIEW_BRANCH = "preview";

/**
 * The compute endpoint of the `preview` branch (Owner decision on #311): the
 * only Neon endpoint the guard lets through, by its direct host or its
 * `-pooler` host. It is not a secret. Production's endpoint is a different
 * one, so a production connection string never matches. If the `preview`
 * branch is ever recreated, its new endpoint id goes here.
 */
export const PREVIEW_ENDPOINT = "ep-floral-mouse-b2er5ebz";

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
 * passes. A Neon host passes only when its endpoint is `PREVIEW_ENDPOINT`
 * and this is a Vercel preview build. Every other Neon host, and every host
 * the guard cannot classify, is refused.
 */
export function guardSeedTarget(connectionString: string | undefined, env: GuardEnv = {}): GuardVerdict {
  if (env.VERCEL_ENV === "production") {
    return refuse("production", "this is a Vercel production build");
  }
  const parsed = parseTarget(connectionString);
  switch (parsed.kind) {
    case "unclassifiable":
      return refuse("unclassifiable", parsed.why);
    case "local":
      return { ok: true, target: ApprovedSeedTarget[approved](connectionString!, "local", parsed.host) };
    case "neon":
      if (parsed.endpointId !== PREVIEW_ENDPOINT) {
        return refuse("unproven-preview", `${parsed.endpointId} is not the endpoint of the "${SHARED_PREVIEW_BRANCH}" branch`);
      }
      if (env.VERCEL_ENV !== "preview") {
        return refuse("unproven-preview", `the "${SHARED_PREVIEW_BRANCH}" branch is seeded only by a Vercel preview build`);
      }
      return { ok: true, target: ApprovedSeedTarget[approved](connectionString!, "preview", SHARED_PREVIEW_BRANCH) };
  }
}
