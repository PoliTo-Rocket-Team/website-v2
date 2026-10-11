import { z } from "zod";

// The Orders page (Dashboard v2 boards 61 to 61d, issue #172; boards 61m, 67,
// 67b and 67m, issue #233): every purchase request in the team, what state
// each is in, and what the viewer may still do with it. Money is whole euro
// cents everywhere, so totals never pick up float error.

/** The states a request shows: waiting for the team leader, or their answer. */
export const ORDER_STATUSES = ["waiting", "approved", "changes-requested", "rejected"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  waiting: "Waiting",
  approved: "Approved",
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

/** Where a request stands. Only a request sent back carries the team leader's reason. */
export type OrderState =
  | { readonly status: "waiting" | "approved" | "rejected" }
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

/** A unit the viewer edits orders in: one division, or a whole department. */
export type EditUnit =
  | { readonly kind: "division"; readonly division: OrderDivision }
  | { readonly kind: "department"; readonly department: OrderDepartment };

/**
 * Why a viewer may approve, reject or ask for changes: they are the team
 * leader, or the team leader gave them "Approve orders". Anyone else may not.
 */
export type DecideRight = "team-leader" | "approve-orders";

/**
 * What the viewer may do on Orders (issue #233). Anyone with any Orders
 * access sees every order in the team; they edit only orders in `edits`: a
 * lead the divisions they hold Orders at Can edit in, a head their whole
 * department. Deciding is apart from editing: `decides` is null for everyone
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

/** The Orders page (boards 61 to 61d, 61m, 67, 67b, 67m): every order in the team, and what the viewer may do. */
export type OrdersPage = {
  readonly scope: OrdersScope;
  /** Every open department and its open divisions, by name. */
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

/** Whether the viewer may edit or cancel this order: it belongs to a division or department they edit in. */
export function canEditOrder(scope: OrdersScope, order: Pick<Order, "unit">): boolean {
  const unit = order.unit;
  if (unit === null) return false;
  return scope.edits.some((e) =>
    e.kind === "division" ? e.division.id === unit.division.id : unit.department !== null && e.department.id === unit.department.id,
  );
}

/** The divisions the viewer may send a new order for: each division they edit in, and every division of a department they edit in. */
export function orderingDivisions(scope: OrdersScope, departments: readonly OrgDepartmentUnits[]): OrderDivision[] {
  const found = new Map<number, OrderDivision>();
  for (const e of scope.edits) {
    if (e.kind === "division") found.set(e.division.id, e.division);
    else for (const d of departments.find((dep) => dep.id === e.department.id)?.divisions ?? []) found.set(d.id, d);
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
function editUnitName(unit: EditUnit): string {
  return unit.kind === "division" ? divisionShort(unit.division.name) : unit.department.name;
}

function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The line under the title (boards 61 and 67): what the viewer edits, and that the rest is read-only. */
export function ordersIntro(scope: OrdersScope): string {
  if (scope.edits.length === 0) return "Every order in the team. You can view them; none are yours to edit.";
  return `Every order in the team. You can edit ${joinNames(scope.edits.map(editUnitName))} orders; the rest are read-only.`;
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

/** The orders of the given divisions: an Overview counts its own unit's (boards 56 and 62). */
export function ordersOfDivisions(orders: readonly Order[], divisionIds: readonly number[]): Order[] {
  return orders.filter((o) => o.unit !== null && divisionIds.includes(o.unit.division.id));
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
 * What the viewer may still do with a request (boards 61c and 61d). Only an
 * order in their scope (`canEditOrder`) can be changed at all; any other opens
 * read-only. A request the team leader has not answered can be cancelled or
 * edited; one sent back can only be edited and sent again, which puts it back
 * to waiting. A request is cancelled only while it is waiting
 * (docs/dashboard-rules.md). An approved or rejected request is the team
 * leader's answer: nothing is left to do with it.
 */
export type OrderActions = {
  readonly cancel: boolean;
  readonly edit: "edit" | "edit-and-resend" | null;
};

const NO_ACTIONS: OrderActions = { cancel: false, edit: null };

/** What a request in `status` allows to someone who may edit it. */
function actionsFor(status: OrderStatus): OrderActions {
  switch (status) {
    case "waiting":
      return { cancel: true, edit: "edit" };
    case "changes-requested":
      return { cancel: false, edit: "edit-and-resend" };
    case "approved":
    case "rejected":
      return NO_ACTIONS;
  }
}

/** What the viewer may do with this order: nothing outside their scope. */
export function orderActions(scope: OrdersScope, order: Pick<Order, "status" | "unit">): OrderActions {
  return canEditOrder(scope, order) ? actionsFor(order.status) : NO_ACTIONS;
}

/** The state an edited request is in afterwards: an edit always goes back to the team leader. */
export function stateAfterEdit(status: OrderStatus): OrderState | null {
  return actionsFor(status).edit === null ? null : { status: "waiting" };
}

/** What the team leader, or someone they gave "Approve orders", answers a waiting request with. */
export type OrderDecision =
  | { readonly kind: "approve" }
  | { readonly kind: "reject" }
  | { readonly kind: "ask-for-changes"; readonly reason: string };

const decisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approve") }),
  z.object({ kind: z.literal("reject") }),
  z.object({ kind: z.literal("ask-for-changes"), reason: z.string() }),
]);

/**
 * Checks a decision on a request, on the server, for every write: only the
 * team leader or a holder of "Approve orders" decides, only a waiting
 * request is decided, and asking for changes says what to change.
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
  if (parsed.data.kind !== "ask-for-changes") return { ok: true, value: parsed.data };
  const reason = parsed.data.reason.trim();
  if (reason === "") return { ok: false, error: "Say what to change." };
  if (reason.length > 500) return { ok: false, error: "Keep the reason under 500 characters." };
  return { ok: true, value: { kind: "ask-for-changes", reason } };
}

/** The state a decision leaves the request in; `by` is the decider's name, `on` the ISO date. */
export function stateAfterDecision(decision: OrderDecision, by: string, on: string): OrderState {
  switch (decision.kind) {
    case "approve":
      return { status: "approved" };
    case "reject":
      return { status: "rejected" };
    case "ask-for-changes":
      return { status: "changes-requested", changes: { reason: decision.reason, by, on } };
  }
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

/** 12 orders per page (Owner decision on #233). */
export const ORDERS_PER_PAGE = 12;

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
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) errors.quantity = "A whole number from 1 to 999.";

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
