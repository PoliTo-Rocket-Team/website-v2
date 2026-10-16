import { callbackPath } from "@/lib/auth-callback";
import { isTestViewer, type TestViewer, type ViewerSession } from "@/lib/dashboard/viewer";
import { dummyDataOn, processDummyModeEnv, type DummyModeEnv } from "@/lib/dummy-data/mode";
import { ownApplicationsStartOf, type OwnApplicationsStart } from "@/lib/dummy-data/own";
import { TEST_VIEWER_PEOPLE } from "@/lib/test-viewer-people";

// Test developer sign-in (issue #141). On previews and under `next dev`, a
// person or an agent can sign in as a test developer: no Google, no account
// and no database session, only a cookie naming which viewer they look as
// (team leader, operations lead, department head, division lead, member,
// alumni, non-member). Where the pages read the dummy arrays
// (lib/dummy-data/mode.ts), the dashboard reads them too. Where they read a
// database, as on a preview with its seeded database (issue #307), the
// test developer is read as that viewer's seeded person and may not write.
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

/** What a test developer changed on the partners (lib/dummy-data/partners.ts); cleared on sign out. */
export const TEST_DEVELOPER_CONTENT_COOKIE = "prt_test_developer_content";

/** What a test developer changed on the questions at the bottom of /apply (lib/dummy-data/faqs.ts); cleared on sign out. Its own cookie, so each content type has the whole cookie's room. */
export const TEST_DEVELOPER_FAQ_COOKIE = "prt_test_developer_faq";

/** What a test developer saved, published or reset on the Team page's visual layer (lib/dummy-data/team-page.ts); cleared on sign out. Its own cookie, as the FAQ's. */
export const TEST_DEVELOPER_TEAM_PAGE_COOKIE = "prt_test_developer_team_page";

/** What a test developer added, edited, reordered or published on the Team page's advisors (lib/dummy-data/team-page.ts); cleared on sign out. Its own cookie, as the layer's. */
export const TEST_DEVELOPER_ADVISORS_COOKIE = "prt_test_developer_advisors";
/** What a test developer changed on the Outreach posts, summit and tags (lib/dummy-data/outreach.ts); cleared on sign out. Its own cookie, as the questions have. */
export const TEST_DEVELOPER_OUTREACH_COOKIE = "prt_test_developer_outreach";

/** What a test developer changed on the projects (lib/dummy-data/projects.ts); cleared on sign out. Its own cookie, as the questions have. */
export const TEST_DEVELOPER_PROJECTS_COOKIE = "prt_test_developer_projects";

/**
 * Which own applications the test developer starts with (lib/dummy-data/own.ts):
 * "none" or "withdrawn" after a sign-in with that `applications` value, absent otherwise.
 */
export const TEST_DEVELOPER_APPLICATIONS_COOKIE = "prt_test_developer_applications";

/** The test view a test developer cookie names, or null when the gate is off or the value is not one. */
export function testDeveloperViewer(
  cookieValue: string | null | undefined,
  env: GateEnv = processGateEnv(),
): TestViewer | null {
  if (!testDeveloperOn(env)) return null;
  return isTestViewer(cookieValue) ? cookieValue : null;
}

/** What the stand-in gate reads: the test developer gate's variables and the database the pages read. */
export type StandInEnv = GateEnv & DummyModeEnv;

function processStandInEnv(): StandInEnv {
  return processDummyModeEnv();
}

/**
 * Who a test developer is read as where the pages read a database (issue
 * #307, ADR 0016): the seeded person of the viewer the cookie names
 * (lib/test-viewer-people.ts). Null where the gate is off, where the pages
 * read the dummy arrays (the dummy dashboard serves the viewer there), or
 * when the cookie names no viewer. A stand-in reads; it never writes
 * (lib/db-audit.ts refuses its writes).
 */
export function testDeveloperStandIn(
  cookieValue: string | null | undefined,
  env: StandInEnv = processStandInEnv(),
): { readonly viewer: TestViewer; readonly userId: string } | null {
  if (dummyDataOn(env)) return null;
  const viewer = testDeveloperViewer(cookieValue, env);
  return viewer === null ? null : { viewer, userId: TEST_VIEWER_PEOPLE[viewer] };
}

/** A write a test developer tried on a database: refused, because their changes never reach one (ADR 0016). */
export class TestDeveloperWriteRefused extends Error {
  constructor() {
    super("A test developer's changes never reach the database; sign in with an account to change it.");
    this.name = "TestDeveloperWriteRefused";
  }
}

/**
 * The user id an audited write is logged under (lib/db-audit.ts): the
 * account's, or none when nobody is signed in. A test developer read as a
 * seeded person is refused before any write is sent.
 */
export function auditWriterOf(user: { readonly session: ViewerSession; readonly id: string } | null): string | null {
  if (user === null) return null;
  if (user.session === "test-developer") throw new TestDeveloperWriteRefused();
  return user.id;
}

/**
 * The sign-in link for one viewer, back to `cb` (a site path) after. With
 * `applications` "none" the viewer starts with no own applications (issue
 * #179), with "withdrawn" only with withdrawn ones (issue #227); View as never
 * passes it, so switching viewer brings the sample set back.
 */
export function testDeveloperSignInHref(
  viewer: TestViewer,
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
 * only withdrawn ones; without it the sample set is back. 404 when the gate is off, 400 for a viewer that is not one of TEST_VIEWERS.
 */
export function testDeveloperSignIn(url: URL, env: GateEnv = processGateEnv()): Response {
  if (!testDeveloperOn(env)) return notFound();
  const viewer = url.searchParams.get("viewer");
  if (!isTestViewer(viewer)) return new Response("Unknown viewer", { status: 400 });
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
    cookieHeader("", 0, url, TEST_DEVELOPER_CONTENT_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_FAQ_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_TEAM_PAGE_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_ADVISORS_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_OUTREACH_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_PROJECTS_COOKIE),
  );
}
