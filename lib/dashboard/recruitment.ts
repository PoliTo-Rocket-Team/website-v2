import type { ApplicationStage, ApplicationState } from "./application-flow";
import type { DivisionChoice, PositionContent } from "./new-position";

// What the Positions and Applications pages show (Dashboard v2 boards 57 and
// 58, issue #171, after boards 41 to 41c of issue #142). The dashboard data
// interface (./data.ts) answers these shapes from the dummy arrays or the
// database; the components in components/dashboard/ render them and fetch
// nothing. Where an application stands, and how it moves, is
// ./application-flow.ts.

/** A position as a filter or link names it: the dummy slug, or the database id as text. */
export type PositionRef = string;

/** A department head's department as the recruitment pages name it, with its open divisions for the tabs. */
export type DepartmentUnit = {
  /** "Aerodynamics" */
  readonly name: string;
  /** Its open divisions in tab order; the full name is what rows name and tabs key on. */
  readonly divisions: readonly { readonly id: number; readonly name: string }[];
};

/** The tab a `?division=<id>` link opens (the Overview's Divisions panel): that division's name, else All divisions. */
export function divisionTabFor(department: DepartmentUnit, asked: string | null): string | null {
  return department.divisions.find((d) => String(d.id) === asked)?.name ?? null;
}

/** "Aerodynamics" reads "Aerodynamics Department" in a page's intro. */
export function departmentLabel(name: string): string {
  return /\bDepartment$/.test(name) ? name : `${name} Department`;
}

export type PositionRow = {
  readonly id: number;
  readonly ref: PositionRef;
  readonly title: string;
  readonly division: string;
  readonly department: string;
  readonly open: boolean;
  readonly applications: number;
  /** Applications nobody has looked at yet. */
  readonly newApplications: number;
  /** "No applications in 30 days": an open role that has gone quiet. */
  readonly quiet: string | null;
  /** "2 days ago" */
  readonly updated: string;
  /** "AER-MSA-001": the code the role was saved under, made from its division. */
  readonly code: string;
  /** What the role says as saved: Edit position (issue #207) opens on it. */
  readonly content: PositionContent;
};

/**
 * Who the page is for decides its shape. The operations lead sees the whole
 * team and the site-wide recruitment switch (board 41); a division lead sees
 * their division's roles and a notice of the switch's state (board 41c). The
 * switch itself is #121's, read through `DashboardData.recruitment()`.
 */
export type PositionsPage = (
  | {
      readonly scope: "team";
      readonly positions: readonly PositionRow[];
    }
  | {
      readonly scope: "division";
      /** The lead's division; null when their access names none. */
      readonly division: string | null;
      readonly positions: readonly PositionRow[];
    }
  | {
      /** A department head (board 63, issue #230): every division of their department, under division tabs. */
      readonly scope: "department";
      readonly department: DepartmentUnit;
      readonly positions: readonly PositionRow[];
    }
) & {
  /** What the New position drawer offers (boards 57a, 57b). */
  readonly newPosition: {
    /** The divisions the viewer may post a role in. */
    readonly divisions: readonly DivisionChoice[];
    /** The id the next saved role is likely to get, for the code preview. */
    readonly nextId: number;
  };
};

export type PositionTab = "all" | "open" | "closed";

export const POSITION_TABS: readonly { readonly tab: PositionTab; readonly label: string }[] = [
  { tab: "all", label: "All" },
  { tab: "open", label: "Open" },
  { tab: "closed", label: "Closed" },
];

export function positionTabCounts(positions: readonly PositionRow[]): Record<PositionTab, number> {
  const open = positions.filter((p) => p.open).length;
  return { all: positions.length, open, closed: positions.length - open };
}

/** The rows a tab, a department and a search leave; `department` null is every department. */
export function filterPositions(
  positions: readonly PositionRow[],
  { tab, department, search }: { tab: PositionTab; department: string | null; search: string },
): PositionRow[] {
  const needle = search.trim().toLowerCase();
  return positions.filter(
    (p) =>
      (tab === "all" || p.open === (tab === "open")) &&
      (department === null || p.department === department) &&
      (needle === "" || `${p.title} ${p.division} ${p.department}`.toLowerCase().includes(needle)),
  );
}

/** The departments the rows name, in first-seen order. */
export function departmentsOf(positions: readonly PositionRow[]): string[] {
  return [...new Set(positions.map((p) => p.department))];
}

// Applications ----------------------------------------------------------------

export type ApplicationDocument = {
  readonly kind: "cv" | "motivation-letter";
  readonly name: string;
  /** "412 KB"; null when the size was not stored. */
  readonly size: string | null;
  /** Where the file opens; null when there is no file to open. */
  readonly href: string | null;
};

