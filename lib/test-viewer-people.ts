// The seeded person each test viewer is (issues #247, #307, ADR 0016). On a
// preview that reads its seeded database, a test developer who views as one
// of lib/dashboard/viewer.ts's test viewers is read as this person. The seed's
// people module (db/seed/people.ts) seeds every one of them, and
// lib/seed/cases.test.ts fails when one is missing. It lives here, apart from
// the seed rows, so the app reads it without loading the seed.

import type { TestViewer } from "@/lib/dashboard/viewer";
import { TESTERS } from "@/lib/dev-tester";

/** A user id made for the seed: `5eed0000-…-0000000000NN`, NN the member id. */
export function seedUserId(memberId: number): string {
  return `5eed0000-0000-4000-8000-${String(memberId).padStart(12, "0")}`;
}

/** The seeded team leader since 2025–26, by member id. */
export const SEEDED_TEAM_LEADER = 1;
/** The seeded alumnus whose name an editor fixed for the Alumni page, by member id. */
export const SEEDED_RENAMED_ALUMNUS = 50;

/**
 * The seeded person each test viewer is, by user id: the team leader, the
 * alumnus whose name was fixed for the Alumni page (every role ended, an
 * Alumni entry kept; issue #317), and the local tester of each other kind.
 */
export const TEST_VIEWER_PEOPLE: Readonly<Record<TestViewer, string>> = {
  "team-leader": seedUserId(SEEDED_TEAM_LEADER),
  "operations-lead": TESTERS["operations-lead"].id,
  "department-head": TESTERS["department-head"].id,
  "division-lead": TESTERS["division-lead"].id,
  member: TESTERS.member.id,
  alumni: seedUserId(SEEDED_RENAMED_ALUMNUS),
  "non-member": TESTERS.applicant.id,
};
