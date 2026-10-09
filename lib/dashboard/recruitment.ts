// What the Positions and Applications pages show (boards 41, 41b and 41c,
// issue #142). The dashboard data interface (./data.ts) answers these shapes
// from the dummy arrays or the database; the components in
// components/dashboard/ render them and fetch nothing.

/** A position as a filter or link names it: the dummy slug, or the database id as text. */
export type PositionRef = string;

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
};

/**
 * Who the page is for decides its shape. The operations lead sees the whole
 * team and the site-wide recruitment switch (board 41); a division lead sees
 * their division's roles and a notice of the switch's state (board 41c).
 */
export type PositionsPage =
  | {
      readonly scope: "team";
      readonly recruitment: { readonly open: boolean; readonly switchable: boolean };
      readonly positions: readonly PositionRow[];
    }
  | {
      readonly scope: "division";
      /** The lead's division; null when their access names none. */
      readonly division: string | null;
      readonly recruitment: { readonly open: boolean };
      readonly positions: readonly PositionRow[];
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

/** Where an application stands with the team (board 41b's tabs). */
export const APPLICATION_STAGES = ["new", "in-review", "accepted", "rejected"] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const STAGE_LABELS: Readonly<Record<ApplicationStage, string>> = {
  new: "New",
  "in-review": "In review",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function isApplicationStage(value: unknown): value is ApplicationStage {
  return typeof value === "string" && (APPLICATION_STAGES as readonly string[]).includes(value);
}

export type ApplicationDocument = {
  readonly kind: "cv" | "motivation-letter";
  readonly name: string;
  /** "412 KB"; null when the size was not stored. */
  readonly size: string | null;
  /** Where the file opens; null when there is no file to open. */
  readonly href: string | null;
};

export type ApplicationEntry = {
  readonly id: number;
  readonly stage: ApplicationStage;
  readonly applicant: {
    readonly name: string;
    readonly email: string;
    readonly phone: string | null;
    readonly politoId: string | null;
  };
  readonly studies: { readonly year: string | null; readonly degree: string | null };
  readonly position: { readonly ref: PositionRef; readonly title: string };
  /** "Today" in the list, "today, 14:32" in the detail panel. */
  readonly applied: { readonly day: string; readonly at: string };
  readonly documents: readonly ApplicationDocument[];
  readonly answers: readonly { readonly question: string; readonly answer: string }[];
};

export type ApplicationsPage = {
  /** The positions the viewer reaches, for the position filter. */
  readonly positions: readonly { readonly ref: PositionRef; readonly title: string }[];
  /** Newest first. */
  readonly applications: readonly ApplicationEntry[];
};

export function stageCounts(applications: readonly ApplicationEntry[]): Record<ApplicationStage, number> {
  const counts = { new: 0, "in-review": 0, accepted: 0, rejected: 0 };
  for (const a of applications) counts[a.stage] += 1;
  return counts;
}

/**
 * The next step at the foot of the detail panel, beside Reject. A new
 * application moves to interview, one in review is accepted. A decided
 * application has no buttons; its stage menu still changes it.
 */
export function nextStage(stage: ApplicationStage): { readonly label: string; readonly to: ApplicationStage } | null {
  switch (stage) {
    case "new":
      return { label: "Move to interview", to: "in-review" };
    case "in-review":
      return { label: "Accept", to: "accepted" };
    case "accepted":
    case "rejected":
      return null;
  }
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
