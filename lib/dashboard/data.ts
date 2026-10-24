import type { Recruitment } from "@/lib/apply/positions";
import type { RecruitmentControl, SwitchRecruitmentResult } from "@/lib/apply/recruitment-switch";
import type { AdvisorEditor } from "@/lib/about/advisors";
import type { TeamPageEditor } from "@/lib/about/team-page-editor";
import type { FaqEditor } from "@/lib/faq/editor";
import type { OutreachEditor } from "@/lib/outreach-editor";
import type { PartnerEditor } from "@/lib/partners-editor";
import type { ProjectEditor } from "@/lib/project-content/editor";
import type { DashboardLanding, NavCounts } from "./access";
import type { AccessGrant, AccessPage } from "./division-access";
import type { Order, OrdersPage } from "./orders";
import type { TeamSideOverview } from "./overview";
import type { LeadMove } from "./application-flow";
import type { DocumentKind, StoredDocument } from "./application-documents";
import type { CreatedPosition } from "./new-position";
import type { ApplicationsPage, PositionsPage } from "./recruitment";
import type { YourDetails } from "./details";
import type { AddLookup, DetailsTarget } from "./division-members";
import type { TeamSearch } from "./division-edit";
import type { TeamStructure } from "./team-structure";
import type { InterviewSlot, MyApplications } from "./my-applications";
import type { MyAlumni } from "./my-alumni";
import type { DeleteAccount, MyAccount, MyProfile } from "./self";
import type { AlumnusKey } from "@/lib/about/alumni-record";
import type { AlumniDirectory } from "./alumni";
import type { HandOverAnswer } from "./hand-over-request";
import type { MemberAliases } from "./alias-request";
import type { OwnAlias } from "./alias-setup";
import type { Departure, MemberDirectory, MemberEdit, TeamTree } from "./team";
import type { DashboardViewer } from "./viewer";
import type { Upload, WriteResult } from "./write";

/**
 * The one way dashboard pages read and write data (issue #141). Every page
 * reads the database (./database.ts) as the signed-in account; ./open.ts
 * opens it and answers a DashboardOpening
 * (./opening.ts). It is the one implementation (issue #613); a later page
 * adds one method here and to it.
 *
 * Positions and Applications (issue #142) answer only what the viewer
 * reaches, and a read or write there the viewer does not reach rejects with
 * DashboardRefused, so a server action needs no check of its own. The other
 * pages' reads answer null when the viewer has nothing on that page (an
 * applicant has no division), and their writes take what the browser sent as
 * it came, check it, and answer a WriteResult (./write.ts). A test
 * developer's write is saved to the shared preview database as their seeded
 * person on a preview, and refused anywhere else (lib/db-audit.ts, ADR 0016).
 */
