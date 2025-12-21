import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  // Redirect logged-in users away from login and signup pages
  if (isAuthenticated && (pathname === "/login" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect dashboard routes for unauthenticated users
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Protect apply/[slug] routes (but not /apply itself)
  const isApplySlug = pathname.startsWith("/apply/") && pathname !== "/apply/";

  if ((isDashboard || isApplySlug) && !isAuthenticated) {
    const signInUrl = new URL("/login", request.url);
    // Preserve the original destination to redirect after login Callback
    signInUrl.searchParams.set("cb", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/sign-up", "/dashboard/:path*", "/apply/:slug"],
};
