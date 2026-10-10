import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import { divisions, logs, orders, roles, scopes, users } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { privatePathname, type PrivatePathname } from "@/lib/storage/pathname";
import { deletePrivateFile, uploadPrivateFile } from "@/lib/storage/private-store";
import {
  ACCESS_TARGETS,
  checkRemoveAllAccess,
  checkSaveAccess,
  heldLevel,
  type AccessGrant,
  type AccessLevel,
  type AccessPerson,
  type AccessTarget,
  type AccessWrite,
  type DivisionAccess,
  type HeldAccess,
} from "./division-access";
import {
  checkNewOrder,
  checkQuote,
  orderActions,
  parseEuros,
  stateAfterEdit,
  type DivisionOrders,
  type NewOrder,
  type Order,
  type OrderState,
  type StoredOrderStatus,
} from "./orders";
import type { DashboardIdentity } from "./database";
import { refused, written, type Upload, type WriteResult } from "./write";

// The division lead's Access and Orders pages read from and written to the
// database (boards 43 and 44, issue #145; Dashboard v2 boards 60 to 61d,
// issue #172). A lead's division is the one their
// lead role sits in, else the first division their scopes cover. Reads follow
// .patterns/drizzle-reads.md; writes follow .patterns/audited-mutations.md
// and check the lead's access on the server before they run.

