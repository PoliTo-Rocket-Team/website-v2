import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { dummyDashboardData } from "@/lib/dummy-data";
import { parseEdits, serializeEdits, TEST_DEVELOPER_EDITS_COOKIE, type TeamEdits } from "@/lib/dummy-data/edits";
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
  const jar = await cookies();
  const viewer = testDeveloperViewer(jar.get(TEST_DEVELOPER_COOKIE)?.value);
  if (viewer !== null) {
    // A test developer's writes land in a cookie only (lib/dummy-data/edits.ts).
    // Only a Server Action calls `save`, the one place a cookie can be set.
    const edits = parseEdits(jar.get(TEST_DEVELOPER_EDITS_COOKIE)?.value);
    const save = async (next: TeamEdits) => {
      jar.set(TEST_DEVELOPER_EDITS_COOKIE, serializeEdits(next), {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60,
      });
    };
    return dashboardOpening(dummyDashboardData(viewer, edits, save), true);
  }
  // A plain Headers: getSessionCookie cannot read Next's request headers.
  const holdsSessionToken = getSessionCookie(new Headers(await headers())) !== null;
  return dashboardOpening(await openDatabaseDashboard(), holdsSessionToken);
});
