import "server-only";

import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/current-user";
import { dummyViewer } from "@/lib/dummy-data";
import type { NavViewer } from "@/lib/nav-viewer-shape";
import { TEST_DEVELOPER_COOKIE, testDeveloperViewer } from "@/lib/test-developer";

/**
 * Who the navbar shows as signed in (issue #157): a test developer (previews
 * and `next dev` only, lib/test-developer.ts), else the signed-in account,
 * else nobody. Read at request time by GET /api/viewer, never by a page, so
 * the pages that carry the navbar stay prerendered.
 */
export async function navViewer(): Promise<NavViewer | null> {
  const kind = testDeveloperViewer((await cookies()).get(TEST_DEVELOPER_COOKIE)?.value);
  if (kind !== null) return { name: dummyViewer(kind).name };
  const user = await getCurrentUser();
  return user === null ? null : { name: user.name };
}
