import type { Recruitment } from "@/lib/apply/positions";
import type { RecruitmentControl, SwitchRecruitmentResult } from "@/lib/apply/recruitment-switch";
import type { NavCounts } from "./access";
import type { Overview } from "./overview";
import type { DashboardViewer } from "./viewer";

/**
 * The one way dashboard pages read data (issue #141). A test developer gets
 * the dummy arrays (lib/dummy-data/), everyone else the database
 * (./database.ts); ./open.ts picks which and answers a DashboardOpening
 * (./opening.ts). A later page adds one method here and to both
 * implementations.
 */
export interface DashboardData {
  readonly viewer: DashboardViewer;
  navCounts(): Promise<NavCounts>;
  overview(): Promise<Overview>;
  /** The site-wide recruitment switch (issue #121): its state, and whether this viewer may flip it. */
  recruitment(): Promise<RecruitmentControl>;
  /** Flips the switch when this viewer may, and refreshes /apply; otherwise writes nothing. */
  setRecruitment(recruitment: Recruitment): Promise<SwitchRecruitmentResult>;
}
