// What the Overview page shows. Every team seat gets one Overview (issue
// #593): the personal panels of board 52 (who they are, their page on the
// site, their division's roster, and "Your access" for what they are
// granted), with the figures, attention rows and panels their scope reads.
// The shape names that scope. The operations lead reads the team shape
// (board 40: figures, what needs attention, recent activity); the team leader
// the leader shape (board 72, issue #252: the same across the team, with what
// waits for their decision and a Departments panel); a division lead the
// division shape (board 56: the same, scoped to their division, plus upcoming
// interviews); a department head the department shape (board 62, issue #230:
// the same across their department, plus a Divisions panel); and a member the
// division shape too, with only the areas they are granted (issue #471), so
// none for a member who holds no grant. A non-member sees the applicant shape
// (boards 50e and 50f, ./applicant-overview.ts) and an alumnus the alumni
// shape (issue #317's board 56, not the division lead's board 56 above;
// ./my-alumni.ts), which the page builds from My applications and My alumni.
// The components in components/dashboard/ render these and fetch nothing.

import type { AccessSection } from "./access-summary";
import type { ApplicantOverview } from "./applicant-overview";
import type { AlumniOverview } from "./my-alumni";
import type { RoleType } from "./team";
import { isTeamLeader, type FlaggedSeat, type ViewerStanding } from "./viewer";

export type Link = { readonly label: string; readonly href: string };

export type Stat = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  /** A green dot before the value: the thing is live (recruitment open, orders waiting). */
  readonly live?: boolean;
};

/**
 * "notice": a stored dashboard notice (./notices.ts), whatever its own kind.
 * "hand-over": a hand-over waiting for the viewer's answer (board 62c,
 * ./hand-over-request.ts), always the top row. The team leader's rows (board 72, ./leader-overview.ts): orders waiting for
 * their decision, approved orders not ordered yet, and positions closing soon.
 */
export type AttentionKind =
  | "applications"
  | "quiet-position"
  | "unassigned"
  | "no-photo"
  | "notice"
  | "orders-to-decide"
  | "approved-orders"
  | "hand-over"
  | "alias-request";

/** A row's button that dismisses the stored notice it shows (./notices.ts). */
export type DismissNotice = { readonly label: string; readonly dismissNotice: number };

/** A row's Decline and Confirm on a hand-over waiting for the viewer (board 62c, ./hand-over-request.ts). */
export type AnswerHandOver = { readonly answerHandOver: number };

/**
 * A row's Decline and Mark created on an open alias request (board 94c,
 * ./alias-request.ts): the member it is for, the address Mark created's
 * dialog starts from (board 94d), and the member's sign-in email, their
 * `users.email`, which the alias forwards to (issue #586). Only the approver
 * seats get these rows (`aliasAttentionFor`), so nobody else is sent it.
 */
export type AnswerAlias = { readonly answerAlias: number; readonly member: string; readonly prefill: string; readonly signInEmail: string };

/** Where a row's button goes, the notice it dismisses, or the request it answers. */
export type AttentionAction = Link | DismissNotice | AnswerHandOver | AnswerAlias;

export function isDismissNotice(action: AttentionAction): action is DismissNotice {
  return "dismissNotice" in action;
}

export function isAnswerHandOver(action: AttentionAction): action is AnswerHandOver {
  return "answerHandOver" in action;
}

export function isAnswerAlias(action: AttentionAction): action is AnswerAlias {
  return "answerAlias" in action;
}

export type AttentionItem = {
  readonly kind: AttentionKind;
  readonly title: string;
  /** The shorter title phones show (board 56m), when it differs. */
  readonly phoneTitle?: string;
  readonly detail: string;
  readonly action: AttentionAction;
  /**
   * The kind whose icon the row's tile draws, when it is not its own: an alias
   * notice is a "notice" but draws the alias request's at-sign (boards 94c and
   * 94f, issue #565).
   */
  readonly iconKind?: AttentionKind;
};

export type ActivityItem = {
  readonly actor: string;
  readonly text: string;
  readonly when: string;
  /** The viewer did it: their circle shows on the accent. */
  readonly self: boolean;
};

