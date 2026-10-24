import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { callbackPath } from "@/lib/auth-callback";
import { TEST_DEVELOPER_COOKIE, testDeveloperViewer } from "@/lib/test-developer";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

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
  ],
};