/** One of the applicant's applications to another role, anywhere on the team (board 58's Other applications). */
export type OtherApplication = {
  readonly title: string;
  readonly department: string;
  readonly division: string;
  readonly stage: ApplicationStage;
};

export type ApplicationEntry = {
  readonly id: number;
  /** Where it stands; ./application-flow.ts says what can happen next. */
  readonly state: ApplicationState;
  readonly applicant: {
    readonly name: string;
    readonly email: string;
    readonly phone: string | null;
    readonly politoId: string | null;
    /** As the application form asked it; it picks "she", "he" or "they" in the dialogs. */
    readonly gender: string | null;
  };
  readonly studies: { readonly year: string | null; readonly degree: string | null };
  readonly position: { readonly ref: PositionRef; readonly title: string; readonly division: string };
  /** "Today" in the list, "today, 14:32" in the detail panel. */
  readonly applied: { readonly day: string; readonly at: string };
  readonly documents: readonly ApplicationDocument[];
  readonly answers: readonly { readonly question: string; readonly answer: string }[];
  /** Newest first; the list's "+2 other" tag counts them. */
  readonly otherApplications: readonly OtherApplication[];
};

/** Whose applications the page lists: the whole team's, a lead's division's, or a head's department's (board 64, issue #230). */
export type ApplicationsScope =
  | { readonly kind: "team" }
  | {
      readonly kind: "division";
      /** As the page's intro names it; null when the lead's access names none. */
      readonly division: string | null;
    }
  | { readonly kind: "department"; readonly department: DepartmentUnit };

export type ApplicationsPage = {
  readonly scope: ApplicationsScope;
  /** The moment the page is seen from (ISO): the interview picker greys out what is past. */
  readonly now: string;
  /** The positions the viewer reaches, for the position filter, with the division each sits in. */
  readonly positions: readonly { readonly ref: PositionRef; readonly title: string; readonly division: string }[];
  /** Newest first. */
  readonly applications: readonly ApplicationEntry[];
};

/** How many applications wait for a first look: the sidebar's count and the New tab's. */
export function newCount(applications: readonly { readonly state: ApplicationState }[]): number {
  return applications.filter((a) => a.state.stage === "new").length;
}

/** "CV + letter" or "CV", as the Documents column reads (board 58b). */
export function documentsLine(documents: readonly ApplicationDocument[]): string {
  const cv = documents.some((d) => d.kind === "cv");
  const letter = documents.some((d) => d.kind === "motivation-letter");
  return [cv ? "CV" : null, letter ? "letter" : null].filter(Boolean).join(" + ");
}

// Ages ------------------------------------------------------------------------

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const TIME_ZONE = "Europe/Rome";

function agoUnit(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}

/** "5 hours ago", "2 days ago", "1 week ago", "2 months ago". */
export function ago(at: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - at.getTime());
  if (ms < HOUR) return "Just now";
  if (ms < DAY) return agoUnit(Math.floor(ms / HOUR), "hour");
  const days = Math.floor(ms / DAY);
  if (days < 7) return agoUnit(days, "day");
  if (days < 30) return agoUnit(Math.floor(days / 7), "week");
  if (days < 365) return agoUnit(Math.floor(days / 30), "month");
  return agoUnit(Math.floor(days / 365), "year");
}

const calendarDay = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TIME_ZONE });
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: TIME_ZONE });

/** Whole calendar days from `at` to `now`, in Turin. */
function calendarDaysBetween(at: Date, now: Date): number {
  const day = (d: Date) => {
    const [y, m, dd] = calendarDay.format(d).split("-").map(Number);
    return Date.UTC(y, m - 1, dd);
  };
  return Math.round((day(now) - day(at)) / DAY);
}

/** When an application came in: "Today" and "today, 14:32"; "2 days ago" and "7 Oct, 10:05". */
export function appliedLabels(at: Date, now: Date): ApplicationEntry["applied"] {
  const days = calendarDaysBetween(at, now);
  const time = clock.format(at);
  if (days <= 0) return { day: "Today", at: `today, ${time}` };
  if (days === 1) return { day: "Yesterday", at: `yesterday, ${time}` };
  return { day: days < 7 ? `${days} days ago` : ago(at, now), at: `${dayMonth.format(at)}, ${time}` };
}

/** An open role with no application for 30 days or more is quiet. */
export const QUIET_DAYS = 30;

/** How many days an open role has gone without an application, once that is 30 or more; else null. */
export function quietDays(open: boolean, lastActivity: Date, now: Date): number | null {
  if (!open) return null;
  const days = Math.floor((now.getTime() - lastActivity.getTime()) / DAY);
  return days >= QUIET_DAYS ? days : null;
}

/** "No applications in 30 days" for an open role that has gone quiet, else null. */
export function quietNote(days: number | null): string | null {
  return days === null ? null : `No applications in ${days} days`;
}

/** "412 KB", "1.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
