import { isBreakGlass, seatOf, type FullAccessSeat, type GrantArea, type ViewerKind, type ViewerStanding } from "./viewer";

// Which viewer reaches which dashboard page, and where the page sits (Dashboard
// v2 boards 51b, 52, 56 and 72). One row per page: a new page adds one row. A
// viewer whose kind is missing from a row's `reach` does not reach the page,
// unless the row names a `grantArea` and they are a member granted that area
// (issues #160, #471), `siteContent` and they hold a Content grant (issues
// #504, #589), or `approveOrders` and they hold "Approve orders". A row that names a `seat` is
// reached by that full-access seat alone (issue #238), and also by the
// break-glass standing when the row says so (issue #727). The `operations-lead`
// kind is full access: the team leader, the operations lead and the IT lead,
// or an admin or org scope row (./viewer.ts), so it reaches every page of the
// team.
//
// Owner decision (issue #408): the sidebar has one structure for every role,
// the same groups in the same order under the same names. A row therefore
// carries one `place`, the same for every viewer who reaches the page; a role
// only hides the pages it does not reach.

export const NAV_GROUPS = ["main", "recruitment", "team", "content"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/** The small heading over each group; the main group has none. */
export const NAV_GROUP_LABELS: Readonly<Record<NavGroup, string | null>> = {
  main: null,
  recruitment: "Recruitment",
  team: "Team",
  content: "Content",
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
  /** Where the page shows, the same for every viewer who reaches it (issue #408). */
  readonly place: NavPlace;
  /** The viewer kinds whose role reaches the page. */
  readonly reach: readonly ViewerKind[];
  /** The area whose grant lets a member reach the page, that area's alone (issues #160, #471). */
  readonly grantArea?: GrantArea;
  /** A viewer whose kind does not reach the page reaches it with a Content grant (issue #504). */
  readonly siteContent?: true;
  /** A viewer whose kind does not reach the page reaches it with "Approve orders". */
  readonly approveOrders?: true;
  /** The viewers whose sidebar lists the page only when a fact holds; the rest always see it. */
  readonly shownWhen?: Readonly<Partial<Record<ViewerKind, NavCondition>>>;
  /** The one full-access seat that reaches the page; every other viewer, full access or not, does not. */
  readonly seat?: FullAccessSeat;
  /** Beside `seat`, the break-glass standing reaches the page too; no other seat does (issue #727). */
  readonly breakGlass?: true;
};

/** Rows in sidebar order within each group. */
export const DASHBOARD_PAGES = [
  {
    key: "overview",
    label: "Overview",
    href: "/dashboard",
    // Every viewer lands here, a non-member with nothing shown too (board
    // 50f, issue #317).
    place: "main",
    reach: ["operations-lead", "department-head", "division-lead", "member", "alumni", "non-member"],
  },
  {
    key: "my-alumni",
    label: "My alumni",
    href: "/dashboard/my-alumni",
    // Board 56b (issue #317): how an alumnus shows on the Alumni page.
    place: "main",
    reach: ["alumni"],
  },
  {
    key: "my-applications",
    label: "My applications",
    href: "/dashboard/my-applications",
    place: "main",
    reach: ["operations-lead", "department-head", "division-lead", "member", "alumni", "non-member"],
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
    place: "main",
    reach: ["operations-lead", "department-head", "division-lead", "member"],
  },
  {
    key: "positions",
    label: "Positions",
    href: "/dashboard/positions",
    place: "recruitment",
    reach: ["operations-lead", "department-head", "division-lead"],
    grantArea: "positions",
  },
  {
    key: "applications",
    label: "Applications",
    href: "/dashboard/applications",
    place: "recruitment",
    reach: ["operations-lead", "department-head", "division-lead"],
    grantArea: "applications",
  },
  {
    key: "members",
    label: "Members",
    href: "/dashboard/members",
    // A department head's Members page holds every division of the department (issue #235).
    place: "team",
    reach: ["operations-lead", "department-head", "division-lead"],
    grantArea: "members",
  },
  {
    key: "projects",
    label: "Projects",
    href: "/dashboard/projects",
    // Board 75 (issue #297): the site-content rule Outreach, Partners, FAQ
    // and the Team page follow (maySiteContent, lib/content/gate.ts), placed first in
    // the Content group as board 75 lists it.
    place: "content",
    reach: ["operations-lead"],
    siteContent: true,
  },
  {
    key: "outreach",
    label: "Outreach",
    href: "/dashboard/outreach",
    // Board 74 (issue #289): the site-content rule Partners and FAQ
    // follow (maySiteContent, lib/content/gate.ts), placed ahead of Partners
    // as board 74 lists the Content group.
    place: "content",
    reach: ["operations-lead"],
    siteContent: true,
  },
  {
    key: "partners",
    label: "Partners",
    href: "/dashboard/partners",
    // Boards 76 and 76b (issue #256): the site-content rule (maySiteContent,
    // lib/content/gate.ts, a Content grant since issue #504), placed under
    // Content, ahead of Alumni as board 76 lists them.
    place: "content",
    reach: ["operations-lead"],
    siteContent: true,
  },
  {
    key: "alumni",
    label: "Alumni",
    href: "/dashboard/alumni",
    // The site-content rule (maySiteContent, lib/content/gate.ts): full
    // access and a Content grant (Owner decision, 2026-10-22, issue #589,
    // which replaced the separate Alumni grant of #504). A division lead or
    // department head gets nothing from their role here. It sits under
    // Content (board 72, issue #252).
    place: "content",
    reach: ["operations-lead"],
    siteContent: true,
  },
  {
    key: "faq",
    label: "FAQ",
    href: "/dashboard/faq",
    // Boards 79 and 79b (issue #258): the site-content rule Partners follows
    // (maySiteContent, lib/content/gate.ts), placed after Alumni, under
    // Content, as board 79 lists them.
    place: "content",
    reach: ["operations-lead"],
    siteContent: true,
  },
  {
    key: "team-page",
    label: "Team page",
    href: "/dashboard/team-page",
    // The Team page editor (boards 80 to 80h, issues #283 and #284): the
    // site-content rule Partners and FAQ follow (maySiteContent,
    // lib/content/gate.ts), placed after FAQ, under Content.
    place: "content",
    reach: ["operations-lead"],
    siteContent: true,
  },
  {
    key: "division-access",
    label: "Access",
    href: "/dashboard/access",
    // A department head's Access page is here (issue #230); full access gives
    // access across the whole team (issue #238). It is no grant area
    // (docs/dashboard-rules.md, "Access"), so no grant opens it (issue #471).
    place: "team",
    reach: ["operations-lead", "department-head", "division-lead"],
  },
  {
    key: "orders",
    label: "Orders",
    href: "/dashboard/orders",
    // Every order in the team, for anyone with Orders access (issue #233).
    place: "team",
    reach: ["operations-lead", "department-head", "division-lead"],
    grantArea: "orders",
    // "Approve orders" is a grant across the whole team (issue #270).
    approveOrders: true,
  },
  {
    key: "activity-log",
    label: "Activity log",
    href: "/dashboard/activity-log",
    // Owner decision on #238: the IT lead alone, not the rest of full access.
    // Owner decision on #727: the break-glass standing too, never a real
    // team leader. The page is not built yet, so the sidebar does not list it.
    place: "unlisted",
    reach: ["operations-lead"],
    seat: "it-lead",
    breakGlass: true,
  },
  {
    key: "my-profile",
    label: "My profile",
    href: "/dashboard/profile",
    place: "user-menu",
    reach: ["operations-lead", "department-head", "division-lead", "member"],
  },
  {
    key: "my-account",
    label: "My account",
    href: "/dashboard/account",
    // Someone off the team keeps their account and its details (issues #201, #317).
    place: "user-menu",
    reach: ["alumni", "non-member"],
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

/** Whether `viewer` reaches `page`, by their role or by a grant the row admits. */
function reaches(page: PageRow, viewer: ViewerStanding): boolean {
  if (page.seat !== undefined && seatOf(viewer) !== page.seat && !(page.breakGlass === true && isBreakGlass(viewer))) return false;
  return (
    page.reach.includes(viewer.kind) ||
    (viewer.kind === "member" && page.grantArea !== undefined && viewer.grantedAreas.includes(page.grantArea)) ||
    (viewer.siteContent && page.siteContent === true) ||
    (viewer.approveOrders && page.approveOrders === true)
  );
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
  return DASHBOARD_PAGES.some((page) => page.key === key && reaches(page, viewer));
}

/**
 * The viewer's sidebar: the one structure every role shares (issue #408), with
 * only the pages the viewer reaches and an empty group left out.
 */
export function sidebarFor(viewer: ViewerStanding, facts: SidebarFacts): NavSection[] {
  return NAV_GROUPS.flatMap((group) => {
    const items = DASHBOARD_PAGES.filter(
      (page: PageRow) => page.place === group && reaches(page, viewer) && shownFor(page, viewer.kind, facts),
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
  const page = DASHBOARD_PAGES.find((row: PageRow) => row.place === "user-menu" && row.reach.includes(kind));
  return page ? { key: page.key, label: page.label, href: page.href } : null;
}

/**
 * The page this viewer's user menu links to: their kind's page, except My
 * profile for an account with no profile of its own (`hasOwnProfile`, issue
 * #725), whose My profile page answers not-found.
 */
export function userMenuPageOf(viewer: { readonly kind: ViewerKind; readonly hasOwnProfile: boolean }): MenuPage | null {
  const page = userMenuPageFor(viewer.kind);
  return page?.key === "my-profile" && !viewer.hasOwnProfile ? null : page;
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