export type TeamOverview = {
  readonly shape: "team";
  readonly stats: readonly Stat[];
  readonly attention: readonly AttentionItem[];
  readonly activity: readonly ActivityItem[];
};

/** An interview the lead has booked, or one still waiting for the applicant to pick a time. */
export type UpcomingInterview = {
  readonly applicant: string;
  readonly position: string;
  /**
   * Who offered its times, read "with Marco Bianchi" under the time (board
   * 99b, issue #652); null for times stored before the setter was recorded.
   */
  readonly setBy: string | null;
} & (
  | { readonly state: "booked"; readonly start: Date; readonly end: Date }
  | { readonly state: "waiting" }
);

export type DivisionOverview = {
  readonly shape: "division";
  readonly stats: readonly Stat[];
  readonly attention: readonly AttentionItem[];
  readonly interviews: readonly UpcomingInterview[];
  readonly activity: readonly ActivityItem[];
};

/** One division on a department head's Overview (boards 62 and 62m): who leads it, how big it is, what waits. */
export type DivisionSummary = {
  readonly id: number;
  /** "Mission Analysis Division" */
  readonly name: string;
  readonly leads: readonly string[];
  readonly people: number;
  readonly newApplications: number;
  readonly openPositions: number;
};

/**
 * Board 62 and 62m (issue #230): a department head's figures and attention
 * across their department, a Divisions panel with one row per division,
 * upcoming interviews (62m) and recent activity (62).
 */
export type DepartmentOverview = {
  readonly shape: "department";
  readonly stats: readonly Stat[];
  readonly attention: readonly AttentionItem[];
  readonly divisions: readonly DivisionSummary[];
  readonly interviews: readonly UpcomingInterview[];
  readonly activity: readonly ActivityItem[];
};

/** One department on the team leader's Overview (board 72): who heads it, how big it is, what waits. */
export type DepartmentSummary = {
  readonly id: number;
  /** "Aerodynamics" */
  readonly name: string;
  readonly heads: readonly string[];
  readonly divisions: number;
  /** Everyone in its divisions and its heads, each once. */
  readonly people: number;
  readonly newApplications: number;
  readonly openPositions: number;
};

/**
 * Board 72 (issue #252): the team leader's figures across the team, what
 * waits for them (./leader-overview.ts), a Departments panel with one row
 * per department, and recent activity. The Activity log is the IT lead's
 * alone, so the panel links to none.
 */
export type TeamLeaderOverview = {
  readonly shape: "leader";
  readonly stats: readonly Stat[];
  readonly attention: readonly AttentionItem[];
  readonly departments: readonly DepartmentSummary[];
  /** Everyone on the team once: the panel's people count. */
  readonly people: number;
  readonly activity: readonly ActivityItem[];
};

/** "6 departments · 112 people", beside the Departments panel's title (board 72). */
export function departmentsMeta(departments: number, people: number): string {
  return `${departments} ${departments === 1 ? "department" : "departments"} · ${rosterSize(people)}`;
}

/** "Head Chiara Ferri · 2 divisions · 16 people" under a department's name (board 72). */
export function departmentLine(department: DepartmentSummary): string {
  const heads = department.heads.length === 0 ? "No head yet" : `Head ${department.heads.join(", ")}`;
  const divisions = `${department.divisions} ${department.divisions === 1 ? "division" : "divisions"}`;
  return `${heads} · ${divisions} · ${rosterSize(department.people)}`;
}

/** "2 divisions · 16 people", beside the Divisions panel's title (board 62). */
export function divisionsMeta(divisions: readonly DivisionSummary[]): string {
  const people = divisions.reduce((sum, d) => sum + d.people, 0);
  return `${divisions.length} ${divisions.length === 1 ? "division" : "divisions"} · ${people} ${people === 1 ? "person" : "people"}`;
}

/** "Leads", "Lead", or null for a division with no lead yet. */
export function leadsLabel(leads: readonly string[]): string | null {
  if (leads.length === 0) return null;
  return leads.length === 1 ? "Lead" : "Leads";
}

