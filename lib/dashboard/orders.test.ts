import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appliedSelection,
  canEditOrder,
  checkApproveOrdersChange,
  checkDecision,
  checkNewOrder,
  checkOrderDivision,
  decideRightOf,
  departmentTick,
  filterOrders,
  NO_FILTERS,
  ORDER_STATUSES,
  orderActions,
  orderBreakdown,
  orderFormFields,
  orderingDivisions,
  orderPage,
  ordersIntro,
  ordersPageFor,
  pagerSlots,
  parseEuros,
  sortOrders,
  stateAfterDecision,
  stateAfterEdit,
  toggleDepartment,
  WHOLE_TEAM,
  type ApproveOrdersFacts,
  type Order,
  type OrdersScope,
  type OrderState,
  type OrderUnit,
  type OrgDepartmentUnits,
} from "./orders";

test("euros as typed become whole cents, and anything else is refused", () => {
  assert.equal(parseEuros("59.55"), 5955);
  assert.equal(parseEuros("59,55"), 5955);
  assert.equal(parseEuros("€ 59.5"), 5950);
  assert.equal(parseEuros("1,234.50"), 123450);
  assert.equal(parseEuros("12"), 1200);
  for (const bad of ["", "abc", "1.234", "-3", "5.5.5"]) assert.equal(parseEuros(bad), null, bad);
});

// Two departments: Aerodynamics (Mission Analysis, Optimization and Analysis) and Electronics (Hardware).
const missionAnalysis = { id: 1, name: "Mission Analysis Division" };
const optimization = { id: 2, name: "Optimization and Analysis Division" };
const hardware = { id: 9, name: "Hardware Division" };
const aerodynamics = { id: 1, name: "Aerodynamics" };
const electronics = { id: 5, name: "Electronics" };
const org: OrgDepartmentUnits[] = [
  { ...aerodynamics, divisions: [missionAnalysis, optimization] },
  { ...electronics, divisions: [hardware] },
];

const inMissionAnalysis: OrderUnit = { division: missionAnalysis, department: aerodynamics };
const inOptimization: OrderUnit = { division: optimization, department: aerodynamics };
const inHardware: OrderUnit = { division: hardware, department: electronics };

let nextId = 1;
function order(state: OrderState, requestedOn = "2026-10-01", unit: OrderUnit | null = inMissionAnalysis): Order {
  return { ...state, id: nextId++, item: "x", reason: null, link: null, requestedBy: "x", unit, unitPrice: 100, quantity: 1, shipping: null, requestedOn, quote: null };
}

const sentBack: OrderState = { status: "changes-requested", changes: { reason: "Add a second quote.", by: "Alessandro Greco", on: "2026-10-05" } };

/** A division lead with Orders at Can edit in Mission Analysis (board 61). */
const lead: OrdersScope = { edits: [{ kind: "division", division: missionAnalysis }], decides: null };
/** The Head of Aerodynamics (board 67). */
const head: OrdersScope = { edits: [{ kind: "department", department: aerodynamics }], decides: null };
/** Someone with Orders at Can view only. */
const viewer: OrdersScope = { edits: [], decides: null };

test("anyone with any Orders access sees every order in the team, in every department; no access is no page", () => {
  const all = [order({ status: "waiting" }), order({ status: "approved" }, "2026-10-02", inOptimization), order({ status: "rejected" }, "2026-10-03", inHardware)];
  for (const scope of [lead, head, viewer, { edits: [], decides: "approve-orders" } satisfies OrdersScope]) {
    const page = ordersPageFor(scope, org, all);
    assert.deepEqual(
      page?.orders.map((o) => o.id),
      all.map((o) => o.id),
    );
  }
  assert.equal(ordersPageFor(null, org, all), null);
});

test("a lead edits only their own division's orders, a head only their department's, and Can view edits none", () => {
  const mine = order({ status: "waiting" }, "2026-10-01", inMissionAnalysis);
  const sameDepartment = order({ status: "waiting" }, "2026-10-01", inOptimization);
  const elsewhere = order({ status: "waiting" }, "2026-10-01", inHardware);
  const noDivision = order({ status: "waiting" }, "2026-10-01", null);

  assert.deepEqual([mine, sameDepartment, elsewhere, noDivision].map((o) => canEditOrder(lead, o)), [true, false, false, false]);
  assert.deepEqual([mine, sameDepartment, elsewhere, noDivision].map((o) => canEditOrder(head, o)), [true, true, false, false]);
  assert.deepEqual([mine, sameDepartment, elsewhere, noDivision].map((o) => canEditOrder(viewer, o)), [false, false, false, false]);
});

