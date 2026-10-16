import { positionCode, type Recruitment } from "@/lib/apply/positions";
import { canSwitchRecruitmentAs, switchRecruitment } from "@/lib/apply/recruitment-switch";
import { landingAfterLeaving, type NavCounts } from "@/lib/dashboard/access";
import { DashboardRefused, type DashboardData } from "@/lib/dashboard/data";
import { formatEuro, waitingOrders } from "@/lib/dashboard/orders";
import { partnerEditor } from "@/lib/partners-editor";
import { dummyLogoFiles, dummyPartnerStore, NO_PARTNER_EDITS_STORE, type DummyPartnerEditsStore } from "./partners";
import {
  checklistProgress,
  divisionShortName,
  noPhotoItem,
  interviewOrder,
  oldestLine,
  type ActivityItem,
  type AttentionItem,
  type ChecklistItem,
  type DepartmentOverview,
  type DivisionOverview,
  type DivisionSummary,
  type PersonalOverview,
  type RosterPerson,
  type TeamLeaderOverview,
  type TeamOverview,
  type TeamSideOverview,
  type UpcomingInterview,
} from "@/lib/dashboard/overview";
import { homeDivisionOf, isIn, membershipsIn, roleIn, type Departure, type RosterEntry } from "@/lib/dashboard/team";
import { applyMove, type LeadMove } from "@/lib/dashboard/application-flow";
import { checkNewPosition, checkPositionContent, newPositionCode, type DivisionChoice, type PositionContent } from "@/lib/dashboard/new-position";
import {
  ago,
  appliedLabels,
  fileSize,
  quietDays,
  quietNote,
  type ApplicationEntry,
  type ApplicationsPage,
  type ApplicationsScope,
  type DepartmentUnit,
  type OtherApplication,
  type PositionRow,
  type PositionsPage,
} from "@/lib/dashboard/recruitment";
import { kindOfTestViewer, testDeveloperStanding, type DashboardViewer, type TestViewer, type ViewerKind } from "@/lib/dashboard/viewer";
import { departmentSummaries, leaderAttention, leaderStats } from "@/lib/dashboard/leader-overview";
import { applications as baseApplications, type DummyApplication } from "./applications";
import { departmentCode, divisionLabel, positionText } from "./apply";
import { applyDummyChange, fitsDummyCookie, type DummyChange, type DummyState, type DummyStateStore } from "./state";
import { refused, written } from "@/lib/dashboard/write";
import { dummyAccessPage, dummyRemoveAllAccess, dummySaveAccess } from "./division";
import {
  dummyCancelOrder,
  dummyDecideOrder,
  dummyEditOrder,
  dummyMarkOrdered,
  dummyOrdersIn,
  dummyOrdersPage,
  dummyPlaceOrder,
  dummySetApproveOrders,
} from "./orders";
import { NO_TEAM_EDITS, type TeamEdits, type TeamEditsStore } from "./edits";
import { dummyNoticeAttention, dummyNoticesOf, isDummyNoticeOpen, type DummyNotices } from "./notices";
import { leaveReason, type LeaveState } from "@/lib/dashboard/self";
import { NO_OWN_STORE, type OwnApplicationsStart, type OwnChangesStore } from "./own";
import { dummyDetails, ownApplicationsOf } from "./own-applications";
import type { YourDetails } from "@/lib/dashboard/details";
import {
  dummyChooseSlot,
  dummyDeleteAccount,
  dummyMyAccount,
  dummyMyApplications,
  dummyMyProfile,
  dummySaveDetails,
  dummySaveLinkedin,
  dummySetPhoto,
  dummyWithdraw,
  teamEmailOf,
} from "./self";
import type { NavViewer } from "@/lib/nav-viewer-shape";
import {
  activity,
  applicant,
  departments,
  divisions,
  DUMMY_NOW,
  people,
  personFor,
  positions as basePositions,
  recruitment,
  roster,
  type DummyPerson,
  type DummyPosition,
} from "./team";
import type { DummyRecruitmentStore } from "./recruitment";
import { dummyJoiners, dummyOrg, dummyRecords, dummyStanding, dummyTeamPages, editedRoster } from "./team-pages";

// The test developer's side of the dashboard data interface: every answer is
// built from the arrays in ./team.ts and ./applications.ts, with no database,
// so it works on a preview that has no DATABASE_URL. What a test developer
// changes is laid over those arrays: the recruitment switch (#121,
// ./recruitment.ts) and the positions and applications they changed
// (./state.ts). Those writes save only through the store the caller hands in
// (a cookie, lib/dashboard/open.ts); the other pages' writes (./division.ts,
// ./self.ts) store nothing.

/** The dummy team as this test developer has left it. */
type Team = {
  readonly recruitmentOpen: boolean;
  readonly positions: readonly DummyPosition[];
  readonly applications: readonly DummyApplication[];
  /** What each role says, as the arrays wrote it or the test developer rewrote it. */
  readonly content: ReadonlyMap<number, PositionContent>;
  /** Division codes the test developer changed in Edit division (#232): a position's code reads its division's code. */
  readonly divisionCodes: ReadonlyMap<number, string>;
};

/**
 * The team with the test developer's division edits (#232): a position in a
 * closed division is closed, as Close division closes them, and a changed
 * division code is the one its positions' codes read.
 */
