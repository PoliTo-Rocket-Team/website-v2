import type { Recruitment } from "@/lib/apply/positions";
import { canSwitchRecruitmentAs, switchRecruitment } from "@/lib/apply/recruitment-switch";
import type { NavCounts } from "@/lib/dashboard/access";
import { DashboardRefused, type DashboardData } from "@/lib/dashboard/data";
import { formatEuro, waitingOrders } from "@/lib/dashboard/orders";
import {
  checklistProgress,
  divisionShortName,
  noPhotoItem,
  interviewOrder,
  oldestLine,
  type ActivityItem,
  type AttentionItem,
  type ChecklistItem,
  type DivisionOverview,
  type OwnApplication,
  type Overview,
  type PersonalOverview,
  type RosterPerson,
  type TeamOverview,
  type UpcomingInterview,
} from "@/lib/dashboard/overview";
import { divisionIdOf, type Departure } from "@/lib/dashboard/team";
import { applyMove, type LeadMove } from "@/lib/dashboard/application-flow";
import { checkNewPosition, newPositionCode, type DivisionChoice } from "@/lib/dashboard/new-position";
import {
  ago,
  appliedLabels,
  fileSize,
  quietDays,
  quietNote,
  type ApplicationEntry,
  type ApplicationsPage,
  type OtherApplication,
  type PositionRow,
  type PositionsPage,
} from "@/lib/dashboard/recruitment";
import type { DashboardViewer, ViewerKind } from "@/lib/dashboard/viewer";
import { applications as baseApplications, type DummyApplication } from "./applications";
import { departmentCode, divisionLabel } from "./apply";
import { applyDummyChange, type DummyChange, type DummyState, type DummyStateStore } from "./state";
import { refused, written } from "@/lib/dashboard/write";
import {
  dummyCancelOrder,
  dummyDivisionAccess,
  dummyDivisionOrders,
  dummyEditOrder,
  dummyGiveAccess,
  dummyPlaceOrder,
  dummyRemoveAccess,
} from "./division";
import { NO_TEAM_EDITS, type TeamEditsStore } from "./edits";
import { leaveReason, type LeaveState } from "@/lib/dashboard/self";
import { sentLabel } from "@/lib/dashboard/my-applications";
import { NO_OWN_STORE, type OwnChanges, type OwnChangesStore } from "./own";
import { dummyDetails, ownApplicationsOf, isWithdrawn } from "./own-applications";
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
} from "./self";
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
import { dummyJoiners, dummyTeamPages, editedRoster } from "./team-pages";

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
};

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
  return {
    recruitmentOpen: isOpen,
    positions: positions.map((p) => ({ ...p, open: state.positionOpen[p.id] ?? p.open })),
    applications: baseApplications.map((a) => ({ ...a, state: state.applications[a.id] ?? a.state })),
  };
}

const NOW = new Date(DUMMY_NOW);

/** Monday of the week DUMMY_NOW falls in, at midnight in Turin. */
const MONDAY = new Date("2026-10-05T00:00:00+02:00");

/** The division a person works in: null for the team leader, a head, or someone not yet placed. */
function divisionIdOfPerson(person: DummyPerson): number | null {
  return divisionIdOf(person.placement);
}

/** The viewer's own division; the division lead and the member viewers both have one. */
function myDivisionId(kind: "division-lead" | "member"): number {
  return divisionIdOfPerson(personFor[kind])!;
}

/** Who a test developer signed in as `kind` is: the dashboard's user card and the navbar show this name. */
export function dummyViewer(kind: ViewerKind): DashboardViewer {
  if (kind === "non-member") {
    return { kind, name: applicant.name, role: "Applicant", session: "test-developer" };
  }
  const person = personFor[kind];
  return { kind, name: person.name, role: person.title, session: "test-developer" };
}

function divisionOf(id: number) {
  return divisions.find((d) => d.id === id)!;
}

function departmentOf(divisionId: number) {
  const division = divisionOf(divisionId);
  return departments.find((d) => d.id === division.departmentId)!;
}

