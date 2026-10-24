import { callbackPath } from "@/lib/auth-callback";
import { isTestViewer, type TestViewer, type ViewerSession } from "@/lib/dashboard/viewer";
import { isPreviewDatabase } from "@/lib/seed/target";
import { TEST_VIEWER_PEOPLE } from "@/lib/test-viewer-people";

// Test developer sign-in (issue #141). On previews and under `next dev`, a
// person or an agent can sign in as a test developer: no Google, no account
// and no database session, only a cookie naming which viewer they look as
// (team leader, operations lead, department head, division lead, member,
// alumni, non-member). Every page reads a database (issue #609), and the
// test developer is read as that viewer's seeded person there (issue #307).
// On a preview that
// person may write to the shared preview database, where the rows last across
// preview builds (a build seeds it only while it is empty); under `next dev`
// they may not (ADR 0016).
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
/** What a test developer changed on the Outreach posts, featured posts and tags (lib/dummy-data/outreach.ts); cleared on sign out. Its own cookie, as the questions have. */
export const TEST_DEVELOPER_OUTREACH_COOKIE = "prt_test_developer_outreach";

/** What a test developer changed on the projects (lib/dummy-data/projects.ts); cleared on sign out. Its own cookie, as the questions have. */
export const TEST_DEVELOPER_PROJECTS_COOKIE = "prt_test_developer_projects";

/**
 * Which own applications the dummy arrays started a test developer with
 * (issue #179). No page reads it any more (issue #609); sign-in and sign-out
 * clear one an earlier sign-in left.
 */
export const TEST_DEVELOPER_APPLICATIONS_COOKIE = "prt_test_developer_applications";

/**
 * The Members grant the dummy arrays gave the member viewer (issue #351). No
 * page reads it any more (issue #609); sign-in and sign-out clear one an
 * earlier sign-in left.
 */
export const TEST_DEVELOPER_GRANT_COOKIE = "prt_test_developer_grant";

/** The test view a test developer cookie names, or null when the gate is off or the value is not one. */
export function testDeveloperViewer(
  cookieValue: string | null | undefined,
  env: GateEnv = processGateEnv(),
): TestViewer | null {
  if (!testDeveloperOn(env)) return null;
  return isTestViewer(cookieValue) ? cookieValue : null;
}

/**
 * Who a test developer is read as (issue #307, ADR 0016): the seeded person
 * of the viewer the cookie names (lib/test-viewer-people.ts), read from the
 * database every page reads (issue #609). Null where the gate is off or when
 * the cookie names no viewer. Whether a stand-in may also write is
 * `testDeveloperMayWrite` (lib/db-audit.ts asks it through `auditWriterOf`).
 */
export function testDeveloperStandIn(
  cookieValue: string | null | undefined,
  env: GateEnv = processGateEnv(),
): { readonly viewer: TestViewer; readonly userId: string } | null {
  const viewer = testDeveloperViewer(cookieValue, env);
  return viewer === null ? null : { viewer, userId: TEST_VIEWER_PEOPLE[viewer] };
}

/** What the write gate reads: the test developer gate's variables and the database a write goes to. */
export type WriteGateEnv = GateEnv & { readonly DATABASE_URL?: string };

function processWriteGateEnv(): WriteGateEnv {
  return { ...processGateEnv(), DATABASE_URL: process.env.DATABASE_URL };
}

/**
 * Whether a test developer read as a seeded person may write to the database
 * (ADR 0016, amendment of 2026-10-17): only on a Vercel preview whose
 * `DATABASE_URL` names the shared `preview` branch, which holds only seeded
 * and tester-made rows and which a preview build seeds only while it is
 * empty (amendment of 2026-10-21). The branch is proven by the seed guard's own
 * check (`isPreviewDatabase`, issue #364), so a preview pointed at any other
 * database is refused too. Refused in production (where the gate is off
 * anyway), on any other Vercel environment, and under `next dev`, where the
 * database may be a real one.
 */
export function testDeveloperMayWrite(env: WriteGateEnv = processWriteGateEnv()): boolean {
  return env.VERCEL_ENV === "preview" && isPreviewDatabase(env.DATABASE_URL);
}

/** A write a test developer tried outside a preview, or on a database other than the `preview` branch: refused (ADR 0016). */
export class TestDeveloperWriteRefused extends Error {
  constructor() {
    super("A test developer's changes reach the database only on a preview; sign in with an account to change it.");
    this.name = "TestDeveloperWriteRefused";
  }
}

/**
 * The user id an audited write is logged under (lib/db-audit.ts): the
 * account's, or none when nobody is signed in. A test developer's write is
 * logged under the seeded person the viewer switch resolves to where
 * `testDeveloperMayWrite` allows it, and refused before it is sent elsewhere.
 */
export function auditWriterOf(
  user: { readonly session: ViewerSession; readonly id: string } | null,
  env: WriteGateEnv = processWriteGateEnv(),
): string | null {
  if (user === null) return null;
  if (user.session === "test-developer" && !testDeveloperMayWrite(env)) throw new TestDeveloperWriteRefused();
  return user.id;
}

/** The sign-in link for one viewer, back to `cb` (a site path) after. */
export function testDeveloperSignInHref(viewer: TestViewer, cb?: string | null): string {
  const query = new URLSearchParams({ viewer });
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
 * GET /api/test-developer/sign-in?viewer=<kind>[&cb=<path>]: sets the cookie
 * and goes to `cb`, else the dashboard. It clears the `applications` and
 * `grant` cookies an earlier sign-in may have left: only the dummy arrays read
 * them, and no page reads those any more (issue #609). 404 when the gate is
 * off, 400 for a viewer that is not one of TEST_VIEWERS.
 */
export function testDeveloperSignIn(url: URL, env: GateEnv = processGateEnv()): Response {
  if (!testDeveloperOn(env)) return notFound();
  const viewer = url.searchParams.get("viewer");
  if (!isTestViewer(viewer)) return new Response("Unknown viewer", { status: 400 });
  return redirect(
    callbackPath(url.searchParams.get("cb")),
    url,
    cookieHeader(viewer, TEST_DEVELOPER_COOKIE_MAX_AGE_S, url),
    cookieHeader("", 0, url, TEST_DEVELOPER_APPLICATIONS_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_GRANT_COOKIE),
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
    cookieHeader("", 0, url, TEST_DEVELOPER_GRANT_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_CONTENT_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_FAQ_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_TEAM_PAGE_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_ADVISORS_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_OUTREACH_COOKIE),
    cookieHeader("", 0, url, TEST_DEVELOPER_PROJECTS_COOKIE),
  );
}
