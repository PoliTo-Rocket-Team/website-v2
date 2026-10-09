import type { Recruitment } from "@/lib/apply/positions";
import type { RecruitmentControl, SwitchRecruitmentResult } from "@/lib/apply/recruitment-switch";
import type { NavCounts } from "./access";
import type { Overview } from "./overview";
import type { AlumniDirectory, MemberDirectory, MemberEdit, TeamTree } from "./team";
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
  /** The Members page (#143): the whole team, or the lead's own division. */
  members(): Promise<MemberDirectory>;
  /** The Alumni page (#143). */
  alumni(): Promise<AlumniDirectory>;
  /** The Team tree (#143), built from this year's roster. */
  teamTree(): Promise<TeamTree>;
  /** Writes from the Team pages; null where this source stores none yet. */
  readonly teamWrites: TeamWrites | null;
  /** The site-wide recruitment switch (issue #121): its state, and whether this viewer may flip it. */
  recruitment(): Promise<RecruitmentControl>;
  /** Flips the switch when this viewer may, and refreshes /apply; otherwise writes nothing. */
  setRecruitment(recruitment: Recruitment): Promise<SwitchRecruitmentResult>;
}

/**
 * Each answers whether the change was made: false when the viewer may not
 * make it or the person is not theirs to change.
 */
export interface TeamWrites {
  setShownOnSite(alumnusId: number, shown: boolean): Promise<boolean>;
  saveMember(personId: number, edit: MemberEdit): Promise<boolean>;
  moveToAlumni(personId: number): Promise<boolean>;
}
