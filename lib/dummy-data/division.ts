import { randomInt } from "node:crypto";
import {
  ACCESS_TARGETS,
  checkGiveAccess,
  checkRemoveAccess,
  type AccessGrant,
  type AccessLevel,
  type AccessPerson,
  type AccessTarget,
  type DivisionAccess,
} from "@/lib/dashboard/division-access";
import { checkNewOrder, checkQuote, type DivisionOrders, type Order, type OrderStatus } from "@/lib/dashboard/orders";
import { divisionIdOf } from "@/lib/dashboard/team";
import { refused, written, type Upload, type WriteResult } from "@/lib/dashboard/write";
import { divisions, people, type DummyPerson } from "./team";

// The division lead's Access and Orders pages for the test developer (boards
// 43 and 44, issue #145). The lead is Marco Bianchi, Mission Analysis.

export type DummyHeldAccess = {
  readonly personId: number;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

/** What each lead holds in their own division ("Your access" on board 43). */
export const heldAccess = [
  { personId: 2, target: "positions", level: "edit" },
  { personId: 2, target: "applications", level: "edit" },
  { personId: 2, target: "members", level: "edit" },
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

export const accessGrants = [
  { id: 1, personId: 3, divisionId: 1, target: "applications", level: "view", givenById: 2, givenOn: "2026-10-02" },
  { id: 2, personId: 4, divisionId: 1, target: "positions", level: "edit", givenById: 2, givenOn: "2026-09-28" },
  { id: 3, personId: 3, divisionId: 1, target: "members", level: "view", givenById: 2, givenOn: "2026-10-02" },
] as const satisfies readonly DummyGrant[];

export type DummyOrder = {
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
  readonly status: OrderStatus;
  readonly requestedOn: string;
};

/** The year the dummy orders' "This year" counts. */
export const ordersYear = 2026;

export const orders = [
  { id: 1, divisionId: 1, requesterId: 2, item: "Steel wire", reason: "For the launch rail", link: "https://amzn.eu/d/076iqsM1", unitPrice: 5955, quantity: 2, shipping: null, status: "waiting", requestedOn: "2026-10-08" },
  { id: 2, divisionId: 1, requesterId: 2, item: "CO2 cartridges", reason: "Ejection tests at Roccaraso", link: null, unitPrice: 12480, quantity: 1, shipping: null, status: "waiting", requestedOn: "2026-10-07" },
  { id: 3, divisionId: 1, requesterId: 3, item: "Mini 3-ring system", reason: "Recovery bay mock-up", link: null, unitPrice: 15000, quantity: 1, shipping: 1330, status: "waiting", requestedOn: "2026-10-06" },
  { id: 4, divisionId: 1, requesterId: 2, item: "Loctite", reason: "Launch rail screws", link: null, unitPrice: 1180, quantity: 3, shipping: null, status: "ordered", requestedOn: "2026-10-01" },
  { id: 5, divisionId: 1, requesterId: 4, item: "M4 heated inserts", reason: "Roccaraso launch", link: null, unitPrice: 2300, quantity: 3, shipping: null, status: "ordered", requestedOn: "2026-09-29" },
  { id: 6, divisionId: 1, requesterId: 3, item: "Concave mirror", reason: "Optical test bench", link: null, unitPrice: 4824, quantity: 1, shipping: null, status: "delivered", requestedOn: "2026-09-22" },
  { id: 7, divisionId: 1, requesterId: 4, item: "Carbon fibre tube, 100 mm", reason: "Airframe test section", link: null, unitPrice: 42000, quantity: 1, shipping: null, status: "delivered", requestedOn: "2026-09-10" },
  { id: 8, divisionId: 1, requesterId: 2, item: "StratoLogger CF altimeter", reason: "Dual-deploy backup", link: null, unitPrice: 6490, quantity: 2, shipping: null, status: "delivered", requestedOn: "2026-07-15" },
  { id: 9, divisionId: 1, requesterId: 3, item: "Parachute, 1.2 m", reason: "Main recovery chute", link: null, unitPrice: 18900, quantity: 1, shipping: 1500, status: "delivered", requestedOn: "2026-06-30" },
  { id: 10, divisionId: 1, requesterId: 4, item: "Raspberry Pi 5", reason: "Ground station", link: null, unitPrice: 8990, quantity: 1, shipping: null, status: "delivered", requestedOn: "2026-05-12" },
  { id: 11, divisionId: 1, requesterId: 2, item: "Load cell, 500 kg", reason: "Static fire stand", link: null, unitPrice: 31450, quantity: 1, shipping: null, status: "delivered", requestedOn: "2026-04-03" },
  { id: 12, divisionId: 1, requesterId: 3, item: "Shock cord, 6 m", reason: "Recovery harness", link: null, unitPrice: 2275, quantity: 2, shipping: null, status: "delivered", requestedOn: "2026-03-18" },
  { id: 13, divisionId: 1, requesterId: 4, item: "GPS module", reason: "Telemetry board", link: null, unitPrice: 4890, quantity: 2, shipping: null, status: "delivered", requestedOn: "2026-02-20" },
  { id: 14, divisionId: 1, requesterId: 2, item: "Aluminium plate 6061, 5 mm", reason: "Fin can", link: null, unitPrice: 33000, quantity: 2, shipping: 2671, status: "delivered", requestedOn: "2026-01-27" },
] as const satisfies readonly DummyOrder[];

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

function accessPerson(p: DummyPerson): AccessPerson {
  return { id: p.id, name: p.name, standing: p.placement.role === "member" ? "member" : "lead" };
}

/** Board 43 for a lead; null for anyone who leads no division. */
export function dummyDivisionAccess(lead: DummyPerson): DivisionAccess | null {
  if (lead.placement.role !== "division-lead") return null;
  const divisionId = lead.placement.divisionId;
  const grants = accessGrants
    .filter((g) => g.divisionId === divisionId)
    .map((g): AccessGrant => ({
      id: g.id,
      person: accessPerson(personOf(g.personId)),
      target: g.target,
      level: g.level,
      givenBy: g.givenById === lead.id ? "You" : personOf(g.givenById).name,
      givenOn: g.givenOn,
    }));
  return {
    division: { id: divisionId, name: divisionOf(divisionId).name },
    held: ACCESS_TARGETS.flatMap((target) =>
      heldAccess.filter((h) => h.personId === lead.id && h.target === target).map((h) => ({ target, level: h.level })),
    ),
    grants,
    people: people.filter((p) => divisionIdOf(p.placement) === divisionId && p.id !== lead.id).map(accessPerson),
  };
}

/** Checks the request as the database side does and answers the new rows; nothing is stored. */
export function dummyGiveAccess(lead: DummyPerson, input: unknown): WriteResult<readonly AccessGrant[]> {
  const access = dummyDivisionAccess(lead);
  if (access === null) return refused("Only a division lead gives access here.");
  const checked = checkGiveAccess(access, input);
  if (!checked.ok) return refused(checked.error);
  const person = access.people.find((p) => p.id === checked.value.personId)!;
  const givenOn = today();
  return written(
    checked.value.targets.map((target) => ({
      id: localId(),
      person,
      target,
      level: checked.value.level,
      givenBy: "You",
      givenOn,
    })),
  );
}

/**
 * Checks a removal as the database side does; nothing is stored. A row given
 * on the page lives only in the page's state, so there is no stored grant to
 * check it against, and removing it is allowed.
 */
export function dummyRemoveAccess(lead: DummyPerson, grantId: number): WriteResult<null> {
  const access = dummyDivisionAccess(lead);
  if (access === null) return refused("Only a division lead removes access here.");
  if (!accessGrants.some((g) => g.id === grantId)) return written(null);
  const checked = checkRemoveAccess(access, grantId);
  return checked.ok ? written(null) : refused(checked.error);
}

/** Board 44 for a lead; null for anyone who leads no division. */
export function dummyDivisionOrders(lead: DummyPerson): DivisionOrders | null {
  if (lead.placement.role !== "division-lead") return null;
  const divisionId = lead.placement.divisionId;
  return {
    division: { id: divisionId, name: divisionOf(divisionId).name },
    year: ordersYear,
    orders: orders
      .filter((o) => o.divisionId === divisionId)
      .map((o): Order => ({
        id: o.id,
        item: o.item,
        reason: o.reason,
        link: o.link,
        requestedBy: personOf(o.requesterId).name,
        unitPrice: o.unitPrice,
        quantity: o.quantity,
        shipping: o.shipping,
        status: o.status,
        requestedOn: o.requestedOn,
        quote: null,
      })),
  };
}

export function dummyPlaceOrder(
  lead: DummyPerson,
  fields: Record<string, string>,
  quote: Upload | null,
): WriteResult<Order> {
  if (dummyDivisionOrders(lead) === null) return refused("Only a division lead sends orders here.");
  const checked = checkNewOrder({
    item: fields.item ?? "",
    link: fields.link ?? "",
    price: fields.price ?? "",
    quantity: fields.quantity ?? "",
    reason: fields.reason ?? "",
  });
  if (!checked.ok) return refused(Object.values(checked.errors)[0] ?? "Check the form.");
  if (quote !== null) {
    const error = checkQuote({ type: quote.contentType, size: quote.bytes.byteLength, name: quote.name });
    if (error !== null) return refused(error);
  }
  return written({
    id: localId(),
    ...checked.value,
    requestedBy: lead.name,
    shipping: null,
    status: "waiting",
    requestedOn: today(),
    quote: quote?.name ?? null,
  });
}
