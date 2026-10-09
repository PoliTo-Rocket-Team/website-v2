import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { dummyDashboardData } from "@/lib/dummy-data";
import { TEST_DEVELOPER_COOKIE, testDeveloperViewer } from "@/lib/test-developer";
import type { DashboardData } from "./data";
import { openDatabaseDashboard } from "./database";

/**
 * The dashboard data for this request: the dummy arrays for a test developer
 * (previews and `next dev` only), else the signed-in account's database
 * rows, else null (nobody signed in). Cached per request, so the layout and
 * the page share one answer.
 */
export const openDashboardData = cache(async (): Promise<DashboardData | null> => {
  const viewer = testDeveloperViewer((await cookies()).get(TEST_DEVELOPER_COOKIE)?.value);
  if (viewer !== null) return dummyDashboardData(viewer);
  return openDatabaseDashboard();
});