export interface DashboardData {
  readonly viewer: DashboardViewer;
  navCounts(): Promise<NavCounts>;
  /**
   * Whether at least one of the viewer's applications is shown now
   * (`isShownAt`, ./my-applications.ts): the sidebar lists My applications
   * only then (issue #317).
   */
  hasShownApplications(): Promise<boolean>;
  /**
   * The team's own Overview (boards 40, 52, 56). Someone off the team has
   * theirs built by the page: a non-member's (boards 50e, 50f) from
   * `myApplications()` (./applicant-overview.ts), an alumnus's (issue
   * #317's board 56) from `myAlumni()` too (./my-alumni.ts). So this
   * rejects them with DashboardRefused.
   */
  overview(): Promise<TeamSideOverview>;
  /** Board 56b (issue #317): how the Alumni page shows the viewer; null for anyone but an alumnus. */
  myAlumni(): Promise<MyAlumni | null>;
  /**
   * My alumni's "Show me on the Alumni page": the alumnus's own request to
   * be left off the page, the one the leave-time box records (#257). Refused
   * for anyone but an alumnus.
   */
  setMyAlumniShown(shown: boolean): Promise<WriteResult<null>>;
  /** My alumni's photo, the one the Alumni page shows (`checkPhoto`, ./self.ts), or null to remove it. */
  setMyAlumniPhoto(photo: Upload | null): Promise<WriteResult<null>>;
  /**
   * Dismiss on a notice under "Needs your attention" (./notices.ts, issue
   * #201): it leaves the list. Refused for a notice that is not the viewer's.
   */
  dismissNotice(noticeId: number): Promise<WriteResult<null>>;
  /**
   * The Members page: the whole team (#143), or one of the lead's divisions
   * (`divisionId`, else their first) with the people waiting for Confirm NDA
   * and the accepted applicants joining it (boards 59 and 61e, #172, #231).
   */
  members(divisionId?: number | null): Promise<MemberDirectory>;
  /**
   * Add member's field (boards 61h, 69c): the team members whose name or
   * email matches, or whether an email is new to the team. Nothing for a
   * division the viewer's Members page does not reach.
   */
  findForAdd(divisionId: number, query: string): Promise<AddLookup>;
  /**
   * The lead and member pickers of New division and Edit division (boards
   * 68b2, 69d) and the head picker of New department (77d): the whole team
   * searched by name, or an email (#232, #251). Nothing for a viewer who
   * manages no division.
   */
  findPeople(query: string): Promise<TeamSearch>;
  /** The Alumni page (board 78, #257): everyone the public Alumni page can list, for a viewer who reaches it. */
  alumni(): Promise<AlumniDirectory>;
  /** The Team tree (#143), built from this year's roster. */
  teamTree(): Promise<TeamTree>;
  /**
   * The Team tree's edit view (boards 77b and 66t-b, #251): every open
   * department and division, with the pages Edit division and Close division
   * read for the divisions the viewer may change. Null for a viewer who edits
   * no structure: a division lead, a member, an applicant.
   */
  teamStructure(): Promise<TeamStructure | null>;
  /** Writes from the Team pages; null where this source stores none yet. */
  readonly teamWrites: TeamWrites | null;
  /** The site-wide recruitment switch (issue #121): its state, and whether this viewer may flip it. */
  recruitment(): Promise<RecruitmentControl>;
  /**
   * Flips the switch when this viewer may, and refreshes /apply; otherwise
   * writes nothing. A refusal is its answer, not a DashboardRefused.
   */
  setRecruitment(recruitment: Recruitment): Promise<SwitchRecruitmentResult>;
  /** Boards 41 and 57 (issues #142, #171). The switch on board 41 is `recruitment()`. */
  positions(): Promise<PositionsPage>;
  /** Boards 58 and 58b (issue #171). */
  applications(): Promise<ApplicationsPage>;
  /**
   * The CV or motivation letter of one application, for the document route
   * (issue #406): rejects with DashboardRefused unless `applications()` lists
   * that application for the viewer; null when no file is stored for it.
   */
  applicationDocument(applicationId: number, kind: DocumentKind): Promise<StoredDocument | null>;
  setPositionOpen(positionId: number, open: boolean): Promise<void>;
  /**
   * New position (boards 57a, 57b). A division the viewer may not post in
   * rejects with DashboardRefused; fields that fail `checkNewPosition`
   * (./new-position.ts), which the drawer runs first, answer the first error.
   */
  createPosition(input: unknown): Promise<WriteResult<CreatedPosition>>;
  /**
   * Edit position (issue #207): the role's text, lists and motivation letter
   * setting, checked as New position checks them (`checkPositionContent`,
   * ./new-position.ts). Its division and open state stay as they are. A
   * position the viewer does not reach rejects with DashboardRefused.
   */
  editPosition(positionId: number, input: unknown): Promise<WriteResult<null>>;
  /**
   * One step on an application (boards 58 to 58i). Which steps are legal is
   * ./application-flow.ts's; an illegal one answers why and writes nothing.
   * Only Confirm join adds the person to the team.
   */
  moveApplication(applicationId: number, move: LeadMove): Promise<WriteResult<null>>;

  /** Boards 60 to 60m (a division lead) and 65 to 65m (a department head): the Access page, the only place access is given, changed or removed. */
  divisionAccess(): Promise<AccessPage | null>;
  /**
   * Give access or Edit access (boards 60b, 60c, 65b): one person's areas in
   * one place (the lead's division; the head's whole department or one of its
   * divisions) become the ones sent, each at its own level, in one audited
   * write. Answers all the person's grants as the table shows them.
   */
  saveAccess(input: unknown): Promise<WriteResult<readonly AccessGrant[]>>;
  /** Remove all access (board 60c): every area the person holds in the viewer's division or department. */
  removeAllAccess(personId: number): Promise<WriteResult<null>>;
  /**
   * Remove on one "Current access" row in Edit access (issue #483): one area
   * of one person in one place goes, checked by `checkRemoveGrant`, and
   * nothing else changes. Answers all the person's grants as the table shows them.
   */
  removeGrant(input: unknown): Promise<WriteResult<readonly AccessGrant[]>>;