test("an order outside the viewer's scope opens read-only, whatever its state", () => {
  for (const status of ORDER_STATUSES) {
    const state: OrderState = status === "changes-requested" ? sentBack : { status };
    assert.deepEqual(orderActions(lead, order(state, "2026-10-01", inHardware)), { cancel: false, edit: null });
    assert.deepEqual(orderActions(viewer, order(state)), { cancel: false, edit: null });
  }
});

test("in scope, only a waiting request can be cancelled; one sent back can only be edited and sent again", () => {
  assert.deepEqual(orderActions(lead, order({ status: "waiting" })), { cancel: true, edit: "edit" });
  assert.deepEqual(orderActions(lead, order(sentBack)), { cancel: false, edit: "edit-and-resend" });
  assert.deepEqual(orderActions(lead, order({ status: "approved" })), { cancel: false, edit: null });
  assert.deepEqual(orderActions(head, order({ status: "rejected" }, "2026-10-01", inOptimization)), { cancel: false, edit: null });
});

test("an edit sends the request back to the team leader, and an answered one cannot be edited", () => {
  assert.deepEqual(stateAfterEdit("changes-requested"), { status: "waiting" });
  assert.deepEqual(stateAfterEdit("waiting"), { status: "waiting" });
  assert.equal(stateAfterEdit("approved"), null);
  assert.equal(stateAfterEdit("rejected"), null);
});

test("by default only the team leader decides; Approve orders lets someone else decide too", () => {
  assert.equal(decideRightOf({ teamLeader: true, approveOrders: false }), "team-leader");
  assert.equal(decideRightOf({ teamLeader: false, approveOrders: true }), "approve-orders");
  assert.equal(decideRightOf({ teamLeader: false, approveOrders: false }), null);
});

test("a decision is refused to anyone without the right, and on a request that is not waiting", () => {
  for (const right of ["team-leader", "approve-orders"] as const) {
    assert.deepEqual(checkDecision(right, "waiting", { kind: "approve" }), { ok: true, value: { kind: "approve" } });
    assert.deepEqual(checkDecision(right, "waiting", { kind: "reject" }), { ok: true, value: { kind: "reject" } });
  }
  // A lead or head of the order's own unit has no right to decide it.
  assert.equal(checkDecision(head.decides, "waiting", { kind: "approve" }).ok, false);
  assert.equal(checkDecision(lead.decides, "waiting", { kind: "reject" }).ok, false);
  for (const status of ["approved", "rejected", "changes-requested"] as const) {
    assert.equal(checkDecision("team-leader", status, { kind: "approve" }).ok, false, status);
  }
  assert.equal(checkDecision("team-leader", "waiting", { kind: "cancel" }).ok, false);
});

test("asking for changes says what to change, and the reason shows on Changes requested (board 61d)", () => {
  assert.equal(checkDecision("team-leader", "waiting", { kind: "ask-for-changes", reason: "  " }).ok, false);
  const asked = checkDecision("approve-orders", "waiting", { kind: "ask-for-changes", reason: " Add a second quote. " });
  assert.deepEqual(asked, { ok: true, value: { kind: "ask-for-changes", reason: "Add a second quote." } });
  if (!asked.ok) return;
  assert.deepEqual(stateAfterDecision(asked.value, "Alessandro Greco", "2026-10-05"), sentBack);
  assert.deepEqual(stateAfterDecision({ kind: "approve" }, "Alessandro Greco", "2026-10-05"), { status: "approved" });
  assert.deepEqual(stateAfterDecision({ kind: "reject" }, "Alessandro Greco", "2026-10-05"), { status: "rejected" });
});

const teamLeader = 14;
const facts: ApproveOrdersFacts = { byTeamLeader: true, team: [2, 6, 14, 15, 20], teamLeaders: [teamLeader], holders: [] };

