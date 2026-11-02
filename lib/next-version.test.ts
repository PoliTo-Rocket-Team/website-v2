import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// Issue #893: on Next.js 16.2, a dashboard page with a dynamic segment (the
// project and Outreach post editors) failed to resume on Vercel once its
// cached shell was regenerated for its own path, which any
// revalidatePath("/dashboard", "layout") causes. React then dropped the
// page's Suspense boundary to client rendering and logged error 419, for
// every viewer and every project. The fix to that resume shipped in
// Next.js 16.3.0. The failure needs Vercel's regenerated shell, so no local
// render shows it; this keeps the app off the releases that have it.
const FIRST_FIXED = [16, 3] as const;

test("the app runs a Next.js release that resumes a regenerated dynamic-segment shell", () => {
  const { version } = createRequire(import.meta.url)("next/package.json") as { version: string };
  const [major, minor] = version.split(".").map(Number);
  const fixed = major > FIRST_FIXED[0] || (major === FIRST_FIXED[0] && minor >= FIRST_FIXED[1]);
  assert.ok(fixed, `Next.js ${version} is older than ${FIRST_FIXED.join(".")}.0, whose regenerated shells fail to resume (#893)`);
});
