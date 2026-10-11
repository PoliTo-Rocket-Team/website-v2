import { randomInt } from "node:crypto";
import {
  canEditOrder,
  checkApproveOrdersChange,
  checkDecision,
  checkNewOrder,
  checkOrderDivision,
  checkQuote,
  decideRightOf,
  orderActions,
  orderingDivisions,
  ordersPageFor,
  orgUnitsOf,
  stateAfterDecision,
  stateAfterEdit,
  WHOLE_TEAM,
  type EditUnit,
  type NewOrder,
  type Order,
  type OrderQuote,
  type OrdersPage,
  type OrdersScope,
  type OrderState,
  type OrderUnit,
  type OrgDepartmentUnits,
} from "@/lib/dashboard/orders";
import { heldLevel } from "@/lib/dashboard/division-access";
import { ledDivisionOf } from "@/lib/dashboard/team";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { heldAccess, type AccessViewerKind } from "./division";
import { departments, divisions, people, type DummyPerson } from "./team";

// The Orders page for the test developer (boards 61 to 61d, issue #172;
// boards 61m, 67, 67b and 67m, issue #233): every order in the team, from
// more than one department, six pages of them. The division lead (Marco
// Bianchi) edits Mission Analysis orders; the department head (Chiara
// Rinaldi) edits every Aerodynamics order; the operations lead (Giulia Rossi)
// has full access and edits every order (issue #238). None is the team leader
// and none holds "Approve orders", so all are refused a decision, as the
// database side refuses them. Writes check what was sent as the database
// side does, store nothing, and answer what the page shows next.

export type DummyOrder = OrderState & {
  readonly id: number;
  readonly divisionId: number;
  readonly requesterId: number;
  readonly item: string;
  readonly reason: string;
  readonly link: string | null;
  /** Euro cents. */
  readonly unitPrice: number;
  readonly quantity: number;
  readonly shipping: number | null;
  readonly requestedOn: string;
  readonly quote: OrderQuote | null;
};

const sentBack: OrderState = {
  status: "changes-requested",
  changes: {
    reason: "Amazon is over our limit for this item. Add a quote from a second shop, then send it again.",
    by: "Alessandro Greco",
    on: "2026-10-05",
  },
};

const rsQuote: OrderQuote = { name: "quote_RS_2026-10-02.pdf", size: 188_416, href: null };
const amazonQuote: OrderQuote = { name: "quote_amazon_2026-10-03.pdf", size: 188_416, href: null };

/** Board 61's first page, newest first, then the older requests that fill the other five. */
const recent: readonly DummyOrder[] = [
  { id: 1, divisionId: 1, requesterId: 2, item: "Steel wire", reason: "For the launch rail", link: "https://uk.rs-online.com/web/p/steel-wire/1234567", unitPrice: 5955, quantity: 2, shipping: null, status: "waiting", requestedOn: "2026-10-08", quote: rsQuote },
  { id: 2, divisionId: 2, requesterId: 32, item: "Workstation RAM, 64 GB", reason: "CFD runs for the fin study", link: null, unitPrice: 9490, quantity: 2, shipping: null, status: "waiting", requestedOn: "2026-10-08", quote: null },
  { id: 3, divisionId: 1, requesterId: 2, item: "CO2 cartridges", reason: "Ejection tests at Roccaraso", link: "https://www.amazon.it/dp/B07CO2XXXX", unitPrice: 12480, quantity: 1, shipping: null, ...sentBack, requestedOn: "2026-10-07", quote: amazonQuote },
  { id: 4, divisionId: 9, requesterId: 68, item: "LiPo batteries, 2S", reason: "Flight computer bench", link: null, unitPrice: 2945, quantity: 2, shipping: null, status: "waiting", requestedOn: "2026-10-07", quote: null },
  { id: 5, divisionId: 1, requesterId: 2, item: "Loctite", reason: "Launch rail screws", link: null, unitPrice: 1180, quantity: 3, shipping: null, status: "approved", requestedOn: "2026-10-06", quote: null },
  { id: 6, divisionId: 2, requesterId: 33, item: "Pitot tube", reason: "Wind tunnel checks", link: null, unitPrice: 7450, quantity: 1, shipping: null, status: "approved", requestedOn: "2026-10-06", quote: null },
  { id: 7, divisionId: 3, requesterId: 38, item: "Carbon fibre sheet", reason: "Fin can layup", link: null, unitPrice: 7100, quantity: 2, shipping: null, status: "approved", requestedOn: "2026-10-05", quote: null },
  { id: 8, divisionId: 12, requesterId: 83, item: "Van rental, 2 days", reason: "Roccaraso launch trip", link: null, unitPrice: 10500, quantity: 2, shipping: null, status: "rejected", requestedOn: "2026-10-05", quote: null },
  { id: 9, divisionId: 6, requesterId: 53, item: "Shock cord, 10 m", reason: "Drogue harness", link: null, unitPrice: 246, quantity: 10, shipping: null, status: "waiting", requestedOn: "2026-10-04", quote: null },
  { id: 10, divisionId: 1, requesterId: 6, item: "Pressure sensor", reason: "Nose cone ports", link: null, unitPrice: 4290, quantity: 1, shipping: null, status: "approved", requestedOn: "2026-10-04", quote: null },
  { id: 11, divisionId: 9, requesterId: 68, item: "Antenna cable, SMA", reason: "Ground station", link: null, unitPrice: 920, quantity: 2, shipping: null, status: "approved", requestedOn: "2026-10-03", quote: null },
  { id: 12, divisionId: 2, requesterId: 32, item: "Balsa sheets", reason: "Fin flutter mock-ups", link: null, unitPrice: 630, quantity: 5, shipping: null, status: "rejected", requestedOn: "2026-10-03", quote: null },
  { id: 13, divisionId: 1, requesterId: 3, item: "Mini 3-ring system", reason: "Recovery bay mock-up", link: null, unitPrice: 15000, quantity: 1, shipping: 1330, status: "waiting", requestedOn: "2026-10-02", quote: null },
  { id: 14, divisionId: 5, requesterId: 48, item: "Ripstop nylon, 5 m", reason: "Main chute canopy", link: null, unitPrice: 1720, quantity: 5, shipping: null, status: "waiting", requestedOn: "2026-10-02", quote: null },
  { id: 15, divisionId: 1, requesterId: 4, item: "M4 heated inserts", reason: "Roccaraso launch", link: null, unitPrice: 2300, quantity: 3, shipping: null, status: "approved", requestedOn: "2026-10-01", quote: null },
  { id: 16, divisionId: 1, requesterId: 3, item: "Concave mirror", reason: "Optical test bench", link: null, unitPrice: 4824, quantity: 1, shipping: null, status: "rejected", requestedOn: "2026-09-30", quote: null },
];

