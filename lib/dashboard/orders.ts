import { z } from "zod";
import { PAGE_SIZE } from "./team";
import type { ScopeKind } from "./viewer";

// The Orders page (Dashboard v2 boards 61 to 61d, issue #172; boards 61m, 67,
// 67b and 67m, issue #233): every purchase request in the team, what state
// each is in, and what the viewer may still do with it. Money is whole euro
// cents everywhere, so totals never pick up float error.

/**
 * The states a request shows: waiting for the team leader, their answer, and
 * Ordered once an approved request was placed with the shop (board 70c, issue
 * #247). Ordered follows Approved and nothing else.
 */
export const ORDER_STATUSES = ["waiting", "approved", "ordered", "changes-requested", "rejected"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  waiting: "Waiting",
  approved: "Approved",
  ordered: "Ordered",
  "changes-requested": "Changes requested",
  rejected: "Rejected",
};

/**
 * A cancelled request is stored, so the record keeps it, but it is no longer
 * a request: it leaves the page. Only the data sources see this state.
 */
export type StoredOrderStatus = OrderStatus | "cancelled";

/** Euro cents. */
export type Cents = number;

/** What the team leader wrote when they sent a request back (board 61d). */
export type ChangeRequest = {
  readonly reason: string;
  /** The team leader who sent it back: "Alessandro Greco". */
  readonly by: string;
  /** ISO date. */
  readonly on: string;
};

/** Who approved or rejected a request, and when (boards 70c and 70e). */
export type Answer = {
  /** Their name: "Alessandro Greco". */
  readonly by: string;
  /** Whether the viewer gave the answer: the note then reads "Approved by you". */
  readonly byYou: boolean;
  /** ISO date. */
  readonly on: string;
};

/**
 * Where a request stands. An approved or ordered request carries who approved
 * it; a rejected one who rejected it and the reason, when they gave one; a
 * request sent back carries what to change.
 */
export type OrderState =
  | { readonly status: "waiting" }
  | { readonly status: "approved" | "ordered"; readonly answer: Answer }
  | { readonly status: "rejected"; readonly answer: Answer; readonly reason: string | null }
  | { readonly status: "changes-requested"; readonly changes: ChangeRequest };

export type OrderQuote = {
  readonly name: string;
  /** Bytes, when the source knows them. */
  readonly size: number | null;
  /** Where the file opens; null where there is no route to it. */
  readonly href: string | null;
};

/** A division as an order names it. */
export type OrderDivision = {
  readonly id: number;
  /** "Mission Analysis Division" */
  readonly name: string;
};

/** A department as an order names it. */
export type OrderDepartment = {
  readonly id: number;
  /** "Aerodynamics" */
  readonly name: string;
};

/**
 * Where an order belongs (issue #233): the division it was made for, stored
 * on the order, and that division's department; null for a division in no
 * department.
 */
export type OrderUnit = {
  readonly division: OrderDivision;
  readonly department: OrderDepartment | null;
};

export type Order = OrderState & {
  readonly id: number;
  readonly item: string;
  /** Why it is needed: "For the launch rail". */
  readonly reason: string | null;
  readonly link: string | null;
  readonly requestedBy: string;
  /** Where it belongs; null for an old order the migration found no division for. */
  readonly unit: OrderUnit | null;
  readonly unitPrice: Cents;
  readonly quantity: number;
  /** Shipping on top of the items, when the order carries one. */
  readonly shipping: Cents | null;
  /** ISO date the request was sent. */
  readonly requestedOn: string;
  readonly quote: OrderQuote | null;
};

/** A unit the viewer edits orders in: one division, a whole department, or, with full access (issue #238), the whole team. */
export type EditUnit =
  | { readonly kind: "division"; readonly division: OrderDivision }
  | { readonly kind: "department"; readonly department: OrderDepartment }
  | { readonly kind: "team" };

/** Full access edits every order in the team (issue #238). */
export const WHOLE_TEAM: EditUnit = { kind: "team" };

/**
 * Why a viewer may approve, reject or ask for changes: they are the team
 * leader, or the team leader gave them "Approve orders". Anyone else may not.
 */
