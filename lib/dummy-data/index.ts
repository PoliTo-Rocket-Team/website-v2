import type { Recruitment } from "@/lib/apply/positions";
import { canSwitchRecruitmentAs, switchRecruitment } from "@/lib/apply/recruitment-switch";
import type { NavCounts } from "@/lib/dashboard/access";
import { DashboardRefused, type DashboardData } from "@/lib/dashboard/data";
import {
  checklistProgress,
  type ActivityItem,
  type AttentionItem,
  type ChecklistItem,
  type Overview,
  type PersonalOverview,
  type RosterPerson,
  type TeamOverview,
} from "@/lib/dashboard/overview";
import { divisionIdOf } from "@/lib/dashboard/team";
import {
  ago,
  appliedLabels,
  fileSize,
  quietDays,
  quietNote,
  type ApplicationEntry,
  type ApplicationStage,
  type ApplicationsPage,
  type PositionRow,
  type PositionsPage,
} from "@/lib/dashboard/recruitment";
import type { DashboardViewer, ViewerKind } from "@/lib/dashboard/viewer";
import { applications as baseApplications, type DummyApplication } from "./applications";
import { applyDummyChange, type DummyChange, type DummyState, type DummyStateStore } from "./state";
import { refused, written } from "@/lib/dashboard/write";
import { dummyDivisionAccess, dummyDivisionOrders, dummyGiveAccess, dummyPlaceOrder, dummyRemoveAccess } from "./division";
import { NO_TEAM_EDITS, type TeamEditsStore } from "./edits";
import {
  dummyDeleteAccount,
  dummyMyAccount,
  dummyMyProfile,
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
  ownApplications,
  people,
  personFor,
  positions as basePositions,
  recruitment,
  roster,
  type DummyPerson,
  type DummyPosition,
} from "./team";
import type { DummyRecruitmentStore } from "./recruitment";
import { dummyTeamPages } from "./team-pages";

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

