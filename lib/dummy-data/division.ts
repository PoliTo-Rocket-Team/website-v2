import { randomInt } from "node:crypto";
import {
  ACCESS_TARGETS,
  checkRemoveAllAccess,
  checkSaveAccess,
  heldLevel,
  type AccessGrant,
  type AccessLevel,
  type AccessPerson,
  type AccessTarget,
  type DivisionAccess,
} from "@/lib/dashboard/division-access";
import {
  checkNewOrder,
  checkQuote,
  orderActions,
  stateAfterEdit,
  type DivisionOrders,
  type NewOrder,
  type Order,
  type OrderQuote,
  type OrderState,
} from "@/lib/dashboard/orders";
import { isIn, ledDivisionOf, membershipsIn, roleIn, type RosterEntry } from "@/lib/dashboard/team";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { divisions, people, type DummyPerson } from "./team";

// The division lead's Access and Orders pages for the test developer (boards
// 60 to 61d, issues #145 and #172). The lead is Marco Bianchi, Mission
// Analysis. The people come from the roster as the test developer left it
// (./team-pages.ts), so someone moved to alumni has no access here any more.

export type DummyHeldAccess = {
  readonly personId: number;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

/** What each lead holds in their own division ("Your access" on board 60). */
export const heldAccess = [
  { personId: 2, target: "positions", level: "edit" },
  { personId: 2, target: "applications", level: "edit" },
  { personId: 2, target: "members", level: "edit" },
  { personId: 2, target: "orders", level: "edit" },
] as const satisfies readonly DummyHeldAccess[];

export type DummyGrant = {
  readonly id: number;
  readonly personId: number;
  readonly divisionId: number;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
  readonly givenById: number;
  readonly givenOn: string;
};

/** Board 60's table: Sara Conti, Luca Marino and Sofia Neri, each area in the order given. */
export const accessGrants = [
  { id: 1, personId: 7, divisionId: 1, target: "applications", level: "view", givenById: 2, givenOn: "2026-10-02" },
  { id: 2, personId: 7, divisionId: 1, target: "positions", level: "edit", givenById: 2, givenOn: "2026-10-02" },
  { id: 3, personId: 4, divisionId: 1, target: "positions", level: "view", givenById: 2, givenOn: "2026-09-28" },
  { id: 4, personId: 4, divisionId: 1, target: "applications", level: "edit", givenById: 2, givenOn: "2026-09-28" },
  { id: 5, personId: 3, divisionId: 1, target: "members", level: "view", givenById: 2, givenOn: "2026-10-02" },
] as const satisfies readonly DummyGrant[];

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

/** Board 61's requests. */
export const orders: readonly DummyOrder[] = [
  { id: 1, divisionId: 1, requesterId: 2, item: "Steel wire", reason: "For the launch rail", link: "https://uk.rs-online.com/web/p/steel-wire/1234567", unitPrice: 5955, quantity: 2, shipping: null, status: "waiting", requestedOn: "2026-10-08", quote: { name: "quote_RS_2026-10-02.pdf", size: 188_416, href: null } },
  { id: 2, divisionId: 1, requesterId: 2, item: "CO2 cartridges", reason: "Ejection tests at Roccaraso", link: "https://www.amazon.it/dp/B07CO2XXXX", unitPrice: 12480, quantity: 1, shipping: null, ...sentBack, requestedOn: "2026-10-07", quote: { name: "quote_amazon_2026-10-03.pdf", size: 188_416, href: null } },
  { id: 3, divisionId: 1, requesterId: 3, item: "Mini 3-ring system", reason: "Recovery bay mock-up", link: null, unitPrice: 15000, quantity: 1, shipping: 1330, status: "waiting", requestedOn: "2026-10-06", quote: null },
  { id: 4, divisionId: 1, requesterId: 2, item: "Loctite", reason: "Launch rail screws", link: null, unitPrice: 1180, quantity: 3, shipping: null, status: "approved", requestedOn: "2026-10-01", quote: null },
  { id: 5, divisionId: 1, requesterId: 4, item: "M4 heated inserts", reason: "Roccaraso launch", link: null, unitPrice: 2300, quantity: 3, shipping: null, status: "approved", requestedOn: "2026-09-29", quote: null },
  { id: 6, divisionId: 1, requesterId: 3, item: "Concave mirror", reason: "Optical test bench", link: null, unitPrice: 4824, quantity: 1, shipping: null, status: "rejected", requestedOn: "2026-09-22", quote: null },
];

function personOf(id: number): DummyPerson {
  return people.find((p) => p.id === id)!;
}

function divisionOf(id: number) {
  return divisions.find((d) => d.id === id)!;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** An id for a row a test developer adds: it lives only in the page's state. */
function localId(): number {
  return randomInt(1_000_000, 2_000_000_000);
}

/** The person as the division's Access page shows them: their standing in that division. */
function accessPerson(entry: RosterEntry, divisionId: number): AccessPerson {
  return { id: entry.id, name: entry.name, standing: roleIn(membershipsIn(entry.placement), divisionId) === "lead" ? "lead" : "member" };
}

/**
 * Boards 60 and 60b for a lead; null for anyone who leads no division. Only
 * people on `roster` hold access: a grant to someone moved to alumni is gone.
 */
export function dummyDivisionAccess(lead: DummyPerson, roster: readonly RosterEntry[]): DivisionAccess | null {
  // One division: the oldest they lead, until the department head work gives them all (#230).
  const divisionId = ledDivisionOf(lead.placement);
  if (divisionId === null) return null;
  const inDivision = roster.filter((e) => isIn(e.placement, divisionId));
  const onTeam = new Map(inDivision.map((e) => [e.id, e]));
  const grants = accessGrants.flatMap((g): AccessGrant[] => {
    const person = onTeam.get(g.personId);
    if (g.divisionId !== divisionId || person === undefined) return [];
    return [
      {
        id: g.id,
        person: accessPerson(person, divisionId),
        target: g.target,
        level: g.level,
        givenBy: g.givenById === lead.id ? "You" : personOf(g.givenById).name,
        givenOn: g.givenOn,
      },
    ];
  });
  return {
    division: { id: divisionId, name: divisionOf(divisionId).name },
    held: ACCESS_TARGETS.flatMap((target) =>
      heldAccess.filter((h) => h.personId === lead.id && h.target === target).map((h) => ({ target, level: h.level })),
    ),
    grants,
    people: inDivision.filter((e) => e.id !== lead.id).map((e) => accessPerson(e, divisionId)),
  };
}

/**
 * Checks a Give access or Edit access Save as the database side does and
 * answers the person's grants as they would read; nothing is stored. An area
 * left as it was keeps its grant; a new or changed one is given by "You"
 * today. A grant given on the page lives only in the page's state, so the
 * check runs against the stored grants alone.
 */
export function dummySaveAccess(
  lead: DummyPerson,
  roster: readonly RosterEntry[],
  input: unknown,
): WriteResult<readonly AccessGrant[]> {
  const access = dummyDivisionAccess(lead, roster);
  if (access === null) return refused("Only a division lead gives access here.");
  const checked = checkSaveAccess(access, input);
  if (!checked.ok) return refused(checked.error);
  const { personId, changes } = checked.value;
  const person = access.people.find((p) => p.id === personId)!;
  const kept = access.grants.filter((g) => g.person.id === personId && !changes.some((c) => c.target === g.target));
  const givenOn = today();
  // Ids rise in area order, as one database insert's do, so the chips read in that order.
  const first = localId();
  const given = changes
    .flatMap((c) => (c.kind === "remove" ? [] : [c]))
    .map((c, i): AccessGrant => ({ id: first + i, person, target: c.target, level: c.to, givenBy: "You", givenOn }));
  return written([...kept, ...given]);
}

/** Checks Remove all access as the database side does; nothing is stored. */
export function dummyRemoveAllAccess(lead: DummyPerson, roster: readonly RosterEntry[], personId: number): WriteResult<null> {
  const access = dummyDivisionAccess(lead, roster);
  if (access === null) return refused("Only a division lead removes access here.");
  const checked = checkRemoveAllAccess(access, personId);
  return checked.ok ? written(null) : refused(checked.error);
}

function stateOf(o: OrderState): OrderState {
  return o.status === "changes-requested" ? { status: o.status, changes: o.changes } : { status: o.status };
}

function orderOf(o: DummyOrder): Order {
  return {
    ...stateOf(o),
    id: o.id,
    item: o.item,
    reason: o.reason,
    link: o.link,
    requestedBy: personOf(o.requesterId).name,
    unitPrice: o.unitPrice,
    quantity: o.quantity,
    shipping: o.shipping,
    requestedOn: o.requestedOn,
    quote: o.quote,
  };
}

/** Boards 61 to 61d for someone who holds Orders in their division; null for anyone else. */
export function dummyDivisionOrders(lead: DummyPerson): DivisionOrders | null {
  // One division: the oldest they lead, until Orders shows the whole team (#233).
  const divisionId = ledDivisionOf(lead.placement);
  if (divisionId === null) return null;
  const level = heldLevel(
    heldAccess.filter((h) => h.personId === lead.id),
    "orders",
  );
  if (level === null) return null;
  return {
    division: { id: divisionId, name: divisionOf(divisionId).name },
    level,
    orders: orders.filter((o) => o.divisionId === divisionId).map(orderOf),
  };
}

/** The Orders page when the person may request and change orders there; a reason when not. */
function orderingPage(lead: DummyPerson): DivisionOrders | string {
  const page = dummyDivisionOrders(lead);
  if (page === null) return "You do not have access to Orders.";
  return page.level === "edit" ? page : "You can view orders but not request or change them.";
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

export function dummyPlaceOrder(
  lead: DummyPerson,
  fields: Record<string, string>,
  quote: Upload | null,
): WriteResult<Order> {
  const page = orderingPage(lead);
  if (typeof page === "string") return refused(page);
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);
  return written({
    id: localId(),
    ...checked.value,
    requestedBy: lead.name,
    shipping: null,
    status: "waiting",
    requestedOn: today(),
    quote: quote === null ? null : quoteOf(quote),
  });
}

/**
 * Checks an edit as the database side does and answers the request as it now
 * reads; nothing is stored. A request sent on the page lives only in the
 * page's state, so it is answered as sent now.
 */
export function dummyEditOrder(
  lead: DummyPerson,
  orderId: number,
  fields: Record<string, string>,
  quote: Upload | null,
): WriteResult<Order> {
  const page = orderingPage(lead);
  if (typeof page === "string") return refused(page);
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);
  const stored = page.orders.find((o) => o.id === orderId);
  if (stored === undefined) {
    if (orders.some((o) => o.id === orderId)) return refused("That request is not in your division.");
    return written({ id: orderId, ...checked.value, requestedBy: lead.name, shipping: null, status: "waiting", requestedOn: today(), quote: quote === null ? null : quoteOf(quote) });
  }
  const next = stateAfterEdit(stored.status);
  if (next === null) return refused("The team leader has answered this request.");
  return written({
    ...next,
    ...checked.value,
    id: stored.id,
    requestedBy: stored.requestedBy,
    shipping: stored.shipping,
    requestedOn: stored.requestedOn,
    quote: quote === null ? stored.quote : quoteOf(quote),
  });
}

export function dummyCancelOrder(lead: DummyPerson, orderId: number): WriteResult<null> {
  const page = orderingPage(lead);
  if (typeof page === "string") return refused(page);
  const stored = page.orders.find((o) => o.id === orderId);
  if (stored === undefined) {
    return orders.some((o) => o.id === orderId) ? refused("That request is not in your division.") : written(null);
  }
  return orderActions(stored.status, page.level).cancel ? written(null) : refused("The team leader has answered this request.");
}
