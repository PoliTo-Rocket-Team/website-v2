import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { dummyDashboardData } from "@/lib/dummy-data";
import { dummyDataOn } from "@/lib/dummy-data/mode";
import { parseEdits, serializeEdits, type TeamEditsStore } from "@/lib/dummy-data/edits";
import { ownApplicationsStartOf, parseOwnChanges, serializeOwnChanges, type OwnChangesStore } from "@/lib/dummy-data/own";
import {
  DUMMY_RECRUITMENT_COOKIE,
  dummyRecruitmentCookieValue,
  dummyRecruitmentOf,
  type DummyRecruitmentStore,
} from "@/lib/dummy-data/recruitment";
import { parseDummyState, serializeDummyState, type DummyStateStore } from "@/lib/dummy-data/state";
import { parsePartnerEdits, serializePartnerEdits, type DummyPartnerEditsStore } from "@/lib/dummy-data/partners";
import { parseFaqEdits, serializeFaqEdits, type DummyFaqEditsStore } from "@/lib/dummy-data/faqs";
import {
  parseAdvisorEdits,
  parseTeamPageLayerEdits,
  serializeAdvisorEdits,
  serializeTeamPageLayerEdits,
  type DummyAdvisorEditsStore,
  type DummyTeamPageLayerEditsStore,
} from "@/lib/dummy-data/team-page";
import { parseOutreachEdits, serializeOutreachEdits, type DummyOutreachEditsStore } from "@/lib/dummy-data/outreach";
import { parseProjectEdits, serializeProjectEdits, type DummyProjectEditsStore } from "@/lib/dummy-data/projects";
import { testGrantOf } from "@/lib/dummy-data/test-grant";
import {
  TEST_DEVELOPER_APPLICATIONS_COOKIE,
  TEST_DEVELOPER_CONTENT_COOKIE,
  TEST_DEVELOPER_COOKIE,
  TEST_DEVELOPER_FAQ_COOKIE,
  TEST_DEVELOPER_GRANT_COOKIE,
  TEST_DEVELOPER_TEAM_PAGE_COOKIE,
  TEST_DEVELOPER_ADVISORS_COOKIE,
  TEST_DEVELOPER_OUTREACH_COOKIE,
  TEST_DEVELOPER_PROJECTS_COOKIE,
  TEST_DEVELOPER_COOKIE_MAX_AGE_S,
  TEST_DEVELOPER_EDITS_COOKIE,
  TEST_DEVELOPER_OWN_COOKIE,
  TEST_DEVELOPER_STATE_COOKIE,
  testDeveloperViewer,
} from "@/lib/test-developer";
import { openDatabaseDashboard } from "./database";
import { dashboardOpening, type DashboardOpening } from "./opening";

/**
 * How this request opens the dashboard: where the pages read the dummy
 * arrays, a test developer (previews and `next dev` only) gets those, with
 * the recruitment switch and the changes they made laid over them. Else the
 * signed-in person's database rows: an account's, or the seeded person a test
 * developer is read as (issue #307, lib/current-user.ts). Else signed out or
 * an account that did not resolve (./opening.ts). Cached per request, so the
 * layout and the page share one answer.
 */
export const openDashboard = cache(async (): Promise<DashboardOpening> => {
  const jar = await cookies();
  const viewer = testDeveloperViewer(jar.get(TEST_DEVELOPER_COOKIE)?.value);
  if (viewer !== null && dummyDataOn()) {
    return dashboardOpening(
      dummyDashboardData(
        viewer,
        dummyRecruitmentIn(jar),
        dummyStateIn(jar),
        dummyTeamEditsIn(jar),
        dummyOwnIn(jar),
        ownApplicationsStartOf(jar.get(TEST_DEVELOPER_APPLICATIONS_COOKIE)?.value),
        dummyPartnerEditsIn(jar),
        dummyFaqEditsIn(jar),
        dummyOutreachEditsIn(jar),
        dummyTeamPageEditsIn(jar),
        dummyAdvisorEditsIn(jar),
        dummyProjectEditsIn(jar),
        testGrantOf(jar.get(TEST_DEVELOPER_GRANT_COOKIE)?.value),
      ),
      true,
    );
  }
  // A plain Headers: getSessionCookie cannot read Next's request headers. A
  // test developer counts as holding one, so a seeded person who did not
  // resolve is not sent to /login, which the proxy would send back.
  const holdsSessionToken = viewer !== null || getSessionCookie(new Headers(await headers())) !== null;
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

/** Changes to the partners (issue #256, lib/dummy-data/partners.ts); the public pages never read them. */
function dummyPartnerEditsIn(jar: Jar): DummyPartnerEditsStore {
  return {
    current: parsePartnerEdits(jar.get(TEST_DEVELOPER_CONTENT_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_CONTENT_COOKIE, serializePartnerEdits(next)),
  };
}

/** Changes to the questions on /apply (issue #258, lib/dummy-data/faqs.ts); /apply never reads them. */
function dummyFaqEditsIn(jar: Jar): DummyFaqEditsStore {
  return {
    current: parseFaqEdits(jar.get(TEST_DEVELOPER_FAQ_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_FAQ_COOKIE, serializeFaqEdits(next)),
  };
}

/** Changes to the Team page's visual layer (issue #283, lib/dummy-data/team-page.ts); the public Team page never reads them. */
function dummyTeamPageEditsIn(jar: Jar): DummyTeamPageLayerEditsStore {
  return {
    current: parseTeamPageLayerEdits(jar.get(TEST_DEVELOPER_TEAM_PAGE_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_TEAM_PAGE_COOKIE, serializeTeamPageLayerEdits(next)),
  };
}

/** Changes to the Team page's advisors (issue #286, lib/dummy-data/team-page.ts); the public Team page never reads them. */
function dummyAdvisorEditsIn(jar: Jar): DummyAdvisorEditsStore {
  return {
    current: parseAdvisorEdits(jar.get(TEST_DEVELOPER_ADVISORS_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_ADVISORS_COOKIE, serializeAdvisorEdits(next)),
  };
}

/** Changes to the Outreach posts, summit and tags (issue #287, lib/dummy-data/outreach.ts); the public pages never read them. */
function dummyOutreachEditsIn(jar: Jar): DummyOutreachEditsStore {
  return {
    current: parseOutreachEdits(jar.get(TEST_DEVELOPER_OUTREACH_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_OUTREACH_COOKIE, serializeOutreachEdits(next)),
  };
}

/** Changes to the projects (issue #298, lib/dummy-data/projects.ts); the public pages never read them. */
function dummyProjectEditsIn(jar: Jar): DummyProjectEditsStore {
  return {
    current: parseProjectEdits(jar.get(TEST_DEVELOPER_PROJECTS_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_PROJECTS_COOKIE, serializeProjectEdits(next)),
  };
}

/** Changes on the viewer's own pages (issue #169, lib/dummy-data/own.ts); /apply reads them too. */
function dummyOwnIn(jar: Jar): OwnChangesStore {
  return {
    current: parseOwnChanges(jar.get(TEST_DEVELOPER_OWN_COOKIE)?.value),
    save: async (next) => setDummyCookie(jar, TEST_DEVELOPER_OWN_COOKIE, serializeOwnChanges(next)),
  };
}