function nameOf(row: { first_name: string | null; last_name: string | null; email: string }): string {
  return [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email;
}

/** The one division a lead's Access and Orders pages are about; null for anyone else. */
async function leadDivision(identity: DashboardIdentity): Promise<{ id: number; name: string } | null> {
  if (identity.kind !== "division-lead" || identity.memberId === null) return null;
  const roleDivision = identity.role?.divisionId ?? null;
  const id = roleDivision !== null && identity.divisionIds.includes(roleDivision) ? roleDivision : identity.divisionIds[0];
  if (id === undefined) return null;
  const [row] = await getDb()
    .select({ id: divisions.id, name: divisions.name })
    .from(divisions)
    .where(and(eq(divisions.id, id), isNull(divisions.closedAt)))
    .limit(1);
  return row ?? null;
}

function isTarget(value: string): value is AccessTarget {
  return (ACCESS_TARGETS as readonly string[]).includes(value);
}

/** What the member holds in the division, area by area: "all" on a division scope covers each area. */
async function readHeld(memberId: number, divisionId: number): Promise<HeldAccess[]> {
  const mine = await getDb()
    .select({ target: scopes.target, level: scopes.accessLevel })
    .from(scopes)
    .where(and(eq(scopes.memberId, memberId), eq(scopes.scope, "division"), eq(scopes.divisionId, divisionId)));
  return ACCESS_TARGETS.flatMap((target) => {
    const levels = mine.filter((m) => m.target === target || m.target === "all").map((m) => m.level);
    if (levels.length === 0) return [];
    return [{ target, level: levels.includes("edit") ? ("edit" as const) : ("view" as const) }];
  });
}

async function readDivisionAccess(identity: DashboardIdentity): Promise<DivisionAccess | null> {
  const division = await leadDivision(identity);
  if (division === null || identity.memberId === null) return null;
  const me = identity.memberId;
  const db = getDb();
  const giver = alias(users, "giver");

  const [held, rows, team] = await Promise.all([
    readHeld(me, division.id),
    db
      .select({
        id: scopes.id,
        member_id: scopes.memberId,
        target: scopes.target,
        level: scopes.accessLevel,
        given_by: scopes.givenBy,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
        giver_first_name: giver.firstName,
        giver_last_name: giver.lastName,
        giver_email: giver.email,
      })
      .from(scopes)
      .innerJoin(users, eq(users.member, scopes.memberId))
      .leftJoin(giver, eq(giver.member, scopes.givenBy))
      .where(
        and(
          eq(scopes.scope, "division"),
          eq(scopes.divisionId, division.id),
          ne(scopes.memberId, me),
          inArray(scopes.target, [...ACCESS_TARGETS]),
        ),
      )
      .orderBy(desc(scopes.id)),
    db
      .select({
        member_id: roles.memberId,
        type: roles.type,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
      })
      .from(roles)
      .innerJoin(users, eq(users.member, roles.memberId))
      .where(and(eq(roles.divisionId, division.id), isNull(roles.leavedAt))),
  ]);

  const roleOf = new Map(team.map((t) => [t.member_id, t.type]));
  const personOf = (memberId: number, row: { first_name: string | null; last_name: string | null; email: string }): AccessPerson => {
    const type = roleOf.get(memberId);
    return { id: memberId, name: nameOf(row), standing: type === "lead" || type === "head" ? "lead" : "member" };
  };

  const ids = rows.map((r) => String(r.id));
  const given =
    ids.length === 0
      ? []
      : await db
          .select({ record_id: logs.recordId, changed_at: logs.changedAt })
          .from(logs)
          .where(and(eq(logs.tableName, "scopes"), eq(logs.operation, "INSERT"), inArray(logs.recordId, ids)));
  const givenOn = new Map(given.map((g) => [g.record_id, g.changed_at.slice(0, 10)]));

  const grants = rows.flatMap((r): AccessGrant[] => {
    if (r.member_id === null || !isTarget(r.target)) return [];
    const givenBy =
      r.given_by === null
        ? null
        : r.given_by === me
          ? "You"
          : r.giver_email === null
            ? null
            : nameOf({ first_name: r.giver_first_name, last_name: r.giver_last_name, email: r.giver_email });
    return [
      {
        id: r.id,
        person: personOf(r.member_id, r),
        target: r.target,
        level: r.level,
        givenBy,
        givenOn: givenOn.get(String(r.id)) ?? null,
      },
    ];
  });

  const people = team
    .flatMap((t) => (t.member_id === null || t.member_id === me ? [] : [personOf(t.member_id, t)]))
    .filter((p, i, all) => all.findIndex((q) => q.id === p.id) === i)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { division, held, grants, people };
}

/**
 * Writes a checked change to one person's access in one audited batch: one
 * grant per person, area and division, so a level change replaces the old
 * grant and a removal deletes it. Answers the person's grants as they now read.
 */
async function writeAccess(
  identity: DashboardIdentity,
  access: DivisionAccess,
  { personId, changes }: AccessWrite,
): Promise<WriteResult<readonly AccessGrant[]>> {
  if (identity.memberId === null) return refused("Only a division lead gives access here.");
  const divisionId = access.division.id;
  const givenBy = identity.memberId;
  // An added area has no grant yet, so clearing every changed area deletes
  // only the grants a level change or a removal replaces.
  const touched = changes.map((c) => c.target);
  const given = changes.flatMap((c) => (c.kind === "remove" ? [] : [{ target: c.target, level: c.to }]));

  if (changes.length > 0) {
    await runAuditBatch((db) => [
      db
        .delete(scopes)
        .where(
          and(
            eq(scopes.memberId, personId),
            eq(scopes.scope, "division"),
            eq(scopes.divisionId, divisionId),
            inArray(scopes.target, touched),
          ),
        ),
      ...(given.length === 0
        ? []
        : [
            db.insert(scopes).values(
              given.map(({ target, level }) => ({
                memberId: personId,
                givenBy,
                scope: "division" as const,
                target,
                accessLevel: level satisfies AccessLevel,
                divisionId,
              })),
            ),
          ]),
    ]);
  }

  const after = await readDivisionAccess(identity);
  return written(after?.grants.filter((g) => g.person.id === personId) ?? []);
}

async function saveAccess(identity: DashboardIdentity, input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  const access = await readDivisionAccess(identity);
  if (access === null) return refused("Only a division lead gives access here.");
  const checked = checkSaveAccess(access, input);
  return checked.ok ? writeAccess(identity, access, checked.value) : refused(checked.error);
}

async function removeAllAccess(identity: DashboardIdentity, personId: number): Promise<WriteResult<null>> {
  const access = await readDivisionAccess(identity);
  if (access === null) return refused("Only a division lead removes access here.");
  const checked = checkRemoveAllAccess(access, personId);
  if (!checked.ok) return refused(checked.error);
  const result = await writeAccess(identity, access, checked.value);
  return result.ok ? written(null) : result;
}

type DbOrderStatus = (typeof orders.$inferSelect)["status"];

const statusOf: Readonly<Record<DbOrderStatus, StoredOrderStatus>> = {
  pending: "waiting",
  accepted: "approved",
  rejected: "rejected",
  changes_requested: "changes-requested",
  cancelled: "cancelled",
};

type OrderRow = {
  id: number;
  status: DbOrderStatus;
  name: string | null;
  reason: string | null;
  description: string | null;
  quantity: number | null;
  price: string | null;
  created_at: string;
  quote_name: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  reviewer_first_name: string | null;
  reviewer_last_name: string | null;
  reviewer_email: string | null;
};

/** A stored request's state on the page; null for a cancelled one, which the page does not list. */
function stateOf(r: OrderRow): OrderState | null {
  const status = statusOf[r.status];
  if (status === "cancelled") return null;
  if (status !== "changes-requested") return { status };
  const by = r.reviewer_email === null ? "The team leader" : nameOf({ first_name: r.reviewer_first_name, last_name: r.reviewer_last_name, email: r.reviewer_email });
  return { status, changes: { reason: r.review_note ?? "", by, on: (r.reviewed_at ?? r.created_at).slice(0, 10) } };
}

// `orders.description` holds the shop link; `orders.price` the price of one,
// without IVA; `orders.quote_name` the quote's pathname in the private store,
// which no route serves yet, so the quote shows by name only.
function orderOf(r: OrderRow): Order[] {
  const state = stateOf(r);
  if (state === null) return [];
  return [
    {
      ...state,
      id: r.id,
      item: r.name ?? "Unnamed item",
      reason: r.reason,
      link: r.description,
      requestedBy: r.email === null ? "" : nameOf({ first_name: r.first_name, last_name: r.last_name, email: r.email }),
      unitPrice: r.price === null ? 0 : (parseEuros(r.price) ?? 0),
      quantity: r.quantity ?? 1,
      shipping: null,
      requestedOn: r.created_at.slice(0, 10),
      quote: r.quote_name === null ? null : { name: r.quote_name.split("/").pop() ?? r.quote_name, size: null, href: null },
    },
  ];
}

const reviewer = alias(users, "reviewer");

function orderColumns() {
  return {
    id: orders.id,
    status: orders.status,
    name: orders.name,
    reason: orders.reason,
    description: orders.description,
    quantity: orders.quantity,
    price: orders.price,
    created_at: orders.createdAt,
    quote_name: orders.quoteName,
    review_note: orders.reviewNote,
    reviewed_at: orders.reviewedAt,
    first_name: users.firstName,
    last_name: users.lastName,
    email: users.email,
    reviewer_first_name: reviewer.firstName,
    reviewer_last_name: reviewer.lastName,
    reviewer_email: reviewer.email,
  };
}

/** Everyone who has held a role in the division, so a person who left keeps their orders there. */
function requestersOf(divisionId: number) {
  return getDb().selectDistinct({ id: roles.memberId }).from(roles).where(eq(roles.divisionId, divisionId));
}

async function readOrderRows(divisionId: number, orderId?: number): Promise<OrderRow[]> {
  return getDb()
    .select(orderColumns())
    .from(orders)
    .leftJoin(users, eq(users.member, orders.requester))
    .leftJoin(reviewer, eq(reviewer.member, orders.reviewedBy))
    .where(
      and(
        inArray(orders.requester, requestersOf(divisionId)),
        orderId === undefined ? undefined : eq(orders.id, orderId),
      ),
    )
    .orderBy(desc(orders.createdAt));
}

/**
 * The division whose orders the viewer reaches, and their level on Orders
 * there (issue #213): an `orders` grant, or a division scope on `all`. Null
 * for someone who holds no Orders access.
 */
async function ordersAccess(identity: DashboardIdentity): Promise<{ division: { id: number; name: string }; level: AccessLevel } | null> {
  const division = await leadDivision(identity);
  if (division === null || identity.memberId === null) return null;
  const level = heldLevel(await readHeld(identity.memberId, division.id), "orders");
  return level === null ? null : { division, level };
}

/** The division the viewer sends and changes orders in; a reason when they may not. */
async function orderingDivision(identity: DashboardIdentity): Promise<{ id: number; name: string } | string> {
  const reach = await ordersAccess(identity);
  if (reach === null) return "You do not have access to Orders.";
  return reach.level === "edit" ? reach.division : "You can view orders but not request or change them.";
}

async function readDivisionOrders(identity: DashboardIdentity): Promise<DivisionOrders | null> {
  const reach = await ordersAccess(identity);
  if (reach === null) return null;
  return { ...reach, orders: (await readOrderRows(reach.division.id)).flatMap(orderOf) };
}

/** The New order or Edit order fields and quote, checked again on the server. */
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

/** Stores a quote in the private store; null when none was sent. */
async function storeQuote(quote: Upload | null): Promise<PrivatePathname | null> {
  if (quote === null) return null;
  const pathname = privatePathname("order", `${randomUUID()}.pdf`);
  await uploadPrivateFile(pathname, quote.bytes, "application/pdf");
  return pathname;
}

async function placeOrder(
  identity: DashboardIdentity,
  fields: Record<string, string>,
  quote: Upload | null,
): Promise<WriteResult<Order>> {
  const division = await orderingDivision(identity);
  if (typeof division === "string") return refused(division);
  if (identity.memberId === null) return refused("Only a team member sends orders here.");
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);

  const order = checked.value;
  const pathname = await storeQuote(quote);
  const requester = identity.memberId;
  try {
    const [row] = await runAuditQuery((db) =>
      db
        .insert(orders)
        .values({
          requester,
          name: order.item,
          description: order.link,
          reason: order.reason,
          quantity: order.quantity,
          price: (order.unitPrice / 100).toFixed(2),
          quoteName: pathname,
        })
        .returning({ id: orders.id }),
    );
    const [placed] = (await readOrderRows(division.id, row.id)).flatMap(orderOf);
    return written(placed);
  } catch (error) {
    if (pathname !== null) await deletePrivateFile(pathname).catch(() => undefined);
    throw error;
  }
}

