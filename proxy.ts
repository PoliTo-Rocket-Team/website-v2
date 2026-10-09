import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { applyListIsPerRequest } from "@/lib/apply/pick";
import { callbackPath } from "@/lib/auth-callback";
import { processDummyModeEnv } from "@/lib/dummy-data/mode";
import { DUMMY_RECRUITMENT_COOKIE } from "@/lib/dummy-data/recruitment";
import { TEST_DEVELOPER_COOKIE, testDeveloperViewer } from "@/lib/test-developer";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // /apply is prerendered (issue #163). In dummy mode, a request carrying
  // `?open=` or the dummy recruitment cookie needs its own render, so it is
  // served by /apply/dummy-state; the address bar keeps /apply. The matcher
  // below lets only such requests reach this proxy.
  if (pathname === "/apply") {
    const perRequest = applyListIsPerRequest({
      env: processDummyModeEnv(),
      openSelector: request.nextUrl.searchParams.get("open"),
      recruitmentCookie: request.cookies.get(DUMMY_RECRUITMENT_COOKIE)?.value,
    });
    if (!perRequest) return NextResponse.next();
    const stateUrl = new URL("/apply/dummy-state", request.url);
    stateUrl.search = search;
    return NextResponse.rewrite(stateUrl);
  }

  // Google is the only sign-in (issue #118). The old sign-up and sign-in
  // pages send their visitors, and their `cb`, to /login.
  if (pathname === "/sign-up" || pathname === "/sign-in") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.search = search;
    return NextResponse.redirect(loginUrl);
  }

  // A test developer (issue #141) counts as signed in only where the gate
  // is on; in production the cookie is ignored.
  const isTestDeveloper =
    testDeveloperViewer(request.cookies.get(TEST_DEVELOPER_COOKIE)?.value) !== null;
  const isAuthenticated = !!getSessionCookie(request) || isTestDeveloper;

  if (isAuthenticated && pathname === "/login") {
    const target = callbackPath(request.nextUrl.searchParams.get("cb"));
    return NextResponse.redirect(new URL(target, request.url));
  }

  // A position page (/apply/<slug>) is open to everyone: signed out, it
  // shows its own sign-in card in place of the form (issue #120).
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (isDashboard && !isAuthenticated) {
    const signInUrl = new URL("/login", request.url);
    signInUrl.searchParams.set("cb", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/sign-up",
    "/sign-in",
    "/dashboard/:path*",
    // Only the /apply requests that can need a request-time render: a plain
    // visit never runs the proxy. The cookie key is DUMMY_RECRUITMENT_COOKIE;
    // the matcher must be a literal (lib/apply/pick.test.ts holds them equal).
    { source: "/apply", has: [{ type: "query", key: "open" }] },
    { source: "/apply", has: [{ type: "cookie", key: "prt_dummy_recruitment" }] },
  ],
};
