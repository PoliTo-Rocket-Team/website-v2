import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { dummyDashboardData } from "@/lib/dummy-data";
import { parseEdits, serializeEdits, type TeamEditsStore } from "@/lib/dummy-data/edits";
import {
  DUMMY_RECRUITMENT_COOKIE,
  dummyRecruitmentCookieValue,
  dummyRecruitmentOf,
  type DummyRecruitmentStore,
} from "@/lib/dummy-data/recruitment";
import { parseDummyState, serializeDummyState, type DummyStateStore } from "@/lib/dummy-data/state";
import {
  TEST_DEVELOPER_COOKIE,
  TEST_DEVELOPER_COOKIE_MAX_AGE_S,
  TEST_DEVELOPER_EDITS_COOKIE,
  TEST_DEVELOPER_STATE_COOKIE,
  testDeveloperViewer,
} from "@/lib/test-developer";
import { openDatabaseDashboard } from "./database";
import { dashboardOpening, type DashboardOpening } from "./opening";

/**
 * How this request opens the dashboard: the dummy arrays for a test
 * developer (previews and `next dev` only), with the recruitment switch and
 * the changes they made laid over them, else the signed-in account's
 * database rows, else signed out or an account that did not resolve
 * (./opening.ts). Cached per request, so the layout and the page share one
 * answer.
 */
export const openDashboard = cache(async (): Promise<DashboardOpening> => {
  const jar = await cookies();
  const viewer = testDeveloperViewer(jar.get(TEST_DEVELOPER_COOKIE)?.value);
  if (viewer !== null) {
    return dashboardOpening(
      dummyDashboardData(viewer, dummyRecruitmentIn(jar), dummyStateIn(jar), dummyTeamEditsIn(jar)),
      true,
    );
  }
  // A plain Headers: getSessionCookie cannot read Next's request headers.
  const holdsSessionToken = getSessionCookie(new Headers(await headers())) !== null;
  return dashboardOpening(await openDatabaseDashboard(), holdsSessionToken);
});

type Jar = Awaited<ReturnType<typeof cookies>>;

/**
 * A test developer's changes go to cookies in their own browser, never the
 * database. Only a server action may set a cookie, and only a server action
 * writes.
 */
function setDummyCookie(jar: Jar, name: string, value: string): void {
  jar.set(name, value, {
    path: "/",
    maxAge: TEST_DEVELOPER_COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

/** The dummy recruitment switch (issue #121), which /apply reads too. */
function dummyRecruitmentIn(jar: Jar): DummyRecruitmentStore {
  return {
    current: dummyRecruitmentOf(jar.get(DUMMY_RECRUITMENT_COOKIE)?.value),
    save: async (recruitment) =>
      setDummyCookie(jar, DUMMY_RECRUITMENT_COOKIE, dummyRecruitmentCookieValue(recruitment)),
  };
}

/** Positions opened or closed and applications moved (issue #142, lib/dummy-data/state.ts). */
function dummyStateIn(jar: Jar): DummyStateStore {
  return {
    current: parseDummyState(jar.get(TEST_DEVELOPER_STATE_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_STATE_COOKIE, serializeDummyState(next)),
  };
}

/** Edits on the Team pages (issue #143, lib/dummy-data/edits.ts). */
function dummyTeamEditsIn(jar: Jar): TeamEditsStore {
  return {
    current: parseEdits(jar.get(TEST_DEVELOPER_EDITS_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_EDITS_COOKIE, serializeEdits(next)),
  };
}