/** A guarded order write that changed no row: the request moved on since the page read it. */
const ORDER_CHANGED = "This request changed. Reload the page.";

/** The request as stored, when it is one of the lead's division's and still on the page. */
async function divisionOrder(identity: DashboardIdentity, orderId: number): Promise<{ divisionId: number; order: Order } | string> {
  const division = await orderingDivision(identity);
  if (typeof division === "string") return division;
  const [order] = (await readOrderRows(division.id, orderId)).flatMap(orderOf);
  return order === undefined ? "That request is not in your division." : { divisionId: division.id, order };
}

async function editOrder(
  identity: DashboardIdentity,
  orderId: number,
  fields: Record<string, string>,
  quote: Upload | null,
): Promise<WriteResult<Order>> {
  const found = await divisionOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  if (stateAfterEdit(found.order.status) === null) return refused("The team leader has answered this request.");
  const checked = checkedOrder(fields, quote);
  if (!checked.ok) return refused(checked.error);

  const order = checked.value;
  const pathname = await storeQuote(quote);
  let changed: { id: number }[];
  try {
    // Back to waiting for the team leader, with their earlier answer cleared.
    changed = await runAuditQuery((db) =>
      db
        .update(orders)
        .set({
          name: order.item,
          description: order.link,
          reason: order.reason,
          quantity: order.quantity,
          price: (order.unitPrice / 100).toFixed(2),
          status: "pending",
          reviewNote: null,
          reviewedBy: null,
          reviewedAt: null,
          ...(pathname === null ? {} : { quoteName: pathname }),
        })
        .where(and(eq(orders.id, orderId), inArray(orders.status, ["pending", "changes_requested"])))
        .returning({ id: orders.id }),
    );
  } catch (error) {
    if (pathname !== null) await deletePrivateFile(pathname).catch(() => undefined);
    throw error;
  }
  // The team leader answered between the read and the write: nothing saved, so the new quote points nowhere.
  if (changed.length === 0) {
    if (pathname !== null) await deletePrivateFile(pathname).catch(() => undefined);
    return refused(ORDER_CHANGED);
  }
  const [edited] = (await readOrderRows(found.divisionId, orderId)).flatMap(orderOf);
  return edited === undefined ? refused("The team leader has answered this request.") : written(edited);
}

async function cancelOrder(identity: DashboardIdentity, orderId: number): Promise<WriteResult<null>> {
  const found = await divisionOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  if (!orderActions(found.order.status, "edit").cancel) return refused("The team leader has answered this request.");
  const changed = await runAuditQuery((db) =>
    db
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id }),
  );
  return changed.length === 0 ? refused(ORDER_CHANGED) : written(null);
}

/** The Access and Orders methods of the database side of the data interface. */
export function databaseDivisionPages(identity: DashboardIdentity) {
  return {
    divisionAccess: () => readDivisionAccess(identity),
    saveAccess: (input: unknown) => saveAccess(identity, input),
    removeAllAccess: (personId: number) => removeAllAccess(identity, personId),
    divisionOrders: () => readDivisionOrders(identity),
    placeOrder: (fields: Record<string, string>, quote: Upload | null) => placeOrder(identity, fields, quote),
    editOrder: (orderId: number, fields: Record<string, string>, quote: Upload | null) =>
      editOrder(identity, orderId, fields, quote),
    cancelOrder: (orderId: number) => cancelOrder(identity, orderId),
  };
}
