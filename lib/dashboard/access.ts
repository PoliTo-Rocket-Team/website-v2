import type { ViewerKind } from "./viewer";

// Which viewer reaches which dashboard page, and where the page sits in that
// viewer's sidebar (boards 40, 40m, 41c, 42, 43, 44, 45b, 46). One row per page:
// a new page adds one row. A viewer missing from a row's `reach` does not
// reach the page. Site content, admin Access and the Activity log are not
// designed yet, so they have no row.

export const NAV_GROUPS = ["main", "recruitment", "team", "my-division"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/** The small heading over each group; the main group has none. */
export const NAV_GROUP_LABELS: Readonly<Record<NavGroup, string | null>> = {
  main: null,
  recruitment: "Recruitment",
  team: "Team",
  "my-division": "My division",
};

type PageRow = {
  readonly key: string;
  readonly label: string;
  readonly href: `/dashboard${string}`;
  readonly reach: Readonly<Partial<Record<ViewerKind, NavGroup>>>;
};

/** Rows in sidebar order within each group. */
export const DASHBOARD_PAGES = [
  {
    key: "overview",
    label: "Overview",
    href: "/dashboard",
    reach: { "operations-lead": "main", "division-lead": "main", member: "main", "non-member": "main" },
  },
  {
    key: "my-profile",
    label: "My profile",
    href: "/dashboard/profile",
    reach: { "operations-lead": "main", "division-lead": "main", member: "main" },
  },
  {
    key: "team-tree",
    label: "Team tree",
    href: "/dashboard/team-tree",
    reach: { "division-lead": "main", member: "main" },
  },
  {
    key: "positions",
    label: "Positions",
    href: "/dashboard/positions",
    reach: { "operations-lead": "recruitment", "division-lead": "recruitment" },
  },
  {
    key: "applications",
    label: "Applications",
    href: "/dashboard/applications",
    reach: { "operations-lead": "recruitment", "division-lead": "recruitment" },
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
    key: "orders",
    label: "Orders",
    href: "/dashboard/orders",
    reach: { "division-lead": "my-division" },
  },
  {
    key: "division-access",
    label: "Access",
    href: "/dashboard/access",
    reach: { "division-lead": "my-division" },
  },
  {
    key: "my-applications",
    label: "My applications",
    href: "/dashboard/my-applications",
    reach: { "non-member": "main" },
  },
  {
    key: "my-account",
    label: "My account",
    href: "/dashboard/account",
    reach: { "non-member": "main" },
  },
] as const satisfies readonly PageRow[];

export type DashboardPageKey = (typeof DASHBOARD_PAGES)[number]["key"];

/** Unread counts beside sidebar items (the orange "12" on Applications). */
export type NavCounts = Readonly<Partial<Record<DashboardPageKey, number>>>;

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

export function canReach(kind: ViewerKind, key: DashboardPageKey): boolean {
  const row: PageRow = DASHBOARD_PAGES.find((page) => page.key === key)!;
  return row.reach[kind] !== undefined;
}

/** The viewer's sidebar: their groups in order, each with the pages they reach. */
export function sidebarFor(kind: ViewerKind, counts: NavCounts = {}): NavSection[] {
  return NAV_GROUPS.flatMap((group) => {
    const items = DASHBOARD_PAGES.filter((page: PageRow) => page.reach[kind] === group).map(
      (page): NavItem => ({
        key: page.key,
        label: page.label,
        href: page.href,
        count: counts[page.key] || null,
      }),
    );
    return items.length === 0 ? [] : [{ group, label: NAV_GROUP_LABELS[group], items }];
  });
}
