import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { orders } from "./orders";

// The Orders page on a preview (issue #233): who sees which orders, and the
// writes the server refuses, checked through the data interface the pages use.

function data(kind: TestViewer) {
  return dummyDashboardData(
    kind,
    { current: dummyRecruitmentOf(undefined), save: async () => {} },
    { current: EMPTY_DUMMY_STATE, save: async () => {} },
  );
}

const fields = { item: "Steel wire", link: "", price: "59.55", quantity: "2", reason: "For the launch rail" };

/** A stored waiting request made for `divisionId`. */
function waitingIn(divisionId: number) {
  return orders.find((o) => o.divisionId === divisionId && o.status === "waiting")!;
}

test("the lead and the head both see every order in the team, from more than one department", async () => {
  for (const kind of ["division-lead", "department-head"] as const) {
    const page = await data(kind).orders();
    assert.equal(page?.orders.length, orders.length, kind);
    assert.ok(new Set(page?.orders.map((o) => o.unit?.department?.id)).size > 1, kind);
  }
  assert.equal(await data("member").orders(), null);
});

test("the server refuses a lead's edit or cancel outside their division, and allows it inside", async () => {
  const lead = data("division-lead");
  const elsewhere = waitingIn(2);
  assert.equal((await lead.editOrder(elsewhere.id, fields, null)).ok, false);
  assert.equal((await lead.cancelOrder(elsewhere.id)).ok, false);
  const mine = waitingIn(1);
  assert.equal((await lead.editOrder(mine.id, fields, null)).ok, true);
  assert.equal((await lead.cancelOrder(mine.id)).ok, true);
});

test("the server refuses a head's edit or cancel outside their department, and allows it across it", async () => {
  const head = data("department-head");
  const electronics = waitingIn(9);
  assert.equal((await head.editOrder(electronics.id, fields, null)).ok, false);
  assert.equal((await head.cancelOrder(electronics.id)).ok, false);
  for (const divisionId of [1, 2]) {
    assert.equal((await head.cancelOrder(waitingIn(divisionId).id)).ok, true, `division ${divisionId}`);
  }
});

test("a new order goes only to a division in the viewer's scope", async () => {
  assert.equal((await data("division-lead").placeOrder(fields, null)).ok, true);
  assert.equal((await data("division-lead").placeOrder({ ...fields, division: "2" }, null)).ok, false);
  // A head picks one of the department's divisions.
  assert.equal((await data("department-head").placeOrder(fields, null)).ok, false);
  const placed = await data("department-head").placeOrder({ ...fields, division: "2" }, null);
  assert.equal(placed.ok && placed.value.unit?.division.id, 2);
  assert.equal((await data("department-head").placeOrder({ ...fields, division: "9" }, null)).ok, false);
});

test("the server refuses a decision from a lead or a head, and Approve orders from anyone but the team leader", async () => {
  for (const kind of ["division-lead", "department-head"] as const) {
    assert.equal((await data(kind).decideOrder(waitingIn(1).id, { kind: "approve" })).ok, false, kind);
    assert.equal((await data(kind).setApproveOrders({ personId: 6, holds: true })).ok, false, kind);
  }
});

test("on a preview the team leader decides a waiting order and marks an approved one as ordered (boards 70b and 70c)", async () => {
  const leader = data("team-leader");
  const page = (await leader.orders())!;
  assert.equal(page.scope.decides, "team-leader");
  const approved = await leader.decideOrder(waitingIn(1).id, { kind: "approve" });
  assert.ok(approved.ok && approved.value.status === "approved" && approved.value.answer.byYou);
  const stored = orders.find((o) => o.status === "approved")!;
  const marked = await leader.markOrdered(stored.id);
  assert.ok(marked.ok && marked.value.status === "ordered");
  // Only from Approved: an ordered or rejected one stays as it is.
  assert.equal((await leader.markOrdered(orders.find((o) => o.status === "ordered")!.id)).ok, false);
  assert.equal((await leader.markOrdered(orders.find((o) => o.status === "rejected")!.id)).ok, false);
  // The operations lead has full access but does not decide.
  assert.equal((await data("operations-lead").markOrdered(stored.id)).ok, false);
});

test("on a preview the team leader's Access page gives Approve orders, and the operations lead's does not", async () => {
  const leader = (await data("team-leader").divisionAccess())!;
  assert.equal(leader.approveOrders.canGive, true);
  assert.ok(leader.approveOrders.holders.length > 0);
  assert.ok(leader.roleAccess.some((r) => r.place.kind === "team"));
  const operations = (await data("operations-lead").divisionAccess())!;
  assert.equal(operations.approveOrders.canGive, false);
  assert.equal((await data("operations-lead").saveAccess({ personId: 5, where: "team", areas: {}, approveOrders: true })).ok, false);
  assert.equal((await data("team-leader").saveAccess({ personId: 5, where: "team", areas: {}, approveOrders: true })).ok, true);
});
