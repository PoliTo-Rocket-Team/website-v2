import { openPositionsDetail } from "./open-positions-detail";
import { formatEuro, type Cents } from "./orders";
import { divisionShortName, noPhotoItem, oldestLine, type AttentionItem, type DivisionOverview, type Stat, type UpcomingInterview } from "./overview";
import { GRANT_AREAS, readsArea, type GrantArea, type ViewerStanding } from "./viewer";

// The division Overview (board 56), built area by area (issue #471). A
// division lead reads every area, so their Overview is the whole board. Each
// figure, attention row and panel belongs to one area, and an area the viewer
// does not read adds nothing, whatever was read for it. A granted member keeps
// their own Overview instead, with one "Your access" line per granted area
// (issue #480, ./access-summary.ts).

/** A live position as the division Overview's Positions figure counts it: no figure about its applications. */
export type OverviewPosition = {
  readonly id: number;
  readonly title: string;
  readonly open: boolean;
  readonly divisionName: string;
};

/** A live position where the viewer reads Applications, with its unread applications and when the oldest came in. */
export type UnreadOverviewPosition = OverviewPosition & {
  readonly newApplications: number;
  readonly oldestNew: Date | null;
};

/**
 * What the Overview was read from, one field per area: absent when the
 * viewer does not read that area, so nothing was read for it.
 */
export type DivisionFigures = {
  readonly now: Date;
  /** The viewer's own notices: theirs whatever areas they read. */
  readonly notices: readonly AttentionItem[];
  /** Positions: the live positions in the units they read Positions in, with nothing of their applications (issue #477). */
  readonly positions?: readonly OverviewPosition[];
  /** Applications: the live positions in the units they read Applications in, their unread applications, and the upcoming interviews on them. */
  readonly applications?: { readonly positions: readonly UnreadOverviewPosition[]; readonly interviews: readonly UpcomingInterview[] };
  /** Orders: the orders waiting in the units they read Orders in. */
  readonly orders?: { readonly count: number; readonly total: Cents };
  /** Members: how many people are in their division, its name, and who has no photo. */
  readonly members?: { readonly count: number; readonly divisionName: string; readonly withoutPhoto: readonly string[] };
};

/** The areas the viewer's division Overview shows, in board order: every one for a lead, the granted ones for a member. */
export function overviewAreasOf(viewer: ViewerStanding): GrantArea[] {
  return GRANT_AREAS.filter((area) => readsArea(viewer, area));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The division Overview from the areas the viewer reads: New applications,
 * the new-application rows and the interviews with Applications; Open
 * positions with Positions; Orders with Orders; My division and the no-photo
 * row with Members. A figure read for an area outside `areas` is dropped.
 */
export function divisionOverviewOf(areas: readonly GrantArea[], figures: DivisionFigures): DivisionOverview {
  const applications = areas.includes("applications") ? figures.applications : undefined;
  const positions = areas.includes("positions") ? figures.positions : undefined;
  const orders = areas.includes("orders") ? figures.orders : undefined;
  const members = areas.includes("members") ? figures.members : undefined;

  const stats: Stat[] = [];
  if (applications) {
    const fresh = applications.positions.reduce((sum, p) => sum + p.newApplications, 0);
    stats.push({ label: "New applications", value: String(fresh), detail: "Waiting for a first look" });
  }
  if (positions) {
    const open = positions.filter((p) => p.open);
    stats.push({
      label: "Open positions",
      value: String(open.length),
      detail: openPositionsDetail(open.map((p) => ({ title: p.title, division: p.divisionName }))),
    });
  }
  if (orders) {
    stats.push({
      label: "Orders",
      value: `${orders.count} waiting`,
      detail: `${formatEuro(orders.total)} to be placed`,
      live: orders.count > 0,
    });
  }
  if (members) {
    stats.push({
      label: "My division",
      value: String(members.count),
      detail: `${members.count === 1 ? "person" : "people"} in ${divisionShortName(members.divisionName)}`,
    });
  }

  const noPhoto = members ? noPhotoItem(members.withoutPhoto) : null;
  const attention: AttentionItem[] = [
    ...(applications?.positions ?? []).flatMap((p): AttentionItem[] =>
      p.newApplications > 0 && p.oldestNew !== null
        ? [
            {
              kind: "applications",
              title: `${plural(p.newApplications, "new application", "new applications")} for ${p.title}`,
              detail: oldestLine(p.oldestNew, figures.now),
              action: { label: "Review", href: `/dashboard/applications?position=${p.id}` },
            },
          ]
        : [],
    ),
    ...(noPhoto ? [noPhoto] : []),
    ...figures.notices,
  ];

  return { shape: "division", stats, attention, interviews: applications?.interviews ?? [], activity: [] };
}
