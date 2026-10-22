import { testDeveloperSignIn } from "@/lib/test-developer";

// Test developer sign-in (issue #141): 404 in production, see lib/test-developer.ts.
export function GET(request: Request): Response {
  return testDeveloperSignIn(new URL(request.url));
}