  /**
   * Boards 61 to 61d, 61m, 67 and 67b (issue #233): every order in the team,
   * for anyone with any Orders access, with what the viewer edits and whether
   * they decide (./orders.ts); null for anyone with no Orders access.
   */
  orders(): Promise<OrdersPage | null>;
  /**
   * The New order fields as typed, with `division` (the division's id) when
   * the viewer may order for more than one, and the quote when one was
   * attached. Refused for a division outside the viewer's scope.
   */
  placeOrder(fields: Record<string, string>, quote: Upload | null): Promise<WriteResult<Order>>;
  /**
   * Edit order, or Edit and send again (boards 61c and 61d): the request with
   * the fields as typed, back to waiting. A quote replaces the one on file;
   * none keeps it. Refused for an order outside the viewer's scope
   * (`canEditOrder`), and once the team leader has approved or rejected it.
   */
  editOrder(orderId: number, fields: Record<string, string>, quote: Upload | null): Promise<WriteResult<Order>>;
  /**
   * Cancel request: the request leaves the page. Allowed only while the
   * request is waiting and in the viewer's scope: refused on Changes
   * requested, Approved and Rejected, and on anyone else's order.
   */
  cancelOrder(orderId: number): Promise<WriteResult<null>>;
  /**
   * Approve, reject or ask for changes on a waiting request (`checkDecision`,
   * ./orders.ts): refused for everyone but the team leader and the people
   * they gave "Approve orders". Answers the request as it now reads.
   */
  decideOrder(orderId: number, input: unknown): Promise<WriteResult<Order>>;
  /**
   * Mark as ordered (board 70c, `checkMarkOrdered`, ./orders.ts): an approved
   * request becomes Ordered. Refused for anyone who does not decide orders, and
   * for a request in any state but Approved. Answers the request as it now reads.
   */
  markOrdered(orderId: number): Promise<WriteResult<Order>>;
  /**
   * Give or remove "Approve orders" (`checkApproveOrdersChange`, ./orders.ts):
   * only the team leader may, and any number of people may hold it.
   */
  setApproveOrders(input: unknown): Promise<WriteResult<null>>;

  /**
   * Boards 76 and 76b (issue #256): the partners and their writes, behind the
   * site-content gate (lib/content/gate.ts), over the database's store.
   */
  readonly partners: PartnerEditor;

  /**
   * Boards 79 and 79b (issue #258): the questions on /apply and their writes,
   * behind the same gate, over the database's store and the time now.
   */
  readonly faqs: FaqEditor;

  /**
   * The Team page's visual layer (issue #283): Save draft, Publish and Reset
   * to team, behind the same gate. Save draft and Publish write the layer and
   * the advisor list together, in one step (issue #321); Reset to team writes
   * the layer alone. None writes a role, division, department, scope or
   * member. Its store and its roles are the database's.
   */
  readonly teamPage: TeamPageEditor;

  /**
   * The Team page's advisors (issue #286): added by hand, never from roles,
   * behind the same gate. The editor saves them with the layer (`teamPage`);
   * End advising also adds the advisor to the Alumni page's Advisors group. Reset to team never reaches them. Each side brings its own store:
   * the database's, or, in tests, a cookie over today's advisors.
   */
  readonly teamAdvisors: AdvisorEditor;

  /**
   * Boards 74 to 74h (issue #287): the Outreach posts, which of them are
   * featured (issue #496), the tag list, and their writes, behind the same
   * gate, over the database's store.
   */
  readonly outreach: OutreachEditor;

  /**
   * Boards 75 to 75d (issues #255 and #298): the projects and their writes,
   * behind the same gate, over the database's store.
   */
  readonly projects: ProjectEditor;

  /** Board 55: a team member's own profile. */
  myProfile(): Promise<MyProfile | null>;
  saveLinkedin(text: string): Promise<WriteResult<string | null>>;
  /** A new photo, already cropped square by the browser, or null to remove it. */
  setPhoto(photo: Upload | null): Promise<WriteResult<null>>;
  /**
   * Board 55b: the member leaves the team at once, with the reason they gave
   * (may be empty). They show in Alumni and keep their sign-in, unless they
   * ticked "Remove my name from the Alumni page" (issue #257). Answers the
   * page that now opens their dashboard (LANDING_AFTER_LEAVING, ./access.ts).
   */
  leaveTeam(reason: string, removeFromAlumni: boolean): Promise<WriteResult<DashboardLanding>>;
  /**
   * Board 55d (issue #262): "Send for confirmation" stores the lead's or
   * head's hand-over as waiting, checked by `planHandOverSend`
   * (./hand-over-request.ts). No role changes until the next level up answers.
   */
  sendHandOver(input: unknown): Promise<WriteResult<null>>;
  /**
   * Board 62c: Confirm or Decline on a hand-over waiting for the viewer,
   * checked by `planHandOverAnswer`. Confirm runs the hand-over at once;
   * either answer notifies the sender. Refused for anyone but the next level up.
   */
  answerHandOver(requestId: number, answer: HandOverAnswer): Promise<WriteResult<null>>;

