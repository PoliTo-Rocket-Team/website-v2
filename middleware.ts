import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isAuthenticated = !!sessionCookie;

  // Redirect logged-in users away from sign-in page
  if (isAuthenticated && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Protect dashboard routes for unauthenticated users
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  // Protect apply/[slug] routes (but not /apply itself)
  const isApplySlug = pathname.startsWith("/apply/") && pathname !== "/apply/";

  if ((isDashboard || isApplySlug) && !isAuthenticated) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/sign-in", "/dashboard/:path*", "/apply/:slug"],
};