test("only the team leader gives or removes Approve orders", () => {
  assert.equal(checkApproveOrdersChange({ ...facts, byTeamLeader: false }, { personId: 2, holds: true }).ok, false);
  assert.equal(checkApproveOrdersChange({ ...facts, byTeamLeader: false, holders: [2] }, { personId: 2, holds: false }).ok, false);
  assert.deepEqual(checkApproveOrdersChange(facts, { personId: 2, holds: true }), { ok: true, value: { personId: 2, holds: true } });
  assert.deepEqual(checkApproveOrdersChange({ ...facts, holders: [2] }, { personId: 2, holds: false }), { ok: true, value: { personId: 2, holds: false } });
});

test("more than one person can hold Approve orders at once: there is no limit", () => {
  const holders = [2, 6, 15];
  assert.deepEqual(checkApproveOrdersChange({ ...facts, holders }, { personId: 20, holds: true }), { ok: true, value: { personId: 20, holds: true } });
});

test("Approve orders goes only to someone on the team, never to the team leader, and not twice", () => {
  assert.equal(checkApproveOrdersChange(facts, { personId: 99, holds: true }).ok, false);
  assert.equal(checkApproveOrdersChange(facts, { personId: teamLeader, holds: true }).ok, false);
  assert.equal(checkApproveOrdersChange({ ...facts, holders: [2] }, { personId: 2, holds: true }).ok, false);
  assert.equal(checkApproveOrdersChange(facts, { personId: 2, holds: false }).ok, false);
  assert.equal(checkApproveOrdersChange(facts, { personId: "2", holds: true }).ok, false);
});

test("a page holds 12 orders, newest first, and a page past the end shows the last", () => {
  const orders = Array.from({ length: 30 }, (_, i) => order({ status: "waiting" }, `2026-09-${String(i + 1).padStart(2, "0")}`));
  const first = orderPage(orders, 1);
  assert.equal(first.pages, 3);
  assert.equal(first.orders.length, 12);
  assert.equal(first.orders[0].requestedOn, "2026-09-30");
  assert.ok(first.orders.every((o, i) => i === 0 || o.requestedOn <= first.orders[i - 1].requestedOn));
  assert.deepEqual(orderPage(orders, 3).orders.map((o) => o.requestedOn), ["2026-09-06", "2026-09-05", "2026-09-04", "2026-09-03", "2026-09-02", "2026-09-01"]);
  assert.equal(orderPage(orders, 9).page, 3);
  assert.deepEqual(orderPage([], 1), { orders: [], page: 1, pages: 1 });
});

test("the pager shows the first, the last and the pages around the current one (board 61)", () => {
  assert.deepEqual(pagerSlots(1, 6), [1, 2, 3, "gap", 6]);
  assert.deepEqual(pagerSlots(4, 6), [1, "gap", 3, 4, 5, 6]);
  assert.deepEqual(pagerSlots(6, 6), [1, "gap", 4, 5, 6]);
  assert.deepEqual(pagerSlots(5, 9), [1, "gap", 4, 5, 6, "gap", 9]);
  assert.deepEqual(pagerSlots(2, 4), [1, 2, 3, 4]);
});

test("orders sort newest first, whatever their state", () => {
  const sorted = sortOrders([
    order({ status: "rejected" }, "2026-10-09"),
    order({ status: "approved" }, "2026-10-08"),
    order({ status: "waiting" }, "2026-10-01"),
    order(sentBack, "2026-10-02"),
    order({ status: "waiting" }, "2026-10-05"),
  ]);
  assert.deepEqual(
    sorted.map((o) => `${o.status} ${o.requestedOn}`),
    ["rejected 2026-10-09", "approved 2026-10-08", "waiting 2026-10-05", "changes-requested 2026-10-02", "waiting 2026-10-01"],
  );
});

test("the department and status filters return the right orders, and together both must hold", () => {
  const a = order({ status: "waiting" }, "2026-10-01", inMissionAnalysis);
  const b = order({ status: "approved" }, "2026-10-01", inOptimization);
  const c = order({ status: "waiting" }, "2026-10-01", inHardware);
  const d = order(sentBack, "2026-10-01", inHardware);
  const none = order({ status: "waiting" }, "2026-10-01", null);
  const all = [a, b, c, d, none];
  const ids = (orders: readonly Order[]) => orders.map((o) => o.id);

  assert.deepEqual(ids(filterOrders(all, NO_FILTERS)), ids(all));
  assert.deepEqual(ids(filterOrders(all, { divisionIds: [missionAnalysis.id, optimization.id], statuses: null })), ids([a, b]));
  assert.deepEqual(ids(filterOrders(all, { divisionIds: null, statuses: ["waiting"] })), ids([a, c, none]));
  assert.deepEqual(ids(filterOrders(all, { divisionIds: null, statuses: ["changes-requested", "approved"] })), ids([b, d]));
  assert.deepEqual(ids(filterOrders(all, { divisionIds: [hardware.id], statuses: ["waiting"] })), ids([c]));
});

