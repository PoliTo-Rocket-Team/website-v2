import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth(req => {
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
  //! todo handle permission checks for protected pages (positions, applications, etc)

  return NextResponse.next();
});

export const config = {
  matcher: ["/sign-in", "/dashboard/:path*"],
};
