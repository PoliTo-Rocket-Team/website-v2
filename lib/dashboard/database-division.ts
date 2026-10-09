import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import { divisions, logs, orders, roles, scopes, users } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { privatePathname } from "@/lib/storage/pathname";
import { deletePrivateFile, uploadPrivateFile } from "@/lib/storage/private-store";
import {
  ACCESS_TARGETS,
  checkGiveAccess,
  type AccessGrant,
  type AccessLevel,
  type AccessPerson,
  type AccessTarget,
  type DivisionAccess,
  type HeldAccess,
} from "./division-access";
import { checkNewOrder, checkQuote, parseEuros, type DivisionOrders, type Order, type OrderStatus } from "./orders";
import type { DashboardIdentity } from "./database";
import { refused, written, type Upload, type WriteResult } from "./write";

// The division lead's Access and Orders pages read from and written to the
// database (boards 43 and 44, issue #145). A lead's division is the one their
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

async function readDivisionAccess(identity: DashboardIdentity): Promise<DivisionAccess | null> {
  const division = await leadDivision(identity);
  if (division === null || identity.memberId === null) return null;
  const me = identity.memberId;
  const db = getDb();
  const giver = alias(users, "giver");

  const [mine, rows, team] = await Promise.all([
    db
      .select({ target: scopes.target, level: scopes.accessLevel })
      .from(scopes)
      .where(and(eq(scopes.memberId, me), eq(scopes.scope, "division"), eq(scopes.divisionId, division.id))),
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

  // "all" on a division scope covers each target the page shares.
  const held: HeldAccess[] = ACCESS_TARGETS.flatMap((target) => {
    const levels = mine.filter((m) => m.target === target || m.target === "all").map((m) => m.level);
    if (levels.length === 0) return [];
    return [{ target, level: levels.includes("edit") ? ("edit" as const) : ("view" as const) }];
  });

  const roleOf = new Map(team.map((t) => [t.member_id, t.type]));
  const personOf = (memberId: number, row: { first_name: string | null; last_name: string | null; email: string }): AccessPerson => {
    const type = roleOf.get(memberId);
    return { id: memberId, name: nameOf(row), role: type === "lead" || type === "head" ? "Division lead" : "Member" };
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

async function giveAccess(identity: DashboardIdentity, input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  const access = await readDivisionAccess(identity);
  if (access === null || identity.memberId === null) return refused("Only a division lead gives access here.");
  const checked = checkGiveAccess(access, input);
  if (!checked.ok) return refused(checked.error);
  const { personId, targets, level } = checked.value;
  const divisionId = access.division.id;
  const givenBy = identity.memberId;

  // One grant per person, target and division: a new level replaces the old.
  await runAuditBatch((db) => [
    db
      .delete(scopes)
      .where(
        and(
          eq(scopes.memberId, personId),
          eq(scopes.scope, "division"),
          eq(scopes.divisionId, divisionId),
          inArray(scopes.target, [...targets]),
        ),
      ),
    db.insert(scopes).values(
      targets.map((target) => ({
        memberId: personId,
        givenBy,
        scope: "division" as const,
        target,
        accessLevel: level satisfies AccessLevel,
        divisionId,
      })),
    ),
  ]);

  const after = await readDivisionAccess(identity);
  return written(after?.grants.filter((g) => g.person.id === personId && targets.includes(g.target)) ?? []);
}

async function removeAccess(identity: DashboardIdentity, grantId: number): Promise<WriteResult<null>> {
  const access = await readDivisionAccess(identity);
  if (access === null) return refused("Only a division lead removes access here.");
  if (!access.grants.some((g) => g.id === grantId)) return refused("That access is not in your division.");
  await runAuditQuery((db) => db.delete(scopes).where(eq(scopes.id, grantId)));
  return written(null);
}

const statusOf: Readonly<Record<(typeof orders.$inferSelect)["status"], OrderStatus>> = {
  pending: "waiting",
  accepted: "ordered",
  rejected: "declined",
};

type OrderRow = {
  id: number;
  status: (typeof orders.$inferSelect)["status"];
  name: string | null;
  reason: string | null;
  description: string | null;
  quantity: number | null;
  price: string | null;
  created_at: string;
  quote_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

// `orders.description` holds the shop link; `orders.price` the price of one,
// without IVA; `orders.quote_name` the quote's pathname in the private store.
function orderOf(r: OrderRow): Order {
  return {
    id: r.id,
    item: r.name ?? "Unnamed item",
    reason: r.reason,
    link: r.description,
    requestedBy: r.email === null ? "" : nameOf({ first_name: r.first_name, last_name: r.last_name, email: r.email }),
    unitPrice: r.price === null ? 0 : (parseEuros(r.price) ?? 0),
    quantity: r.quantity ?? 1,
    shipping: null,
    status: statusOf[r.status],
    requestedOn: r.created_at.slice(0, 10),
    quote: r.quote_name?.split("/").pop() ?? null,
  };
}

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
    first_name: users.firstName,
    last_name: users.lastName,
    email: users.email,
  };
}

async function readDivisionOrders(identity: DashboardIdentity): Promise<DivisionOrders | null> {
  const division = await leadDivision(identity);
  if (division === null) return null;
  const db = getDb();
  // Everyone who has held a role in the division, so a person who left keeps their orders here.
  const requesters = db.selectDistinct({ id: roles.memberId }).from(roles).where(eq(roles.divisionId, division.id));
  const rows = await db
    .select(orderColumns())
    .from(orders)
    .leftJoin(users, eq(users.member, orders.requester))
    .where(inArray(orders.requester, requesters))
    .orderBy(desc(orders.createdAt));
  return { division, year: new Date().getUTCFullYear(), orders: rows.map(orderOf) };
}

async function placeOrder(
  identity: DashboardIdentity,
  fields: Record<string, string>,
  quote: Upload | null,
): Promise<WriteResult<Order>> {
  const division = await leadDivision(identity);
  if (division === null || identity.memberId === null) return refused("Only a division lead sends orders here.");
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

  const order = checked.value;
  const pathname = quote === null ? null : privatePathname("order", `${randomUUID()}.pdf`);
  if (pathname !== null && quote !== null) await uploadPrivateFile(pathname, quote.bytes, "application/pdf");
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
        .returning({ id: orders.id, created_at: orders.createdAt, status: orders.status }),
    );
    return written({
      id: row.id,
      ...order,
      requestedBy: identity.name,
      shipping: null,
      status: statusOf[row.status],
      requestedOn: row.created_at.slice(0, 10),
      quote: quote?.name ?? null,
    });
  } catch (error) {
    if (pathname !== null) await deletePrivateFile(pathname).catch(() => undefined);
    throw error;
  }
}

/** The Access and Orders methods of the database side of the data interface. */
export function databaseDivisionPages(identity: DashboardIdentity) {
  return {
    divisionAccess: () => readDivisionAccess(identity),
    giveAccess: (input: unknown) => giveAccess(identity, input),
    removeAccess: (grantId: number) => removeAccess(identity, grantId),
    divisionOrders: () => readDivisionOrders(identity),
    placeOrder: (fields: Record<string, string>, quote: Upload | null) => placeOrder(identity, fields, quote),
  };
}
