import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db/client";
import { departments, divisions, logs, orders, roles, scopes, users } from "@/db/schema";
import { runAuditBatch, runAuditQuery } from "@/lib/db-audit";
import { privatePathname, type PrivatePathname } from "@/lib/storage/pathname";
import { deletePrivateFile, uploadPrivateFile } from "@/lib/storage/private-store";
import {
  ACCESS_TARGETS,
  checkRemoveAllAccess,
  checkSaveAccess,
  ROLE_HELD_ACCESS,
  type AccessDivision,
  type AccessGrant,
  type AccessLevel,
  type AccessPage,
  type AccessPerson,
  type AccessPlace,
  type AccessTarget,
  type AccessUnit,
  type AccessWrite,
  type HeldAccess,
  type RoleAccess,
} from "./division-access";
import { headDivisionsOf } from "./viewer";
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
  parseEuros,
  stateAfterEdit,
  type EditUnit,
  type NewOrder,
  type Order,
  type OrderDecision,
  type OrdersPage,
  type OrdersScope,
  type OrderState,
  type OrderUnit,
  type OrgDepartmentUnits,
  type StoredOrderStatus,
} from "./orders";
import type { DashboardIdentity } from "./database";
import { refused, written, type Upload, type WriteResult } from "./write";

// The Access pages of a division lead and a department head, and the Orders
// page, read from and written to the database (boards 43 and 44, issue #145;
// Dashboard v2 boards 60 to 61d, issue #172; boards 65 and 65b, issue #230;
// boards 61 to 67b, issue #233). A lead's Access division is the one their
// lead role sits in, else the first division their scopes cover; a head's
// department is their role's. Orders shows every order in the team and checks
// each write against the viewer's scope on the server. Reads follow
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

/** A department head's department and its open divisions, in tab order (issue #230); null for anyone else. */
export async function readHeadDepartment(identity: DashboardIdentity): Promise<{ id: number; name: string; divisions: AccessDivision[] } | null> {
  if (identity.kind !== "department-head") return null;
  const id = identity.role?.departmentId ?? identity.departmentIds[0] ?? null;
  if (id === null) return null;
  const db = getDb();
  const [[department], rows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(and(eq(departments.id, id), isNull(departments.closedAt)))
      .limit(1),
    db
      .select({ id: divisions.id, name: divisions.name, departmentId: divisions.deptId, closedAt: divisions.closedAt })
      .from(divisions)
      .where(eq(divisions.deptId, id)),
  ]);
  if (!department) return null;
  return { ...department, divisions: headDivisionsOf(id, rows).map((d) => ({ id: d.id, name: d.name })) };
}

/** The unit the viewer's Access page is about, and what they hold there; null for anyone with no such page. */
async function accessUnitOf(identity: DashboardIdentity): Promise<{ unit: AccessUnit; held: readonly HeldAccess[] } | null> {
  if (identity.memberId === null) return null;
  if (identity.kind === "division-lead") {
    const division = await leadDivision(identity);
    if (division === null) return null;
    return { unit: { kind: "division", division }, held: await readHeld(identity.memberId, division.id) };
  }
  const department = await readHeadDepartment(identity);
  if (department === null) return null;
  // A head's role holds every area at Can edit across their department (board 65).
  return {
    unit: { kind: "department", department: { id: department.id, name: department.name }, divisions: department.divisions },
    held: ROLE_HELD_ACCESS,
  };
}

function isLeadRole(type: string | null): boolean {
  return type === "lead" || type === "head";
}

/**
 * The Access page (boards 60 and 65): the viewer's unit and what they hold,
 * the other leads with the access their role gives, the grants in the unit
 * (each division's, and on a head's page the department-wide ones), and the
 * people the viewer may give access to.
 */