test("ticking a department ticks its divisions, and nothing or everything ticked is no filter (board 67b)", () => {
  const [aero] = org;
  assert.deepEqual(toggleDepartment(aero, []), [1, 2]);
  assert.deepEqual(toggleDepartment(aero, [1, 2, 9]), [9]);
  assert.deepEqual(toggleDepartment(aero, [2]), [1, 2]);
  assert.equal(departmentTick(aero, [2]), "some");
  assert.equal(departmentTick(aero, [1, 2]), "all");
  assert.equal(departmentTick(aero, [9]), "none");
  assert.equal(appliedSelection([], [1, 2, 9]), null);
  assert.equal(appliedSelection([9, 2, 1], [1, 2, 9]), null);
  assert.deepEqual(appliedSelection([1, 2], [1, 2, 9]), [1, 2]);
});

test("a lead orders for their division; a head picks one of their department's divisions", () => {
  assert.deepEqual(orderingDivisions(lead, org), [missionAnalysis]);
  assert.deepEqual(orderingDivisions(head, org), [missionAnalysis, optimization]);
  assert.deepEqual(orderingDivisions(viewer, org), []);

  assert.deepEqual(checkOrderDivision([missionAnalysis], undefined), { ok: true, value: missionAnalysis });
  assert.deepEqual(checkOrderDivision([missionAnalysis, optimization], "2"), { ok: true, value: optimization });
  assert.equal(checkOrderDivision([missionAnalysis, optimization], "").ok, false);
  assert.equal(checkOrderDivision([missionAnalysis, optimization], "9").ok, false);
  assert.equal(checkOrderDivision([], "1").ok, false);
});

test("the intro names what the viewer edits (boards 61 and 67)", () => {
  assert.equal(ordersIntro(lead), "Every order in the team. You can edit Mission Analysis orders; the rest are read-only.");
  assert.equal(ordersIntro(head), "Every order in the team. You can edit Aerodynamics orders; the rest are read-only.");
});

test("Edit order opens on the request as it was sent", () => {
  assert.deepEqual(orderFormFields({ item: "Steel wire", link: null, unitPrice: 5955, quantity: 2, reason: "For the launch rail" }), {
    item: "Steel wire",
    link: "",
    price: "59.55",
    quantity: "2",
    reason: "For the launch rail",
  });
});

test("the breakdown shows quantity and shipping only when there are some", () => {
  assert.equal(orderBreakdown({ unitPrice: 5955, quantity: 2, shipping: null }), "€59.55 × 2");
  assert.equal(orderBreakdown({ unitPrice: 15000, quantity: 1, shipping: 1330 }), "€150.00 + €13.30");
  assert.equal(orderBreakdown({ unitPrice: 12480, quantity: 1, shipping: null }), "€124.80");
});

test("a new order needs an item, a price, a whole quantity and a reason; the link is optional but real", () => {
  const ok = checkNewOrder({ item: " Steel wire ", link: "", price: "59.55", quantity: "2", reason: "For the launch rail" });
  assert.deepEqual(ok, { ok: true, value: { item: "Steel wire", link: null, unitPrice: 5955, quantity: 2, reason: "For the launch rail" } });

  const bad = checkNewOrder({ item: "", link: "amzn.eu/x", price: "0", quantity: "1.5", reason: " " });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["item", "link", "quantity", "reason", "unitPrice"]);
});

test("full access edits every order in the team and orders for any division, deciding still apart (issue #238)", () => {
  const scope: OrdersScope = { edits: [WHOLE_TEAM], decides: null };
  for (const unit of [inMissionAnalysis, inOptimization, inHardware, null]) assert.equal(canEditOrder(scope, { unit }), true);
  assert.deepEqual(
    orderingDivisions(scope, org).map((d) => d.id),
    [9, 1, 2],
  );
  assert.equal(ordersIntro(scope), "Every order in the team. You can edit all of them.");
  assert.equal(checkDecision(scope.decides, "waiting", { kind: "approve" }).ok, false);
});
