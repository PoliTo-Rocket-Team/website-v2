import { callbackPath } from "@/lib/auth-callback";
import { isViewerKind, type ViewerKind } from "@/lib/dashboard/viewer";
import { ownApplicationsStartOf, type OwnApplicationsStart } from "@/lib/dummy-data/own";

// Test developer sign-in (issue #141). On previews and under `next dev`, a
// person or an agent can sign in as a test developer: no Google, no account
// and no database session, only a cookie naming which viewer they look as
// (operations lead, division lead, member, non-member). The dashboard then
// reads the dummy data in lib/dummy-data/ instead of the database.
//
// Production never offers it and never accepts it: every path asks
// `testDeveloperOn()` first, at request time, so a cookie set elsewhere is
// ignored there and the sign-in route answers 404.

/** The two variables the gate reads. */
export type GateEnv = {
  readonly NODE_ENV?: string;
  readonly VERCEL_ENV?: string;
};

function processGateEnv(): GateEnv {
  return { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
}

/**
 * Whether test developer sign-in is on: on a Vercel preview, or under
 * `next dev` with no Vercel environment. Off in production, on any other
 * Vercel environment, and for a local production build.
 */
export function testDeveloperOn(env: GateEnv = processGateEnv()): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "preview";
  return env.NODE_ENV === "development";
}

export const TEST_DEVELOPER_COOKIE = "prt_test_developer";

/** A week: long enough for a review, short enough to forget. */
export const TEST_DEVELOPER_COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60;

/** What a test developer changed on the dummy team (lib/dummy-data/state.ts); cleared on sign out. */
export const TEST_DEVELOPER_STATE_COOKIE = "prt_test_developer_state";

/** What a test developer changed on the Team pages (lib/dummy-data/edits.ts); cleared on sign out. */
export const TEST_DEVELOPER_EDITS_COOKIE = "prt_test_developer_edits";

/** What a test developer changed on their own pages (lib/dummy-data/own.ts); cleared on sign out. */
export const TEST_DEVELOPER_OWN_COOKIE = "prt_test_developer_own";

/**
 * Which own applications the test developer starts with (lib/dummy-data/own.ts):
 * "none" or "withdrawn" after a sign-in with that `applications` value, absent otherwise.
 */
export const TEST_DEVELOPER_APPLICATIONS_COOKIE = "prt_test_developer_applications";

/** The viewer a test developer cookie names, or null when the gate is off or the value is not a viewer. */
export function testDeveloperViewer(
  cookieValue: string | null | undefined,
  env: GateEnv = processGateEnv(),
): ViewerKind | null {
  if (!testDeveloperOn(env)) return null;
  return isViewerKind(cookieValue) ? cookieValue : null;
}

/**
 * The sign-in link for one viewer, back to `cb` (a site path) after. With
 * `applications` "none" the viewer starts with no own applications (issue
 * #179), with "withdrawn" only with withdrawn ones (issue #227); View as never
 * passes it, so switching viewer brings the sample set back.
 */
export function testDeveloperSignInHref(
  viewer: ViewerKind,
  cb?: string | null,
  applications: OwnApplicationsStart = "sample",
): string {
  const query = new URLSearchParams({ viewer });
  if (applications !== "sample") query.set("applications", applications);
  if (cb) query.set("cb", callbackPath(cb));
  return `/api/test-developer/sign-in?${query}`;
}

export const TEST_DEVELOPER_SIGN_OUT_HREF = "/api/test-developer/sign-out";

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

function cookieHeader(value: string, maxAge: number, url: URL, name: string = TEST_DEVELOPER_COOKIE): string {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function redirect(to: string, url: URL, ...cookies: string[]): Response {
  const headers = new Headers({ Location: new URL(to, url).toString(), "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

/**
 * GET /api/test-developer/sign-in?viewer=<kind>[&applications=none|withdrawn][&cb=<path>]:
 * sets the cookie and goes to `cb`, else the dashboard. `applications=none`
 * starts the viewer with no own applications, `applications=withdrawn` with
 * only withdrawn ones; without it the sample set is back. 404 when the gate is off, 400 for a viewer that is not one of the four.
 */
export function testDeveloperSignIn(url: URL, env: GateEnv = processGateEnv()): Response {
  if (!testDeveloperOn(env)) return notFound();
  const viewer = url.searchParams.get("viewer");
  if (!isViewerKind(viewer)) return new Response("Unknown viewer", { status: 400 });
  const start = ownApplicationsStartOf(url.searchParams.get("applications"));
  return redirect(
    callbackPath(url.searchParams.get("cb")),
    url,
    cookieHeader(viewer, TEST_DEVELOPER_COOKIE_MAX_AGE_S, url),
    start !== "sample"
      ? cookieHeader(start, TEST_DEVELOPER_COOKIE_MAX_AGE_S, url, TEST_DEVELOPER_APPLICATIONS_COOKIE)
      : cookieHeader("", 0, url, TEST_DEVELOPER_APPLICATIONS_COOKIE),
  );
}

/**
 * GET /api/test-developer/sign-out: clears the cookie and the changes made on
 * the dummy team, and goes to /login. 404 when the gate is off.
 */
export function testDeveloperSignOut(url: URL, env: GateEnv = processGateEnv()): Response {
  if (!testDeveloperOn(env)) return notFound();
  return redirect(
    "/login",
    url,
    cookieHeader("", 0, url),
    cookieHeader("", 0, url, TEST_DEVELOPER_STATE_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_EDITS_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_OWN_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_APPLICATIONS_COOKIE),
  );
}