/** What the older requests buy: item, reason, division, requester, price of one in cents, quantity. */
const OLDER: readonly (readonly [item: string, reason: string, divisionId: number, requesterId: number, unitPrice: number, quantity: number])[] = [
  ["Epoxy resin, 1 kg", "Fin bonding", 3, 39, 3450, 2],
  ["Strain gauges", "Bulkhead test", 4, 44, 1290, 6],
  ["Swivel, 1 t", "Recovery harness", 6, 54, 1880, 2],
  ["IMU breakout", "Attitude estimator tests", 7, 59, 3990, 1],
  ["Requirements workshop room", "Design review", 8, 63, 6000, 1],
  ["Ground station radio", "Telemetry link", 9, 69, 14900, 1],
  ["SD cards, 32 GB", "Flight logs", 10, 74, 890, 4],
  ["Poster printing", "Open day stand", 11, 80, 2500, 3],
  ["Fuel for the van", "Roccaraso launch trip", 12, 84, 9000, 1],
  ["First aid kit", "Launch site safety", 13, 86, 4590, 1],
  ["Sponsor gift bags", "Partner day", 14, 88, 1200, 10],
  ["Wind tunnel time", "Nose cone drag check", 1, 7, 18000, 1],
  ["CFD licence top-up", "Fin study", 2, 34, 25000, 1],
  ["Kevlar thread", "Shroud line repairs", 5, 49, 1560, 2],
  ["Aluminium tube, 1 m", "Coupler stock", 3, 40, 3120, 2],
  ["Torque wrench", "Motor retention", 4, 45, 6890, 1],
  ["Pyro cutters", "Reefing tests", 6, 55, 4200, 4],
  ["Servo motors", "Airbrake prototype", 7, 60, 2350, 4],
  ["Label printer tape", "Harness labels", 8, 64, 1450, 3],
  ["Crimp connectors", "Avionics bay wiring", 9, 70, 990, 5],
  ["Debug probe", "Flight software bench", 10, 75, 7900, 1],
  ["Camera mount", "Launch footage", 11, 81, 2990, 1],
  ["Tie-down straps", "Rail transport", 12, 85, 1690, 4],
  ["Ear defenders", "Static fire", 13, 87, 2100, 6],
  ["Roll-up banner", "Sponsor wall", 14, 89, 8900, 1],
  ["Ballast weights", "Stability margin tests", 1, 13, 1450, 4],
];

/** The ISO date `days` days before 2026-09-29. */
function daysBefore(days: number): string {
  return new Date(Date.UTC(2026, 8, 29 - days)).toISOString().slice(0, 10);
}