/** "MA" for "Mission Analysis Division", "OA" for "Optimization and Analysis Division" (board 62's tile). */
export function divisionInitials(name: string): string {
  const words = divisionShortName(name)
    .split(/\s+/)
    .filter((w) => w !== "" && !["and", "&", "of", "the"].includes(w.toLowerCase()));
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export type PersonHeader = {
  readonly name: string;
  /** "Member · Mission Analysis Division · Aerodynamics" */
  readonly line: string;
  /** "In the team since October 2025" */
  readonly since: string | null;
  readonly edit: Link | null;
  /** The viewer's stored photo, the one the sidebar shows (`DashboardViewer.photoUrl`); null draws the PRT mark (issue #599). */
  readonly photoUrl: string | null;
};

export type ChecklistItem = {
  readonly label: string;
  readonly detail: string;
  readonly done: boolean;
  readonly action: Link | null;
};

export type Checklist = {
  readonly title: string;
  readonly detail: string;
  readonly items: readonly ChecklistItem[];
};

/**
 * Who sets someone's name and division on The Team page, from the seat they
 * hold (issue #641): their division lead for a role in a division; the team
 * leader for a department head (Change head) and for a team-level seat (Add
 * seat, Change holder on the Team tree's seat row); and, for the team leader,
 * the previous team leader, who handed the role over.
 */
export type PageSetter = "division-lead" | "team-leader" | "previous-team-leader";

/**
 * One active role, as "Your page on the site" reads it. `fullAccess` is the
 * team-level seat the role is flagged as, whether or not it sits in a
 * division: the IT lead's seat is a lead role in the IT division.
 */
export type PageRole = { readonly type: RoleType; readonly divisionId: number | null; readonly fullAccess: FlaggedSeat | null };

/**
 * The setter of the highest seat among someone's active roles: the team
 * leader's seat, then a head's, a role flagged as a team-level seat or any
 * role in no division, then a role in a division. Null for someone holding
 * no role.
 */
export function pageSetterOf(roles: readonly PageRole[]): PageSetter | null {
  if (roles.length === 0) return null;
  if (roles.some((r) => r.type === "president")) return "previous-team-leader";
  if (roles.some((r) => r.type === "head" || r.fullAccess !== null || r.divisionId === null)) return "team-leader";
  return "division-lead";
}

const PAGE_SETTER_DETAIL: Readonly<Record<PageSetter, string>> = {
  "division-lead": "Set by your division lead",
  "team-leader": "Set by the team leader",
  "previous-team-leader": "Handed over by the previous team leader",
};

/** What "Your page on the site" reads about the viewer. */
export type PageProfile = {
  readonly roles: readonly PageRole[];
  readonly email: string;
  /** Their stored photo; null when none is stored. */
  readonly photoUrl: string | null;
  readonly linkedin: string | null;
};

/**
 * "Your page on the site" (board 52): name and division, email, photo and
 * LinkedIn, each done or not. Null once all four are done, so the Overview
 * shows no panel; it comes back as soon as one is undone (Owner decision,
 * 2026-10-24, on #641).
 */
export function pageChecklistOf(page: PageProfile): Checklist | null {
  const setter = pageSetterOf(page.roles);
  const items: ChecklistItem[] = [
    { label: "Name and division", detail: PAGE_SETTER_DETAIL[setter ?? "division-lead"], done: setter !== null, action: null },
    { label: "Email", detail: page.email, done: true, action: null },
    {
      label: "Photo",
      detail: "A clear, square photo of your face",
      done: page.photoUrl !== null,
      action: page.photoUrl !== null ? null : { label: "Upload", href: "/dashboard/profile" },
    },
    {
      label: "LinkedIn",
      detail: "Optional, shown as an icon on your card",
      done: page.linkedin !== null,
      action: page.linkedin !== null ? null : { label: "Add", href: "/dashboard/profile" },
    },
  ];
  if (items.every((item) => item.done)) return null;
  return {
    title: "Your page on the site",
    detail: `This is how you appear on The Team page. ${checklistProgress(items)}`,
    items,
  };
}

export type RosterPerson = {
  readonly name: string;
  /** "Department head", "Division lead" or "Member"; the viewer's own row reads "You" on desktop (board 52). */
  readonly role: string;
  /** A head or a lead: their circle shows on the accent. */
  readonly lead: boolean;
  readonly self: boolean;
  /** Their stored photo; null draws the PRT mark (issue #599). */
  readonly photoUrl: string | null;
};

export type Roster = {
  readonly title: string;
  readonly detail: string;
  /** Everyone in the division or department, not only the people listed. */
  readonly size: number;
  /** At most `ROSTER_LIMIT` of them. */
  readonly people: readonly RosterPerson[];
  /** "See all 14 on Members", to the Members page (board 99b); null for a viewer who does not reach that page. */
  readonly seeAll: Link | null;
};

/** The most people an Overview roster lists (board 99b); everyone is on the Members page. */
export const ROSTER_LIMIT = 6;

/** One active role row in the viewer's division or department, as the personal roster reads it. */
export type RosterRow = {
  readonly memberId: number;
  readonly name: string;
  /** The row's position type; "lead" or "head" makes the member a division lead. */
  readonly type: string | null;
  readonly photoUrl: string | null;
};

/** A row of a department's roster: the head's own row names no division. */
export type DepartmentRosterRow = RosterRow & { readonly divisionId: number | null };

/** Where someone stands in a roster, highest first. */
type RosterRank = "head" | "lead" | "member";

const RANK_ORDER: readonly RosterRank[] = ["head", "lead", "member"];

const RANK_LABELS: Readonly<Record<RosterRank, string>> = {
  head: "Department head",
  lead: "Division lead",
  member: "Member",
};

/** A division roster's row: "lead" or "head" in a division makes a division lead. */
function divisionRankOf(row: RosterRow): RosterRank {
  return row.type === "lead" || row.type === "head" ? "lead" : "member";
}

/** A department roster's row: the head's own row names no division; in a division it reads as a division row. */
function departmentRankOf(row: DepartmentRosterRow): RosterRank {
  return row.type === "head" && row.divisionId === null ? "head" : divisionRankOf(row);
}

/** "See all 14 on Members", or null for a viewer who does not reach the Members page. */
function seeAllOf(size: number, members: string | null): Link | null {
  return members === null ? null : { label: `See all ${size} on Members`, href: members };
}

/**
 * One member can hold more than one active role row in a unit (a department
 * head who also leads a division in it), so the rows collapse to one person
 * per member (issue #249), at the highest rank any of their rows has. Heads
 * come first, then leads, the viewer among them when they hold one of those
 * seats (board 99b); then the other members, and the viewer last when they
 * are a member. At most `ROSTER_LIMIT` are listed, the viewer always among
 * them; `size` counts everyone.
 */
function rosterPeople<R extends RosterRow>(rows: readonly R[], rankOf: (row: R) => RosterRank, viewerId: number | null) {
  const byMember = new Map<number, RosterPerson & { rank: RosterRank }>();
  for (const row of rows) {
    const held = byMember.get(row.memberId)?.rank;
    const own = rankOf(row);
    const rank = held !== undefined && RANK_ORDER.indexOf(held) < RANK_ORDER.indexOf(own) ? held : own;
    byMember.set(row.memberId, {
      name: row.name,
      role: RANK_LABELS[rank],
      lead: rank !== "member",
      self: row.memberId === viewerId,
      photoUrl: row.photoUrl,
      rank,
    });
  }
  const everyone = [...byMember.values()];
  const me = everyone.filter((p) => p.self && p.rank === "member");
  const room = ROSTER_LIMIT - me.length;
  const leads = keepingViewer(
    RANK_ORDER.filter((rank) => rank !== "member").flatMap((rank) => everyone.filter((p) => p.rank === rank)),
    room,
  );
  const others = everyone.filter((p) => !p.self && p.rank === "member").slice(0, room - leads.length);
  return { size: everyone.length, people: [...leads, ...others, ...me].map(({ rank: _rank, ...person }) => person) };
}

/** The first `room` of `people`, the viewer kept in the last place when they would fall off. */
function keepingViewer<T extends { readonly self: boolean }>(people: readonly T[], room: number): T[] {
  const first = people.slice(0, room);
  const viewer = people.find((p) => p.self);
  return viewer === undefined || first.includes(viewer) ? first : [...first.slice(0, room - 1), viewer];
}

/**
 * The viewer's division on the personal Overview (boards 52 and 99b): at
 * most `ROSTER_LIMIT` people (`rosterPeople`), with "See all N on Members"
 * to `members`, the Members page, when the viewer reaches it.
 */
export function divisionRoster(
  division: { readonly title: string; readonly department: string; readonly members: string | null },
  rows: readonly RosterRow[],
  viewerId: number | null,
): Roster {
  const { size, people } = rosterPeople(rows, divisionRankOf, viewerId);
  return { title: division.title, detail: `${division.department} · ${rosterSize(size)}`, size, people, seeAll: seeAllOf(size, division.members) };
}

/**
 * A department head's department on their Overview (issue #652): its head
 * and everyone in its divisions, as a division's roster lists them.
 */
export function departmentRoster(
  department: { readonly title: string; readonly divisions: number; readonly members: string | null },
  rows: readonly DepartmentRosterRow[],
  viewerId: number | null,
): Roster {
  const { size, people } = rosterPeople(rows, departmentRankOf, viewerId);
  const divisions = `${department.divisions} ${department.divisions === 1 ? "division" : "divisions"}`;
  return { title: department.title, detail: `${divisions} · ${rosterSize(size)}`, size, people, seeAll: seeAllOf(size, department.members) };
}

/**
 * Board 52's panels, on every team seat's Overview (issue #593): who the
 * viewer is, their page on the site, the roster of their own division or
 * department (issue #652: never wider, whatever their grants reach, and none
 * for the team leader, whose whole team is on the Members page), and "Your
 * access".
 */
export type PersonalPanels = {
  readonly person: PersonHeader;
  /** Where these panels sit beside the scope board (`overviewLayoutOf`). */
  readonly layout: OverviewLayout;
  /** "Your page on the site" (`pageChecklistOf`); null once every step is done (issue #641). */
  readonly checklist: Checklist | null;
  readonly rosters: readonly Roster[];
  readonly access: AccessSection;
};

/**
 * How a team seat's Overview sets its panels out. `leader-columns` is boards
 * 99 and 99b (issue #652): what needs attention, their page on the site and
 * the scope's own panel on the left, the roster then recent activity on the
 * right. `board-first` is the order from before: the scope board's attention
 * beside its activity, then their page on the site beside the roster.
 */
export type OverviewLayout = "leader-columns" | "board-first";

/**
 * Boards 99 and 99b are for the three leaders the issue names: the team
 * leader, a department head and a division lead. Every other team seat (a
 * member, with or without grants, and a full-access seat that is not the team
 * leader) keeps the board-first order.
 */
export function overviewLayoutOf(viewer: ViewerStanding): OverviewLayout {
  if (viewer.kind === "department-head" || viewer.kind === "division-lead" || isTeamLeader(viewer)) return "leader-columns";
  return "board-first";
}

/** The one-line strip under a member's panels when they hold no grant and read no area (board 40m). */
export const ACCESS_HINT = "Need to work on recruitment or site content? Ask your division lead or the admin team for access.";

/** The figures, rows and panels a seat's scope reads: the board its shape names. */
export type ScopeBoard = TeamOverview | TeamLeaderOverview | DepartmentOverview | DivisionOverview;

/** What the dashboard data interface answers: the one team Overview, the same for every seat but the scope it reads (issue #593). */
export type TeamSideOverview = ScopeBoard & PersonalPanels;

/**
 * The team Overview in the sections the page streams one by one (issue
 * #397): the person, known with the viewer, so it shows at once; the board
 * its scope reads; and board 52's own panels. Each read starts when the
 * sections are asked for, so they run side by side; `TeamSideOverview` is
 * the three together (`overviewOfSections`).
 */
export type OverviewSections = {
  readonly person: PersonHeader;
  readonly board: Promise<ScopeBoard>;
  readonly panels: Promise<Omit<PersonalPanels, "person">>;
};

/** The whole team Overview, once every section has arrived. */
export async function overviewOfSections({ person, board, panels }: OverviewSections): Promise<TeamSideOverview> {
  const [scope, own] = await Promise.all([board, panels]);
  return { ...scope, ...own, person };
}

/** Someone off the team: a non-member (boards 50e, 50f) or an alumnus (board 56, issue #317), built by the page. */
export type Overview = TeamSideOverview | ApplicantOverview | AlumniOverview;

/** "2 of 4 done", the count phones show beside the checklist title (board 52m). */
export function checklistCount(items: readonly ChecklistItem[]): string {
  return `${items.filter((item) => item.done).length} of ${items.length} done`;
}

/** "2 of 4 done." */
export function checklistProgress(items: readonly ChecklistItem[]): string {
  return `${checklistCount(items)}.`;
}

/** "6 people", beside the division's title on phones (board 52m). */
export function rosterSize(size: number): string {
  return `${size} ${size === 1 ? "person" : "people"}`;
}

/** Booked interviews first, soonest first, then the ones waiting for a time. */
export function interviewOrder(interviews: readonly UpcomingInterview[]): UpcomingInterview[] {
  const booked = interviews.flatMap((i) => (i.state === "booked" ? [i] : []));
  const waiting = interviews.filter((i) => i.state === "waiting");
  return [...booked.sort((a, b) => a.start.getTime() - b.start.getTime()), ...waiting];
}

/** "2 booked · 1 waiting"; a side with none is left out. */
export function interviewSummary(interviews: readonly UpcomingInterview[]): string {
  const booked = interviews.filter((i) => i.state === "booked").length;
  const waiting = interviews.length - booked;
  return [booked > 0 ? `${booked} booked` : null, waiting > 0 ? `${waiting} waiting` : null].filter(Boolean).join(" · ");
}

const TEAM_TIME_ZONE = "Europe/Rome";
const dayOf = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: TEAM_TIME_ZONE });
const monthOf = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: TEAM_TIME_ZONE });
const weekdayOf = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TEAM_TIME_ZONE });
const timeOf = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TEAM_TIME_ZONE });

