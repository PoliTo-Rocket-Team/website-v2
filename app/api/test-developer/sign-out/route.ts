import { testDeveloperSignOut } from "@/lib/test-developer";

// Test developer sign-out (issue #141): 404 in production, see lib/test-developer.ts.
export function GET(request: Request): Response {
  return testDeveloperSignOut(new URL(request.url));
}