function teamOf({ isOpen }: Recruitment, state: DummyState): Team {
  return {
    recruitmentOpen: isOpen,
    positions: basePositions.map((p) => ({ ...p, open: state.positionOpen[p.id] ?? p.open })),
    applications: baseApplications.map((a) => ({ ...a, stage: state.applicationStage[a.id] ?? a.stage })),
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
  return applicationsTo(list, team).filter((a) => a.stage === "new").length;
}

function sinceMonday(list: readonly DummyPosition[], team: Team): string {
  const fresh = applicationsTo(list, team).filter((a) => a.stage === "new" && new Date(a.appliedAt) >= MONDAY);
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

function attentionFor(kind: ViewerKind, team: Team): AttentionItem[] {
  const scoped = positionsFor(kind, team);
  const fresh = scoped.flatMap((p): AttentionItem[] => {
    const n = newApplications([p], team);
    if (n === 0) return [];
    return [
      {
        kind: "applications",
        title: `${plural(n, "new application", "new applications")} for ${p.title}`,
        detail: `${departmentOf(p.divisionId).name} · ${divisionOf(p.divisionId).name}`,
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
  return [...fresh, ...quiet, ...unassigned];
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

function teamOverview(kind: "operations-lead" | "division-lead", team: Team): TeamOverview {
  const scoped = positionsFor(kind, team);
  const open = scoped.filter((p) => p.open);
  const recruitmentStat = {
    label: "Recruitment",
    value: team.recruitmentOpen ? "Open" : "Closed",
    detail: team.recruitmentOpen
      ? recruitment.open
        ? `Public on the site since ${recruitment.since}`
        : "Public on the site"
      : "Positions are hidden on the site",
    live: team.recruitmentOpen,
  };

  if (kind === "operations-lead") {
    const openDepartments = new Set(open.map((p) => departmentOf(p.divisionId).id));
    return {
      shape: "team",
      stats: [
        { label: "New applications", value: String(newApplications(scoped, team)), detail: sinceMonday(scoped, team) },
        { label: "Open positions", value: String(open.length), detail: `In ${openDepartments.size} departments` },
        recruitmentStat,
        { label: "Team members", value: String(roster.members), detail: `${roster.season} roster` },
      ],
      attention: attentionFor(kind, team),
      activity: activityFor(kind),
    };
  }

  const division = divisionOf(myDivisionId(kind));
  const members = people.filter((p) => divisionIdOfPerson(p) === division.id);
  return {
    shape: "team",
    stats: [
      { label: "New applications", value: String(newApplications(scoped, team)), detail: sinceMonday(scoped, team) },
      { label: "Open positions", value: String(open.length), detail: division.name },
      recruitmentStat,
      { label: "Division members", value: String(members.length), detail: `${roster.season} roster` },
    ],
    attention: attentionFor(kind, team),
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
    role: p.id === me.id ? "You" : p.placement.role === "division-lead" ? "Division lead" : "Member",
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
      people: rosterPreview(me),
    },
    applications: null,
    hint: "Need to work on recruitment or site content? Ask your division lead or the admin team for access.",
  };
}

function applicantOverview(team: Team): PersonalOverview {
  return {
    shape: "personal",
    person: { name: applicant.name, line: `Applicant · ${applicant.email}`, since: null, edit: null },
    checklist: null,
    roster: null,
    applications: ownApplications.map((a) => {
      const position = team.positions.find((p) => p.id === a.positionId)!;
      return {
        title: position.title,
        detail: `${departmentOf(position.divisionId).name} · sent ${a.sent}`,
        status: a.status,
      };
    }),
    hint: null,
  };
}

function overviewFor(kind: ViewerKind, team: Team): Overview {
  switch (kind) {
    case "operations-lead":
    case "division-lead":
      return teamOverview(kind, team);
    case "member":
      return memberOverview();
    case "non-member":
      return applicantOverview(team);
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
    newApplications: received.filter((a) => a.stage === "new").length,
    quiet: quietNote(quietDays(p.open, lastActivity(p, team), NOW)),
    updated: ago(new Date(p.updatedAt), NOW),
  };
}

function positionsPage(kind: ViewerKind, team: Team): PositionsPage {
  const rows = positionsFor(kind, team).map((p) => positionRow(p, team));
  if (kind === "operations-lead") {
    return { scope: "team", positions: rows };
  }
  if (kind === "division-lead") {
    const division = divisionOf(myDivisionId(kind)).name;
    return { scope: "division", division, positions: rows };
  }
  throw new DashboardRefused("positions");
}

/** "ROSSI_GIULIA_CV.pdf" */
function cvName(name: string): string {
  const words = name.toUpperCase().split(/\s+/);
  return `${[words[words.length - 1], ...words.slice(0, -1)].join("_")}_CV.pdf`;
}

function applicationEntry(a: DummyApplication, position: DummyPosition): ApplicationEntry {
  return {
    id: a.id,
    stage: a.stage,
    applicant: { name: a.applicant.name, email: a.applicant.email, phone: a.applicant.phone, politoId: a.applicant.politoId },
    studies: { year: a.applicant.year, degree: a.applicant.degree },
    position: { ref: position.slug, title: position.title },
    applied: appliedLabels(new Date(a.appliedAt), NOW),
    documents: [
      { kind: "cv", name: cvName(a.applicant.name), size: fileSize(a.cvBytes), href: null },
      ...(position.requiresMotivationLetter
        ? [{ kind: "motivation-letter" as const, name: "Motivation_letter.pdf", size: fileSize(a.letterBytes), href: null }]
        : []),
    ],
    answers: [a.answer],
  };
}

function applicationsPage(kind: ViewerKind, team: Team): ApplicationsPage {
  if (kind !== "operations-lead" && kind !== "division-lead") throw new DashboardRefused("applications");
  const scoped = positionsFor(kind, team);
  const byId = new Map(scoped.map((p) => [p.id, p]));
  return {
    positions: scoped.map((p) => ({ ref: p.slug, title: p.title })),
    applications: applicationsTo(scoped, team)
      .sort((x, y) => new Date(y.appliedAt).getTime() - new Date(x.appliedAt).getTime())
      .map((a) => applicationEntry(a, byId.get(a.positionId)!)),
  };
}

/** The person the viewer is on the team; null for the applicant. */
function teamPersonFor(kind: ViewerKind): DummyPerson | null {
  return kind === "non-member" ? null : personFor[kind];
}

const notOnTeam = "This page is for team members.";
const notApplicant = "This page is for applicants.";

/**
 * The dashboard as the test developer sees it, looking as `kind`, with the
 * recruitment switch read from and kept in `recruitment` (./recruitment.ts),
 * their Positions and Applications changes in `changes` (./state.ts), and
 * their Team page edits in `teamEdits` (./edits.ts). Other writes check what
 * was sent as the database side does, store nothing, and answer what the page
 * shows next.
 */
export function dummyDashboardData(
  kind: ViewerKind,
  recruitment: DummyRecruitmentStore,
  changes: DummyStateStore,
  teamEdits: TeamEditsStore = NO_TEAM_EDITS,
): DashboardData {
  const team = teamOf(recruitment.current, changes.current);
  const change = (c: DummyChange) => changes.save(applyDummyChange(changes.current, c));
  const person = teamPersonFor(kind);
  const canSwitch = canSwitchRecruitmentAs(kind);

  return {
    viewer: dummyViewer(kind),
    navCounts: async () => navCountsFor(kind, team),
    overview: async () => overviewFor(kind, team),
    recruitment: async () => ({ recruitment: recruitment.current, canSwitch }),
    // Nothing is cached in dummy mode: /apply reads the cookie on each request.
    setRecruitment: (next) =>
      switchRecruitment(next, { maySwitch: async () => canSwitch, save: recruitment.save, refresh: () => {} }),
    ...dummyTeamPages(kind, teamEdits.current, teamEdits.save),
    positions: async () => positionsPage(kind, team),
    applications: async () => applicationsPage(kind, team),

    async setPositionOpen(id, open) {
      const base = basePositions.find((p) => p.id === id);
      if (!base || !positionsFor(kind, team).some((p) => p.id === id)) throw new DashboardRefused(`position ${id}`);
      await change({ kind: "position", id, open, initial: base.open });
    },

    async setApplicationStage(id, stage: ApplicationStage) {
      const base = baseApplications.find((a) => a.id === id);
      if (!base || !positionsFor(kind, team).some((p) => p.id === base.positionId)) {
        throw new DashboardRefused(`application ${id}`);
      }
      await change({ kind: "application", id, stage, initial: base.stage });
    },

    divisionAccess: async () => (person === null ? null : dummyDivisionAccess(person)),
    giveAccess: async (input) => (person === null ? refused(notOnTeam) : dummyGiveAccess(person, input)),
    removeAccess: async (grantId) => (person === null ? refused(notOnTeam) : dummyRemoveAccess(person, grantId)),

    divisionOrders: async () => (person === null ? null : dummyDivisionOrders(person)),
    placeOrder: async (fields, quote) => (person === null ? refused(notOnTeam) : dummyPlaceOrder(person, fields, quote)),

    myProfile: async () => (person === null ? null : dummyMyProfile(person)),
    saveLinkedin: async (text) => (person === null ? refused(notOnTeam) : dummySaveLinkedin(text)),
    setPhoto: async (photo) => (person === null ? refused(notOnTeam) : dummySetPhoto(photo)),
    requestLeave: async () => (person === null ? refused(notOnTeam) : written(null)),

    myAccount: async () => (person === null ? dummyMyAccount(applicant) : null),
    withdrawApplication: async (id) => (person === null ? dummyWithdraw(applicant, id) : refused(notApplicant)),
    deleteAccount: async (options) =>
      person === null ? dummyDeleteAccount(options) : refused("Leave the team first. Once your lead confirms, you can delete your account."),
  };
}
