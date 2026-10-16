import type { PersonRecord } from "./division-members";
import type { Order } from "./orders";
import type { AttentionItem, DepartmentSummary, Stat } from "./overview";
import type { OrgChart } from "./team";
import { shortDate } from "./write";

// The team leader's Overview (board 72, issue #252): what both sides of the
// data interface compute the same way. "Needs your attention" holds the
// orders waiting for their decision and the approved orders not ordered yet;
// those rows show counts and items, never a price. The Departments panel
// counts each department's people, heads and what waits there.

const TEAM_TIME_ZONE = "Europe/Rome";
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TEAM_TIME_ZONE });

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** How many items the approved row names before it counts the rest. */
const ITEMS_NAMED = 3;

/** "Pitot tube, Loctite"; past three, "Pitot tube, Loctite, Epoxy and 40 more". */
function itemsLine(items: readonly string[]): string {
  const named = items.slice(0, ITEMS_NAMED).join(", ");
  return items.length > ITEMS_NAMED ? `${named} and ${items.length - ITEMS_NAMED} more` : named;
}

/**
 * "Needs your attention" for the team leader (board 72), in this order: one
 * row for every order waiting for a decision, naming the oldest; one row for
 * every approved order not ordered yet, naming the items. Positions keep no
 * closing day, so no position row joins them. A row with nothing to say is
 * left out.
 */
export function leaderAttention(input: {
  readonly orders: readonly Pick<Order, "status" | "item" | "requestedBy" | "requestedOn">[];
  readonly now: Date;
}): AttentionItem[] {
  const { now } = input;
  const thisYear = Number(isoDay.format(now).slice(0, 4));
  const waiting = input.orders.filter((o) => o.status === "waiting");
  const approved = input.orders.filter((o) => o.status === "approved");
  const items: AttentionItem[] = [];
  const oldest = [...waiting].sort((a, b) => a.requestedOn.localeCompare(b.requestedOn))[0];
  if (oldest !== undefined) {
    items.push({
      kind: "orders-to-decide",
      title: waiting.length === 1 ? "1 order waits for your decision" : `${waiting.length} orders wait for your decision`,
      detail: `Oldest: ${oldest.item}, sent ${shortDate(oldest.requestedOn, thisYear)} by ${oldest.requestedBy}`,
      action: { label: "Review", href: "/dashboard/orders" },
    });
  }
  if (approved.length > 0) {
    items.push({
      kind: "approved-orders",
      title: approved.length === 1 ? "1 approved order is not ordered yet" : `${approved.length} approved orders are not ordered yet`,
      detail: itemsLine(approved.map((o) => o.item)),
      action: { label: "Open", href: "/dashboard/orders" },
    });
  }
  return items;
}

/** The four figures of board 72: new applications, open positions, orders for the team leader's decision, the team. */
export function leaderStats(figures: {
  readonly newApplications: number;
  /** "+12 since Monday", or what the source can say instead. */
  readonly newDetail: string;
  readonly openPositions: number;
  /** Departments with at least one open position. */
  readonly openDepartments: number;
  readonly ordersWaiting: number;
  readonly people: number;
  readonly departments: number;
}): Stat[] {
  return [
    { label: "New applications", value: String(figures.newApplications), detail: figures.newDetail },
    { label: "Open positions", value: String(figures.openPositions), detail: `In ${plural(figures.openDepartments, "department", "departments")}` },
    { label: "Orders", value: `${figures.ordersWaiting} waiting`, detail: "for your decision", live: figures.ordersWaiting > 0 },
    { label: "Team", value: String(figures.people), detail: `people in ${plural(figures.departments, "department", "departments")}` },
  ];
}

/** One position as the Departments panel counts it. */
export type DivisionPositions = {
  readonly divisionId: number;
  readonly open: boolean;
  readonly newApplications: number;
};

/**
 * The Departments panel (board 72): each open department in chart order, its
 * heads, its open divisions, and the people in them or heading it, each
 * counted once, with the new applications and open positions there.
 */
export function departmentSummaries(
  records: readonly Pick<PersonRecord, "name" | "memberships" | "beyondDivisions">[],
  org: OrgChart,
  positions: readonly DivisionPositions[],
): DepartmentSummary[] {
  return org.departments.map((department) => {
    const divisionIds = org.divisions.filter((d) => d.departmentId === department.id).map((d) => d.id);
    const heads = records.filter((r) => r.beyondDivisions.some((b) => b.kind === "head" && b.departmentId === department.id));
    const inside = records.filter((r) => heads.includes(r) || r.memberships.some((m) => divisionIds.includes(m.divisionId)));
    const own = positions.filter((p) => divisionIds.includes(p.divisionId));
    return {
      id: department.id,
      name: department.name,
      heads: heads.map((h) => h.name),
      divisions: divisionIds.length,
      people: inside.length,
      newApplications: own.reduce((sum, p) => sum + p.newApplications, 0),
      openPositions: own.filter((p) => p.open).length,
    };
  });
}