async function readAccessPage(identity: DashboardIdentity): Promise<AccessPage | null> {
  const found = await accessUnitOf(identity);
  if (found === null || identity.memberId === null) return null;
  const { unit, held } = found;
  const me = identity.memberId;
  const db = getDb();
  const giver = alias(users, "giver");
  const unitDivisions = unit.kind === "division" ? [unit.division] : unit.divisions;
  const divisionIds = unitDivisions.map((d) => d.id);
  const department = unit.kind === "department" ? unit.department : null;
  const inUnitDivisions = and(eq(scopes.scope, "division"), inArray(scopes.divisionId, divisionIds.length ? divisionIds : [-1]));

  const [rows, team] = await Promise.all([
    db
      .select({
        id: scopes.id,
        member_id: scopes.memberId,
        scope: scopes.scope,
        division_id: scopes.divisionId,
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
          department === null
            ? inUnitDivisions
            : or(inUnitDivisions, and(eq(scopes.scope, "department"), eq(scopes.deptId, department.id))),
          ne(scopes.memberId, me),
          inArray(scopes.target, [...ACCESS_TARGETS]),
        ),
      )
      .orderBy(desc(scopes.id)),
    db
      .select({
        member_id: roles.memberId,
        type: roles.type,
        division_id: roles.divisionId,
        first_name: users.firstName,
        last_name: users.lastName,
        email: users.email,
      })
      .from(roles)
      .innerJoin(users, eq(users.member, roles.memberId))
      .where(
        and(
          isNull(roles.leavedAt),
          department === null
            ? inArray(roles.divisionId, divisionIds)
            : or(inArray(roles.divisionId, divisionIds.length ? divisionIds : [-1]), and(eq(roles.deptId, department.id), eq(roles.type, "head"))),
        ),
      ),
  ]);

  // One person per member: a lead in any of their roles stands as a lead, placed in that role's division.
  const byMember = new Map<number, AccessPerson>();
  for (const t of team) {
    if (t.member_id === null) continue;
    const lead = isLeadRole(t.type);
    const division = unitDivisions.find((d) => d.id === t.division_id) ?? null;
    const known = byMember.get(t.member_id);
    if (known !== undefined && (known.standing === "lead" || !lead)) continue;
    byMember.set(t.member_id, { id: t.member_id, name: nameOf(t), standing: lead ? "lead" : "member", division: division ?? known?.division ?? null });
  }
  const personOf = (memberId: number, row: { first_name: string | null; last_name: string | null; email: string }): AccessPerson =>
    byMember.get(memberId) ?? { id: memberId, name: nameOf(row), standing: "member", division: null };

  const roleAccess = [...byMember.values()].flatMap((person): RoleAccess[] => {
    if (person.id === me || person.standing !== "lead") return [];
    if (person.division !== null) return [{ person, place: { kind: "division", division: person.division } }];
    return department === null ? [] : [{ person, place: { kind: "department", department } }];
  });

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
    const person = personOf(r.member_id, r);
    // A lead's access comes with the role: their row is in `roleAccess`.
    if (person.standing === "lead") return [];
    const division = unitDivisions.find((d) => d.id === r.division_id);
    const place: AccessPlace | null =
      r.scope === "department" && department !== null
        ? { kind: "department", department }
        : division === undefined
          ? null
          : { kind: "division", division };
    if (place === null) return [];
    const givenBy =
      r.given_by === null
        ? null
        : r.given_by === me
          ? "You"
          : r.giver_email === null
            ? null
            : nameOf({ first_name: r.giver_first_name, last_name: r.giver_last_name, email: r.giver_email });
    return [{ id: r.id, person, place, target: r.target, level: r.level, givenBy, givenOn: givenOn.get(String(r.id)) ?? null }];
  });

  const people = [...byMember.values()].filter((p) => p.id !== me).sort((a, b) => a.name.localeCompare(b.name));

  return { unit, held, roleAccess, grants, people };
}

/** The `scopes` rows one place holds: a division's, or a department's own (only `dept_id` set). */
function placeColumns(place: AccessPlace) {
  return place.kind === "division"
    ? { scope: "division" as const, deptId: null, divisionId: place.division.id }
    : { scope: "department" as const, deptId: place.department.id, divisionId: null };
}

/**
 * Writes checked changes to one person's access in one audited batch: one
 * grant per person, area and place, so a level change replaces the old grant
 * and a removal deletes it. Answers the person's grants as they now read.
 */