function withDivisionEdits(team: Team, edits: TeamEdits): Team {
  const { closed } = dummyOrg(edits);
  const shut = new Set(closed.map((d) => d.id));
  const codes = new Map(Object.entries(edits.divisions).flatMap(([id, d]) => (d.code === null ? [] : [[Number(id), d.code] as const])));
  return {
    ...team,
    positions: team.positions.map((p) => (shut.has(p.divisionId) ? { ...p, open: false } : p)),
    divisionCodes: codes,
  };
}

/**
 * What a role in the arrays says before any edit: the public pages' text
 * (./apply.ts) and the role's own question and letter setting. A role the
 * test developer posted says what they wrote, kept in the state cookie.
 */
function baseContent(p: DummyPosition): PositionContent | null {
  const text = positionText[p.id as keyof typeof positionText];
  if (!text) return null;
  return {
    title: p.title,
    description: text.description,
    required: [...text.required],
    desirable: [...text.desirable],
    questions: p.question ? [p.question] : [],
    motivationLetter: p.requiresMotivationLetter,
  };
}

/** A posted role whose text the cookie no longer holds still has its title and letter setting. */
function contentOf(p: DummyPosition, team: Team): PositionContent {
  return (
    team.content.get(p.id) ?? {
      title: p.title,
      description: "",
      required: [],
      desirable: [],
      questions: [],
      motivationLetter: p.requiresMotivationLetter,
    }
  );
}

/** A role the test developer posted, as the arrays hold a position. */
function postedPosition(p: DummyState["newPositions"][number]): DummyPosition {
  return {
    id: p.id,
    title: p.title,
    slug: String(p.id),
    divisionId: p.divisionId,
    open: p.open,
    updatedAt: p.createdAt,
    question: "",
    requiresMotivationLetter: p.motivationLetter,
  };
}

function teamOf({ isOpen }: Recruitment, state: DummyState): Team {
  const positions: DummyPosition[] = [...basePositions, ...state.newPositions.map(postedPosition)];
  const edits = new Map(state.positionEdits.map((e) => [e.id, e.content]));
  const content = new Map<number, PositionContent>();
  for (const p of positions) {
    const said = edits.get(p.id) ?? baseContent(p);
    if (said) content.set(p.id, said);
  }
  return {
    recruitmentOpen: isOpen,
    positions: positions.map((p) => {
      const edit = edits.get(p.id);
      const edited = edit
        ? { title: edit.title, requiresMotivationLetter: edit.motivationLetter, question: edit.questions[0] ?? "", updatedAt: DUMMY_NOW }
        : {};
      return { ...p, ...edited, open: state.positionOpen[p.id] ?? p.open };
    }),
    applications: baseApplications.map((a) => ({ ...a, state: state.applications[a.id] ?? a.state })),
    content,
    divisionCodes: new Map(),
  };
}

const NOW = new Date(DUMMY_NOW);

/** Monday of the week DUMMY_NOW falls in, at midnight in Turin. */
const MONDAY = new Date("2026-10-05T00:00:00+02:00");

/**
 * The one division a page about the viewer names: their home division
 * (`homeDivision`). Null for the team leader, a head, or someone not yet placed.
 */
function divisionIdOfPerson(person: DummyPerson): number | null {
  return homeDivisionOf(person.placement);
}

/** Their role in `divisionId`, or null when they are not in it. */
function roleInDivision(person: DummyPerson, divisionId: number) {
  return roleIn(membershipsIn(person.placement), divisionId);
}

/** The viewer's own division; the division lead and the member viewers both have one. */
function myDivisionId(kind: "division-lead" | "member"): number {
  return divisionIdOfPerson(personFor[kind])!;
}

/** The department head viewer's department (Aerodynamics) and its divisions, in tab order (issue #230). */
function headDepartment() {
  const placement = personFor["department-head"].placement;
  const id = placement.role === "head" ? placement.departmentId : -1;
  const department = departments.find((d) => d.id === id)!;
  const own = divisions.filter((d) => d.departmentId === id).sort((a, b) => a.name.localeCompare(b.name));
  return { ...department, divisions: own, divisionIds: own.map((d) => d.id) as number[] };
}

/** Who a test developer signed in as `viewer` is: the dashboard's user card and the navbar show this name. */
export function dummyViewer(viewer: TestViewer): DashboardViewer {
  if (viewer === "non-member") {
    return { ...testDeveloperStanding(viewer), name: applicant.name, role: "Applicant", session: "test-developer" };
  }
  const person = personFor[viewer];
  return { ...testDeveloperStanding(viewer), name: person.name, role: person.title, session: "test-developer" };
}

/** The navbar's account menu for a test developer (board 01b): the applicant has no team address, so their sign-in one. */
export function dummyNavViewer(viewer: TestViewer): NavViewer {
  if (viewer === "non-member") return { name: applicant.name, email: applicant.email, photoUrl: null, session: "test-developer" };
  const person = personFor[viewer];
  return { name: person.name, email: teamEmailOf(person), photoUrl: null, session: "test-developer" };
}

function divisionOf(id: number) {
  return divisions.find((d) => d.id === id)!;
}

function departmentOf(divisionId: number) {
  const division = divisionOf(divisionId);
  return departments.find((d) => d.id === division.departmentId)!;
}

/** The positions a viewer reaches: the whole team, the head's department, or the lead's division. */
function positionsFor(kind: ViewerKind, team: Team): readonly DummyPosition[] {
  if (kind === "operations-lead") return team.positions;
  if (kind === "department-head") {
    const ids = headDepartment().divisionIds;
    return team.positions.filter((p) => ids.includes(p.divisionId));
  }
  if (kind === "division-lead") return team.positions.filter((p) => p.divisionId === myDivisionId(kind));
  return [];
}

