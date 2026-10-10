import type { Recruitment } from "@/lib/apply/positions";
import type { RecruitmentControl, SwitchRecruitmentResult } from "@/lib/apply/recruitment-switch";
import type { NavCounts } from "./access";
import type { AccessGrant, DivisionAccess } from "./division-access";
import type { DivisionOrders, Order } from "./orders";
import type { Overview } from "./overview";
import type { ApplicationStage, ApplicationsPage, PositionsPage } from "./recruitment";
import type { YourDetails } from "./details";
import type { InterviewSlot, MyApplications } from "./my-applications";
import type { DeleteAccount, MyAccount, MyProfile } from "./self";
import type { AlumniDirectory, MemberDirectory, MemberEdit, TeamTree } from "./team";
import type { DashboardViewer } from "./viewer";
import type { Upload, WriteResult } from "./write";

/**
 * The one way dashboard pages read and write data (issue #141). A test
 * developer gets the dummy arrays (lib/dummy-data/), everyone else the
 * database (./database.ts); ./open.ts picks which and answers a
 * DashboardOpening (./opening.ts). A later page adds one method here and to
 * both implementations.
 *
 * Positions and Applications (issue #142) answer only what the viewer
 * reaches, and a read or write there the viewer does not reach rejects with
 * DashboardRefused, so a server action needs no check of its own; a test
 * developer's write there changes only a cookie. The other pages' reads answer
 * null when the viewer has nothing on that page (an applicant has no
 * division), and their writes take what the browser sent as it came, check
 * it, and answer a WriteResult (./write.ts); a test developer's write there
 * lands nowhere and answers what the page shows next.
 */
export interface DashboardData {
  readonly viewer: DashboardViewer;
  navCounts(): Promise<NavCounts>;
  /** Whether the viewer has sent at least one application: the sidebar lists My applications only then. */
  hasOwnApplications(): Promise<boolean>;
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
  /**
   * Flips the switch when this viewer may, and refreshes /apply; otherwise
   * writes nothing. A refusal is its answer, not a DashboardRefused.
   */
  setRecruitment(recruitment: Recruitment): Promise<SwitchRecruitmentResult>;
  /** Boards 41 and 41c (issue #142). The switch on board 41 is `recruitment()`. */
  positions(): Promise<PositionsPage>;
  /** Board 41b (issue #142). */
  applications(): Promise<ApplicationsPage>;
  setPositionOpen(positionId: number, open: boolean): Promise<void>;
  setApplicationStage(applicationId: number, stage: ApplicationStage): Promise<void>;

  /** Board 43: the division lead's Access page. */
  divisionAccess(): Promise<DivisionAccess | null>;
  /** One grant per chosen target; answers the grants as the table shows them. */
  giveAccess(input: unknown): Promise<WriteResult<readonly AccessGrant[]>>;
  removeAccess(grantId: number): Promise<WriteResult<null>>;

  /** Board 44: the division lead's Orders page. */
  divisionOrders(): Promise<DivisionOrders | null>;
  /** The New order fields as typed, and the quote when one was attached. */
  placeOrder(fields: Record<string, string>, quote: Upload | null): Promise<WriteResult<Order>>;

  /** Board 55: a team member's own profile. */
  myProfile(): Promise<MyProfile | null>;
  saveLinkedin(text: string): Promise<WriteResult<string | null>>;
  /** A new photo, already cropped square by the browser, or null to remove it. */
  setPhoto(photo: Upload | null): Promise<WriteResult<null>>;
  /**
   * Board 55b: the member leaves the team at once, with the reason they gave
   * (may be empty). They show in Alumni and keep their sign-in.
   */
  leaveTeam(reason: string): Promise<WriteResult<null>>;

  /** Board 51: an applicant's own account. */
  myAccount(): Promise<MyAccount | null>;
  /**
   * "Your details" on My account and My profile, as the edit form sent them;
   * the apply form starts from what is saved. Answers the details as saved.
   */
  saveDetails(input: unknown): Promise<WriteResult<YourDetails>>;
  /** Boards 51c and 55c: closes the account; the rest only as ticked. The page signs out after. */
  deleteAccount(options: DeleteAccount): Promise<WriteResult<null>>;

  /** Boards 50 and 53: the viewer's own applications; null when they have none to follow. */
  myApplications(): Promise<MyApplications | null>;
  /** Board 50b: the lead stops seeing it at once, and it moves to Past as Withdrawn. */
  withdrawApplication(applicationId: number): Promise<WriteResult<null>>;
  /** Board 50c: the applicant confirms one of the times the lead offered. */
  chooseInterviewSlot(applicationId: number, slotId: number): Promise<WriteResult<InterviewSlot>>;
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

/** A read or write the viewer does not reach. */
export class DashboardRefused extends Error {
  constructor(what: string) {
    super(`Not allowed: ${what}`);
    this.name = "DashboardRefused";
  }
}
