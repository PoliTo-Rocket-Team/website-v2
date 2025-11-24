import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  checkUserHasAccess,
  isProtectedRoute,
  getRequiredTarget,
} from "@/lib/middleware-permissions";

export default auth(async req => {
  const { pathname, search } = req.nextUrl;

  // Redirect logged-in users away from sign-in page
  if (req.auth && pathname === "/sign-in") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Protect dashboard routes for unauthenticated users
  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (isDashboard && !req.auth) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname + search);
    return NextResponse.redirect(signInUrl);
  }

  // Handle permission checks for protected pages (positions, applications, etc)
  if (req.auth && isProtectedRoute(pathname)) {
    const target = getRequiredTarget(pathname);
    
    if (target && req.auth.userId) {
      // Session type is extended in types/next-auth.d.ts
      const session = req.auth as { userId?: string; supabaseAccessToken?: string };
      const supabaseAccessToken = session.supabaseAccessToken;
      
      if (supabaseAccessToken) {
        const { hasAccess } = await checkUserHasAccess(
          req.auth.userId,
          target,
          supabaseAccessToken
        );

        if (!hasAccess) {
          // Redirect to dashboard with error indication
          const dashboardUrl = new URL("/dashboard", req.url);
          dashboardUrl.searchParams.set("error", "access_denied");
          return NextResponse.redirect(dashboardUrl);
        }
      }
    }
  }

  // Store referer header for access control redirects
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-current-path', pathname);
  if (req.headers.get('referer')) {
    requestHeaders.set('x-referer', req.headers.get('referer')!);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
});

export const config = {
  matcher: ["/sign-in", "/dashboard/:path*"],
};