function applicationsTo(list: readonly DummyPosition[], team: Team): DummyApplication[] {
  const ids = new Set(list.map((p) => p.id));
  return team.applications.filter((a) => ids.has(a.positionId));
}

function newApplications(list: readonly DummyPosition[], team: Team): number {
  return applicationsTo(list, team).filter((a) => a.state.stage === "new").length;
}

function sinceMonday(list: readonly DummyPosition[], team: Team): string {
  const fresh = applicationsTo(list, team).filter((a) => a.state.stage === "new" && new Date(a.appliedAt) >= MONDAY);
  return `+${fresh.length} since Monday`;
}

/** The latest application to a position, or its last edit when it has none. */
function lastActivity(position: DummyPosition, team: Team): Date {
  const times = applicationsTo([position], team).map((a) => new Date(a.appliedAt).getTime());
  return new Date(times.length > 0 ? Math.max(...times) : new Date(position.updatedAt).getTime());
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** When the oldest new application to `position` came in. */
function oldestNew(position: DummyPosition, team: Team): Date {
  const times = applicationsTo([position], team)
    .filter((a) => a.state.stage === "new")
    .map((a) => new Date(a.appliedAt).getTime());
  return new Date(Math.min(...times));
}

function attentionFor(kind: ViewerKind, team: Team, dummyNotices: DummyNotices): AttentionItem[] {
  const scoped = positionsFor(kind, team);
  const fresh = scoped.flatMap((p): AttentionItem[] => {
    const n = newApplications([p], team);
    if (n === 0) return [];
    return [
      {
        kind: "applications",
        title: `${plural(n, "new application", "new applications")} for ${p.title}`,
        // The operations lead sees where the role sits; a lead or head, how long it has waited (boards 56, 62m).
        detail:
          kind === "division-lead" || kind === "department-head"
            ? oldestLine(oldestNew(p, team), NOW)
            : `${departmentOf(p.divisionId).name} · ${divisionOf(p.divisionId).name}`,
        action: { label: "Review", href: `/dashboard/applications?position=${p.slug}` },
      },
    ];
  });
  const quiet = scoped.flatMap((p): AttentionItem[] => {
    const days = quietDays(p.open, lastActivity(p, team), NOW);
    if (days === null) return [];
    return [
      {
        kind: "quiet-position",
        title: `${p.title} has had no applications in ${days} days`,
        detail: `${departmentOf(p.divisionId).name} · consider editing or closing it`,
        action: { label: "Open", href: `/dashboard/positions?position=${p.slug}` },
      },
    ];
  });
  const unplaced = kind === "operations-lead" ? people.filter((p) => p.placement.role === "divisions" && p.placement.memberships.length === 0) : [];
  const unassigned: AttentionItem[] =
    unplaced.length === 0
      ? []
      : [
          {
            kind: "unassigned",
            title: `${plural(unplaced.length, "new member has", "new members have")} no division yet`,
            detail: `Added to the ${roster.season} roster`,
            action: { label: "Assign", href: "/dashboard/members" },
          },
        ];
  const covered = kind === "division-lead" ? [myDivisionId(kind)] : kind === "department-head" ? headDepartment().divisionIds : [];
  const noPhoto = noPhotoItem(
    people
      .filter((p) => covered.some((id) => roleInDivision(p, id) === "member") && !p.hasPhoto)
      .map((p) => p.name),
  );
  const notices =
    kind === "operations-lead" || kind === "department-head" || kind === "division-lead"
      ? dummyNoticeAttention(personFor[kind], dummyNotices, NOW)
      : [];
  return [...fresh, ...quiet, ...unassigned, ...(noPhoto ? [noPhoto] : []), ...notices];
}

function activityFor(kind: Exclude<ViewerKind, "non-member" | "member">, me: DummyPerson = personFor[kind]): ActivityItem[] {
  const events =
    kind === "operations-lead"
      ? activity
      : kind === "department-head"
        ? activity.filter((a) => a.divisionId !== null && headDepartment().divisionIds.includes(a.divisionId))
        : activity.filter((a) => a.divisionId === divisionIdOfPerson(me));
  return events.slice(0, 5).map((a) => ({
    actor: a.actor,
    text: a.text,
    when: a.when,
    self: a.actorId === me.id,
  }));
}

/** Board 40: the operations lead's figures, attention and activity across the team. */
function teamOverview(team: Team, notices: DummyNotices): TeamOverview {
  const kind = "operations-lead";
  const scoped = positionsFor(kind, team);
  const open = scoped.filter((p) => p.open);
  const openDepartments = new Set(open.map((p) => departmentOf(p.divisionId).id));
  return {
    shape: "team",
    stats: [
      { label: "New applications", value: String(newApplications(scoped, team)), detail: sinceMonday(scoped, team) },
      { label: "Open positions", value: String(open.length), detail: `In ${openDepartments.size} departments` },
      {
        label: "Recruitment",
        value: team.recruitmentOpen ? "Open" : "Closed",
        detail: team.recruitmentOpen
          ? recruitment.open
            ? `Public on the site since ${recruitment.since}`
            : "Public on the site"
          : "Positions are hidden on the site",
        live: team.recruitmentOpen,
      },
      { label: "Team members", value: String(roster.members), detail: `${roster.season} roster` },
    ],
    attention: attentionFor(kind, team, notices),
    activity: activityFor(kind),
  };
}

/**
 * Board 72 (issue #252): the team leader's figures, what waits for their
 * decision, the Departments panel and the team's recent activity, over the
 * team as the test developer left it.
 */
function leaderOverview(team: Team, edits: TeamEdits, notices: DummyNotices): TeamLeaderOverview {
  const me = personFor["team-leader"];
  const { org } = dummyOrg(edits);
  const records = dummyRecords(edits, dummyJoiners(team.applications));
  const open = team.positions.filter((p) => p.open);
  const orders = dummyOrdersIn(org.divisions.map((d) => d.id));
  return {
    shape: "leader",
    stats: leaderStats({
      newApplications: newApplications(team.positions, team),
      newDetail: sinceMonday(team.positions, team),
      openPositions: open.length,
      openDepartments: new Set(open.map((p) => departmentOf(p.divisionId).id)).size,
      ordersWaiting: waitingOrders(orders).count,
      people: records.length,
      departments: org.departments.length,
    }),
    attention: [
      ...leaderAttention({
        orders,
        positions: open.map((p) => ({
          ref: p.slug,
          title: p.title,
          department: departmentOf(p.divisionId).name,
          division: divisionOf(p.divisionId).name,
          applications: applicationsTo([p], team).length,
          closesOn: p.closesOn ?? null,
        })),
        now: NOW,
      }),
      ...dummyNoticeAttention(me, notices, NOW),
    ],
    departments: departmentSummaries(
      records,
      org,
      team.positions.map((p) => ({ divisionId: p.divisionId, open: p.open, newApplications: newApplications([p], team) })),
    ),
    people: records.length,
    activity: activityFor("operations-lead", me),
  };
}

/**
 * The interviews in the given divisions: their applications at Interview, each booked
 * at the time the applicant picked or still waiting for a pick, so the
 * Overview names the people the Applications page shows at that stage.
 * Booked ones come first, soonest first.
 */
function interviewsFor(divisionIds: readonly number[], team: Team): UpcomingInterview[] {
  const positions = new Map(team.positions.filter((p) => divisionIds.includes(p.divisionId)).map((p) => [p.id, p]));
  const all = applicationsTo([...positions.values()], team).flatMap((a): UpcomingInterview[] => {
    if (a.state.stage !== "interview") return [];
    const who = { applicant: a.applicant.name, position: positions.get(a.positionId)!.title };
    const booked = a.state.booked;
    return [
      booked === null
        ? { ...who, state: "waiting" }
        : { ...who, state: "booked", start: new Date(booked.slot.start), end: new Date(booked.slot.end) },
    ];
  });
  return interviewOrder(all);
}

/** Board 56: the division lead's figures, attention, interviews and activity, all scoped to their division. */
function divisionOverview(team: Team, notices: DummyNotices): DivisionOverview {
  const kind = "division-lead";
  const scoped = positionsFor(kind, team);
  const open = scoped.filter((p) => p.open);
  const division = divisionOf(myDivisionId(kind));
  const members = people.filter((p) => isIn(p.placement, division.id));
  // The figure counts the lead's own division's orders, though Orders shows the whole team (issue #233).
  const waiting = waitingOrders(dummyOrdersIn([division.id]));
  return {
    shape: "division",
    stats: [
      { label: "New applications", value: String(newApplications(scoped, team)), detail: sinceMonday(scoped, team) },
      {
        label: "Open positions",
        value: String(open.length),
        detail: open.length === 0 ? "None open" : open.map((p) => p.title).join(", "),
      },
      {
        label: "Orders",
        value: `${waiting.count} waiting`,
        detail: `${formatEuro(waiting.total)} to be placed`,
        live: waiting.count > 0,
      },
      {
        label: "My division",
        value: String(members.length),
        detail: `${members.length === 1 ? "person" : "people"} in ${divisionShortName(division.name)}`,
      },
    ],
    attention: attentionFor(kind, team, notices),
    interviews: interviewsFor([division.id], team),
    activity: activityFor(kind),
  };
}

/** Boards 62 and 62m: the department head's figures, attention, divisions, interviews and activity (issue #230). */
function departmentOverview(team: Team, notices: DummyNotices): DepartmentOverview {
  const kind = "department-head";
  const department = headDepartment();
  const scoped = positionsFor(kind, team);
  const open = scoped.filter((p) => p.open);
  // Someone in two of the department's divisions counts once here (issue #229).
  const inDepartment = people.filter((p) => department.divisionIds.some((id) => isIn(p.placement, id)));
  const waiting = waitingOrders(dummyOrdersIn(department.divisionIds));
  const openDivisions = new Set(open.map((p) => p.divisionId)).size;
  return {
    shape: "department",
    stats: [
      { label: "New applications", value: String(newApplications(scoped, team)), detail: sinceMonday(scoped, team) },
      { label: "Open positions", value: String(open.length), detail: `In ${plural(openDivisions, "division", "divisions")}` },
      {
        label: "Orders",
        value: `${waiting.count} waiting`,
        detail: `${formatEuro(waiting.total)} to be placed`,
        live: waiting.count > 0,
      },
      {
        label: "My department",
        value: String(inDepartment.length),
        detail: `${inDepartment.length === 1 ? "person" : "people"} in ${department.name}`,
      },
    ],
    attention: attentionFor(kind, team, notices),
    divisions: department.divisions.map((division): DivisionSummary => {
      const own = scoped.filter((p) => p.divisionId === division.id);
      const members = inDepartment.filter((p) => isIn(p.placement, division.id));
      return {
        id: division.id,
        name: division.name,
        leads: members.filter((p) => roleInDivision(p, division.id) === "lead").map((p) => p.name),
        people: members.length,
        newApplications: newApplications(own, team),
        openPositions: own.filter((p) => p.open).length,
      };
    }),
    interviews: interviewsFor(department.divisionIds, team),
    activity: activityFor(kind),
  };
}

function sinceLine(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const month = date.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return `In the team since ${month} ${date.getUTCFullYear()}`;
}

/** The lead first, then up to two others, then the viewer (board 40m). */
function rosterPreview(me: DummyPerson): RosterPerson[] {
  const mine = divisionIdOfPerson(me);
  const isLead = (p: DummyPerson) => mine !== null && roleInDivision(p, mine) === "lead";
  const division = people.filter((p) => mine !== null && isIn(p.placement, mine));
  const lead = division.filter(isLead);
  const others = division.filter((p) => !isLead(p) && p.id !== me.id).slice(0, 2);
  return [...lead, ...others, me].map((p) => ({
    name: p.name,
    role: isLead(p) ? "Division lead" : "Member",
    lead: isLead(p),
    self: p.id === me.id,
  }));
}

function memberOverview(): PersonalOverview {
  const me = personFor.member;
  const division = divisionOf(myDivisionId("member"));
  const department = departmentOf(division.id);
  const items: ChecklistItem[] = [
    { label: "Name and division", detail: "Set by your division lead", done: true, action: null },
    { label: "Email", detail: me.email, done: true, action: null },
    {
      label: "Photo",
      detail: "A clear, square photo of your face",
      done: me.hasPhoto,
      action: me.hasPhoto ? null : { label: "Upload", href: "/dashboard/profile" },
    },
    {
      label: "LinkedIn",
      detail: "Optional, shown as an icon on your card",
      done: me.linkedin !== null,
      action: me.linkedin !== null ? null : { label: "Add", href: "/dashboard/profile" },
    },
  ];
  const size = people.filter((p) => isIn(p.placement, division.id)).length;
  return {
    shape: "personal",
    person: {
      name: me.name,
      line: `${me.title} · ${division.name} · ${department.name}`,
      since: sinceLine(me.since),
      edit: { label: "Edit profile", href: "/dashboard/profile" },
    },
    checklist: {
      title: "Your page on the site",
      detail: `This is how you appear on The Team page. ${checklistProgress(items)}`,
      items,
    },
    roster: {
      title: division.name,
      detail: `${department.name} · ${size} people`,
      size,
      people: rosterPreview(me),
    },
    hint: "Need to work on recruitment or site content? Ask your division lead or the admin team for access.",
  };
}

function overviewFor(kind: ViewerKind, team: Team, notices: DummyNotices): TeamSideOverview {
  switch (kind) {
    case "operations-lead":
      return teamOverview(team, notices);
    case "department-head":
      return departmentOverview(team, notices);
    case "division-lead":
      return divisionOverview(team, notices);
    case "member":
      return memberOverview();
    case "non-member":
      throw new DashboardRefused("a non-member's Overview is built from My applications");
  }
}

function navCountsFor(kind: ViewerKind, team: Team): NavCounts {
  const fresh = newApplications(positionsFor(kind, team), team);
  return fresh > 0 ? { applications: fresh } : {};
}

// Positions and Applications (boards 41, 41b, 41c) -----------------------------

function positionRow(p: DummyPosition, team: Team): PositionRow {
  const received = applicationsTo([p], team);
  return {
    id: p.id,
    ref: p.slug,
    title: p.title,
    division: divisionOf(p.divisionId).name,
    department: departmentOf(p.divisionId).name,
    open: p.open,
    applications: received.length,
    newApplications: received.filter((a) => a.state.stage === "new").length,
    quiet: quietNote(quietDays(p.open, lastActivity(p, team), NOW)),
    updated: ago(new Date(p.updatedAt), NOW),
    code: positionCode({
      id: p.id,
      dept_code: departmentCode[divisionOf(p.divisionId).departmentId],
      div_code: team.divisionCodes.get(p.divisionId) ?? divisionLabel[p.divisionId as keyof typeof divisionLabel].code,
    }),
    content: contentOf(p, team),
  };
}

/**
 * The divisions a viewer may post a role in: every one for the operations
 * lead, their department's for a department head (board 63b), the lead's own
 * for a division lead.
 */
function postableDivisions(kind: ViewerKind): DivisionChoice[] {
  const ids: number[] =
    kind === "operations-lead"
      ? divisions.map((d) => d.id)
      : kind === "department-head"
        ? headDepartment().divisionIds
        : kind === "division-lead"
          ? [myDivisionId(kind)]
          : [];
  return ids.map((id) => {
    const division = divisionOf(id);
    return {
      id,
      name: division.name,
      department: departmentOf(id).name,
      deptCode: departmentCode[division.departmentId],
      divCode: divisionLabel[division.id].code,
    };
  });
}

function nextPositionId(team: Team): number {
  return Math.max(...team.positions.map((p) => p.id)) + 1;
}

function positionsPage(kind: ViewerKind, team: Team): PositionsPage {
  const rows = positionsFor(kind, team).map((p) => positionRow(p, team));
  const newPosition = { divisions: postableDivisions(kind), nextId: nextPositionId(team) };
  if (kind === "operations-lead") {
    return { scope: "team", positions: rows, newPosition };
  }
  if (kind === "department-head") {
    return { scope: "department", department: departmentUnit(), positions: rows, newPosition };
  }
  if (kind === "division-lead") {
    const division = divisionOf(myDivisionId(kind)).name;
    return { scope: "division", division, positions: rows, newPosition };
  }
  throw new DashboardRefused("positions");
}

/** "ROSSI_GIULIA_CV.pdf" */
function cvName(name: string): string {
  const words = name.toUpperCase().split(/\s+/);
  return `${[words[words.length - 1], ...words.slice(0, -1)].join("_")}_CV.pdf`;
}

/** The applicant's applications to other roles, anywhere on the team, newest first. */
function otherApplications(a: DummyApplication, team: Team): OtherApplication[] {
  return team.applications
    .filter((o) => o.id !== a.id && o.applicant.email === a.applicant.email)
    .sort((x, y) => new Date(y.appliedAt).getTime() - new Date(x.appliedAt).getTime())
    .map((o) => {
      const position = team.positions.find((p) => p.id === o.positionId)!;
      return {
        title: position.title,
        department: departmentOf(position.divisionId).name,
        division: divisionOf(position.divisionId).name,
        stage: o.state.stage,
      };
    });
}

function applicationEntry(a: DummyApplication, position: DummyPosition, team: Team, onTeam: readonly RosterEntry[]): ApplicationEntry {
  return {
    id: a.id,
    state: a.state,
    standing: dummyStanding(a.applicant.email, position.divisionId, onTeam),
    applicant: {
      name: a.applicant.name,
      email: a.applicant.email,
      phone: a.applicant.phone,
      politoId: a.applicant.politoId,
      gender: a.applicant.gender,
    },
    studies: { year: a.applicant.year, degree: a.applicant.degree },
    position: { ref: position.slug, title: position.title, division: divisionOf(position.divisionId).name },
    applied: appliedLabels(new Date(a.appliedAt), NOW),
    documents: [
      { kind: "cv", name: cvName(a.applicant.name), size: fileSize(a.cvBytes), href: null },
      ...(position.requiresMotivationLetter
        ? [{ kind: "motivation-letter" as const, name: "Motivation_letter.pdf", size: fileSize(a.letterBytes), href: null }]
        : []),
    ],
    answers: [a.answer],
    otherApplications: otherApplications(a, team),
  };
}

/** The head's department as the recruitment pages name it, with its division tabs. */
function departmentUnit(): DepartmentUnit {
  const department = headDepartment();
  return { name: department.name, divisions: department.divisions.map((d) => ({ id: d.id, name: d.name })) };
}

function applicationsScope(kind: "operations-lead" | "department-head" | "division-lead"): ApplicationsScope {
  switch (kind) {
    case "operations-lead":
      return { kind: "team" };
    case "department-head":
      return { kind: "department", department: departmentUnit() };
    case "division-lead":
      return { kind: "division", division: divisionOf(myDivisionId(kind)).name };
  }
}

function applicationsPage(kind: ViewerKind, team: Team, onTeam: readonly RosterEntry[]): ApplicationsPage {
  if (kind !== "operations-lead" && kind !== "department-head" && kind !== "division-lead") throw new DashboardRefused("applications");
  const scoped = positionsFor(kind, team);
  const byId = new Map(scoped.map((p) => [p.id, p]));
  return {
    scope: applicationsScope(kind),
    now: NOW.toISOString(),
    positions: scoped.map((p) => ({ ref: p.slug, title: p.title, division: divisionOf(p.divisionId).name, department: departmentOf(p.divisionId).name })),
    applications: applicationsTo(scoped, team)
      .sort((x, y) => new Date(y.appliedAt).getTime() - new Date(x.appliedAt).getTime())
      .map((a) => applicationEntry(a, byId.get(a.positionId)!, team, onTeam)),
  };
}

/** The person the viewer is on the team; null for the applicant. */
function teamPersonFor(viewer: TestViewer): DummyPerson | null {
  return viewer === "non-member" ? null : personFor[viewer];
}

const notOnTeam = "This page is for team members.";
const noOrders = "You do not have access to Orders.";

/**
 * The dashboard of a team member the test developer signed in as after they
 * left or were moved to alumni: like the database side (issue #201), a member
 * with no active role gets the applicant's pages, as themselves, with no
 * applications sent. Their details stay the ones they had on the team.
 */
function leftTeamDashboard(
  kind: Exclude<TestViewer, "non-member">,
  self: DummyPerson,
  recruitment: DummyRecruitmentStore,
  changes: DummyStateStore,
  teamEdits: TeamEditsStore,
  own: OwnChangesStore,
): DashboardData {
  const applicantPages = dummyDashboardData("non-member", recruitment, changes, teamEdits, own, "none");
  return {
    ...applicantPages,
    viewer: { ...applicantPages.viewer, name: self.name },
    myAccount: async () => ({ ...dummyMyAccount(self, own.current, "none"), details: dummyDetails(kind, own.current) }),
    async saveDetails(input) {
      const result = dummySaveDetails(input, "applicant", dummyDetails(kind, own.current));
      if (result.ok) await own.save({ ...own.current, details: { ...own.current.details, [kind]: result.value } });
      return result;
    },
  };
}

/**
 * The dashboard as the test developer sees it, looking as `viewer`, with the
 * recruitment switch read from and kept in `recruitment` (./recruitment.ts),
 * their Positions and Applications changes in `changes` (./state.ts), and
 * their Team page edits in `teamEdits` (./edits.ts), and the changes on their
 * own pages in `own` (./own.ts), starting from the own applications
 * `ownStart` names. Other writes check what was sent as the database side
 * does, store nothing, and answer what the page shows next. The team leader
 * is full access, the `operations-lead` kind, so the other pages read as the
 * operations lead's. On Access and Orders they are themselves, the one who
 * decides orders and gives "Approve orders" (issue #247), and they have
 * their own Overview, Members and own pages (boards 72 to 73c, issue #252).
 */
export function dummyDashboardData(
  viewer: TestViewer,
  recruitment: DummyRecruitmentStore,
  changes: DummyStateStore,
  teamEdits: TeamEditsStore = NO_TEAM_EDITS,
  own: OwnChangesStore = NO_OWN_STORE,
  ownStart: OwnApplicationsStart = "sample",
  partnerEdits: DummyPartnerEditsStore = NO_PARTNER_EDITS_STORE,
): DashboardData {
  const kind = kindOfTestViewer(viewer);
  if (viewer !== "non-member" && teamEdits.current.movedToAlumni[personFor[viewer].id] !== undefined) {
    return leftTeamDashboard(viewer, personFor[viewer], recruitment, changes, teamEdits, own);
  }
  const team = withDivisionEdits(teamOf(recruitment.current, changes.current), teamEdits.current);
  const change = (c: DummyChange) => changes.save(applyDummyChange(changes.current, c));
  const person = teamPersonFor(viewer);
  const accessKind = kind === "operations-lead" || kind === "division-lead" || kind === "department-head" ? kind : null;
  const canSwitch = canSwitchRecruitmentAs(kind);
  // The team as the test developer left it: who was moved to alumni, who joined.
  const teamRoster = editedRoster(teamEdits.current, dummyJoiners(team.applications));
  // Closing a division removes the access given in it (#232).
  const closedIds = new Set(dummyOrg(teamEdits.current).closed.map((d) => d.id));
  const leaveStateOf = (p: DummyPerson): LeaveState => (teamEdits.current.movedToAlumni[p.id] === undefined ? "on-team" : "left");
  const me = person === null ? { firstName: applicant.firstName, email: applicant.email } : { firstName: person.name.split(" ")[0], email: person.email };
  const myApplications = () => dummyMyApplications(viewer, me, own.current, ownStart);
  const saveOwnDetails = (details: YourDetails) => own.save({ ...own.current, details: { ...own.current.details, [viewer]: details } });

  // One move for both pages: the Applications panel and the Members page's
  // Confirm join (board 59) run it, so the application is the one record of
  // who joined, and the roster reads it (./team-pages.ts).
  async function moveApplication(id: number, move: LeadMove) {
    const base = baseApplications.find((a) => a.id === id);
    const current = team.applications.find((a) => a.id === id);
    if (!base || !current || !positionsFor(kind, team).some((p) => p.id === base.positionId)) {
      throw new DashboardRefused(`application ${id}`);
    }
    const position = team.positions.find((p) => p.id === base.positionId)!;
    // The dummy team is seen from DUMMY_NOW, so its moves happen then too.
    const result = applyMove(current.state, move, NOW, dummyStanding(current.applicant.email, position.divisionId, teamRoster));
    if (!result.ok) return refused(result.reason);
    if (!result.changed) return written(null);
    await change({ kind: "application", id, state: result.state, initial: base.state });
    return written(null);
  }

  return {
    viewer: dummyViewer(viewer),
    navCounts: async () => navCountsFor(kind, team),
    hasOwnApplications: async () => ownApplicationsOf(viewer, ownStart).length > 0,
    overview: async () =>
      viewer === "team-leader"
        ? leaderOverview(team, teamEdits.current, dummyNoticesOf(teamEdits.current))
        : overviewFor(kind, team, dummyNoticesOf(teamEdits.current)),
    async dismissNotice(noticeId) {
      const dismissed = teamEdits.current.dismissedNotices;
      if (person === null || !isDummyNoticeOpen(person, dummyNoticesOf(teamEdits.current), noticeId)) {
        return refused("This notice is not yours, or it was already dismissed.");
      }
      await teamEdits.save({ ...teamEdits.current, dismissedNotices: [...dismissed, noticeId] });
      return written(null);
    },
    recruitment: async () => ({ recruitment: recruitment.current, canSwitch }),
    // Nothing is cached in dummy mode: /apply reads the cookie on each request.
    setRecruitment: (next) =>
      switchRecruitment(next, { maySwitch: async () => canSwitch, save: recruitment.save, refresh: () => {} }),
    ...dummyTeamPages(viewer, teamEdits.current, teamEdits.save, team.applications, moveApplication, (divisionId) =>
      team.positions.filter((p) => p.divisionId === divisionId && p.open).length,
    ),
    positions: async () => positionsPage(kind, team),
    applications: async () => applicationsPage(kind, team, teamRoster),

    async setPositionOpen(id, open) {
      const base = basePositions.find((p) => p.id === id);
      if (!base || !positionsFor(kind, team).some((p) => p.id === id)) throw new DashboardRefused(`position ${id}`);
      await change({ kind: "position", id, open, initial: base.open });
    },

    async createPosition(input) {
      const allowed = postableDivisions(kind);
      const division = allowed.find((d) => d.id === (input as { divisionId?: unknown } | null)?.divisionId);
      if (!division) throw new DashboardRefused("a position in that division");
      const checked = checkNewPosition(input);
      if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
      const id = nextPositionId(team);
      const { position } = checked;
      const posted = { id, title: position.title, divisionId: division.id, open: position.open, motivationLetter: position.motivationLetter, createdAt: NOW.toISOString() };
      const content: PositionContent = {
        title: position.title,
        description: position.description,
        required: position.required,
        desirable: position.desirable,
        questions: position.questions,
        motivationLetter: position.motivationLetter,
      };
      const next = applyDummyChange(changes.current, { kind: "new-position", position: posted, content });
      // Text too long for the cookie: the role is still posted, with its title and letter setting.
      await changes.save(fitsDummyCookie(next) ? next : { ...next, positionEdits: next.positionEdits.filter((e) => e.id !== id) });
      return written({ id, code: newPositionCode(division, id) });
    },

    async editPosition(id, input) {
      const position = positionsFor(kind, team).find((p) => p.id === id);
      if (!position) throw new DashboardRefused(`position ${id}`);
      const checked = checkPositionContent(input);
      if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
      const base = basePositions.find((p) => p.id === id);
      const next = applyDummyChange(changes.current, {
        kind: "position-edit",
        id,
        content: checked.position,
        initial: base ? baseContent(base) : null,
      });
      if (!fitsDummyCookie(next)) {
        return refused("A preview keeps this text in a browser cookie, and it is too long for it. Shorten the description or the lists.");
      }
      await changes.save(next);
      return written(null);
    },

    moveApplication,

    divisionAccess: async () => (accessKind === null || person === null ? null : dummyAccessPage(accessKind, person, teamRoster, closedIds)),
    saveAccess: async (input) =>
      accessKind === null || person === null ? refused(notOnTeam) : dummySaveAccess(accessKind, person, teamRoster, input, closedIds),
    removeAllAccess: async (personId) =>
      accessKind === null || person === null ? refused(notOnTeam) : dummyRemoveAllAccess(accessKind, person, teamRoster, personId, closedIds),

    orders: async () => (accessKind === null || person === null ? null : dummyOrdersPage(accessKind, person)),
    placeOrder: async (fields, quote) =>
      accessKind === null || person === null ? refused(noOrders) : dummyPlaceOrder(accessKind, person, fields, quote),
    editOrder: async (id, fields, quote) =>
      accessKind === null || person === null ? refused(noOrders) : dummyEditOrder(accessKind, person, id, fields, quote),
    cancelOrder: async (id) => (accessKind === null || person === null ? refused(noOrders) : dummyCancelOrder(accessKind, person, id)),
    decideOrder: async (id, input) =>
      accessKind === null || person === null ? refused(noOrders) : dummyDecideOrder(accessKind, person, id, input),
    markOrdered: async (id) => (accessKind === null || person === null ? refused(noOrders) : dummyMarkOrdered(accessKind, person, id)),
    setApproveOrders: async (input) =>
      person === null ? refused(notOnTeam) : dummySetApproveOrders(person, teamRoster.map((e) => e.id), input),

    // Behind the same site-content gate as the database side; changes live in the test developer's cookie.
    partners: partnerEditor(dummyViewer(viewer), dummyPartnerStore(partnerEdits), dummyLogoFiles),

    myProfile: async () => (person === null ? null : dummyMyProfile(viewer, person, own.current, leaveStateOf(person))),
    async saveLinkedin(text) {
      if (person === null) return refused(notOnTeam);
      const result = dummySaveLinkedin(text);
      // LinkedIn is one of the details, as on the database side (`users.linkedin`).
      if (result.ok) await saveOwnDetails({ ...dummyDetails(viewer, own.current), linkedin: result.value ?? "" });
      return result;
    },
    setPhoto: async (photo) => (person === null ? refused(notOnTeam) : dummySetPhoto(photo)),
    async leaveTeam(reason, removeFromAlumni) {
      if (person === null) return refused(notOnTeam);
      if (leaveStateOf(person) === "left") return refused("You already left the team.");
      // The reason is checked as the database side checks it; a preview keeps none.
      leaveReason(reason);
      const year = new Date(DUMMY_NOW).getUTCFullYear();
      // A departure as Move to alumni records it: the years on the team, and no
      // listed reason, since the leaver's own words are free text.
      const departure: Departure = { from: Math.min(Number(person.since.slice(0, 4)), year), to: year, reason: null };
      const { alumni } = teamEdits.current;
      await teamEdits.save({
        ...teamEdits.current,
        movedToAlumni: { ...teamEdits.current.movedToAlumni, [person.id]: departure },
        // "Remove my name from the Alumni page" (board 55b, issue #257).
        ...(removeFromAlumni === true && {
          alumni: { ...alumni, entries: { ...alumni.entries, [`m${person.id}`]: { ...alumni.entries[`m${person.id}`], removed: true } } },
        }),
      });
      // Off the team they have no applications sent (leftTeamDashboard).
      return written(landingAfterLeaving(false));
    },

    myAccount: async () => (person === null ? dummyMyAccount(applicant, own.current, ownStart) : null),
    async saveDetails(input) {
      const result = dummySaveDetails(input, person === null ? "applicant" : "member", dummyDetails(viewer, own.current));
      if (result.ok) await saveOwnDetails(result.value);
      return result;
    },
    deleteAccount: async (options) => dummyDeleteAccount(options),

    myApplications: async () => myApplications(),
    async withdrawApplication(id) {
      const result = dummyWithdraw(myApplications(), own.current, id);
      if (!result.ok) return result;
      await own.save(result.value);
      return written(null);
    },
    async chooseInterviewSlot(applicationId, slotId) {
      const result = dummyChooseSlot(myApplications(), own.current, applicationId, slotId);
      if (!result.ok) return result;
      await own.save(result.value.changes);
      return written(result.value.slot);
    },
  };
}
