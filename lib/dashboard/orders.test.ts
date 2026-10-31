import assert from "node:assert/strict";
import { test } from "node:test";
import {
  appliedSelection,
  canEditOrder,
  checkApproveOrdersChange,
  checkDecision,
  checkMarkOrdered,
  checkNewOrder,
  checkOrderDivision,
  decideRightOf,
  departmentTick,
  filterOrders,
  NO_FILTERS,
  ORDER_STATUSES,
  orderActions,
  orderBreakdown,
  orderEditControls,
  orderFormFields,
  orderingDivisions,
  orderPage,
  ordersIntro,
  ordersPageFor,
  ordersScopeOf,
  orgUnitsOf,
  parseEuros,
  sortOrders,
  stateAfterDecision,
  stateAfterEdit,
  toggleDepartment,
  WHOLE_TEAM,
  type ApproveOrdersFacts,
  type Order,
  type OrdersScope,
  type OrdersScopeRow,
  type OrdersViewer,
  type OrderState,
  type OrderStatus,
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
const answer = { by: "Alessandro Greco", byYou: true, on: "2026-10-05" };
const approved: OrderState = { status: "approved", answer };
const ordered: OrderState = { status: "ordered", answer };
const rejected: OrderState = { status: "rejected", answer, reason: null };

/** A request in each state the page shows. */
const STATES: Readonly<Record<OrderStatus, OrderState>> = {
  waiting: { status: "waiting" },
  approved,
  ordered,
  "changes-requested": sentBack,
  rejected,
};

/** A division lead with Orders at Can edit in Mission Analysis (board 61). */
const lead: OrdersScope = { edits: [{ kind: "division", division: missionAnalysis }], decides: null };
/** The Head of Aerodynamics (board 67). */
const head: OrdersScope = { edits: [{ kind: "department", department: aerodynamics }], decides: null };
/** Someone with Orders at Can view only. */
const viewer: OrdersScope = { edits: [], decides: null };

test("anyone with any Orders access sees every order in the team, in every department; no access is no page", () => {
  const all = [order({ status: "waiting" }), order(approved, "2026-10-02", inOptimization), order(rejected, "2026-10-03", inHardware)];
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

const NOTHING = { cancel: false, edit: null, decide: false, markOrdered: false };

test("an order outside the viewer's scope opens read-only, whatever its state", () => {
  for (const status of ORDER_STATUSES) {
    const state = STATES[status];
    assert.deepEqual(orderActions(lead, order(state, "2026-10-01", inHardware)), NOTHING);
    assert.deepEqual(orderActions(viewer, order(state)), NOTHING);
  }
});

test("in scope, only a waiting request can be cancelled; one sent back can only be edited and sent again", () => {
  assert.deepEqual(orderActions(lead, order({ status: "waiting" })), { ...NOTHING, cancel: true, edit: "edit" });
  assert.deepEqual(orderActions(lead, order(sentBack)), { ...NOTHING, edit: "edit-and-resend" });
  assert.deepEqual(orderActions(lead, order(approved)), NOTHING);
  assert.deepEqual(orderActions(lead, order(ordered)), NOTHING);
  assert.deepEqual(orderActions(head, order(rejected, "2026-10-01", inOptimization)), NOTHING);
});

test("an edit sends the request back to the team leader, and an answered one cannot be edited", () => {
  assert.deepEqual(stateAfterEdit("changes-requested"), { status: "waiting" });
  assert.deepEqual(stateAfterEdit("waiting"), { status: "waiting" });
  assert.equal(stateAfterEdit("approved"), null);
  assert.equal(stateAfterEdit("ordered"), null);
  assert.equal(stateAfterEdit("rejected"), null);
});

test("a rejected request cannot be edited or sent again, even by the team leader who edits every order (board 70e)", () => {
  const teamLeader: OrdersScope = { edits: [WHOLE_TEAM], decides: "team-leader" };
  for (const scope of [lead, head, teamLeader]) assert.deepEqual(orderActions(scope, order(rejected)), NOTHING);
});

/** Board 70: the team leader holds full access and decides. */
const teamLeaderScope: OrdersScope = { edits: [WHOLE_TEAM], decides: "team-leader" };
/** A member the team leader gave "Approve orders", with Orders at Can view (board 71). */
const holderScope: OrdersScope = { edits: [], decides: "approve-orders" };
/** The operations lead: full access, but no "Approve orders" (issue #238). */
const operationsLeadScope: OrdersScope = { edits: [WHOLE_TEAM], decides: null };

test("Reject, Ask for changes and Approve show on a waiting order only to the team leader and holders of Approve orders (board 70b)", () => {
  const waiting = order({ status: "waiting" });
  assert.equal(orderActions(teamLeaderScope, waiting).decide, true);
  assert.equal(orderActions(holderScope, waiting).decide, true);
  assert.equal(orderActions(operationsLeadScope, waiting).decide, false);
  assert.equal(orderActions(lead, waiting).decide, false);
  // Deciding needs no edit scope: the holder edits nothing, yet decides an order in any division.
  assert.deepEqual(orderActions(holderScope, order({ status: "waiting" }, "2026-10-01", inHardware)), { ...NOTHING, decide: true });
  // Nobody decides a request that is no longer waiting.
  for (const status of ["approved", "ordered", "changes-requested", "rejected"] as const) {
    assert.equal(orderActions(teamLeaderScope, order(STATES[status])).decide, false, status);
  }
});

test("Mark as ordered shows on an approved order only to the people who decide orders (board 70c)", () => {
  for (const status of ORDER_STATUSES) {
    const actions = orderActions(teamLeaderScope, order(STATES[status]));
    assert.equal(actions.markOrdered, status === "approved", status);
  }
  assert.equal(orderActions(holderScope, order(approved)).markOrdered, true);
  assert.equal(orderActions(operationsLeadScope, order(approved)).markOrdered, false);
  assert.equal(orderActions(lead, order(approved)).markOrdered, false);
});

test("an order moves from Approved to Ordered only through Mark as ordered, and only from Approved", () => {
  assert.deepEqual(checkMarkOrdered("team-leader", approved), { ok: true, value: ordered });
  assert.deepEqual(checkMarkOrdered("approve-orders", approved), { ok: true, value: ordered });
  for (const status of ["waiting", "ordered", "changes-requested", "rejected"] as const) {
    assert.equal(checkMarkOrdered("team-leader", STATES[status]).ok, false, status);
  }
  assert.equal(checkMarkOrdered(null, approved).ok, false);
  // No decision reaches Ordered, and no edit leaves it.
  for (const decision of [{ kind: "approve" }, { kind: "reject", reason: null }, { kind: "ask-for-changes", reason: "x" }] as const) {
    assert.notEqual(stateAfterDecision(decision, answer).status, "ordered");
  }
  assert.equal(checkDecision("team-leader", "ordered", { kind: "approve" }).ok, false);
  assert.equal(stateAfterEdit("ordered"), null);
});

test("by default only the team leader decides; Approve orders lets someone else decide too", () => {
  assert.equal(decideRightOf({ teamLeader: true, approveOrders: false }), "team-leader");
  assert.equal(decideRightOf({ teamLeader: false, approveOrders: true }), "approve-orders");
  assert.equal(decideRightOf({ teamLeader: false, approveOrders: false }), null);
});

/** A member: no full access, not the team leader, no department to head, no division to lead. */
const memberViewer: OrdersViewer = { fullAccess: false, teamLeader: false, headDepartment: null, ledDivisionIds: [] };
const approveOrdersRow: OrdersScopeRow = { scope: "team", target: "approve_orders", level: "edit", divisionId: null, deptId: null };

test("\"Approve orders\" alone is Orders access: the page opens, the holder decides, and edits nothing (issue #270)", () => {
  const scope = ordersScopeOf(memberViewer, [approveOrdersRow], org);
  assert.deepEqual(scope, { edits: [], decides: "approve-orders" });
  assert.notEqual(ordersPageFor(scope, org, [order({ status: "waiting" })]), null);
  assert.ok(scope !== null);
  // The decide buttons on a waiting order, Mark as ordered on an approved one, and no edit, cancel or new order anywhere.
  assert.deepEqual(orderActions(scope, order({ status: "waiting" })), { ...NOTHING, decide: true });
  assert.deepEqual(orderActions(scope, order(approved)), { ...NOTHING, markOrdered: true });
  for (const status of ORDER_STATUSES) assert.equal(orderActions(scope, order(STATES[status])).edit, null, status);
  assert.deepEqual(orderingDivisions(scope, org), []);
});

/** A holder of "Approve orders" who also heads Aerodynamics. */
const headHolderScope: OrdersScope = { edits: [{ kind: "department", department: aerodynamics }], decides: "approve-orders" };
/** Every viewer who may edit an order in Mission Analysis, with whether they also decide it. */
const EDITORS: readonly (readonly [string, OrdersScope])[] = [
  ["the team leader", teamLeaderScope],
  ["an Approve orders holder with an edit scope", headHolderScope],
  ["full access", operationsLeadScope],
  ["a department head", head],
  ["a division lead", lead],
];

test("every viewer who may edit a waiting order gets Edit order and Cancel request, whether they decide it or not (issue #675)", () => {
  const waiting = order({ status: "waiting" });
  for (const [who, scope] of EDITORS) {
    assert.deepEqual(
      orderEditControls(orderActions(scope, waiting)).buttons,
      [
        { kind: "cancel", label: "Cancel request" },
        { kind: "edit", label: "Edit order" },
      ],
      who,
    );
  }
  // Beside the decide buttons they sit at the panel's head (board 70b); with no decide buttons, in the footer.
  assert.equal(orderEditControls(orderActions(teamLeaderScope, waiting)).place, "head");
  assert.equal(orderEditControls(orderActions(headHolderScope, waiting)).place, "head");
  assert.equal(orderEditControls(orderActions(head, waiting)).place, "footer");
  assert.equal(orderEditControls(orderActions(lead, waiting)).place, "footer");
});

test("a sent-back request offers Edit and send again alone, an order outside scope offers nothing, and no edit control reads only Edit", () => {
  for (const [who, scope] of EDITORS) {
    assert.deepEqual(orderEditControls(orderActions(scope, order(sentBack))).buttons, [{ kind: "edit", label: "Edit and send again" }], who);
    for (const status of ["approved", "ordered", "rejected"] as const) {
      assert.deepEqual(orderEditControls(orderActions(scope, order(STATES[status]))).buttons, [], `${who}, ${status}`);
    }
  }
  assert.deepEqual(orderEditControls(orderActions(lead, order({ status: "waiting" }, "2026-10-01", inHardware))).buttons, []);
  assert.deepEqual(orderEditControls(orderActions(holderScope, order({ status: "waiting" }))).buttons, []);
});

test("a member with no \"Approve orders\" and no Orders access gets no Orders page (issue #270)", () => {
  const siteContent: OrdersScopeRow = { scope: "website", target: "all", level: "edit", divisionId: null, deptId: null };
  for (const rows of [[], [siteContent]]) {
    const scope = ordersScopeOf(memberViewer, rows, org);
    assert.equal(scope, null);
    assert.equal(ordersPageFor(scope, org, [order({ status: "waiting" })]), null);
  }
});

test("Orders access from scope rows, a head's role and full access keeps its edits; deciding stays apart (issue #233)", () => {
  const divisionEdit: OrdersScopeRow = { scope: "division", target: "orders", level: "edit", divisionId: missionAnalysis.id, deptId: null };
  const divisionView: OrdersScopeRow = { ...divisionEdit, level: "view" };
  assert.deepEqual(ordersScopeOf(memberViewer, [divisionEdit], org), lead);
  assert.deepEqual(ordersScopeOf(memberViewer, [divisionView], org), viewer);
  assert.deepEqual(ordersScopeOf({ ...memberViewer, headDepartment: aerodynamics }, [], org), head);
  assert.deepEqual(ordersScopeOf({ ...memberViewer, fullAccess: true }, [], org), operationsLeadScope);
  assert.deepEqual(ordersScopeOf({ ...memberViewer, fullAccess: true, teamLeader: true }, [], org), teamLeaderScope);
  assert.deepEqual(ordersScopeOf(memberViewer, [divisionView, approveOrdersRow], org), holderScope);
});

test("a lead's role edits each open division they lead, with no scope row, and decides nothing (issue #590)", () => {
  const leadOf = (...ledDivisionIds: number[]): OrdersViewer => ({ ...memberViewer, ledDivisionIds });
  assert.deepEqual(ordersScopeOf(leadOf(missionAnalysis.id), [], org), lead);
  // Two led divisions, in two departments: each one, in the team's order. A closed division (not in `org`) adds nothing.
  assert.deepEqual(ordersScopeOf(leadOf(hardware.id, missionAnalysis.id, 42), [], org), {
    edits: [
      { kind: "division", division: missionAnalysis },
      { kind: "division", division: hardware },
    ],
    decides: null,
  });
  assert.equal(ordersScopeOf(leadOf(42), [], org), null);
  // A grant elsewhere adds only what it gives: a whole-team Can view row keeps the lead's own division and edits nothing more.
  const teamView: OrdersScopeRow = { scope: "team", target: "orders", level: "view", divisionId: null, deptId: null };
  assert.deepEqual(ordersScopeOf(leadOf(missionAnalysis.id), [teamView], org), lead);
  // Deciding still comes only from the team leader's role or "Approve orders".
  assert.deepEqual(ordersScopeOf(leadOf(missionAnalysis.id), [approveOrdersRow], org), { ...lead, decides: "approve-orders" });
  assert.deepEqual(ordersScopeOf({ ...leadOf(missionAnalysis.id), teamLeader: true }, [], org), { ...lead, decides: "team-leader" });
  // A head who also holds a role in a division of their own department edits the department, once.
  assert.deepEqual(ordersScopeOf({ ...leadOf(missionAnalysis.id), headDepartment: aerodynamics }, [], org), head);
});

test("a decision is refused to anyone without the right, and on a request that is not waiting", () => {
  for (const right of ["team-leader", "approve-orders"] as const) {
    assert.deepEqual(checkDecision(right, "waiting", { kind: "approve" }), { ok: true, value: { kind: "approve" } });
    assert.deepEqual(checkDecision(right, "waiting", { kind: "reject" }), { ok: true, value: { kind: "reject", reason: null } });
  }
  // A lead or head of the order's own unit has no right to decide it.
  assert.equal(checkDecision(head.decides, "waiting", { kind: "approve" }).ok, false);
  assert.equal(checkDecision(lead.decides, "waiting", { kind: "reject" }).ok, false);
  for (const status of ["approved", "ordered", "rejected", "changes-requested"] as const) {
    assert.equal(checkDecision("team-leader", status, { kind: "approve" }).ok, false, status);
  }
  assert.equal(checkDecision("team-leader", "waiting", { kind: "cancel" }).ok, false);
});

test("asking for changes says what to change, and the reason shows on Changes requested (board 61d)", () => {
  assert.equal(checkDecision("team-leader", "waiting", { kind: "ask-for-changes", reason: "  " }).ok, false);
  const asked = checkDecision("approve-orders", "waiting", { kind: "ask-for-changes", reason: " Add a second quote. " });
  assert.deepEqual(asked, { ok: true, value: { kind: "ask-for-changes", reason: "Add a second quote." } });
  if (!asked.ok) return;
  assert.deepEqual(stateAfterDecision(asked.value, answer), sentBack);
  assert.deepEqual(stateAfterDecision({ kind: "approve" }, answer), approved);
});

test("Ask for changes cannot be sent without a note (board 70d)", () => {
  for (const reason of ["", "   ", "\n"]) {
    assert.deepEqual(checkDecision("team-leader", "waiting", { kind: "ask-for-changes", reason }), { ok: false, error: "Say what to change." });
  }
  assert.equal(checkDecision("team-leader", "waiting", { kind: "ask-for-changes" }).ok, false);
});

test("Reject sends with a reason or without one, and the requester reads the reason (board 70e)", () => {
  assert.deepEqual(checkDecision("team-leader", "waiting", { kind: "reject" }), { ok: true, value: { kind: "reject", reason: null } });
  assert.deepEqual(checkDecision("team-leader", "waiting", { kind: "reject", reason: "  " }), { ok: true, value: { kind: "reject", reason: null } });
  const why = checkDecision("approve-orders", "waiting", { kind: "reject", reason: " Logistics already booked a van. " });
  assert.deepEqual(why, { ok: true, value: { kind: "reject", reason: "Logistics already booked a van." } });
  if (!why.ok) return;
  assert.deepEqual(stateAfterDecision(why.value, answer), { status: "rejected", answer, reason: "Logistics already booked a van." });
  assert.equal(checkDecision("team-leader", "waiting", { kind: "reject", reason: "x".repeat(501) }).ok, false);
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

test("with two team leaders, each gives Approve orders and neither is given it, but a kept grant can be removed (epic #861)", () => {
  const coLeader = 15;
  const both: ApproveOrdersFacts = { ...facts, teamLeaders: [teamLeader, coLeader] };
  // Either team leader asks: the facts read the same, as each holds the seat.
  assert.deepEqual(checkApproveOrdersChange(both, { personId: 2, holds: true }), { ok: true, value: { personId: 2, holds: true } });
  for (const leader of [teamLeader, coLeader]) {
    assert.deepEqual(checkApproveOrdersChange(both, { personId: leader, holds: true }), { ok: false, error: "The team leader already approves orders." }, `leader ${leader}`);
  }
  // A grant the co-leader kept from a seat held before can still be removed; one they lack cannot.
  const kept: ApproveOrdersFacts = { ...both, holders: [coLeader] };
  assert.deepEqual(checkApproveOrdersChange(kept, { personId: coLeader, holds: false }), { ok: true, value: { personId: coLeader, holds: false } });
  assert.deepEqual(checkApproveOrdersChange(both, { personId: coLeader, holds: false }), { ok: false, error: "They do not hold Approve orders." });
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

test("orders sort newest first, whatever their state", () => {
  const sorted = sortOrders([
    order(rejected, "2026-10-09"),
    order(approved, "2026-10-08"),
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
  const b = order(approved, "2026-10-01", inOptimization);
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

test("the Department filter lists departments in the team's order, as board 67b does, and divisions by name", () => {
  const units = orgUnitsOf(
    [
      { id: 6, name: "Operations" },
      { id: 2, name: "Structures" },
      { id: 1, name: "Aerodynamics" },
    ],
    [
      { id: 2, name: "Optimization and Analysis Division", departmentId: 1 },
      { id: 7, name: "Logistics Division", departmentId: 6 },
      { id: 1, name: "Mission Analysis Division", departmentId: 1 },
      { id: 30, name: "Unplaced Division", departmentId: null },
    ],
  );
  assert.deepEqual(
    units.map((d) => [d.name, d.divisions.map((v) => v.name)]),
    [
      ["Aerodynamics", ["Mission Analysis Division", "Optimization and Analysis Division"]],
      ["Structures", []],
      ["Operations", ["Logistics Division"]],
    ],
  );
});
