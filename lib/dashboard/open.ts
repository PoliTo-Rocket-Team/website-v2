import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { openDatabaseDashboard } from "./database";
import { dashboardOpening, type DashboardOpening } from "./opening";

/**
 * How this request opens the dashboard: the signed-in account's database
 * rows (lib/current-user.ts), else signed out or an account that did not
 * resolve (./opening.ts). Every run reads the database (issue #609): under
 * `next dev` and on previews a run with none stops
 * (lib/database-required.ts). Cached per request, so the layout and the page
 * share one answer.
 */
export const openDashboard = cache(async (): Promise<DashboardOpening> => {
  // A plain Headers: getSessionCookie cannot read Next's request headers.
  const holdsSessionToken = getSessionCookie(new Headers(await headers())) !== null;
  return dashboardOpening(await openDatabaseDashboard(), holdsSessionToken);
});
