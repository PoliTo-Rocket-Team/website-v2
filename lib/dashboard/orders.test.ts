import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkNewOrder,
  inOrderTab,
  orderActions,
  orderBreakdown,
  orderFormFields,
  orderTabs,
  parseEuros,
  sortOrders,
  stateAfterEdit,
  type Order,
  type OrderState,
} from "./orders";

test("euros as typed become whole cents, and anything else is refused", () => {
  assert.equal(parseEuros("59.55"), 5955);
  assert.equal(parseEuros("59,55"), 5955);
  assert.equal(parseEuros("€ 59.5"), 5950);
  assert.equal(parseEuros("1,234.50"), 123450);
  assert.equal(parseEuros("12"), 1200);
  for (const bad of ["", "abc", "1.234", "-3", "5.5.5"]) assert.equal(parseEuros(bad), null, bad);
});

function order(state: OrderState, requestedOn = "2026-10-01"): Order {
  return { ...state, id: 0, item: "x", reason: null, link: null, requestedBy: "x", unitPrice: 100, quantity: 1, shipping: null, requestedOn, quote: null };
}

const sentBack: OrderState = { status: "changes-requested", changes: { reason: "Add a second quote.", by: "Alessandro Greco", on: "2026-10-05" } };

test("the tabs count every status, empty ones included, and All counts them all", () => {
  const orders = [order({ status: "waiting" }), order({ status: "waiting" }), order({ status: "approved" }), order(sentBack)];
  assert.deepEqual(
    orderTabs(orders).map((t) => `${t.label} ${t.count}`),
    ["All 4", "Waiting 2", "Approved 1", "Changes requested 1", "Rejected 0"],
  );
  assert.equal(orders.filter((o) => inOrderTab(o, "changes-requested")).length, 1);
  assert.equal(orders.filter((o) => inOrderTab(o, "all")).length, 4);
});

test("only a request the team leader has not settled can be cancelled or edited", () => {
  assert.deepEqual(orderActions("waiting"), { cancel: true, edit: "edit" });
  assert.deepEqual(orderActions("changes-requested"), { cancel: true, edit: "edit-and-resend" });
  assert.deepEqual(orderActions("approved"), { cancel: false, edit: null });
  assert.deepEqual(orderActions("rejected"), { cancel: false, edit: null });
});

test("an edit sends the request back to the team leader, and an answered one cannot be edited", () => {
  assert.deepEqual(stateAfterEdit("changes-requested"), { status: "waiting" });
  assert.deepEqual(stateAfterEdit("waiting"), { status: "waiting" });
  assert.equal(stateAfterEdit("approved"), null);
  assert.equal(stateAfterEdit("rejected"), null);
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

test("a new order needs an item, a price, a whole quantity and a reason; the link is optional but real", () => {
  const ok = checkNewOrder({ item: " Steel wire ", link: "", price: "59.55", quantity: "2", reason: "For the launch rail" });
  assert.deepEqual(ok, { ok: true, value: { item: "Steel wire", link: null, unitPrice: 5955, quantity: 2, reason: "For the launch rail" } });

  const bad = checkNewOrder({ item: "", link: "amzn.eu/x", price: "0", quantity: "1.5", reason: " " });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["item", "link", "quantity", "reason", "unitPrice"]);
});