/** The positions a viewer reaches: the whole team, or the lead's division. */
function positionsFor(kind: ViewerKind, team: Team): readonly DummyPosition[] {
  if (kind === "operations-lead") return team.positions;
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

function attentionFor(kind: ViewerKind, team: Team): AttentionItem[] {
  const scoped = positionsFor(kind, team);
  const fresh = scoped.flatMap((p): AttentionItem[] => {
    const n = newApplications([p], team);
    if (n === 0) return [];
    return [
      {
        kind: "applications",
        title: `${plural(n, "new application", "new applications")} for ${p.title}`,
        // The operations lead sees where the role sits; a division lead, how long it has waited (board 56).
        detail:
          kind === "division-lead"
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
  const unplaced = kind === "operations-lead" ? people.filter((p) => p.placement.role === "member" && p.placement.divisionId === null) : [];
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
  const noPhoto =
    kind === "division-lead"
      ? noPhotoItem(
          people
            .filter((p) => divisionIdOfPerson(p) === myDivisionId(kind) && p.placement.role === "member" && !p.hasPhoto)
            .map((p) => p.name),
        )
      : null;
  return [...fresh, ...quiet, ...unassigned, ...(noPhoto ? [noPhoto] : [])];
}

function activityFor(kind: Exclude<ViewerKind, "non-member" | "member">): ActivityItem[] {
  const me = personFor[kind];
  const events =
    kind === "operations-lead" ? activity : activity.filter((a) => a.divisionId === divisionIdOfPerson(me));
  return events.slice(0, 5).map((a) => ({
    actor: a.actor,
    text: a.text,
    when: a.when,
    self: a.actorId === me.id,
  }));
}

/** Board 40: the operations lead's figures, attention and activity across the team. */
function teamOverview(team: Team): TeamOverview {
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
    attention: attentionFor(kind, team),
    activity: activityFor(kind),
  };
}

/**
 * The lead's division's interviews: its applications at Interview, each booked
 * at the time the applicant picked or still waiting for a pick, so the
 * Overview names the people the Applications page shows at that stage.
 * Booked ones come first, soonest first.
 */
function interviewsFor(divisionId: number, team: Team): UpcomingInterview[] {
  const positions = new Map(team.positions.filter((p) => p.divisionId === divisionId).map((p) => [p.id, p]));
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
function divisionOverview(team: Team): DivisionOverview {
  const kind = "division-lead";
  const scoped = positionsFor(kind, team);
  const open = scoped.filter((p) => p.open);
  const division = divisionOf(myDivisionId(kind));
  const members = people.filter((p) => divisionIdOfPerson(p) === division.id);
  const orders = dummyDivisionOrders(personFor[kind])!;
  const waiting = waitingOrders(orders.orders);
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
    attention: attentionFor(kind, team),
    interviews: interviewsFor(division.id, team),
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
  const division = people.filter((p) => divisionIdOfPerson(p) === divisionIdOfPerson(me));
  const lead = division.filter((p) => p.placement.role === "division-lead");
  const others = division.filter((p) => p.placement.role !== "division-lead" && p.id !== me.id).slice(0, 2);
  return [...lead, ...others, me].map((p) => ({
    name: p.name,
    role: p.placement.role === "division-lead" ? "Division lead" : "Member",
    lead: p.placement.role === "division-lead",
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
  const size = people.filter((p) => divisionIdOfPerson(p) === division.id).length;
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
    applications: null,
    hint: "Need to work on recruitment or site content? Ask your division lead or the admin team for access.",
  };
}

/** How the Overview's short list words each of the applicant's own applications. */
const overviewStatus = {
  received: "received",
  "in-review": "in-review",
  interview: "in-review",
  accepted: "accepted",
  "not-selected": "declined",
  joined: "accepted",
} as const satisfies Readonly<Record<string, OwnApplication["status"]>>;

function applicantOverview(team: Team, own: OwnChanges): PersonalOverview {
  return {
    shape: "personal",
    person: { name: applicant.name, line: `Applicant · ${applicant.email}`, since: null, edit: null },
    checklist: null,
    roster: null,
    applications: ownApplicationsOf("non-member")
      .filter((a) => !isWithdrawn(a, own))
      .map((a) => {
        const position = team.positions.find((p) => p.id === a.positionId)!;
        return {
          title: position.title,
          detail: `${departmentOf(position.divisionId).name} · sent ${sentLabel(a.sent)}`,
          status: overviewStatus[a.status.kind],
        };
      }),
    hint: null,
  };
}

function overviewFor(kind: ViewerKind, team: Team, own: OwnChanges): Overview {
  switch (kind) {
    case "operations-lead":
      return teamOverview(team);
    case "division-lead":
      return divisionOverview(team);
    case "member":
      return memberOverview();
    case "non-member":
      return applicantOverview(team, own);
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
  };
}

/** The divisions a viewer may post a role in: every one for the operations lead, the lead's own for a division lead. */
function postableDivisions(kind: ViewerKind): DivisionChoice[] {
  const ids: number[] =
    kind === "operations-lead" ? divisions.map((d) => d.id) : kind === "division-lead" ? [myDivisionId(kind)] : [];
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

function applicationEntry(a: DummyApplication, position: DummyPosition, team: Team): ApplicationEntry {
  return {
    id: a.id,
    state: a.state,
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

function applicationsPage(kind: ViewerKind, team: Team): ApplicationsPage {
  if (kind !== "operations-lead" && kind !== "division-lead") throw new DashboardRefused("applications");
  const scoped = positionsFor(kind, team);
  const byId = new Map(scoped.map((p) => [p.id, p]));
  return {
    division: kind === "division-lead" ? divisionOf(myDivisionId(kind)).name : null,
    now: NOW.toISOString(),
    positions: scoped.map((p) => ({ ref: p.slug, title: p.title })),
    applications: applicationsTo(scoped, team)
      .sort((x, y) => new Date(y.appliedAt).getTime() - new Date(x.appliedAt).getTime())
      .map((a) => applicationEntry(a, byId.get(a.positionId)!, team)),
  };
}

/** The person the viewer is on the team; null for the applicant. */
function teamPersonFor(kind: ViewerKind): DummyPerson | null {
  return kind === "non-member" ? null : personFor[kind];
}

const notOnTeam = "This page is for team members.";

/**
 * The dashboard as the test developer sees it, looking as `kind`, with the
 * recruitment switch read from and kept in `recruitment` (./recruitment.ts),
 * their Positions and Applications changes in `changes` (./state.ts), and
 * their Team page edits in `teamEdits` (./edits.ts), and the changes on their
 * own pages in `own` (./own.ts). Other writes check what was sent as the
 * database side does, store nothing, and answer what the page shows next.
 */
export function dummyDashboardData(
  kind: ViewerKind,
  recruitment: DummyRecruitmentStore,
  changes: DummyStateStore,
  teamEdits: TeamEditsStore = NO_TEAM_EDITS,
  own: OwnChangesStore = NO_OWN_STORE,
): DashboardData {
  const team = teamOf(recruitment.current, changes.current);
  const change = (c: DummyChange) => changes.save(applyDummyChange(changes.current, c));
  const person = teamPersonFor(kind);
  const canSwitch = canSwitchRecruitmentAs(kind);
  // The team as the test developer left it: who was moved to alumni, who joined.
  const teamRoster = editedRoster(teamEdits.current, dummyJoiners(team.applications));
  const leaveStateOf = (p: DummyPerson): LeaveState => (teamEdits.current.movedToAlumni[p.id] === undefined ? "on-team" : "left");
  const me = person === null ? { firstName: applicant.firstName, email: applicant.email } : { firstName: person.name.split(" ")[0], email: person.email };
  const myApplications = () => dummyMyApplications(kind, me, own.current);
  const saveOwnDetails = (details: YourDetails) => own.save({ ...own.current, details: { ...own.current.details, [kind]: details } });

  // One move for both pages: the Applications panel and the Members page's
  // Confirm join (board 59) run it, so the application is the one record of
  // who joined, and the roster reads it (./team-pages.ts).
  async function moveApplication(id: number, move: LeadMove) {
    const base = baseApplications.find((a) => a.id === id);
    const current = team.applications.find((a) => a.id === id);
    if (!base || !current || !positionsFor(kind, team).some((p) => p.id === base.positionId)) {
      throw new DashboardRefused(`application ${id}`);
    }
    // The dummy team is seen from DUMMY_NOW, so its moves happen then too.
    const result = applyMove(current.state, move, NOW);
    if (!result.ok) return refused(result.reason);
    if (!result.changed) return written(null);
    await change({ kind: "application", id, state: result.state, initial: base.state });
    return written(null);
  }

  return {
    viewer: dummyViewer(kind),
    navCounts: async () => navCountsFor(kind, team),
    hasOwnApplications: async () => ownApplicationsOf(kind).length > 0,
    overview: async () => overviewFor(kind, team, own.current),
    recruitment: async () => ({ recruitment: recruitment.current, canSwitch }),
    // Nothing is cached in dummy mode: /apply reads the cookie on each request.
    setRecruitment: (next) =>
      switchRecruitment(next, { maySwitch: async () => canSwitch, save: recruitment.save, refresh: () => {} }),
    ...dummyTeamPages(kind, teamEdits.current, teamEdits.save, team.applications, moveApplication),
    positions: async () => positionsPage(kind, team),
    applications: async () => applicationsPage(kind, team),

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
      await change({
        kind: "new-position",
        position: { id, title: position.title, divisionId: division.id, open: position.open, motivationLetter: position.motivationLetter, createdAt: NOW.toISOString() },
      });
      return written({ id, code: newPositionCode(division, id) });
    },

    moveApplication,

    divisionAccess: async () => (person === null ? null : dummyDivisionAccess(person, teamRoster)),
    giveAccess: async (input) => (person === null ? refused(notOnTeam) : dummyGiveAccess(person, teamRoster, input)),
    removeAccess: async (grantId) =>
      person === null ? refused(notOnTeam) : dummyRemoveAccess(person, teamRoster, grantId),

    divisionOrders: async () => (person === null ? null : dummyDivisionOrders(person)),
    placeOrder: async (fields, quote) => (person === null ? refused(notOnTeam) : dummyPlaceOrder(person, fields, quote)),
    editOrder: async (id, fields, quote) =>
      person === null ? refused(notOnTeam) : dummyEditOrder(person, id, fields, quote),
    cancelOrder: async (id) => (person === null ? refused(notOnTeam) : dummyCancelOrder(person, id)),

    myProfile: async () => (person === null ? null : dummyMyProfile(kind, person, own.current, leaveStateOf(person))),
    async saveLinkedin(text) {
      if (person === null) return refused(notOnTeam);
      const result = dummySaveLinkedin(text);
      // LinkedIn is one of the details, as on the database side (`users.linkedin`).
      if (result.ok) await saveOwnDetails({ ...dummyDetails(kind, own.current), linkedin: result.value ?? "" });
      return result;
    },
    setPhoto: async (photo) => (person === null ? refused(notOnTeam) : dummySetPhoto(photo)),
    async leaveTeam(reason) {
      if (person === null) return refused(notOnTeam);
      if (leaveStateOf(person) === "left") return refused("You already left the team.");
      // The reason is checked as the database side checks it; a preview keeps none.
      leaveReason(reason);
      const year = new Date(DUMMY_NOW).getUTCFullYear();
      // A departure as Move to alumni records it: the years on the team, and no
      // listed reason, since the leaver's own words are free text.
      const departure: Departure = { from: Math.min(Number(person.since.slice(0, 4)), year), to: year, reason: null };
      await teamEdits.save({ ...teamEdits.current, movedToAlumni: { ...teamEdits.current.movedToAlumni, [person.id]: departure } });
      return written(null);
    },

    myAccount: async () => (person === null ? dummyMyAccount(applicant, own.current) : null),
    async saveDetails(input) {
      const result = dummySaveDetails(input, person === null ? "applicant" : "member", dummyDetails(kind, own.current));
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
