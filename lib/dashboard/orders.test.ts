import assert from "node:assert/strict";
import { test } from "node:test";
import { checkNewOrder, orderBreakdown, orderFigures, parseEuros, sortOrders, type Order } from "./orders";

test("euros as typed become whole cents, and anything else is refused", () => {
  assert.equal(parseEuros("59.55"), 5955);
  assert.equal(parseEuros("59,55"), 5955);
  assert.equal(parseEuros("€ 59.5"), 5950);
  assert.equal(parseEuros("1,234.50"), 123450);
  assert.equal(parseEuros("12"), 1200);
  for (const bad of ["", "abc", "1.234", "-3", "5.5.5"]) assert.equal(parseEuros(bad), null, bad);
});

function order(status: Order["status"], unitPrice: number, quantity: number, shipping: number | null, requestedOn: string): Order {
  return { id: 0, item: "x", reason: null, link: null, requestedBy: "x", unitPrice, quantity, shipping, status, requestedOn, quote: null };
}

test("the figures count waiting and ordered totals, and only this year's placed spend", () => {
  const figures = orderFigures(
    [
      order("waiting", 5955, 2, null, "2026-10-08"),
      order("waiting", 15000, 1, 1330, "2026-10-06"),
      order("ordered", 1180, 3, null, "2026-10-01"),
      order("delivered", 4824, 1, null, "2026-09-22"),
      order("delivered", 9999, 1, null, "2025-12-30"),
      order("declined", 50000, 1, null, "2026-05-01"),
    ],
    2026,
  );
  assert.deepEqual(figures, {
    waiting: { count: 2, total: 11910 + 16330 },
    ordered: { count: 1, total: 3540 },
    yearSpend: 3540 + 4824,
  });
});

test("the breakdown shows quantity and shipping only when there are some", () => {
  assert.equal(orderBreakdown({ unitPrice: 5955, quantity: 2, shipping: null }), "€59.55 × 2");
  assert.equal(orderBreakdown({ unitPrice: 15000, quantity: 1, shipping: 1330 }), "€150.00 + €13.30");
  assert.equal(orderBreakdown({ unitPrice: 12480, quantity: 1, shipping: null }), "€124.80");
});

test("orders sort waiting first, newest first within a status", () => {
  const sorted = sortOrders([
    order("delivered", 1, 1, null, "2026-10-09"),
    order("waiting", 1, 1, null, "2026-10-01"),
    order("waiting", 1, 1, null, "2026-10-05"),
    order("ordered", 1, 1, null, "2026-10-08"),
  ]);
  assert.deepEqual(
    sorted.map((o) => `${o.status} ${o.requestedOn}`),
    ["waiting 2026-10-05", "waiting 2026-10-01", "ordered 2026-10-08", "delivered 2026-10-09"],
  );
});

test("a new order needs an item, a price, a whole quantity and a reason; the link is optional but real", () => {
  const ok = checkNewOrder({ item: " Steel wire ", link: "", price: "59.55", quantity: "2", reason: "For the launch rail" });
  assert.deepEqual(ok, { ok: true, value: { item: "Steel wire", link: null, unitPrice: 5955, quantity: 2, reason: "For the launch rail" } });

  const bad = checkNewOrder({ item: "", link: "amzn.eu/x", price: "0", quantity: "1.5", reason: " " });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.deepEqual(Object.keys(bad.errors).sort(), ["item", "link", "quantity", "reason", "unitPrice"]);
});
