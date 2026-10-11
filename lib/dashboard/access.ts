import type { ViewerKind } from "./viewer";

// Which viewer reaches which dashboard page, and where the page sits for that
// viewer (Dashboard v2 boards 51b, 52 and 56; the operations lead keeps boards
// 40 to 46). One row per page: a new page adds one row. A viewer missing from
// a row's `reach` does not reach the page. Site content, admin Access and the
// Activity log are not designed yet, so they have no row.

export const NAV_GROUPS = ["main", "recruitment", "team", "my-department", "my-division"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/** The small heading over each group; the main group has none. */
export const NAV_GROUP_LABELS: Readonly<Record<NavGroup, string | null>> = {
  main: null,
  recruitment: "Recruitment",
  team: "Team",
  "my-department": "My department",
  "my-division": "My division",
};

/**
 * Where a reached page shows: in a sidebar group, as the user menu's page
 * (board 51b: My account or My profile), or nowhere, reached by its address
 * alone.
 */
export type NavPlace = NavGroup | "user-menu" | "unlisted";

/** A sidebar item that shows only when a fact about the viewer holds. */
export type NavCondition = "has-own-applications";

type PageRow = {
  readonly key: string;
  readonly label: string;
  readonly href: `/dashboard${string}`;
  readonly reach: Readonly<Partial<Record<ViewerKind, NavPlace>>>;
  /** The viewers whose sidebar lists the page only when a fact holds; the rest always see it. */
  readonly shownWhen?: Readonly<Partial<Record<ViewerKind, NavCondition>>>;
};

/** Rows in sidebar order within each group. */
export const DASHBOARD_PAGES = [
  {
    key: "overview",
    label: "Overview",
    href: "/dashboard",
    reach: { "operations-lead": "main", "department-head": "main", "division-lead": "main", member: "main", "non-member": "main" },
    // A non-member who has not applied lands on My applications instead
    // (issue #179), so their sidebar lists Overview only once they have
    // applied (board 50e, issue #211).
    shownWhen: { "non-member": "has-own-applications" },
  },
  {
    key: "my-applications",
    label: "My applications",
    href: "/dashboard/my-applications",
    reach: { "operations-lead": "main", "department-head": "main", "division-lead": "main", member: "main", "non-member": "main" },
    // A non-member always sees it, applied or not (issue #179); the team only once they have applied (issue #183).
    shownWhen: {
      "operations-lead": "has-own-applications",
      "department-head": "has-own-applications",
      "division-lead": "has-own-applications",
      member: "has-own-applications",
    },
  },
  {
    key: "team-tree",
    label: "Team tree",
    href: "/dashboard/team-tree",
    reach: { "operations-lead": "main", "department-head": "main", "division-lead": "main", member: "main" },
  },
  {
    key: "positions",
    label: "Positions",
    href: "/dashboard/positions",
    reach: { "operations-lead": "recruitment", "department-head": "recruitment", "division-lead": "recruitment" },
  },
  {
    key: "applications",
    label: "Applications",
    href: "/dashboard/applications",
    reach: { "operations-lead": "recruitment", "department-head": "recruitment", "division-lead": "recruitment" },
  },
  {
    key: "members",
    label: "Members",
    href: "/dashboard/members",
    reach: { "operations-lead": "team", "division-lead": "my-division" },
  },
  {
    key: "alumni",
    label: "Alumni",
    href: "/dashboard/alumni",
    reach: { "operations-lead": "team" },
  },
  {
    key: "division-access",
    label: "Access",
    href: "/dashboard/access",
    // A department head's Members and Orders pages are #231 and #233; their Access page is here (issue #230).
    reach: { "department-head": "my-department", "division-lead": "my-division" },
  },
  {
    key: "orders",
    label: "Orders",
    href: "/dashboard/orders",
    reach: { "division-lead": "my-division" },
  },
  {
    key: "my-profile",
    label: "My profile",
    href: "/dashboard/profile",
    reach: { "operations-lead": "user-menu", "department-head": "user-menu", "division-lead": "user-menu", member: "user-menu" },
  },
  {
    key: "my-account",
    label: "My account",
    href: "/dashboard/account",
    reach: { "non-member": "user-menu" },
  },
] as const satisfies readonly PageRow[];

export type DashboardPageKey = (typeof DASHBOARD_PAGES)[number]["key"];

/** Unread counts beside sidebar items (the orange "8" on Applications). */
export type NavCounts = Readonly<Partial<Record<DashboardPageKey, number>>>;

/** What the sidebar needs to know about the viewer, read through the dashboard data interface. */
export type SidebarFacts = {
  readonly counts: NavCounts;
  /** The viewer has sent at least one application (My applications shows for the team). */
  readonly hasOwnApplications: boolean;
};

export type NavItem = {
  readonly key: DashboardPageKey;
  readonly label: string;
  readonly href: string;
  readonly count: number | null;
};

export type NavSection = {
  readonly group: NavGroup;
  readonly label: string | null;
  readonly items: readonly NavItem[];
};

/** A page the user menu links to. */
export type MenuPage = {
  readonly key: DashboardPageKey;
  readonly label: string;
  readonly href: string;
};

/** Where `page` shows for `kind`; undefined when the viewer does not reach it. */
function placeOf(page: PageRow, kind: ViewerKind): NavPlace | undefined {
  return page.reach[kind];
}

function shownFor(page: PageRow, kind: ViewerKind, facts: SidebarFacts): boolean {
  switch (page.shownWhen?.[kind]) {
    case undefined:
      return true;
    case "has-own-applications":
      return facts.hasOwnApplications;
  }
}

export function canReach(kind: ViewerKind, key: DashboardPageKey): boolean {
  return DASHBOARD_PAGES.some((page) => page.key === key && placeOf(page, kind) !== undefined);
}

/** The viewer's sidebar: their groups in order, each with the pages listed there for them. */
export function sidebarFor(kind: ViewerKind, facts: SidebarFacts): NavSection[] {
  return NAV_GROUPS.flatMap((group) => {
    const items = DASHBOARD_PAGES.filter((page) => placeOf(page, kind) === group && shownFor(page, kind, facts)).map(
      (page): NavItem => ({ key: page.key, label: page.label, href: page.href, count: facts.counts[page.key] || null }),
    );
    return items.length === 0 ? [] : [{ group, label: NAV_GROUP_LABELS[group], items }];
  });
}

/**
 * Where /dashboard sends the viewer, or null when it shows them their
 * Overview: a non-member who has not applied yet lands on My applications,
 * its empty page (issue #179).
 */
export function dashboardLandingFor(kind: ViewerKind, hasOwnApplications: boolean): "/dashboard/my-applications" | null {
  return kind === "non-member" && !hasOwnApplications ? "/dashboard/my-applications" : null;
}

/** The page that opens the dashboard for a viewer: their Overview, or the page /dashboard sends them to. */
export type DashboardLanding = "/dashboard" | "/dashboard/my-applications";

/**
 * Where someone who just left the team opens the dashboard: as a non-member
 * (issue #201), straight to the page /dashboard would send them to, so the
 * move skips the redirect, which shows an empty page while it runs (issue #227).
 */
export function landingAfterLeaving(hasOwnApplications: boolean): DashboardLanding {
  return dashboardLandingFor("non-member", hasOwnApplications) ?? "/dashboard";
}

/** The page the user menu opens for this viewer: My account for a non-member, My profile for the team. */
export function userMenuPageFor(kind: ViewerKind): MenuPage | null {
  const page = DASHBOARD_PAGES.find((row) => placeOf(row, kind) === "user-menu");
  return page ? { key: page.key, label: page.label, href: page.href } : null;
}

/**
 * The title the phone top bar shows for the page at `pathname` (boards 50m-b,
 * 52m, 56m): the page whose address is the longest match, so a page under
 * /dashboard/applications still reads "Applications". Null off the dashboard.
 */
export function pageTitleFor(pathname: string): string | null {
  const page = DASHBOARD_PAGES.filter(
    (row) => pathname === row.href || pathname.startsWith(`${row.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
  return page?.label ?? null;
}
