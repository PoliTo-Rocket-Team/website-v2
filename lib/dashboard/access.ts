import { seatOf, type FullAccessSeat, type ViewerKind, type ViewerStanding } from "./viewer";

// Which viewer reaches which dashboard page, and where the page sits for that
// viewer (Dashboard v2 boards 51b, 52 and 56; the operations lead keeps boards
// 40 to 46). One row per page: a new page adds one row. A viewer whose kind is
// missing from a row's `reach` does not reach the page, unless the row names an
// `areaGrant` place and they are a member holding an area grant (issue #160),
// a `siteContent` place and they hold site-content access, or an
// `approveOrders` place and they hold "Approve orders". A row that names a
// `seat` is reached by that full-access seat alone (issue #238). The
// `operations-lead` kind is full access: the team leader, the operations lead
// and the IT lead, or an admin or org scope row (./viewer.ts), so it reaches
// every page of the team. A row's `seatPlace` moves a page to another group
// for one full-access seat: the team leader's sidebar has a Content group
// (board 72, issue #252), where Alumni sits, and each content page adds its
// own row there.

export const NAV_GROUPS = ["main", "recruitment", "team", "content", "my-department", "my-division"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/** The small heading over each group; the main group has none. */
export const NAV_GROUP_LABELS: Readonly<Record<NavGroup, string | null>> = {
  main: null,
  recruitment: "Recruitment",
  team: "Team",
  content: "Content",
  "my-department": "My department",
  "my-division": "My division",
};

/**
 * Where a reached page shows: in a sidebar group, as the user menu's page
 * (board 51b: My account or My profile), or nowhere, reached by its address
 * alone.
 */
export type NavPlace = NavGroup | "user-menu" | "unlisted";

/**
 * A sidebar item that shows only when a fact about the viewer holds: today,
 * that at least one of their applications is shown (`isShownAt`,
 * ./my-applications.ts, issue #317).
 */
export type NavCondition = "has-shown-applications";

type PageRow = {
  readonly key: string;
  readonly label: string;
  readonly href: `/dashboard${string}`;
  readonly reach: Readonly<Partial<Record<ViewerKind, NavPlace>>>;
  /** Where the page shows for a member who holds an area grant (issue #160): where it shows for a division lead. */
  readonly areaGrant?: NavPlace;
  /** Where the page shows for a viewer whose kind does not reach it but who holds site-content access. */
  readonly siteContent?: NavPlace;
  /** Where the page shows for a viewer whose kind does not reach it but who holds "Approve orders". */
  readonly approveOrders?: NavPlace;
  /** The viewers whose sidebar lists the page only when a fact holds; the rest always see it. */
  readonly shownWhen?: Readonly<Partial<Record<ViewerKind, NavCondition>>>;
  /** The one full-access seat that reaches the page; every other viewer, full access or not, does not. */
  readonly seat?: FullAccessSeat;
  /** Where the page shows for a full-access seat whose sidebar places it apart from the rest of full access. */
  readonly seatPlace?: Readonly<Partial<Record<FullAccessSeat, NavPlace>>>;
};

/** Rows in sidebar order within each group. */
export const DASHBOARD_PAGES = [
  {
    key: "overview",
    label: "Overview",
    href: "/dashboard",
    // Every viewer lands here, a non-member with nothing shown too (board
    // 50f, issue #317).
    reach: {
      "operations-lead": "main",
      "department-head": "main",
      "division-lead": "main",
      member: "main",
      alumni: "main",
      "non-member": "main",
    },
  },
  {
    key: "my-alumni",
    label: "My alumni",
    href: "/dashboard/my-alumni",
    // Board 56b (issue #317): how an alumnus shows on the Alumni page.
    reach: { alumni: "main" },
  },
  {
    key: "my-applications",
    label: "My applications",
    href: "/dashboard/my-applications",
    reach: {
      "operations-lead": "main",
      "department-head": "main",
      "division-lead": "main",
      member: "main",
      alumni: "main",
      "non-member": "main",
    },
    // Listed only while one of their applications is shown, for everyone
    // (issue #317; the team since issue #183).
    shownWhen: {
      "operations-lead": "has-shown-applications",
      "department-head": "has-shown-applications",
      "division-lead": "has-shown-applications",
      member: "has-shown-applications",
      alumni: "has-shown-applications",
      "non-member": "has-shown-applications",
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
    areaGrant: "recruitment",
  },
  {
    key: "applications",
    label: "Applications",
    href: "/dashboard/applications",
    reach: { "operations-lead": "recruitment", "department-head": "recruitment", "division-lead": "recruitment" },
    areaGrant: "recruitment",
  },
  {
    key: "members",
    label: "Members",
    href: "/dashboard/members",
    // A department head's Members page holds every division of the department (issue #235).
    reach: { "operations-lead": "team", "department-head": "my-department", "division-lead": "my-division" },
    areaGrant: "my-division",
  },
  {
    key: "projects",
    label: "Projects",
    href: "/dashboard/projects",
    // Board 75 (issue #297): the site-content rule Outreach, Partners, Alumni
    // and FAQ follow (maySiteContent, lib/content/gate.ts), placed first in
    // the Content group as board 75 lists it.
    reach: { "operations-lead": "team" },
    siteContent: "team",
    seatPlace: { "team-leader": "content" },
  },
  {
    key: "outreach",
    label: "Outreach",
    href: "/dashboard/outreach",
    // Board 74 (issue #289): the site-content rule Partners, Alumni and FAQ
    // follow (maySiteContent, lib/content/gate.ts), placed ahead of Partners
    // as board 74 lists the Content group.
    reach: { "operations-lead": "team" },
    siteContent: "team",
    seatPlace: { "team-leader": "content" },
  },
  {
    key: "partners",
    label: "Partners",
    href: "/dashboard/partners",
    // Boards 76 and 76b (issue #256): the Alumni rule (maySiteContent,
    // lib/content/gate.ts), placed as Alumni is: under Content for the team
    // leader, ahead of Alumni as board 76 lists them.
    reach: { "operations-lead": "team" },
    siteContent: "team",
    seatPlace: { "team-leader": "content" },
  },
  {
    key: "alumni",
    label: "Alumni",
    href: "/dashboard/alumni",
    // Owner decision on #234: full access (the team leader, the operations
    // lead and the IT lead, issue #238) and anyone given site-content access.
    // A division lead or department head gets nothing from their role here.
    reach: { "operations-lead": "team" },
    siteContent: "team",
    // The team leader's sidebar groups it under Content (board 72, issue #252).
    seatPlace: { "team-leader": "content" },
  },
  {
    key: "faq",
    label: "FAQ",
    href: "/dashboard/faq",
    // Boards 79 and 79b (issue #258): the site-content rule Partners and
    // Alumni follow (maySiteContent, lib/content/gate.ts), placed after
    // Alumni, under Content for the team leader, as board 79 lists them.
    reach: { "operations-lead": "team" },
    siteContent: "team",
    seatPlace: { "team-leader": "content" },
  },
  {
    key: "team-page",
    label: "Team page",
    href: "/dashboard/team-page",
    // The Team page editor (boards 80 to 80h, issues #283 and #284): the
    // site-content rule Partners, Alumni and FAQ follow (maySiteContent,
    // lib/content/gate.ts), placed after FAQ, under Content for the team
    // leader.
    reach: { "operations-lead": "team" },
    siteContent: "team",
    seatPlace: { "team-leader": "content" },
  },
  {
    key: "division-access",
    label: "Access",
    href: "/dashboard/access",
    // A department head's Access page is here (issue #230); full access gives
    // access across the whole team (issue #238).
    reach: { "operations-lead": "team", "department-head": "my-department", "division-lead": "my-division" },
    areaGrant: "my-division",
  },
  {
    key: "orders",
    label: "Orders",
    href: "/dashboard/orders",
    // Every order in the team, for anyone with Orders access (issue #233).
    reach: { "operations-lead": "team", "department-head": "my-department", "division-lead": "my-division" },
    areaGrant: "my-division",
    // "Approve orders" is a grant across the whole team, so the page sits
    // under Team, as it does for full access (issue #270).
    approveOrders: "team",
  },
  {
    key: "activity-log",
    label: "Activity log",
    href: "/dashboard/activity-log",
    // Owner decision on #238: the IT lead alone, not the rest of full access.
    // The page is not built yet, so the sidebar does not list it.
    reach: { "operations-lead": "unlisted" },
    seat: "it-lead",
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
    // Someone off the team keeps their account and its details (issues #201, #317).
    reach: { alumni: "user-menu", "non-member": "user-menu" },
  },
] as const satisfies readonly PageRow[];

export type DashboardPageKey = (typeof DASHBOARD_PAGES)[number]["key"];

/** Unread counts beside sidebar items (the orange "8" on Applications). */
export type NavCounts = Readonly<Partial<Record<DashboardPageKey, number>>>;

/** What the sidebar needs to know about the viewer, read through the dashboard data interface. */
export type SidebarFacts = {
  readonly counts: NavCounts;
  /** At least one of the viewer's applications is shown (`isShownAt`, ./my-applications.ts). */
  readonly hasShownApplications: boolean;
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

/** Where `page` shows for `viewer`; undefined when the viewer does not reach it. */
function placeOf(page: PageRow, viewer: ViewerStanding): NavPlace | undefined {
  const seat = seatOf(viewer);
  if (page.seat !== undefined && seat !== page.seat) return undefined;
  const reached = page.reach[viewer.kind];
  if (reached === undefined) {
    return (
      (viewer.kind === "member" && viewer.areaGrant ? page.areaGrant : undefined) ??
      (viewer.siteContent ? page.siteContent : undefined) ??
      (viewer.approveOrders ? page.approveOrders : undefined)
    );
  }
  return (seat === null ? undefined : page.seatPlace?.[seat]) ?? reached;
}

function shownFor(page: PageRow, kind: ViewerKind, facts: SidebarFacts): boolean {
  switch (page.shownWhen?.[kind]) {
    case undefined:
      return true;
    case "has-shown-applications":
      return facts.hasShownApplications;
  }
}

/** Whether `viewer` reaches the page: the one rule its sidebar item and the page itself both read. */
export function canReach(viewer: ViewerStanding, key: DashboardPageKey): boolean {
  return DASHBOARD_PAGES.some((page) => page.key === key && placeOf(page, viewer) !== undefined);
}

/** The viewer's sidebar: their groups in order, each with the pages listed there for them. */
export function sidebarFor(viewer: ViewerStanding, facts: SidebarFacts): NavSection[] {
  return NAV_GROUPS.flatMap((group) => {
    const items = DASHBOARD_PAGES.filter(
      (page) => placeOf(page, viewer) === group && shownFor(page, viewer.kind, facts),
    ).map(
      (page): NavItem => ({ key: page.key, label: page.label, href: page.href, count: facts.counts[page.key] || null }),
    );
    return items.length === 0 ? [] : [{ group, label: NAV_GROUP_LABELS[group], items }];
  });
}

/**
 * The page that opens the dashboard: every viewer lands on their Overview,
 * a non-member with nothing shown too (board 50f, issue #317). Before that a
 * non-member who had not applied landed on My applications (issue #179).
 */
export type DashboardLanding = "/dashboard";

/**
 * Where someone who just left the team opens the dashboard: their Overview,
 * as every viewer (issue #317), with no redirect on the way (issue #227).
 */
export const LANDING_AFTER_LEAVING: DashboardLanding = "/dashboard";

/** The page the user menu opens for this viewer: My account off the team, My profile on it. */
export function userMenuPageFor(kind: ViewerKind): MenuPage | null {
  const page = DASHBOARD_PAGES.find((row: PageRow) => row.reach[kind] === "user-menu");
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
