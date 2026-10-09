import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { dummyDashboardData } from "@/lib/dummy-data";
import { TEST_DEVELOPER_COOKIE, testDeveloperViewer } from "@/lib/test-developer";
import { openDatabaseDashboard } from "./database";
import { dashboardOpening, type DashboardOpening } from "./opening";

/**
 * How this request opens the dashboard: the dummy arrays for a test
 * developer (previews and `next dev` only), else the signed-in account's
 * database rows, else signed out or an account that did not resolve
 * (./opening.ts). Cached per request, so the layout and the page share one
 * answer.
 */
export const openDashboard = cache(async (): Promise<DashboardOpening> => {
  const viewer = testDeveloperViewer((await cookies()).get(TEST_DEVELOPER_COOKIE)?.value);
  if (viewer !== null) return dashboardOpening(dummyDashboardData(viewer), true);
  // A plain Headers: getSessionCookie cannot read Next's request headers.
  const holdsSessionToken = getSessionCookie(new Headers(await headers())) !== null;
  return dashboardOpening(await openDatabaseDashboard(), holdsSessionToken);
});
