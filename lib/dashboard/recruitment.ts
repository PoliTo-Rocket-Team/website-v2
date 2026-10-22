import type { ApplicantDetails } from "./applicant-details";
import type { ApplicantStanding, ApplicationStage, ApplicationState } from "./application-flow";
import type { DivisionChoice, PositionContent } from "./new-position";
import { areaUnitsOf, type AreaReader } from "./viewer";

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

/** What a role's applications say on the Positions page: Applications data, so only where the viewer reads Applications. */
export type PositionApplications = {
  /** Every live application to it. */
  readonly total: number;
  /** Applications nobody has looked at yet. */
  readonly fresh: number;
  /** "No applications in 30 days": an open role that has gone quiet. */
  readonly quiet: string | null;
};

export type PositionRow = {
  readonly id: number;
  readonly ref: PositionRef;
  readonly title: string;
  readonly division: string;
  readonly department: string;
  readonly open: boolean;
  /**
   * Null where the viewer reads Positions but not Applications: a Positions
   * grant shows the role, never a figure about who applied (issue #477).
   */
  readonly applications: PositionApplications | null;
  /**
   * Whether the viewer may open or close this role (issue #487), by the rule
   * every position write asks (`mayChangePositionIn`, ./position-access.ts).
   * Where false its switch shows the role's state and cannot be flipped.
   */
  readonly canChange: boolean;
  /** "2 days ago" */
  readonly updated: string;
  /** "AER-MSA-001": the code the role was saved under, made from its division. */
  readonly code: string;
  /** What the role says as saved: Edit position (issue #207) opens on it. */
  readonly content: PositionContent;
};

/** A place a member's grant covers, as a page's intro names it (issue #487). */
export type GrantPlace = { readonly kind: "department"; readonly name: string } | { readonly kind: "division"; readonly name: string };

/** An open department or division by id, as `grantReachOf` names it. */
export type NamedUnit = { readonly id: number; readonly name: string };

/**
 * What a member's grants on one area cover, as the Positions and
 * Applications intros name it (issues #487, #577): the whole team when they
 * cover every open department, which is what a `team` scope row opens, else
 * the places they cover.
 */
export type GrantReach = { readonly kind: "team" } | { readonly kind: "places"; readonly places: readonly [GrantPlace, ...GrantPlace[]] };

/**
 * The reach of a member's grants on `area` (issues #487, #577): the units
 * `areaUnitsOf` gives, departments first, each by name, among the open ones.
 * A member's own role adds no unit there, so the page never names their own
 * division for a grant elsewhere. Null when the grants cover no open unit.
 */
export function grantReachOf(
  viewer: AreaReader,
  area: "positions" | "applications",
  open: { readonly departments: readonly NamedUnit[]; readonly divisions: readonly NamedUnit[] },
): GrantReach | null {
  const units = areaUnitsOf(viewer, area);
  if (open.departments.length > 0 && open.departments.every((d) => units.departmentIds.includes(d.id))) return { kind: "team" };
  const named = (list: readonly NamedUnit[], ids: readonly number[]) =>
    list
      .filter((u) => ids.includes(u.id))
      .map((u) => u.name)
      .sort((a, b) => a.localeCompare(b));
  const [first, ...rest] = [
    ...named(open.departments, units.departmentIds).map((name): GrantPlace => ({ kind: "department", name })),
    ...named(open.divisions, units.divisionIds).map((name): GrantPlace => ({ kind: "division", name })),
  ];
  return first === undefined ? null : { kind: "places", places: [first, ...rest] };
}

/**
 * The places a grant covers, named once (issue #577): "the Propulsion
 * Department", "the Propulsion Department and the Test Bench", and past two
 * places a count, "3 departments and 1 division", so a line never chains
 * every department with "and".
 */
