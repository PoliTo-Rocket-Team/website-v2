import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { dummyDashboardData } from "@/lib/dummy-data";
import { parseDummyState, serializeDummyState, type DummyState } from "@/lib/dummy-data/state";
import {
  TEST_DEVELOPER_COOKIE,
  TEST_DEVELOPER_COOKIE_MAX_AGE_S,
  TEST_DEVELOPER_STATE_COOKIE,
  testDeveloperViewer,
} from "@/lib/test-developer";
import { openDatabaseDashboard } from "./database";
import { dashboardOpening, type DashboardOpening } from "./opening";

/**
 * How this request opens the dashboard: the dummy arrays for a test
 * developer (previews and `next dev` only), with the changes they made laid
 * over them (lib/dummy-data/state.ts), else the signed-in account's
 * database rows, else signed out or an account that did not resolve
 * (./opening.ts). Cached per request, so the layout and the page share one
 * answer.
 */
export const openDashboard = cache(async (): Promise<DashboardOpening> => {
  const jar = await cookies();
  const viewer = testDeveloperViewer(jar.get(TEST_DEVELOPER_COOKIE)?.value);
  if (viewer !== null) {
    const state = parseDummyState(jar.get(TEST_DEVELOPER_STATE_COOKIE)?.value);
    return dashboardOpening(dummyDashboardData(viewer, state, saveDummyState), true);
  }
  // A plain Headers: getSessionCookie cannot read Next's request headers.
  const holdsSessionToken = getSessionCookie(new Headers(await headers())) !== null;
  return dashboardOpening(await openDatabaseDashboard(), holdsSessionToken);
});

/**
 * A test developer's changes go to a cookie, never the database. Only a
 * server action may set a cookie, and only a server action writes.
 */
async function saveDummyState(next: DummyState): Promise<void> {
  (await cookies()).set(TEST_DEVELOPER_STATE_COOKIE, serializeDummyState(next), {
    path: "/",
    maxAge: TEST_DEVELOPER_COOKIE_MAX_AGE_S,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