/** Older requests: each template twice, a day apart, almost all of them answered. */
const older: readonly DummyOrder[] = [0, 1].flatMap((round) =>
  OLDER.map(([item, reason, divisionId, requesterId, unitPrice, quantity], i): DummyOrder => {
    const n = round * OLDER.length + i;
    const status = n % 9 === 4 ? "waiting" : n % 5 === 2 ? "rejected" : "approved";
    return {
      id: 100 + n,
      divisionId,
      requesterId,
      item,
      reason,
      link: null,
      unitPrice: unitPrice + round * 50,
      quantity,
      shipping: null,
      status,
      requestedOn: daysBefore(Math.floor(n / 2)),
      quote: null,
    };
  }),
);

/** Every request in the team: 68, so the table runs to six pages of 12. */
export const orders: readonly DummyOrder[] = [...recent, ...older];

/** Who the team leader gave "Approve orders": nobody on the test developer's team. */
export const approveOrdersHolders: readonly number[] = [];

function personOf(id: number): DummyPerson {
  return people.find((p) => p.id === id)!;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** An id for a row a test developer adds: it lives only in the page's state. */
function localId(): number {
  return randomInt(1_000_000, 2_000_000_000);
}

/** Every department in the team's order and its divisions (`orgUnitsOf`). */
function orgUnits(): OrgDepartmentUnits[] {
  return orgUnitsOf(departments, divisions);
}

function unitOfDivision(divisionId: number): OrderUnit {
  const division = divisions.find((d) => d.id === divisionId)!;
  const department = departments.find((d) => d.id === division.departmentId)!;
  return { division: { id: division.id, name: division.name }, department: { id: department.id, name: department.name } };
}

/**
 * The viewer's Orders scope, as the database side reads it: the whole team
 * for full access, a lead's Orders level in the division they lead, a head's
 * whole department at Can edit; null for anyone with no Orders access.
 */
function scopeOf(kind: AccessViewerKind, viewer: DummyPerson): OrdersScope | null {
  const decides = decideRightOf({
    teamLeader: viewer.placement.role === "team-leader",
    approveOrders: approveOrdersHolders.includes(viewer.id),
  });
  const placement = viewer.placement;
  // Full access edits every order in the team (issue #238); deciding still needs the team leader's role or the grant.
  if (kind === "operations-lead") return { edits: [WHOLE_TEAM], decides };
  if (kind === "department-head") {
    if (placement.role !== "head") return null;
    const department = departments.find((d) => d.id === placement.departmentId)!;
    return { edits: [{ kind: "department", department: { id: department.id, name: department.name } }], decides };
  }
  const divisionId = ledDivisionOf(placement);
  const level = heldLevel(
    heldAccess.filter((h) => h.personId === viewer.id),
    "orders",
  );
  if (divisionId === null || level === null) return decides === null ? null : { edits: [], decides };
  const edits: EditUnit[] = level === "edit" ? [{ kind: "division", division: unitOfDivision(divisionId).division }] : [];
  return { edits, decides };
}

function orderOf(o: DummyOrder): Order {
  return {
    ...(o.status === "changes-requested" ? { status: o.status, changes: o.changes } : { status: o.status }),
    id: o.id,
    item: o.item,
    reason: o.reason,
    link: o.link,
    requestedBy: personOf(o.requesterId).name,
    unit: unitOfDivision(o.divisionId),
    unitPrice: o.unitPrice,
    quantity: o.quantity,
    shipping: o.shipping,
    requestedOn: o.requestedOn,
    quote: o.quote,
  };
}

/** Every request made for the given divisions: a division lead's and a department head's Overview count the waiting ones (boards 56 and 62). */
export function dummyOrdersIn(divisionIds: readonly number[]): Order[] {
  return orders.filter((o) => divisionIds.includes(o.divisionId)).map(orderOf);
}

/** Boards 61 to 67b: every order in the team for someone with Orders access; null for anyone else. */
export function dummyOrdersPage(kind: AccessViewerKind, viewer: DummyPerson): OrdersPage | null {
  return ordersPageFor(scopeOf(kind, viewer), orgUnits(), orders.map(orderOf));
}

/** The New order or Edit order fields, checked as the database side checks them. */
function checkedOrder(fields: Record<string, string>, quote: Upload | null): { ok: true; value: NewOrder } | { ok: false; error: string } {
  const checked = checkNewOrder({
    item: fields.item ?? "",
    link: fields.link ?? "",
    price: fields.price ?? "",
    quantity: fields.quantity ?? "",
    reason: fields.reason ?? "",
  });
  if (!checked.ok) return { ok: false, error: Object.values(checked.errors)[0] ?? "Check the form." };
  if (quote !== null) {
    const error = checkQuote({ type: quote.contentType, size: quote.bytes.byteLength, name: quote.name });
    if (error !== null) return { ok: false, error };
  }
  return checked;
}

function quoteOf(upload: Upload): OrderQuote {
  return { name: upload.name, size: upload.bytes.byteLength, href: null };
}

const NO_ACCESS = "You do not have access to Orders.";
const OUT_OF_SCOPE = "This order is outside your division or department, so it is read-only for you.";

export function dummyPlaceOrder(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  fields: Record<string, string>,
  quote: Upload | null,
): WriteResult<Order> {
  const page = dummyOrdersPage(kind, viewer);
  if (page === null) return refused(NO_ACCESS);
  const division = checkOrderDivision(orderingDivisions(page.scope, page.departments), fields.division);
  if (!division.ok) return refused(division.error);
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);
  return written({
    id: localId(),
    ...checked.value,
    requestedBy: viewer.name,
    unit: unitOfDivision(division.value.id),
    shipping: null,
    status: "waiting",
    requestedOn: today(),
    quote: quote === null ? null : quoteOf(quote),
  });
}