export type DecideRight = "team-leader" | "approve-orders";

/**
 * What the viewer may do on Orders (issue #233). Anyone with any Orders
 * access sees every order in the team; they edit only orders in `edits`: a
 * lead the divisions they hold Orders at Can edit in, a head their whole
 * department, full access the whole team. Deciding is apart from editing: `decides` is null for everyone
 * but the team leader and the people they gave "Approve orders".
 */
export type OrdersScope = {
  readonly edits: readonly EditUnit[];
  readonly decides: DecideRight | null;
};

/** The right a viewer decides orders with, from who they are and what they hold. */
export function decideRightOf(viewer: { readonly teamLeader: boolean; readonly approveOrders: boolean }): DecideRight | null {
  if (viewer.teamLeader) return "team-leader";
  return viewer.approveOrders ? "approve-orders" : null;
}

/** An open department with its open divisions, for the Department filter (board 67b) and New order. */
export type OrgDepartmentUnits = OrderDepartment & { readonly divisions: readonly OrderDivision[] };

/**
 * The open departments in the team's order, each with its open divisions by
 * name: the order board 67b lists them in, and the Team tree draws them in
 * (departments by id). Both data sources build the Department filter here.
 */
export function orgUnitsOf(
  departments: readonly OrderDepartment[],
  divisions: readonly (OrderDivision & { readonly departmentId: number | null })[],
): OrgDepartmentUnits[] {
  return [...departments]
    .sort((a, b) => a.id - b.id)
    .map((d) => ({
      id: d.id,
      name: d.name,
      divisions: divisions
        .filter((v) => v.departmentId === d.id)
        .map((v) => ({ id: v.id, name: v.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** The Orders page (boards 61 to 61d, 61m, 67, 67b, 67m): every order in the team, and what the viewer may do. */
export type OrdersPage = {
  readonly scope: OrdersScope;
  /** Every open department in the team's order (`orgUnitsOf`), and its open divisions by name. */
  readonly departments: readonly OrgDepartmentUnits[];
  readonly orders: readonly Order[];
};

/**
 * A viewer's Orders page (Owner decision on #233): with any Orders access,
 * however narrow, every order in the team; with none, no page. Both data
 * sources build the page here, so neither can narrow what a viewer sees.
 */
export function ordersPageFor(
  scope: OrdersScope | null,
  departments: readonly OrgDepartmentUnits[],
  orders: readonly Order[],
): OrdersPage | null {
  return scope === null ? null : { scope, departments, orders };
}

/** One of the viewer's scope rows, as their Orders scope reads it. */
export type OrdersScopeRow = {
  readonly scope: ScopeKind;
  readonly target: string;
  readonly level: "view" | "edit";
  readonly divisionId: number | null;
  readonly deptId: number | null;
};

/** What a team member's Orders scope reads beside their scope rows. */
export type OrdersViewer = {
  /** Full access, the `operations-lead` kind (issue #238). */
  readonly fullAccess: boolean;
  readonly teamLeader: boolean;
  /** The department a head's role holds at Can edit (board 65); null for anyone else. */
  readonly headDepartment: OrderDepartment | null;
};

/**
 * A team member's Orders scope (issue #233), or null when they hold no
 * Orders access anywhere. Full access edits every order in the team (issue
 * #238). A `division` or `department` row on `orders` (or on `all`) is access
 * there, at its level; a head's role is Can edit across their department
 * (board 65), and a `team` row on `orders` is access across the whole team
 * (issue #247). Deciding comes from being the team leader, or from the `team`
 * row on `approve_orders`, which is Orders access on its own (issue #270): it
 * opens the page with no edits. Full access alone does not decide.
 */
export function ordersScopeOf(
  viewer: OrdersViewer,
  rows: readonly OrdersScopeRow[],
  org: readonly OrgDepartmentUnits[],
): OrdersScope | null {
  const ordersRows = rows.filter((r) => (r.scope === "division" || r.scope === "department") && (r.target === "orders" || r.target === "all"));
  const teamOrders = rows.filter((r) => r.scope === "team" && r.target === "orders");
  const decides = decideRightOf({
    teamLeader: viewer.teamLeader,
    approveOrders: rows.some((r) => r.scope === "team" && r.target === "approve_orders"),
  });
  if (viewer.fullAccess || teamOrders.some((r) => r.level === "edit")) return { edits: [WHOLE_TEAM], decides };

  type UnitEdit = Exclude<EditUnit, { kind: "team" }>;
  const edits: UnitEdit[] = [];
  const add = (unit: UnitEdit) => {
    const key = (u: UnitEdit) => (u.kind === "division" ? `v${u.division.id}` : `d${u.department.id}`);
    if (!edits.some((e) => key(e) === key(unit))) edits.push(unit);
  };
  if (viewer.headDepartment !== null) add({ kind: "department", department: viewer.headDepartment });
  for (const r of ordersRows) {
    if (r.level !== "edit") continue;
    if (r.scope === "department") {
      const department = org.find((d) => d.id === r.deptId);
      if (department) add({ kind: "department", department: { id: department.id, name: department.name } });
    } else {
      const division = org.flatMap((d) => d.divisions).find((d) => d.id === r.divisionId);
      if (division) add({ kind: "division", division });
    }
  }
  if (viewer.headDepartment === null && ordersRows.length === 0 && teamOrders.length === 0 && decides === null) return null;
  return { edits, decides };
}

/** Whether the viewer may edit or cancel this order: it belongs to a division or department they edit in. */
export function canEditOrder(scope: OrdersScope, order: Pick<Order, "unit">): boolean {
  const unit = order.unit;
  return scope.edits.some((e) => {
    switch (e.kind) {
      case "team":
        return true;
      case "division":
        return unit !== null && e.division.id === unit.division.id;
      case "department":
        return unit !== null && unit.department !== null && e.department.id === unit.department.id;
    }
  });
}

/** The divisions the viewer may send a new order for: each division they edit in, and every division of a department, or of the team, they edit in. */
export function orderingDivisions(scope: OrdersScope, departments: readonly OrgDepartmentUnits[]): OrderDivision[] {
  const found = new Map<number, OrderDivision>();
  for (const e of scope.edits) {
    const divisions =
      e.kind === "division"
        ? [e.division]
        : e.kind === "department"
          ? (departments.find((dep) => dep.id === e.department.id)?.divisions ?? [])
          : departments.flatMap((dep) => dep.divisions);
    for (const d of divisions) found.set(d.id, d);
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The division a new order is for, as the New order form sent it: one of the
 * viewer's ordering divisions. A viewer with one has no Division field, so
 * nothing sent means that one.
 */
export function checkOrderDivision(
  choices: readonly OrderDivision[],
  sent: string | undefined,
): { ok: true; value: OrderDivision } | { ok: false; error: string } {
  if (choices.length === 0) return { ok: false, error: "You can view orders but not request them." };
  const text = (sent ?? "").trim();
  if (text === "") return choices.length === 1 ? { ok: true, value: choices[0] } : { ok: false, error: "Choose the division the order is for." };
  const found = /^\d+$/.test(text) ? choices.find((d) => d.id === Number(text)) : undefined;
  return found === undefined ? { ok: false, error: "You can request orders only for your own division." } : { ok: true, value: found };
}

/** "Mission Analysis Division" reads "Mission Analysis" where the page names it beside its department. */
export function divisionShort(name: string): string {
  return name.replace(/\s+Division$/, "");
}

/** The units the viewer edits, as the intro names them: "Mission Analysis", "Aerodynamics". */
function editUnitName(unit: Exclude<EditUnit, { kind: "team" }>): string {
  return unit.kind === "division" ? divisionShort(unit.division.name) : unit.department.name;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The line under the title (boards 61, 67 and 70): what the viewer decides, else what they edit and that the rest is read-only. */
export function ordersIntro(scope: OrdersScope): string {
  if (scope.decides !== null) return "Every order in the team. Open a waiting order to approve it, reject it or ask for changes.";
  if (scope.edits.length === 0) return "Every order in the team. You can view them; none are yours to edit.";
  if (scope.edits.some((e) => e.kind === "team")) return "Every order in the team. You can edit all of them.";
  const units = scope.edits.flatMap((e) => (e.kind === "team" ? [] : [editUnitName(e)]));
  return `Every order in the team. You can edit ${joinNames(units)} orders; the rest are read-only.`;
}

/** "Aerodynamics · Mission Analysis" on a phone card (board 61m); a dash for an order with no division on record. */
export function unitLine(unit: OrderUnit | null): string {
  if (unit === null) return "–";
  const division = divisionShort(unit.division.name);
  return unit.department === null ? division : `${unit.department.name} · ${division}`;
}

export function orderTotal(order: Pick<Order, "unitPrice" | "quantity" | "shipping">): Cents {
  return order.unitPrice * order.quantity + (order.shipping ?? 0);
}

/** The requests still waiting for the team leader, and what they add up to (the lead Overview, board 56). */
export function waitingOrders(orders: readonly Order[]): { count: number; total: Cents } {
  const waiting = orders.filter((o) => o.status === "waiting");
  return { count: waiting.length, total: waiting.reduce((sum, o) => sum + orderTotal(o), 0) };
}

const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });

/** "€2,140.85" */
export function formatEuro(cents: Cents): string {
  return euro.format(cents / 100);
}

/** The small line under a total: "€59.55 × 2", "€150.00 + €13.30", or the unit price alone. */
export function orderBreakdown(order: Pick<Order, "unitPrice" | "quantity" | "shipping">): string {
  const items =
    order.quantity === 1 ? formatEuro(order.unitPrice) : `${formatEuro(order.unitPrice)} × ${order.quantity}`;
  return order.shipping === null ? items : `${items} + ${formatEuro(order.shipping)}`;
}

/**
 * What the viewer may still do with a request (boards 61c, 61d, 70b and 70c).
 * Editing and deciding are apart. Only an order in the viewer's scope
 * (`canEditOrder`) can be changed: a request the team leader has not answered
 * can be cancelled or edited; one sent back can only be edited and sent again,
 * which puts it back to waiting. A request is cancelled only while it is
 * waiting. Approved, Ordered and Rejected are answers: nobody edits them, and
 * a rejected request is never sent again (the requester makes a new one).
 * Deciding needs the right to decide (`decideRightOf`), not an edit scope: a
 * waiting request can be approved, rejected or sent back, and an approved one
 * marked as ordered, by the same people (issue #247).
 */
export type OrderActions = {
  readonly cancel: boolean;
  readonly edit: "edit" | "edit-and-resend" | null;
  /** Reject, Ask for changes and Approve (board 70b). */
  readonly decide: boolean;
  /** Mark as ordered (board 70c). */
  readonly markOrdered: boolean;
};

type EditActions = Pick<OrderActions, "cancel" | "edit">;

const NO_EDITS: EditActions = { cancel: false, edit: null };

/** What a request in `status` allows to someone who may edit it. */
function editsFor(status: OrderStatus): EditActions {
  switch (status) {
    case "waiting":
      return { cancel: true, edit: "edit" };
    case "changes-requested":
      return { cancel: false, edit: "edit-and-resend" };
    case "approved":
    case "ordered":
    case "rejected":
      return NO_EDITS;
  }
}

/** What the viewer may do with this order: edits only inside their scope, decisions only with the right to decide. */
export function orderActions(scope: OrdersScope, order: Pick<Order, "status" | "unit">): OrderActions {
  const edits = canEditOrder(scope, order) ? editsFor(order.status) : NO_EDITS;
  const decides = scope.decides !== null;
  return { ...edits, decide: decides && order.status === "waiting", markOrdered: decides && order.status === "approved" };
}

/** The state an edited request is in afterwards: an edit always goes back to the team leader. */
export function stateAfterEdit(status: OrderStatus): OrderState | null {
  return editsFor(status).edit === null ? null : { status: "waiting" };
}

/** What the team leader, or someone they gave "Approve orders", answers a waiting request with. */
export type OrderDecision =
  | { readonly kind: "approve" }
  | { readonly kind: "reject"; readonly reason: string | null }
  | { readonly kind: "ask-for-changes"; readonly reason: string };

const decisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approve") }),
  z.object({ kind: z.literal("reject"), reason: z.string().optional() }),
  z.object({ kind: z.literal("ask-for-changes"), reason: z.string() }),
]);

const MAX_REASON = 500;

/**
 * Checks a decision on a request, on the server, for every write: only the
 * team leader or a holder of "Approve orders" decides, only a waiting
 * request is decided, asking for changes says what to change (board 70d),
 * and a rejection gives a reason or none (board 70e).
 */
export function checkDecision(
  decides: DecideRight | null,
  status: OrderStatus,
  input: unknown,
): { ok: true; value: OrderDecision } | { ok: false; error: string } {
  if (decides === null) return { ok: false, error: "Only the team leader, or someone they gave Approve orders, decides orders." };
  if (status !== "waiting") return { ok: false, error: "This request is not waiting for an answer." };
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose approve, reject or ask for changes." };
  const decision = parsed.data;
  switch (decision.kind) {
    case "approve":
      return { ok: true, value: { kind: "approve" } };
    case "reject": {
      const reason = (decision.reason ?? "").trim();
      if (reason.length > MAX_REASON) return { ok: false, error: "Keep the reason under 500 characters." };
      return { ok: true, value: { kind: "reject", reason: reason === "" ? null : reason } };
    }
    case "ask-for-changes": {
      const reason = decision.reason.trim();
      if (reason === "") return { ok: false, error: "Say what to change." };
      if (reason.length > MAX_REASON) return { ok: false, error: "Keep the reason under 500 characters." };
      return { ok: true, value: { kind: "ask-for-changes", reason } };
    }
  }
}

/** The state a decision leaves the request in; `answer` says who decided and when. */
export function stateAfterDecision(decision: OrderDecision, answer: Answer): OrderState {
  switch (decision.kind) {
    case "approve":
      return { status: "approved", answer };
    case "reject":
      return { status: "rejected", answer, reason: decision.reason };
    case "ask-for-changes":
      return { status: "changes-requested", changes: { reason: decision.reason, by: answer.by, on: answer.on } };
  }
}

/**
 * Mark as ordered (board 70c, issue #247): an approved request becomes
 * Ordered and keeps who approved it. The people who decide orders mark them
 * (the boards show only the team leader's view; #247's triage reads it as the
 * same set as `decideRightOf`), and only from Approved: no other state reaches
 * Ordered, and Ordered goes nowhere.
 */
export function checkMarkOrdered(
  decides: DecideRight | null,
  state: OrderState,
): { ok: true; value: OrderState } | { ok: false; error: string } {
  if (decides === null) return { ok: false, error: "Only the team leader, or someone they gave Approve orders, marks orders as ordered." };
  if (state.status !== "approved") return { ok: false, error: "Only an approved request can be marked as ordered." };
  return { ok: true, value: { status: "ordered", answer: state.answer } };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** "5 Oct 2026" from an ISO date, in UTC. */
export function dayMonthYear(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/**
 * The note on an approved or ordered request (board 70c): "Approved by you on
 * 5 Oct 2026. Mark it as ordered once you have placed it." The second sentence
 * shows only to someone who may mark it.
 */
export function approvedNote(state: Extract<OrderState, { status: "approved" | "ordered" }>, canMark: boolean): string {
  const approved = `Approved by ${state.answer.byYou ? "you" : state.answer.by} on ${dayMonthYear(state.answer.on)}.`;
  if (state.status === "ordered") return `${approved} It has been ordered.`;
  return canMark ? `${approved} Mark it as ordered once you have placed it.` : approved;
}

/** Who rejected a request and when, under its reason: "Alessandro Greco · 5 Oct 2026". */
export function answeredLine(answer: Answer): string {
  return `${answer.byYou ? "You" : answer.by} · ${dayMonthYear(answer.on)}`;
}

/**
 * Give or remove "Approve orders" (issue #233). Only the team leader does
 * either, and any number of people may hold it at once. The team leader
 * already decides, so they are never given it.
 */
export type ApproveOrdersChange = { readonly personId: number; readonly holds: boolean };

const approveOrdersSchema = z.object({ personId: z.number().int().positive(), holds: z.boolean() });

export type ApproveOrdersFacts = {
  /** Whether the person changing it is the team leader. */
  readonly byTeamLeader: boolean;
  /** Everyone on the team now. */
  readonly team: readonly number[];
  /** Whoever holds the team leader's role now. */
  readonly teamLeaders: readonly number[];
  /** Who holds "Approve orders" now. */
  readonly holders: readonly number[];
};

/** Checks a give or remove of "Approve orders" against who asks, who is on the team and who holds it now. */
export function checkApproveOrdersChange(
  facts: ApproveOrdersFacts,
  input: unknown,
): { ok: true; value: ApproveOrdersChange } | { ok: false; error: string } {
  if (!facts.byTeamLeader) return { ok: false, error: "Only the team leader gives or removes Approve orders." };
  const parsed = approveOrdersSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown person." };
  const { personId, holds } = parsed.data;
  if (!facts.team.includes(personId)) return { ok: false, error: "Give Approve orders only to someone on the team." };
  if (facts.teamLeaders.includes(personId)) return { ok: false, error: "The team leader already approves orders." };
  const holdsNow = facts.holders.includes(personId);
  if (holds === holdsNow) return { ok: false, error: holds ? "They already hold Approve orders." : "They do not hold Approve orders." };
  return { ok: true, value: { personId, holds } };
}

/** Newest request first, whatever its state (board 61). */
export function sortOrders(orders: readonly Order[]): Order[] {
  return [...orders].sort((a, b) => b.requestedOn.localeCompare(a.requestedOn) || b.id - a.id);
}

/**
 * The two column filters (boards 61 and 67b): the divisions ticked in the
 * Department · Division filter, and the statuses ticked in the Status
 * filter. Null is no filter: every order shows.
 */
export type OrderFilters = {
  readonly divisionIds: readonly number[] | null;
  readonly statuses: readonly OrderStatus[] | null;
};

export const NO_FILTERS: OrderFilters = { divisionIds: null, statuses: null };

/** The orders that pass both filters. An order with no division shows only while no division filter is set. */
export function filterOrders(orders: readonly Order[], filters: OrderFilters): Order[] {
  const { divisionIds, statuses } = filters;
  return orders.filter(
    (o) =>
      (divisionIds === null || (o.unit !== null && divisionIds.includes(o.unit.division.id))) &&
      (statuses === null || statuses.includes(o.status)),
  );
}

/** A filter as Apply sets it: nothing ticked, or everything ticked, is no filter. */
export function appliedSelection<T>(ticked: readonly T[], all: readonly T[]): readonly T[] | null {
  return ticked.length === 0 || all.every((v) => ticked.includes(v)) ? null : ticked;
}

/** How a department's checkbox reads (board 67b): ticked when all its divisions are, half when some are. */
export function departmentTick(department: OrgDepartmentUnits, ticked: readonly number[]): "all" | "some" | "none" {
  const n = department.divisions.filter((d) => ticked.includes(d.id)).length;
  if (n === 0) return "none";
  return n === department.divisions.length ? "all" : "some";
}

/** Ticking a department ticks every division in it; unticking a fully ticked one clears them all. */
export function toggleDepartment(department: OrgDepartmentUnits, ticked: readonly number[]): number[] {
  const ids = department.divisions.map((d) => d.id);
  const rest = ticked.filter((id) => !ids.includes(id));
  return departmentTick(department, ticked) === "all" ? rest : [...rest, ...ids];
}

/** The largest quantity one order line takes. */
export const MAX_ORDER_QUANTITY = 1_000_000;

/** 12 orders per page (Owner decision on #233), the same page size as every dashboard list. */
export const ORDERS_PER_PAGE = PAGE_SIZE;

/** One page of the orders, newest first, and how many pages there are; a page past the end shows the last. */
export function orderPage(orders: readonly Order[], page: number): { orders: Order[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE));
  const current = Math.min(Math.max(1, Math.floor(page)), pages);
  const start = (current - 1) * ORDERS_PER_PAGE;
  return { orders: sortOrders(orders).slice(start, start + ORDERS_PER_PAGE), page: current, pages };
}

/**
 * The pager's numbers (board 61: "‹ 1 2 3 … 6 ›"): the first and last page,
 * the current one with its neighbours (three at either end), and a gap where
 * numbers are left out. Up to five pages show every number.
 */
export function pagerSlots(page: number, pages: number): (number | "gap")[] {
  if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
  const window = page <= 2 ? [1, 2, 3] : page >= pages - 1 ? [pages - 2, pages - 1, pages] : [page - 1, page, page + 1];
  const shown = [...new Set([1, ...window, pages])].sort((a, b) => a - b);
  return shown.flatMap((n, i): (number | "gap")[] => (i > 0 && n - shown[i - 1] > 1 ? ["gap", n] : [n]));
}

/**
 * Euros as a person types them, to cents: "59.55", "59,55", "€ 59.55",
 * "1,234.50". Null for anything else, or for more than two decimals.
 */
export function parseEuros(text: string): Cents | null {
  const bare = text.replace(/€/g, "").replace(/\s/g, "");
  if (bare === "") return null;
  // A comma followed by exactly one or two digits at the end is a decimal comma.
  const normal = /,\d{1,2}$/.test(bare) && !bare.includes(".") ? bare.replace(",", ".") : bare.replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normal);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** A quote is a PDF of at most this many bytes. */
export const MAX_QUOTE_BYTES = 10 * 1024 * 1024;

export type NewOrder = {
  readonly item: string;
  readonly link: string | null;
  readonly unitPrice: Cents;
  readonly quantity: number;
  readonly reason: string;
};

export type NewOrderErrors = Partial<Record<keyof NewOrder | "quote" | "division", string>>;

const httpUrl = z
  .string()
  .url("Paste the full link, starting with https://")
  .refine((url) => /^https?:\/\//i.test(url), "Paste the full link, starting with https://");

/**
 * Checks the New order fields as typed, on the client and again on the
 * server. Answers the order, or one message per field that is wrong.
 */
export function checkNewOrder(fields: {
  item: string;
  link: string;
  price: string;
  quantity: string;
  reason: string;
}): { ok: true; value: NewOrder } | { ok: false; errors: NewOrderErrors } {
  const errors: NewOrderErrors = {};
  const item = fields.item.trim();
  if (item === "") errors.item = "Say what to buy.";
  else if (item.length > 120) errors.item = "Keep the item under 120 characters.";

  const linkText = fields.link.trim();
  let link: string | null = null;
  if (linkText !== "") {
    const parsed = httpUrl.safeParse(linkText);
    if (parsed.success) link = parsed.data;
    else errors.link = parsed.error.issues[0]?.message;
  }

  const unitPrice = parseEuros(fields.price);
  if (unitPrice === null || unitPrice === 0) errors.unitPrice = "Write the price in euros, like 59.55.";

  const quantity = /^\d+$/.test(fields.quantity.trim()) ? Number(fields.quantity.trim()) : NaN;
  // Bulk parts (screws, connectors) run into the thousands (Owner decision,
  // 2026-10-21); the cap only stops a mistyped number, well inside the column.
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_ORDER_QUANTITY)
    errors.quantity = "A whole number from 1 to 1,000,000.";

  const reason = fields.reason.trim();
  if (reason === "") errors.reason = "Say what it is for.";
  else if (reason.length > 500) errors.reason = "Keep the reason under 500 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { item, link, unitPrice: unitPrice!, quantity, reason } };
}

/** Whether a picked file can be sent as the quote. */
export function checkQuote(file: { type: string; size: number; name: string }): string | null {
  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!pdf) return "The quote must be a PDF.";
  if (file.size > MAX_QUOTE_BYTES) return "The quote must be 10 MB or less.";
  return null;
}

/** A request's fields as the New order form shows them, for Edit order. */
export function orderFormFields(order: Pick<Order, "item" | "link" | "unitPrice" | "quantity" | "reason">): {
  item: string;
  link: string;
  price: string;
  quantity: string;
  reason: string;
} {
  return {
    item: order.item,
    link: order.link ?? "",
    price: (order.unitPrice / 100).toFixed(2),
    quantity: String(order.quantity),
    reason: order.reason ?? "",
  };
}