export function placesPhrase(places: readonly [GrantPlace, ...GrantPlace[]]): string {
  if (places.length <= 2) return places.map((p) => `the ${p.kind === "department" ? departmentLabel(p.name) : p.name}`).join(" and ");
  const counted = (kind: GrantPlace["kind"]) => {
    const n = places.filter((p) => p.kind === kind).length;
    return n === 0 ? [] : [`${n} ${kind}${n === 1 ? "" : "s"}`];
  };
  return [...counted("department"), ...counted("division")].join(" and ");
}

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
  | {
      /**
       * A member who reads Positions by a grant (issue #487): what their
       * Positions grants cover (`grantReachOf`), never their own role's division.
       */
      readonly scope: "granted";
      readonly reach: GrantReach;
      readonly positions: readonly PositionRow[];
    }
) & {
  /**
   * Whether the viewer reads Applications at all (`readsRecruitment`): the
   * table's Applications column shows only then (issue #487).
   */
  readonly readsApplications: boolean;
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
  {
    tab,
    department,
    division = null,
    search,
  }: { tab: PositionTab; department: string | null; division?: string | null; search: string },
): PositionRow[] {
  const needle = search.trim().toLowerCase();
  return positions.filter(
    (p) =>
      (tab === "all" || p.open === (tab === "open")) &&
      (department === null || p.department === department) &&
      (division === null || p.division === division) &&
      (needle === "" || `${p.title} ${p.division} ${p.department}`.toLowerCase().includes(needle)),
  );
}

/** The departments the rows name, in first-seen order. */
export function departmentsOf(positions: readonly PositionRow[]): string[] {
  return [...new Set(positions.map((p) => p.department))];
}

/**
 * The team leader's "All divisions" select (boards 63 and 64 with whole-team
 * selects, issue #252): the divisions the rows name in the chosen department,
 * or across the team, by name.
 */
export function divisionsOf(rows: readonly { readonly division: string; readonly department: string }[], department: string | null): string[] {
  return [...new Set(rows.filter((r) => department === null || r.department === department).map((r) => r.division))].sort((a, b) =>
    a.localeCompare(b),
  );
}

// Applications ----------------------------------------------------------------

export type ApplicationDocument = {
  readonly kind: "cv" | "motivation-letter";
  readonly name: string;
  /** "412 KB"; null when the size was not stored. */
  readonly size: string | null;
  /** Where the file opens: the access-checked document route (./application-documents.ts); null when no file is stored. */
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
  /** Their name, and every field they gave on the apply form and in "Your details" (issue #406). */
  readonly applicant: ApplicantDetails & { readonly name: string };
  /** Where the applicant stands with the team: a member joins with no NDA wait (board 58h2). */
  readonly standing: ApplicantStanding;
  readonly position: { readonly ref: PositionRef; readonly title: string; readonly division: string };
  /** "Today" in the list, "today, 14:32" in the detail panel. */
  readonly applied: { readonly day: string; readonly at: string };
  readonly documents: readonly ApplicationDocument[];
  readonly answers: readonly { readonly question: string; readonly answer: string }[];
  /** Newest first; the list's "+2 other" tag counts them. */
  readonly otherApplications: readonly OtherApplication[];
  /**
   * Whether the viewer may move this application (issue #577), by the rule
   * every application write asks (`mayChangePositionIn` on Applications in
   * its position's unit, ./position-access.ts). Where false the panel shows
   * its stage and offers no step.
   */
  readonly canChange: boolean;
};

/**
 * Whose applications the page lists: the whole team's, a lead's division's, a
 * head's department's (board 64, issue #230), or what a member's Applications
 * grants cover (issue #577), never their own role's division.
 */
export type ApplicationsScope =
  | { readonly kind: "team" }
  | { readonly kind: "granted"; readonly reach: GrantReach }
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
  /** The positions the viewer reaches, for the position filter, with the division and department each sits in. */
  readonly positions: readonly { readonly ref: PositionRef; readonly title: string; readonly division: string; readonly department: string }[];
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
