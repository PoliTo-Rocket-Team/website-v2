import type { Recruitment } from "@/lib/apply/positions";
import { recruitment } from "./team";

// The recruitment switch in dummy mode (issue #121). A preview has no
// database, so a test developer's flip is kept in a cookie in their own
// browser: the dashboard writes it, and the dashboard and /apply read it on
// each request. No server memory holds it, so every instance of the preview
// answers the same, and two reviewers never flip each other's switch. Only
// the dummy sides read it; production never does.

export const DUMMY_RECRUITMENT_COOKIE = "prt_dummy_recruitment";

const COOKIE_VALUES = { open: true, closed: false } as const;
type CookieValue = keyof typeof COOKIE_VALUES;

/** The team's switch before anyone flips it. */
export const DEFAULT_DUMMY_RECRUITMENT: Recruitment = { isOpen: recruitment.open };

/** The switch as this browser left it; anything but a value this module wrote reads as the default. */
export function dummyRecruitmentOf(cookieValue: string | null | undefined): Recruitment {
  return cookieValue === "open" || cookieValue === "closed"
    ? { isOpen: COOKIE_VALUES[cookieValue] }
    : DEFAULT_DUMMY_RECRUITMENT;
}

/** The cookie value that stores this state. */
export function dummyRecruitmentCookieValue({ isOpen }: Recruitment): CookieValue {
  return isOpen ? "open" : "closed";
}

/** Where the dummy dashboard reads and keeps the switch. */
export type DummyRecruitmentStore = {
  readonly current: Recruitment;
  save(recruitment: Recruitment): Promise<void>;
};
