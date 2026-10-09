import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { dummyDashboardData } from "@/lib/dummy-data";
import { parseEdits, serializeEdits, TEST_DEVELOPER_EDITS_COOKIE, type TeamEdits } from "@/lib/dummy-data/edits";
import {
  DUMMY_RECRUITMENT_COOKIE,
  dummyRecruitmentCookieValue,
  dummyRecruitmentOf,
  type DummyRecruitmentStore,
} from "@/lib/dummy-data/recruitment";
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
    return dashboardOpening(dummyDashboardData(viewer, dummyRecruitmentIn(jar), edits, save), true);
  }
  // A plain Headers: getSessionCookie cannot read Next's request headers.
  const holdsSessionToken = getSessionCookie(new Headers(await headers())) !== null;
  return dashboardOpening(await openDatabaseDashboard(), holdsSessionToken);
});

/** A week, as the test developer cookie. */
const RECRUITMENT_COOKIE_MAX_AGE_S = 7 * 24 * 60 * 60;

/**
 * The dummy recruitment switch kept in this browser's cookie. Only a server
 * action may set a cookie, and only the switch's action saves.
 */
function dummyRecruitmentIn(jar: Awaited<ReturnType<typeof cookies>>): DummyRecruitmentStore {
  return {
    current: dummyRecruitmentOf(jar.get(DUMMY_RECRUITMENT_COOKIE)?.value),
    save: async (recruitment) => {
      jar.set(DUMMY_RECRUITMENT_COOKIE, dummyRecruitmentCookieValue(recruitment), {
        path: "/",
        maxAge: RECRUITMENT_COOKIE_MAX_AGE_S,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    },
  };
}