async function writeAccess(identity: DashboardIdentity, personId: number, writes: readonly AccessWrite[]): Promise<WriteResult<readonly AccessGrant[]>> {
  if (identity.memberId === null) return refused("Only a division lead or a department head gives access here.");
  const givenBy = identity.memberId;
  const statements = writes.filter((w) => w.changes.length > 0);

  if (statements.length > 0) {
    await runAuditBatch((db) => {
      const [first, ...rest] = statements.flatMap(({ place, changes }) => {
        const columns = placeColumns(place);
        // An added area has no grant yet, so clearing every changed area deletes
        // only the grants a level change or a removal replaces.
        const touched = changes.map((c) => c.target);
        const given = changes.flatMap((c) => (c.kind === "remove" ? [] : [{ target: c.target, level: c.to }]));
        const where =
          columns.scope === "division"
            ? and(eq(scopes.scope, "division"), eq(scopes.divisionId, columns.divisionId))
            : and(eq(scopes.scope, "department"), eq(scopes.deptId, columns.deptId), isNull(scopes.divisionId));
        return [
          db.delete(scopes).where(and(eq(scopes.memberId, personId), where, inArray(scopes.target, touched))),
          ...(given.length === 0
            ? []
            : [
                db.insert(scopes).values(
                  given.map(({ target, level }) => ({
                    memberId: personId,
                    givenBy,
                    scope: columns.scope,
                    target,
                    accessLevel: level satisfies AccessLevel,
                    deptId: columns.deptId,
                    divisionId: columns.divisionId,
                  })),
                ),
              ]),
        ];
      });
      // Every write with a change deletes first, so the batch is never empty.
      return [first!, ...rest];
    });
  }

  const after = await readAccessPage(identity);
  return written(after?.grants.filter((g) => g.person.id === personId) ?? []);
}

async function saveAccess(identity: DashboardIdentity, input: unknown): Promise<WriteResult<readonly AccessGrant[]>> {
  const access = await readAccessPage(identity);
  if (access === null) return refused("Only a division lead or a department head gives access here.");
  const checked = checkSaveAccess(access, input);
  return checked.ok ? writeAccess(identity, checked.value.personId, [checked.value]) : refused(checked.error);
}

async function removeAllAccess(identity: DashboardIdentity, personId: number): Promise<WriteResult<null>> {
  const access = await readAccessPage(identity);
  if (access === null) return refused("Only a division lead or a department head removes access here.");
  const checked = checkRemoveAllAccess(access, personId);
  if (!checked.ok) return refused(checked.error);
  const result = await writeAccess(identity, personId, checked.value);
  return result.ok ? written(null) : result;
}

