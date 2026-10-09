// Where auth lives on each deployment, and whether Google sign-in goes
// through the OAuth proxy (issue #130).
//
// Google only accepts a fixed list of redirect URIs, and a Vercel preview's
// URL changes on every PR. So previews send Google sign-in through the fixed
// v2dev host, which hands the session back to the preview that started it.
// Production and local dev sign in directly.

export const PRODUCTION_URL = "https://v2.politorocketteam.it";
export const PROXY_HOST_URL = "https://v2dev.politorocketteam.it";
/** The git branch Vercel serves on PROXY_HOST_URL. */
export const PROXY_HOST_BRANCH = "huey/landing-page";
export const LOCAL_URL = "http://localhost:3000";

const GOOGLE_CALLBACK_PATH = "/api/auth/callback/google";

// This Vercel project's preview hosts, and no other project's:
//   website-v2-<deployment hash>-info-42486522s-projects.vercel.app
//   website-v2-git-<branch slug>-info-42486522s-projects.vercel.app
const PROJECT_PREVIEW_HOST =
  /^website-v2-[a-z0-9]+(?:-[a-z0-9]+)*-info-42486522s-projects\.vercel\.app$/;

export type AuthDeployment = "production" | "proxy-host" | "preview" | "local";

export type OAuthProxy =
  | { readonly on: false }
  | {
      readonly on: true;
      /** The fixed host Google redirects to. */
      readonly productionURL: string;
      readonly googleRedirectURI: string;
    };

export type AuthUrls = {
  readonly deployment: AuthDeployment;
  readonly baseURL: string;
  /** Origins trusted by exact match. */
  readonly origins: readonly string[];
  /** Whether any of this project's Vercel preview origins is trusted too. */
  readonly trustsProjectPreviews: boolean;
  readonly proxy: OAuthProxy;
};

export type AuthEnv = Readonly<Record<string, string | undefined>>;

const PROXY_ON: OAuthProxy = {
  on: true,
  productionURL: PROXY_HOST_URL,
  googleRedirectURI: `${PROXY_HOST_URL}${GOOGLE_CALLBACK_PATH}`,
};

function httpsOrigin(host: string | undefined): string | undefined {
  return host ? `https://${host}` : undefined;
}

function defined(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * Reads Vercel's system variables (VERCEL_ENV, VERCEL_URL, VERCEL_BRANCH_URL,
 * VERCEL_GIT_COMMIT_REF) and returns where auth lives on this deployment.
 */
export function authUrls(env: AuthEnv): AuthUrls {
  const vercelEnv = env.VERCEL_ENV;

  if (vercelEnv === "production") {
    return {
      deployment: "production",
      baseURL: PRODUCTION_URL,
      origins: [PRODUCTION_URL],
      trustsProjectPreviews: false,
      proxy: { on: false },
    };
  }

  if (vercelEnv === "preview") {
    const deploymentOrigin = httpsOrigin(env.VERCEL_URL);
    const branchOrigin = httpsOrigin(env.VERCEL_BRANCH_URL);

    // v2dev is itself a preview deployment of PROXY_HOST_BRANCH. It is the
    // proxy's fixed host: Google returns there, and it hands the session back
    // to the preview that started the sign-in, so it runs the plugin too.
    if (env.VERCEL_GIT_COMMIT_REF === PROXY_HOST_BRANCH) {
      return {
        deployment: "proxy-host",
        baseURL: PROXY_HOST_URL,
        origins: defined([PROXY_HOST_URL, deploymentOrigin, branchOrigin]),
        trustsProjectPreviews: true,
        proxy: PROXY_ON,
      };
    }

    const ownOrigin = branchOrigin ?? deploymentOrigin;
    if (!ownOrigin) {
      throw new Error("authUrls: a Vercel preview has no VERCEL_URL or VERCEL_BRANCH_URL.");
    }

    return {
      deployment: "preview",
      baseURL: ownOrigin,
      origins: defined([ownOrigin, deploymentOrigin, branchOrigin, PROXY_HOST_URL]),
      trustsProjectPreviews: true,
      proxy: PROXY_ON,
    };
  }

  if (vercelEnv === undefined || vercelEnv === "" || vercelEnv === "development") {
    const baseURL = env.BETTER_AUTH_URL || LOCAL_URL;
    return {
      deployment: "local",
      baseURL,
      origins: defined([LOCAL_URL, "http://127.0.0.1:3000", baseURL]),
      trustsProjectPreviews: false,
      proxy: { on: false },
    };
  }

  throw new Error(`authUrls: unknown VERCEL_ENV "${vercelEnv}".`);
}

function isProjectPreviewOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    url.origin === origin &&
    PROJECT_PREVIEW_HOST.test(url.hostname)
  );
}

export function trustsOrigin(urls: AuthUrls, origin: string): boolean {
  if (urls.origins.includes(origin)) return true;
  return urls.trustsProjectPreviews && isProjectPreviewOrigin(origin);
}

/**
 * The trusted-origins list better-auth checks a request against: the exact
 * origins, plus the request's own Origin when it is one of this project's
 * previews. better-auth matches patterns loosely, so the preview check stays
 * here, as one strict rule.
 */
export function trustedOriginsFor(urls: AuthUrls, request: Request | undefined): string[] {
  const origin = request?.headers.get("origin");
  if (origin && !urls.origins.includes(origin) && trustsOrigin(urls, origin)) {
    return [...urls.origins, origin];
  }
  return [...urls.origins];
}
