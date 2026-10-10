import { z } from "zod";

// The division lead's Orders page (Dashboard v2 boards 61 to 61d, issue
// #172): the division's purchase requests to the team leader, what state each
// is in, and what the lead may still do with it. Money is whole euro cents
// everywhere, so totals never pick up float error.

/** The states a request shows: waiting for the team leader, or their answer. */
export const ORDER_STATUSES = ["waiting", "approved", "changes-requested", "rejected"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  waiting: "Waiting",
  approved: "Approved",
  "changes-requested": "Changes requested",
  rejected: "Rejected",
};

/**
 * A cancelled request is stored, so the record keeps it, but it is no longer
 * a request: it leaves the page. Only the data sources see this state.
 */
export type StoredOrderStatus = OrderStatus | "cancelled";

/** Euro cents. */
export type Cents = number;

/** What the team leader wrote when they sent a request back (board 61d). */
export type ChangeRequest = {
  readonly reason: string;
  /** The team leader who sent it back: "Alessandro Greco". */
  readonly by: string;
  /** ISO date. */
  readonly on: string;
};

/** Where a request stands. Only a request sent back carries the team leader's reason. */
export type OrderState =
  | { readonly status: "waiting" | "approved" | "rejected" }
  | { readonly status: "changes-requested"; readonly changes: ChangeRequest };

export type OrderQuote = {
  readonly name: string;
  /** Bytes, when the source knows them. */
  readonly size: number | null;
  /** Where the file opens; null where there is no route to it. */
  readonly href: string | null;
};

export type Order = OrderState & {
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
  /** ISO date the request was sent. */
  readonly requestedOn: string;
  readonly quote: OrderQuote | null;
};

export type DivisionOrders = {
  readonly division: { readonly id: number; readonly name: string };
  readonly orders: readonly Order[];
};

export function orderTotal(order: Pick<Order, "unitPrice" | "quantity" | "shipping">): Cents {
  return order.unitPrice * order.quantity + (order.shipping ?? 0);
}

/** The requests still waiting for the team leader, and what they add up to (the lead Overview, board 56). */
export function waitingOrders(orders: readonly Order[]): { count: number; total: Cents } {
  const waiting = orders.filter((o) => o.status === "waiting");
  return { count: waiting.length, total: waiting.reduce((sum, o) => sum + orderTotal(o), 0) };
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

/**
 * What the lead may still do with a request (boards 61c and 61d). A request
 * the team leader has not answered can be cancelled or edited; one sent back
 * can be cancelled, or edited and sent again, which puts it back to waiting.
 * An approved or rejected request is the team leader's answer: nothing is left
 * to do with it.
 */
export type OrderActions = {
  readonly cancel: boolean;
  readonly edit: "edit" | "edit-and-resend" | null;
};

export function orderActions(status: OrderStatus): OrderActions {
  switch (status) {
    case "waiting":
      return { cancel: true, edit: "edit" };
    case "changes-requested":
      return { cancel: true, edit: "edit-and-resend" };
    case "approved":
    case "rejected":
      return { cancel: false, edit: null };
  }
}

/** The state an edited request is in afterwards: an edit always goes back to the team leader. */
export function stateAfterEdit(status: OrderStatus): OrderState | null {
  return orderActions(status).edit === null ? null : { status: "waiting" };
}

/** Newest request first, whatever its state (board 61). */
export function sortOrders(orders: readonly Order[]): Order[] {
  return [...orders].sort((a, b) => b.requestedOn.localeCompare(a.requestedOn) || b.id - a.id);
}

export type OrderTab = OrderStatus | "all";

/** The filter tabs (board 61): All, then every status, each with its count, empty ones included. */
export function orderTabs(orders: readonly Order[]): { status: OrderTab; label: string; count: number }[] {
  return [
    { status: "all", label: "All", count: orders.length },
    ...ORDER_STATUSES.map((status) => ({
      status,
      label: ORDER_STATUS_LABELS[status],
      count: orders.filter((o) => o.status === status).length,
    })),
  ];
}

export function inOrderTab(order: Pick<Order, "status">, tab: OrderTab): boolean {
  return tab === "all" || order.status === tab;
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

/** A request's fields as the New order form shows them, for Edit order. */
export function orderFormFields(order: Pick<Order, "item" | "link" | "unitPrice" | "quantity" | "reason">): {
  item: string;
  link: string;
  price: string;
  quantity: string;
  reason: string;
} {
  return {
    item: order.item,
    link: order.link ?? "",
    price: (order.unitPrice / 100).toFixed(2),
    quantity: String(order.quantity),
    reason: order.reason ?? "",
  };
}