/** Every open department and its open divisions, by name: the Department filter (board 67b) and New order read it. */
async function readOrgUnits(): Promise<OrgDepartmentUnits[]> {
  const db = getDb();
  const [deps, divs] = await Promise.all([
    db.select({ id: departments.id, name: departments.name }).from(departments).where(isNull(departments.closedAt)),
    db
      .select({ id: divisions.id, name: divisions.name, department_id: divisions.deptId })
      .from(divisions)
      .where(isNull(divisions.closedAt)),
  ]);
  return deps
    .map((d) => ({
      id: d.id,
      name: d.name,
      divisions: divs
        .filter((v) => v.department_id === d.id)
        .map((v) => ({ id: v.id, name: v.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Whether the viewer holds the team leader's role now. */
function isTeamLeader(identity: DashboardIdentity): boolean {
  return identity.roles.some((r) => r.type === "president");
}

/**
 * The viewer's Orders scope (issue #233), or null when they hold no Orders
 * access anywhere. A `division` or `department` scope row on `orders` (or on
 * `all`) is access there, at its level; a head's role is Can edit across
 * their department (board 65). Deciding comes from being the team leader,
 * or from a `team` row on `approve_orders`.
 */
async function readOrdersScope(identity: DashboardIdentity, org: readonly OrgDepartmentUnits[]): Promise<OrdersScope | null> {
  if (identity.memberId === null || identity.kind === "non-member") return null;
  const [rows, headDepartment] = await Promise.all([
    getDb()
      .select({ scope: scopes.scope, target: scopes.target, level: scopes.accessLevel, division_id: scopes.divisionId, dept_id: scopes.deptId })
      .from(scopes)
      .where(eq(scopes.memberId, identity.memberId)),
    readHeadDepartment(identity),
  ]);
  const ordersRows = rows.filter((r) => (r.scope === "division" || r.scope === "department") && (r.target === "orders" || r.target === "all"));
  const decides = decideRightOf({
    teamLeader: isTeamLeader(identity),
    approveOrders: rows.some((r) => r.scope === "team" && r.target === "approve_orders"),
  });

  const edits: EditUnit[] = [];
  const add = (unit: EditUnit) => {
    const key = (u: EditUnit) => (u.kind === "division" ? `v${u.division.id}` : `d${u.department.id}`);
    if (!edits.some((e) => key(e) === key(unit))) edits.push(unit);
  };
  if (headDepartment !== null) add({ kind: "department", department: { id: headDepartment.id, name: headDepartment.name } });
  for (const r of ordersRows) {
    if (r.level !== "edit") continue;
    if (r.scope === "department") {
      const department = org.find((d) => d.id === r.dept_id);
      if (department) add({ kind: "department", department: { id: department.id, name: department.name } });
    } else {
      const division = org.flatMap((d) => d.divisions).find((d) => d.id === r.division_id);
      if (division) add({ kind: "division", division });
    }
  }
  if (headDepartment === null && ordersRows.length === 0 && decides === null) return null;
  return { edits, decides };
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
  division_id: number | null;
  division_name: string | null;
  department_id: number | null;
  department_name: string | null;
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

function unitOf(r: OrderRow): OrderUnit | null {
  if (r.division_id === null || r.division_name === null) return null;
  return {
    division: { id: r.division_id, name: r.division_name },
    department: r.department_id === null || r.department_name === null ? null : { id: r.department_id, name: r.department_name },
  };
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
      unit: unitOf(r),
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
    division_id: divisions.id,
    division_name: divisions.name,
    department_id: departments.id,
    department_name: departments.name,
    first_name: users.firstName,
    last_name: users.lastName,
    email: users.email,
    reviewer_first_name: reviewer.firstName,
    reviewer_last_name: reviewer.lastName,
    reviewer_email: reviewer.email,
  };
}

/** Orders as the page reads them: every order in the team, or only the given divisions', or one order. */
async function readOrderRows(where: { divisionIds?: readonly number[]; orderId?: number } = {}): Promise<OrderRow[]> {
  return getDb()
    .select(orderColumns())
    .from(orders)
    .leftJoin(users, eq(users.member, orders.requester))
    .leftJoin(reviewer, eq(reviewer.member, orders.reviewedBy))
    .leftJoin(divisions, eq(divisions.id, orders.divisionId))
    .leftJoin(departments, eq(departments.id, divisions.deptId))
    .where(
      and(
        where.divisionIds === undefined ? undefined : inArray(orders.divisionId, where.divisionIds.length ? [...where.divisionIds] : [-1]),
        where.orderId === undefined ? undefined : eq(orders.id, where.orderId),
      ),
    )
    .orderBy(desc(orders.createdAt), desc(orders.id));
}

/** Every request made for the given divisions: a division lead's and a department head's Overview count the waiting ones (boards 56 and 62). */
export async function readOrdersIn(divisionIds: readonly number[]): Promise<Order[]> {
  return (await readOrderRows({ divisionIds })).flatMap(orderOf);
}

/** The Orders page (issue #233): every order in the team, for anyone with Orders access; null for anyone else. */
async function readOrdersPage(identity: DashboardIdentity): Promise<OrdersPage | null> {
  const org = await readOrgUnits();
  const scope = await readOrdersScope(identity, org);
  if (scope === null) return null;
  return ordersPageFor(scope, org, (await readOrderRows()).flatMap(orderOf));
}

/** The viewer's scope and one stored request, or why there is nothing to act on. */
async function scopedOrder(identity: DashboardIdentity, orderId: number): Promise<{ scope: OrdersScope; order: Order } | string> {
  const scope = await readOrdersScope(identity, await readOrgUnits());
  if (scope === null) return "You do not have access to Orders.";
  const [order] = (await readOrderRows({ orderId })).flatMap(orderOf);
  return order === undefined ? "That request is no longer on the page." : { scope, order };
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
  if (identity.memberId === null) return refused("Only a team member sends orders here.");
  const org = await readOrgUnits();
  const scope = await readOrdersScope(identity, org);
  if (scope === null) return refused("You do not have access to Orders.");
  const division = checkOrderDivision(orderingDivisions(scope, org), fields.division);
  if (!division.ok) return refused(division.error);
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
          divisionId: division.value.id,
          name: order.item,
          description: order.link,
          reason: order.reason,
          quantity: order.quantity,
          price: (order.unitPrice / 100).toFixed(2),
          quoteName: pathname,
        })
        .returning({ id: orders.id }),
    );
    const [placed] = (await readOrderRows({ orderId: row.id })).flatMap(orderOf);
    return written(placed);
  } catch (error) {
    if (pathname !== null) await deletePrivateFile(pathname).catch(() => undefined);
    throw error;
  }
}

/** A guarded order write that changed no row: the request moved on since the page read it. */
const ORDER_CHANGED = "This request changed. Reload the page.";

const OUT_OF_SCOPE = "This order is outside your division or department, so it is read-only for you.";

async function editOrder(
  identity: DashboardIdentity,
  orderId: number,
  fields: Record<string, string>,
  quote: Upload | null,
): Promise<WriteResult<Order>> {
  const found = await scopedOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  if (!canEditOrder(found.scope, found.order)) return refused(OUT_OF_SCOPE);
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
  const [edited] = (await readOrderRows({ orderId })).flatMap(orderOf);
  return edited === undefined ? refused("The team leader has answered this request.") : written(edited);
}

async function cancelOrder(identity: DashboardIdentity, orderId: number): Promise<WriteResult<null>> {
  const found = await scopedOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  if (!canEditOrder(found.scope, found.order)) return refused(OUT_OF_SCOPE);
  if (!orderActions(found.scope, found.order).cancel) return refused("The team leader has answered this request.");
  const changed = await runAuditQuery((db) =>
    db
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id }),
  );
  return changed.length === 0 ? refused(ORDER_CHANGED) : written(null);
}

const DB_STATUS_AFTER: Readonly<Record<OrderDecision["kind"], DbOrderStatus>> = {
  approve: "accepted",
  reject: "rejected",
  "ask-for-changes": "changes_requested",
};

/** Approve, reject or ask for changes, checked on the server (`checkDecision`). */
async function decideOrder(identity: DashboardIdentity, orderId: number, input: unknown): Promise<WriteResult<Order>> {
  if (identity.memberId === null) return refused("Only the team leader, or someone they gave Approve orders, decides orders.");
  const found = await scopedOrder(identity, orderId);
  if (typeof found === "string") return refused(found);
  const checked = checkDecision(found.scope.decides, found.order.status, input);
  if (!checked.ok) return refused(checked.error);
  const decision = checked.value;
  const reviewedBy = identity.memberId;
  const changed = await runAuditQuery((db) =>
    db
      .update(orders)
      .set({
        status: DB_STATUS_AFTER[decision.kind],
        reviewNote: decision.kind === "ask-for-changes" ? decision.reason : null,
        reviewedBy,
        reviewedAt: new Date().toISOString(),
      })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning({ id: orders.id }),
  );
  if (changed.length === 0) return refused(ORDER_CHANGED);
  const [decided] = (await readOrderRows({ orderId })).flatMap(orderOf);
  return decided === undefined ? refused(ORDER_CHANGED) : written(decided);
}

/** Give or remove "Approve orders": only the team leader, any number of holders (`checkApproveOrdersChange`). */
async function setApproveOrders(identity: DashboardIdentity, input: unknown): Promise<WriteResult<null>> {
  if (identity.memberId === null) return refused("Only the team leader gives or removes Approve orders.");
  const db = getDb();
  const [active, holders] = await Promise.all([
    db.select({ member_id: roles.memberId, type: roles.type }).from(roles).where(isNull(roles.leavedAt)),
    db
      .select({ member_id: scopes.memberId })
      .from(scopes)
      .where(and(eq(scopes.scope, "team"), eq(scopes.target, "approve_orders"))),
  ]);
  const ids = (rows: readonly { member_id: number | null }[]) => [...new Set(rows.flatMap((r) => (r.member_id === null ? [] : [r.member_id])))];
  const checked = checkApproveOrdersChange(
    {
      byTeamLeader: isTeamLeader(identity),
      team: ids(active),
      teamLeaders: ids(active.filter((r) => r.type === "president")),
      holders: ids(holders),
    },
    input,
  );
  if (!checked.ok) return refused(checked.error);
  const { personId, holds } = checked.value;
  const givenBy = identity.memberId;
  await runAuditQuery((tx) =>
    holds
      ? tx.insert(scopes).values({ memberId: personId, givenBy, scope: "team", target: "approve_orders", accessLevel: "edit" })
      : tx.delete(scopes).where(and(eq(scopes.memberId, personId), eq(scopes.scope, "team"), eq(scopes.target, "approve_orders"))),
  );
  return written(null);
}

/** The Access and Orders methods of the database side of the data interface. */
export function databaseDivisionPages(identity: DashboardIdentity) {
  return {
    divisionAccess: () => readAccessPage(identity),
    saveAccess: (input: unknown) => saveAccess(identity, input),
    removeAllAccess: (personId: number) => removeAllAccess(identity, personId),
    orders: () => readOrdersPage(identity),
    placeOrder: (fields: Record<string, string>, quote: Upload | null) => placeOrder(identity, fields, quote),
    editOrder: (orderId: number, fields: Record<string, string>, quote: Upload | null) =>
      editOrder(identity, orderId, fields, quote),
    cancelOrder: (orderId: number) => cancelOrder(identity, orderId),
    decideOrder: (orderId: number, input: unknown) => decideOrder(identity, orderId, input),
    setApproveOrders: (input: unknown) => setApproveOrders(identity, input),
  };
}
