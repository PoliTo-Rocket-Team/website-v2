import { DASHBOARD_PAGES } from "./access";
import { formatEuro, type Cents } from "./orders";
import { GRANT_AREAS, type GrantArea } from "./viewer";

// "Your access" on the Overview (issues #480, #593): one line per area the
// viewer holds a grant on, whatever their seat, at the grant's own scope,
// with a link to that area's page. The line carries counts only: names and
// details (applicants, interview times, people without a photo, single
// orders) stay on the area's own page and the board's figures, and no
// summary can hold one. A Content grant (issue #504) adds a last line naming
// the editors it opens, linked to the first of them. "Approve orders" (issue
// #592) adds a line before it counting the orders in the team waiting for a
// decision. A grant with no figure card on the board shows here all the same.

/** The areas a "Your access" line is about: the grant areas, Approve orders, and Content. */
export type SummaryArea = GrantArea | "approve-orders" | "content";

/** One granted area's counts and the page that shows them. */
export type AccessSummary =
  | { readonly area: "positions"; readonly href: "/dashboard/positions"; readonly open: number; readonly divisions: number }
  | { readonly area: "applications"; readonly href: "/dashboard/applications"; readonly fresh: number; readonly booked: number }
  | { readonly area: "members"; readonly href: "/dashboard/members"; readonly people: number; readonly divisions: number }
  | { readonly area: "orders"; readonly href: "/dashboard/orders"; readonly waiting: number; readonly total: Cents }
  | { readonly area: "approve-orders"; readonly href: "/dashboard/orders"; readonly waiting: number }
  | { readonly area: "content"; readonly href: string; readonly pages: readonly string[] };

/**
 * What the Overview shows under the personal panels (issue #593): the "Your
 * access" lines when the viewer holds a grant, and nothing when they hold
 * none. A member with no grant is not told to ask for access (issue #790).
 */
export type AccessSection =
  | { readonly kind: "lines"; readonly lines: readonly [AccessSummary, ...AccessSummary[]] }
  | { readonly kind: "none" };

export function accessSectionOf(lines: readonly AccessSummary[]): AccessSection {
  const [first, ...rest] = lines;
  return first === undefined ? { kind: "none" } : { kind: "lines", lines: [first, ...rest] };
}

/** The Content line: the editors a Content grant opens, in sidebar order (`siteContent` rows, ./access.ts). */
function contentSummary(): AccessSummary {
  const pages = DASHBOARD_PAGES.filter((page) => "siteContent" in page && page.siteContent === true);
  return { area: "content", href: pages[0]?.href ?? "/dashboard", pages: pages.map((page) => page.label) };
}

/**
 * What the summaries are counted from, one field per area: absent when the
 * viewer does not read that area, so nothing was read for it. Each field
 * takes only what its count needs, so a reader may hand over richer rows.
 */
export type AccessFigures = {
  /** The live positions in the units they read Positions in. */
  readonly positions?: readonly { readonly open: boolean; readonly divisionId: number }[];
  /** The live positions in the units they read Applications in, with their unread counts, and the upcoming interviews on them. */
  readonly applications?: {
    readonly positions: readonly { readonly newApplications: number }[];
    readonly interviews: readonly { readonly state: "booked" | "waiting" }[];
  };
  /** The orders waiting in the units they read Orders in. */
  readonly orders?: { readonly count: number; readonly total: Cents };
  /** The people in the divisions they read Members in, each once, and how many divisions that is. */
  readonly members?: { readonly people: number; readonly divisions: number };
  /** The orders in the team waiting for a decision, read only when the viewer holds "Approve orders". */
  readonly approveOrders?: { readonly waiting: number };
};

/**
 * The "Your access" lines, in `GRANT_AREAS` order: one per granted area in
 * `areas` that was read, then Approve orders when its figure was read, then
 * Content when the viewer holds it. A figure read for an area outside `areas`
 * adds nothing.
 */
export function accessSummariesOf(areas: readonly GrantArea[], figures: AccessFigures, content = false): AccessSummary[] {
  return [
    ...grantSummariesOf(areas, figures),
    ...(figures.approveOrders ? [{ area: "approve-orders", href: "/dashboard/orders", waiting: figures.approveOrders.waiting } as const] : []),
    ...(content ? [contentSummary()] : []),
  ];
}

function grantSummariesOf(areas: readonly GrantArea[], figures: AccessFigures): AccessSummary[] {
  return GRANT_AREAS.flatMap((area): AccessSummary[] => {
    if (!areas.includes(area)) return [];
    switch (area) {
      case "positions": {
        if (!figures.positions) return [];
        const open = figures.positions.filter((p) => p.open);
        return [{ area, href: "/dashboard/positions", open: open.length, divisions: new Set(open.map((p) => p.divisionId)).size }];
      }
      case "applications": {
        if (!figures.applications) return [];
        const { positions, interviews } = figures.applications;
        return [
          {
            area,
            href: "/dashboard/applications",
            fresh: positions.reduce((sum, p) => sum + p.newApplications, 0),
            booked: interviews.filter((i) => i.state === "booked").length,
          },
        ];
      }
      case "members":
        return figures.members ? [{ area, href: "/dashboard/members", people: figures.members.people, divisions: figures.members.divisions }] : [];
      case "orders":
        return figures.orders ? [{ area, href: "/dashboard/orders", waiting: figures.orders.count, total: figures.orders.total }] : [];
    }
  });
}

export const ACCESS_AREA_LABELS: Readonly<Record<SummaryArea, string>> = {
  positions: "Positions",
  applications: "Applications",
  members: "Members",
  orders: "Orders",
  "approve-orders": "Approve orders",
  content: "Content",
};

/** "Projects, Outreach, Partners, FAQ and Team page". */
function listed(names: readonly string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What the line says after the area's name: "8 new · 2 interviews booked". */
export function accessCounts(summary: AccessSummary): string {
  switch (summary.area) {
    case "positions":
      return summary.open === 0 ? "0 open" : `${summary.open} open in ${plural(summary.divisions, "division", "divisions")}`;
    case "applications":
      return `${summary.fresh} new · ${plural(summary.booked, "interview booked", "interviews booked")}`;
    case "members": {
      const people = plural(summary.people, "person", "people");
      return summary.divisions > 1 ? `${people} in ${summary.divisions} divisions` : people;
    }
    case "orders":
      return `${summary.waiting} waiting · ${formatEuro(summary.total)} to be placed`;
    case "approve-orders":
      return `${summary.waiting} waiting for your decision`;
    case "content":
      return `Edit ${listed(summary.pages)}`;
  }
}

/** The whole line: "Applications · 8 new · 2 interviews booked". */
export function accessLine(summary: AccessSummary): string {
  return `${ACCESS_AREA_LABELS[summary.area]} · ${accessCounts(summary)}`;
}