  /**
   * Epic #538 (boards 94, 94b, 94e): the email alias of each of `memberIds`
   * on the team, which is their PRT email (issue #563), as the member
   * drawer's PRT email row shows it to the viewer, with whether they may
   * request one or cancel the open request (`memberAliasesFor`,
   * ./alias-request.ts). Someone not on the team is left out.
   */
  memberAliases(memberIds: readonly number[]): Promise<MemberAliases>;
  /**
   * Request alias (board 94): checked by `planAliasRequest`; refused for
   * anyone but a lead, head or the team leader who may manage the member,
   * and while the member's PRT email is set or a request is open.
   */
  requestAlias(memberId: number): Promise<WriteResult<null>>;
  /** Cancel request (board 94b): checked by `planAliasCancel`. */
  cancelAliasRequest(requestId: number): Promise<WriteResult<null>>;
  /**
   * Decline or Mark created on an open request (boards 94c, 94d), checked by
   * `planAliasAnswer`: only the team leader, the operations lead and the IT
   * lead. Mark created saves the address as the member's PRT email; the answer
   * writes the notices `aliasAnswerNotices` names.
   */
  answerAlias(requestId: number, answer: unknown): Promise<WriteResult<null>>;
  /**
   * Issue #542 (boards 94f, 94g): the viewer's own alias and whether they set
   * it up (`ownAliasOf`, ./alias-setup.ts); null off the team or with none.
   * It reads the viewer's own record and nobody else's.
   */
  myAlias(): Promise<OwnAlias | null>;
  /**
   * "I've set it up" (board 94g), checked by `planAliasSetUp`: stored on the
   * viewer's own record only, and refused with no alias or once set up.
   */
  confirmAliasSetUp(): Promise<WriteResult<null>>;

  /** Board 51: an applicant's own account. */
  myAccount(): Promise<MyAccount | null>;
  /**
   * "Your details" on My account and My profile, as the edit form sent them;
   * the apply form starts from what is saved. Answers the details as saved.
   */
  saveDetails(input: unknown): Promise<WriteResult<YourDetails>>;
  /** Boards 51c and 55c: closes the account; the rest only as ticked. The page signs out after. */
  deleteAccount(options: DeleteAccount): Promise<WriteResult<null>>;

  /**
   * Boards 50 and 53: the viewer's own applications the one-month rule
   * shows (`isShownAt`, ./my-applications.ts, issue #317), empty lists when
   * none is (issue #179); null for a viewer who does not apply.
   */
  myApplications(): Promise<MyApplications | null>;
  /** Board 50b: the lead stops seeing it at once, and it moves to Past as Withdrawn. */
  withdrawApplication(applicationId: number): Promise<WriteResult<null>>;
  /** Board 50c: the applicant confirms one of the times the lead offered. */
  chooseInterviewSlot(applicationId: number, slotId: number): Promise<WriteResult<InterviewSlot>>;
}

/**
 * The boolean writes answer whether the change was made: false when the
 * viewer may not make it or the person is not theirs to change. Every write
 * checks on the server, not only in the menu.
 */
