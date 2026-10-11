import assert from "node:assert/strict";
import { test } from "node:test";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { orders } from "./orders";

// The Orders page on a preview (issue #233): who sees which orders, and the
// writes the server refuses, checked through the data interface the pages use.

function data(kind: ViewerKind) {
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
