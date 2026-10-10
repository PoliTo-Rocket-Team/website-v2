// What the Overview page shows. The operations lead sees the team shape
// (board 40: figures, what needs attention, recent activity); a division lead
// sees the division shape (board 56: the same, scoped to their division, plus
// upcoming interviews); a member sees the personal shape (board 52: who they
// are and what is theirs). A non-member who has applied sees the applicant
// shape (board 50e, ./applicant-overview.ts), which the page builds from My
// applications and the open positions. The components in
// components/dashboard/ render these and fetch nothing.

import type { ApplicantOverview } from "./applicant-overview";

export type Link = { readonly label: string; readonly href: string };

export type Stat = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  /** A green dot before the value: the thing is live (recruitment open, orders waiting). */
  readonly live?: boolean;
};

/** "notice": a stored dashboard notice (./notices.ts), whatever its own kind. */
export type AttentionKind = "applications" | "quiet-position" | "unassigned" | "no-photo" | "notice";

/** A row's button that dismisses the stored notice it shows (./notices.ts). */
export type DismissNotice = { readonly label: string; readonly dismissNotice: number };

/** Where a row's button goes, or the notice it dismisses. */
export type AttentionAction = Link | DismissNotice;

export function isDismissNotice(action: AttentionAction): action is DismissNotice {
  return "dismissNotice" in action;
}

export type AttentionItem = {
  readonly kind: AttentionKind;
  readonly title: string;
  /** The shorter title phones show (board 56m), when it differs. */
  readonly phoneTitle?: string;
  readonly detail: string;
  readonly action: AttentionAction;
};

export type ActivityItem = {
  readonly actor: string;
  readonly text: string;
  readonly when: string;
  /** The viewer did it: their initials show on the accent. */
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

export type PersonHeader = {
  readonly name: string;
  /** "Member · Mission Analysis Division · Aerodynamics" */
  readonly line: string;
  /** "In the team since October 2025" */
  readonly since: string | null;
  readonly edit: Link | null;
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

export type RosterPerson = {
  readonly name: string;
  /** "Division lead" or "Member"; the viewer's own row reads "You" on desktop (board 52). */
  readonly role: string;
  readonly lead: boolean;
  readonly self: boolean;
};

export type Roster = {
  readonly title: string;
  readonly detail: string;
  /** Everyone in the division, not only the people listed. */
  readonly size: number;
  readonly people: readonly RosterPerson[];
};

export type PersonalOverview = {
  readonly shape: "personal";
  readonly person: PersonHeader;
  readonly checklist: Checklist | null;
  readonly roster: Roster | null;
  /** The one-line strip under the panels (board 40m). */
  readonly hint: string | null;
};

/** What the dashboard data interface answers: the team's own Overviews. */
export type TeamSideOverview = TeamOverview | DivisionOverview | PersonalOverview;

export type Overview = TeamSideOverview | ApplicantOverview;

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
