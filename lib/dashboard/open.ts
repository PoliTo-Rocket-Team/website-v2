import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { TEST_DEVELOPER_COOKIE, testDeveloperViewer } from "@/lib/test-developer";
import { openDatabaseDashboard } from "./database";
import { dashboardOpening, type DashboardOpening } from "./opening";

/**
 * How this request opens the dashboard: the signed-in person's database rows,
 * an account's or the seeded person a test developer is read as (issue #307,
 * lib/current-user.ts), else signed out or an account that did not resolve
 * (./opening.ts). Every run reads the database (issue #609): under `next dev`
 * and on previews a run with none stops (lib/database-required.ts). Cached
 * per request, so the layout and the page share one answer.
 */
export const openDashboard = cache(async (): Promise<DashboardOpening> => {
  const viewer = testDeveloperViewer((await cookies()).get(TEST_DEVELOPER_COOKIE)?.value);
  // A plain Headers: getSessionCookie cannot read Next's request headers. A
  // test developer counts as holding one, so a seeded person who did not
  // resolve is not sent to /login, which the proxy would send back.
  const holdsSessionToken = viewer !== null || getSessionCookie(new Headers(await headers())) !== null;
  return dashboardOpening(await openDatabaseDashboard(), holdsSessionToken);
});