/**
 * Checks an edit as the database side does and answers the request as it now
 * reads; nothing is stored. A request sent on the page lives only in the
 * page's state, so it is answered as sent now, for the division the form
 * names.
 */
export function dummyEditOrder(
  kind: AccessViewerKind,
  viewer: DummyPerson,
  orderId: number,
  fields: Record<string, string>,
  quote: Upload | null,
): WriteResult<Order> {
  const page = dummyOrdersPage(kind, viewer);
  if (page === null) return refused(NO_ACCESS);
  const stored = page.orders.find((o) => o.id === orderId);
  if (stored !== undefined && !canEditOrder(page.scope, stored)) return refused(OUT_OF_SCOPE);
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);
  if (stored === undefined) {
    const division = checkOrderDivision(orderingDivisions(page.scope, page.departments), fields.division);
    if (!division.ok) return refused(division.error);
    return written({
      id: orderId,
      ...checked.value,
      requestedBy: viewer.name,
      unit: unitOfDivision(division.value.id),
      shipping: null,
      status: "waiting",
      requestedOn: today(),
      quote: quote === null ? null : quoteOf(quote),
    });
  }
  const next = stateAfterEdit(stored.status);
  if (next === null) return refused("The team leader has answered this request.");
  return written({
    ...next,
    ...checked.value,
    id: stored.id,
    requestedBy: stored.requestedBy,
    unit: stored.unit,
    shipping: stored.shipping,
    requestedOn: stored.requestedOn,
    quote: quote === null ? stored.quote : quoteOf(quote),
  });
}

export function dummyCancelOrder(kind: AccessViewerKind, viewer: DummyPerson, orderId: number): WriteResult<null> {
  const page = dummyOrdersPage(kind, viewer);
  if (page === null) return refused(NO_ACCESS);
  const stored = page.orders.find((o) => o.id === orderId);
  // A request sent on the page lives only in its state: cancelling it leaves nothing behind.
  if (stored === undefined) return written(null);
  if (!canEditOrder(page.scope, stored)) return refused(OUT_OF_SCOPE);
  return orderActions(page.scope, stored).cancel ? written(null) : refused("The team leader has answered this request.");
}

/** Checks a decision as the database side does: only the team leader or a holder of "Approve orders" decides. */
export function dummyDecideOrder(kind: AccessViewerKind, viewer: DummyPerson, orderId: number, input: unknown): WriteResult<Order> {
  const page = dummyOrdersPage(kind, viewer);
  if (page === null) return refused(NO_ACCESS);
  const stored = page.orders.find((o) => o.id === orderId);
  if (stored === undefined) return refused("That request is no longer on the page.");
  const checked = checkDecision(page.scope.decides, stored.status, input);
  if (!checked.ok) return refused(checked.error);
  return written({ ...stored, ...stateAfterDecision(checked.value, viewer.name, today()) });
}

/** Checks a give or remove of "Approve orders" as the database side does; nothing is stored. */
export function dummySetApproveOrders(viewer: DummyPerson, onTeam: readonly number[], input: unknown): WriteResult<null> {
  const checked = checkApproveOrdersChange(
    {
      byTeamLeader: viewer.placement.role === "team-leader",
      team: onTeam,
      teamLeaders: people.filter((p) => p.placement.role === "team-leader").map((p) => p.id),
      holders: approveOrdersHolders,
    },
    input,
  );
  return checked.ok ? written(null) : refused(checked.error);
}
