import { z } from "zod";

// The division lead's Orders page (board 44, issue #145): the division's
// purchase requests, the three figures over them, and the New order rules.
// Money is whole euro cents everywhere, so totals never pick up float error.

/** Waiting for the team leader, placed, arrived; or turned down. */
export const ORDER_STATUSES = ["waiting", "ordered", "delivered", "declined"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  waiting: "Waiting",
  ordered: "Ordered",
  delivered: "Delivered",
  declined: "Declined",
};

/** Euro cents. */
export type Cents = number;

export type Order = {
  readonly id: number;
  readonly item: string;
  /** Why it is needed: "For the launch rail". */
  readonly reason: string | null;
  readonly link: string | null;
  readonly requestedBy: string;
  readonly unitPrice: Cents;
  readonly quantity: number;
  /** Shipping on top of the items, when the order carries one. */
  readonly shipping: Cents | null;
  readonly status: OrderStatus;
  /** ISO date the request was sent. */
  readonly requestedOn: string;
  /** The attached quote's file name, when one was sent. */
  readonly quote: string | null;
};

export type DivisionOrders = {
  readonly division: { readonly id: number; readonly name: string };
  /** The year "This year" counts. */
  readonly year: number;
  readonly orders: readonly Order[];
};

export function orderTotal(order: Pick<Order, "unitPrice" | "quantity" | "shipping">): Cents {
  return order.unitPrice * order.quantity + (order.shipping ?? 0);
}

const euro = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });

/** "€2,140.85" */
export function formatEuro(cents: Cents): string {
  return euro.format(cents / 100);
}

/** The small line under a total: "€59.55 × 2", "€150.00 + €13.30", or the unit price alone. */
export function orderBreakdown(order: Pick<Order, "unitPrice" | "quantity" | "shipping">): string {
  const items =
    order.quantity === 1 ? formatEuro(order.unitPrice) : `${formatEuro(order.unitPrice)} × ${order.quantity}`;
  return order.shipping === null ? items : `${items} + ${formatEuro(order.shipping)}`;
}

export type OrderFigures = {
  readonly waiting: { readonly count: number; readonly total: Cents };
  readonly ordered: { readonly count: number; readonly total: Cents };
  /** What the division spent in `year`: orders placed or delivered that year. */
  readonly yearSpend: Cents;
};

function sum(orders: readonly Order[]): Cents {
  return orders.reduce((total, o) => total + orderTotal(o), 0);
}

export function orderFigures(orders: readonly Order[], year: number): OrderFigures {
  const waiting = orders.filter((o) => o.status === "waiting");
  const ordered = orders.filter((o) => o.status === "ordered");
  const spent = orders.filter(
    (o) => (o.status === "ordered" || o.status === "delivered") && Number(o.requestedOn.slice(0, 4)) === year,
  );
  return {
    waiting: { count: waiting.length, total: sum(waiting) },
    ordered: { count: ordered.length, total: sum(ordered) },
    yearSpend: sum(spent),
  };
}

/** Waiting first, then ordered, delivered and declined; newest first within each. */
export function sortOrders(orders: readonly Order[]): Order[] {
  return [...orders].sort(
    (a, b) =>
      ORDER_STATUSES.indexOf(a.status) - ORDER_STATUSES.indexOf(b.status) ||
      b.requestedOn.localeCompare(a.requestedOn) ||
      b.id - a.id,
  );
}

/** The filter tabs: All, then each status the board shows, and Declined only when there is one. */
export function orderTabs(orders: readonly Order[]): { status: OrderStatus | "all"; label: string; count: number }[] {
  const shown = ORDER_STATUSES.filter((s) => s !== "declined" || orders.some((o) => o.status === s));
  return [
    { status: "all", label: "All", count: orders.length },
    ...shown.map((status) => ({
      status,
      label: ORDER_STATUS_LABELS[status],
      count: orders.filter((o) => o.status === status).length,
    })),
  ];
}

/**
 * Euros as a person types them, to cents: "59.55", "59,55", "€ 59.55",
 * "1,234.50". Null for anything else, or for more than two decimals.
 */
export function parseEuros(text: string): Cents | null {
  const bare = text.replace(/€/g, "").replace(/\s/g, "");
  if (bare === "") return null;
  // A comma followed by exactly one or two digits at the end is a decimal comma.
  const normal = /,\d{1,2}$/.test(bare) && !bare.includes(".") ? bare.replace(",", ".") : bare.replace(/,/g, "");
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normal);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** A quote is a PDF of at most this many bytes. */
export const MAX_QUOTE_BYTES = 10 * 1024 * 1024;

export type NewOrder = {
  readonly item: string;
  readonly link: string | null;
  readonly unitPrice: Cents;
  readonly quantity: number;
  readonly reason: string;
};

export type NewOrderErrors = Partial<Record<keyof NewOrder | "quote", string>>;

const httpUrl = z
  .string()
  .url("Paste the full link, starting with https://")
  .refine((url) => /^https?:\/\//i.test(url), "Paste the full link, starting with https://");

/**
 * Checks the New order fields as typed, on the client and again on the
 * server. Answers the order, or one message per field that is wrong.
 */
export function checkNewOrder(fields: {
  item: string;
  link: string;
  price: string;
  quantity: string;
  reason: string;
}): { ok: true; value: NewOrder } | { ok: false; errors: NewOrderErrors } {
  const errors: NewOrderErrors = {};
  const item = fields.item.trim();
  if (item === "") errors.item = "Say what to buy.";
  else if (item.length > 120) errors.item = "Keep the item under 120 characters.";

  const linkText = fields.link.trim();
  let link: string | null = null;
  if (linkText !== "") {
    const parsed = httpUrl.safeParse(linkText);
    if (parsed.success) link = parsed.data;
    else errors.link = parsed.error.issues[0]?.message;
  }

  const unitPrice = parseEuros(fields.price);
  if (unitPrice === null || unitPrice === 0) errors.unitPrice = "Write the price in euros, like 59.55.";

  const quantity = /^\d+$/.test(fields.quantity.trim()) ? Number(fields.quantity.trim()) : NaN;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) errors.quantity = "A whole number from 1 to 999.";

  const reason = fields.reason.trim();
  if (reason === "") errors.reason = "Say what it is for.";
  else if (reason.length > 500) errors.reason = "Keep the reason under 500 characters.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { item, link, unitPrice: unitPrice!, quantity, reason } };
}

/** Whether a picked file can be sent as the quote. */
export function checkQuote(file: { type: string; size: number; name: string }): string | null {
  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!pdf) return "The quote must be a PDF.";
  if (file.size > MAX_QUOTE_BYTES) return "The quote must be 10 MB or less.";
  return null;
}
