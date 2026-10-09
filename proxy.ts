import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { callbackPath } from "@/lib/auth-callback";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Google is the only sign-in (issue #118). The old sign-up and sign-in
  // pages send their visitors, and their `cb`, to /login.
  if (pathname === "/sign-up" || pathname === "/sign-in") {
    const loginUrl = new URL("/login", request.url);
    loginUrl.search = search;
    return NextResponse.redirect(loginUrl);
  }

  const isAuthenticated = !!getSessionCookie(request);

  if (isAuthenticated && pathname === "/login") {
    const target = callbackPath(request.nextUrl.searchParams.get("cb"));
    return NextResponse.redirect(new URL(target, request.url));
  }

  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isApplySlug = pathname.startsWith("/apply/") && pathname !== "/apply/";

  if ((isDashboard || isApplySlug) && !isAuthenticated) {
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
    "/apply/:slug",
  ],
};
