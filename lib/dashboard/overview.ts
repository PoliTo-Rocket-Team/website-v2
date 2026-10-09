// What the Overview page shows (boards 40 and 40m). A lead sees the team
// shape (figures, what needs attention, recent activity); a member or an
// applicant sees the personal shape (who they are and what is theirs). The
// components in components/dashboard/ render these and fetch nothing.

export type Link = { readonly label: string; readonly href: string };

export type Stat = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  /** A green dot before the value: the thing is live (recruitment open). */
  readonly live?: boolean;
};

export type AttentionKind = "applications" | "quiet-position" | "unassigned";

export type AttentionItem = {
  readonly kind: AttentionKind;
  readonly title: string;
  readonly detail: string;
  readonly action: Link;
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
  readonly role: string;
  readonly lead: boolean;
  readonly self: boolean;
};

export type Roster = {
  readonly title: string;
  readonly detail: string;
  readonly people: readonly RosterPerson[];
};

export type ApplicationStatus = "received" | "in-review" | "accepted" | "declined";

export type OwnApplication = {
  readonly title: string;
  readonly detail: string;
  readonly status: ApplicationStatus;
};

export type PersonalOverview = {
  readonly shape: "personal";
  readonly person: PersonHeader;
  readonly checklist: Checklist | null;
  readonly roster: Roster | null;
  readonly applications: readonly OwnApplication[] | null;
  /** The one-line strip under the panels (board 40m). */
  readonly hint: string | null;
};

export type Overview = TeamOverview | PersonalOverview;

/** "2 of 4 done." */
export function checklistProgress(items: readonly ChecklistItem[]): string {
  return `${items.filter((item) => item.done).length} of ${items.length} done.`;
}