/**
 * A booked slot as board 56 shows it, in the team's time zone: "16", "OCT",
 * "Thu 17:30 – 18:00"; and as the phone pill shows it (board 56m): "Thu 16, 17:30".
 */
export function interviewSlot(start: Date, end: Date): { day: string; month: string; when: string; short: string } {
  const weekday = weekdayOf.format(start);
  const day = dayOf.format(start);
  return {
    day,
    month: monthOf.format(start).toUpperCase(),
    when: `${weekday} ${timeOf.format(start)} – ${timeOf.format(end)}`,
    short: `${weekday} ${day}, ${timeOf.format(start)}`,
  };
}

/** "Mission Analysis Division" reads "Mission Analysis" after "people in". */
export function divisionShortName(name: string): string {
  return name.replace(/\s+Division$/, "");
}

/** "Oldest is 6 days old"; "Oldest is from today" for one sent today. */
export function oldestLine(oldest: Date, now: Date): string {
  const days = Math.floor((now.getTime() - oldest.getTime()) / 86_400_000);
  if (days < 1) return "Oldest is from today";
  return `Oldest is ${days} ${days === 1 ? "day" : "days"} old`;
}

/** One attention row for the division's members with no photo on The Team page (board 56). */
export function noPhotoItem(names: readonly string[]): AttentionItem | null {
  if (names.length === 0) return null;
  return {
    kind: "no-photo",
    title:
      names.length === 1
        ? `${names[0]} has no photo on the Team page`
        : `${names.length} members have no photo on the Team page`,
    phoneTitle: names.length === 1 ? `${names[0]} has no photo` : `${names.length} members have no photo`,
    detail: names.length === 1 ? "Ask them to add one in My profile" : names.join(", "),
    action: { label: "View", href: "/dashboard/members" },
  };
}