export interface TeamWrites {
  /** The Shown / Hidden switch on board 78: whether the public Alumni page lists them. */
  setAlumnusShown(key: AlumnusKey, shown: boolean): Promise<boolean>;
  /**
   * Board 78b's Save: name, founder mark, per-year role text, shown or
   * hidden, checked by `checkAlumnusFix` (./alumni.ts). It changes only the
   * Alumni page: never a role, a division or access.
   */
  fixAlumnus(key: AlumnusKey, input: unknown): Promise<WriteResult<null>>;
  /** Board 78b's photo: a JPEG or PNG of at most 2 MB, or null to remove it. */
  setAlumnusPhoto(key: AlumnusKey, photo: Upload | null): Promise<WriteResult<null>>;
  /** Board 78c: an external advisor, always in the Advisors group (`checkAdvisor`, ./alumni.ts). */
  addAdvisor(input: unknown, photo: Upload | null): Promise<WriteResult<null>>;
  /**
   * Lead or member in one division, from Edit details' position part (issue
   * #584): for someone the viewer may edit, where `mayChangeDivision` lets
   * them change that division's leads. A division lead never changes a lead
   * (Owner decision on #231), so their change is refused.
   */
  saveMember(personId: number, edit: MemberEdit): Promise<boolean>;
  /**
   * "Leaves the team" (board 59d, widened by #231): every role and every
   * access grant ends and the person moves to Alumni; their account stays.
   * Refused unless `mayLeaveTeam` (./team.ts) allows it.
   */
  moveToAlumni(personId: number, departure: Departure): Promise<boolean>;
  /**
   * Board 59: the accepted applicant joins the division the position belongs
   * to. It is the Applications page's Confirm join, decided by the same rule
   * (`moveApplication`), never by the Members area (issue #584).
   */
  confirmJoin(applicationId: number): Promise<boolean>;
  /**
   * Add member (boards 61h, 61h2): someone on the team joins the division at
   * once and keeps their other divisions; an email new to the team waits for
   * Confirm NDA. Answers which happened.
   */
  addMember(input: unknown): Promise<WriteResult<"joined" | "waiting">>;
  /** Confirm NDA: the person waiting becomes a member, with the date and who confirmed it. */
  confirmNda(joinId: number): Promise<boolean>;
  /** Cancel add: the person waiting for Confirm NDA is no longer added. Nothing else changes, since they never joined. */
  cancelAdd(joinId: number): Promise<boolean>;
  /** "Remove from <division>": only that division's role ends. Refused for someone whose only division it is. */
  removeFromDivision(personId: number, divisionId: number): Promise<boolean>;
  /**
   * Edit details or Fill details (board 61g, issue #584): the details of
   * anyone the viewer may edit, and the title in `divisionId`, which they
   * must reach and the person be in; null for someone in no division the
   * viewer reaches (a seat), whose title is not set here.
   */
  saveMemberDetails(target: DetailsTarget, divisionId: number | null, input: unknown): Promise<WriteResult<null>>;
  /** The photo in Edit details, for anyone the viewer may edit: a square JPEG under 500 KB, or null to remove it. */
  setMemberPhoto(personId: number, photo: Upload | null): Promise<WriteResult<null>>;
  /**
   * New division (board 69d, #232): a division in the department with its
   * name, code, leads and members, checked by `planDivisionSave`
   * (./division-edit.ts). Answers the new division's id.
   */
  createDivision(departmentId: number, input: unknown): Promise<WriteResult<number>>;
  /**
   * Edit division (boards 68b to 68b4): name, code and leads, with what
   * happens to each old lead. Refused for a closed division: a closed
   * division never opens again (#251).
   */
  saveDivision(divisionId: number, input: unknown): Promise<WriteResult<null>>;
  /**
   * Close division (board 68c): refused while anyone is in it; closing also
   * closes its open positions and removes the access given in it.
   */
  closeDivision(divisionId: number): Promise<WriteResult<null>>;
  /**
   * New department (board 77d, #251): name, code and one head, checked by
   * `planDepartmentCreate` (./department-edit.ts). The team leader and full
   * access only. Answers the new department's id.
   */
  createDepartment(input: unknown): Promise<WriteResult<number>>;
  /** Edit department's Save changes (board 77e): its name and code. The team leader and full access only. */
  saveDepartment(departmentId: number, input: unknown): Promise<WriteResult<null>>;
  /**
   * Close department (board 77f): each open division moves to another
   * department with its people, leads and open positions, or closes when it
   * is empty; then the department closes, and its head becomes an advisor or
   * leaves the team, as the closer picked (refused when nothing was picked).
   * Checked by `planDepartmentClose`.
   */
  closeDepartment(departmentId: number, input: unknown): Promise<WriteResult<null>>;
  /**
   * "Hand over the role" on the Team Leader box (board 77i, issue #253): who
   * takes over, and whether the team leader becomes an advisor or leaves the
   * team, checked by `planTeamLeaderHandOver` (./hand-over.ts). Only the
   * current team leader; everyone else is refused.
   */
  handOverTeamLeader(input: unknown): Promise<WriteResult<null>>;
}

/** A read or write the viewer does not reach. */
export class DashboardRefused extends Error {
  constructor(what: string) {
    super(`Not allowed: ${what}`);
    this.name = "DashboardRefused";
  }
}
