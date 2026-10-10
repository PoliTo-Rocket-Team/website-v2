"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";
import { ExternalLink, FileText, Link2, MessageSquareText, Plus, Upload, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import type { AccessLevel } from "@/lib/dashboard/division-access";
import {
  checkNewOrder,
  checkQuote,
  formatEuro,
  inOrderTab,
  ORDER_STATUS_LABELS,
  orderActions,
  orderBreakdown,
  orderFormFields,
  orderTabs,
  orderTotal,
  parseEuros,
  sortOrders,
  type DivisionOrders,
  type NewOrderErrors,
  type Order,
  type OrderStatus,
  type OrderTab,
} from "@/lib/dashboard/orders";
import { fileSize } from "@/lib/dashboard/recruitment";
import { shortDate, type WriteResult } from "@/lib/dashboard/write";
import { ConfirmDialog } from "./confirm-dialog";
import { Drawer, DrawerPage, PANEL_DANGER_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { Field, inputClass } from "./field";
import { PANEL } from "./panel";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";

export type OrderWrites = {
  placeOrder: (form: FormData) => Promise<WriteResult<Order>>;
  editOrder: (orderId: number, form: FormData) => Promise<WriteResult<Order>>;
  cancelOrder: (orderId: number) => Promise<WriteResult<null>>;
};

/** What the page has open on the right: nothing, a request, a new request, or an edit of one. */
type Open =
  | { readonly kind: "none" }
  | { readonly kind: "order"; readonly id: number }
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly id: number };

const CLOSED: Open = { kind: "none" };

// Boards 61 to 61d and 61m: the division's requests to the team leader, the
// status tabs, the request panel with Cancel request and Edit order, and the
// New order panel. Props in, nothing fetched; the list lives in this page's
// state, so a sent, edited or cancelled request shows at once. On a phone the
// table is a stack of cards and each panel is a full page.
export function DivisionOrdersView({ data, writes }: { data: DivisionOrders; writes: OrderWrites }) {
  const [orders, setOrders] = useState(data.orders);
  const [tab, setTab] = useState<OrderTab>("all");
  const [open, setOpen] = useState<Open>(CLOSED);
  const [fresh, setFresh] = useState<number | null>(null);
  const tabs = orderTabs(orders);
  const shown = useMemo(() => sortOrders(orders.filter((o) => inOrderTab(o, tab))), [orders, tab]);
  const selected = open.kind === "order" || open.kind === "edit" ? (orders.find((o) => o.id === open.id) ?? null) : null;

  const replace = (order: Order) => setOrders((all) => all.map((o) => (o.id === order.id ? order : o)));

  return (
    <DrawerPage drawerOpen={open.kind !== "none"}>
      <PageHeader
        title="Orders"
        intro="Ask the team leader to place big orders the team card can't cover."
        phone="bar"
        action={
          data.level === "edit" ? (
            <button type="button" onClick={() => setOpen({ kind: "new" })} className={PRIMARY_PILL}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              <span className="md:hidden">New</span>
              <span className="hidden md:inline">New order</span>
            </button>
          ) : undefined
        }
      />

      <div
        role="tablist"
        aria-label="Show orders"
        className="mt-5 flex max-w-full max-md:mt-0 gap-1.5 overflow-x-auto md:inline-flex md:gap-1 md:rounded-[10px] md:border md:border-hairline md:p-1"
      >
        {tabs.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={tab === t.status}
            onClick={() => setTab(t.status)}
            className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:h-7 md:rounded-[7px] md:border-0 md:px-2.5 ${
              tab === t.status ? "border-white-10 bg-white-10 font-semibold text-prt-text" : "border-hairline text-text-2 hover:text-prt-text"
            }`}
          >
            {t.label}
            <span className="font-mono text-[11px] font-normal text-prt-muted">{t.count}</span>
          </button>
        ))}
      </div>

      {shown.length > 0 && (
        <>
          <ul aria-label="Orders" className="mt-4 flex flex-col gap-2.5 md:hidden">
            {shown.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setOpen({ kind: "order", id: o.id })}
                  className={`${PANEL} block w-full px-4 py-3.5 text-left transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                    o.id === fresh ? "border-accent/40" : ""
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-[16px] font-semibold">{o.item}</span>
                    <StatusPill status={o.status} dot={false} />
                  </span>
                  <span className="block truncate text-[13px] text-prt-muted">
                    {[o.reason, o.requestedBy].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-2 block text-[14px] tabular-nums text-text-2">{formatEuro(orderTotal(o))}</span>
                </button>
              </li>
            ))}
          </ul>

          <section aria-label="Orders" className={`${PANEL} mt-5 hidden overflow-hidden md:block`}>
            <div aria-hidden className={`${ROW} h-9 border-b border-hairline`}>
              <span className={EYEBROW}>Item</span>
              <span className={EYEBROW}>Requested by</span>
              <span className={`${EYEBROW} text-right`}>Total</span>
              <span className={EYEBROW}>Status</span>
            </div>
            <ul className="divide-y divide-hairline">
              {shown.map((o) => {
                const on = selected?.id === o.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setOpen({ kind: "order", id: o.id })}
                      className={`${ROW} w-full py-3 text-left transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                        on || o.id === fresh ? "bg-accent/[0.06]" : "hover:bg-white-5"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-medium">{o.item}</span>
                        {o.reason && <span className="block truncate text-[12px] text-prt-muted">{o.reason}</span>}
                      </span>
                      <span className="truncate text-[13px] text-text-2">{o.requestedBy}</span>
                      <span className="text-right">
                        <span className="block text-[14px] font-semibold tabular-nums">{formatEuro(orderTotal(o))}</span>
                        <span className="block text-[11px] tabular-nums text-prt-muted">{orderBreakdown(o)}</span>
                      </span>
                      <span className="min-w-0">
                        <StatusPill status={o.status} dot />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <OrderPanel
        order={open.kind === "order" ? selected : null}
        level={data.level}
        onClose={() => setOpen(CLOSED)}
        onEdit={(order) => setOpen({ kind: "edit", id: order.id })}
        cancelOrder={writes.cancelOrder}
        onCancelled={(order) => {
          setOrders((all) => all.filter((o) => o.id !== order.id));
          setOpen(CLOSED);
        }}
      />

      <OrderFormDrawer
        key={open.kind === "new" ? "new" : open.kind === "edit" ? `edit-${open.id}` : "closed"}
        open={open.kind === "new" || (open.kind === "edit" && selected !== null)}
        onOpenChange={(next) => !next && setOpen(selected && open.kind === "edit" ? { kind: "order", id: selected.id } : CLOSED)}
        divisionName={data.division.name}
        editing={open.kind === "edit" ? selected : null}
        writes={writes}
        onSaved={(order, isNew) => {
          if (isNew) {
            setOrders((all) => [order, ...all]);
            setTab("all");
            setOpen(CLOSED);
          } else {
            replace(order);
            setOpen({ kind: "order", id: order.id });
          }
          setFresh(order.id);
        }}
      />
    </DrawerPage>
  );
}

const ROW = "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_152px] items-center gap-x-4 px-[18px]";

// Board 61: Waiting is the neutral pill, Approved green, Changes requested
// amber, Rejected red. The desktop table marks each with a dot; the phone
// cards (61m) show the pill alone.
const STATUS_STYLES: Readonly<Record<OrderStatus, { pill: string; dot: string }>> = {
  waiting: { pill: "bg-white-10 text-text-2", dot: "bg-warning" },
  approved: { pill: "bg-success-soft text-success", dot: "bg-success" },
  "changes-requested": { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  rejected: { pill: "bg-danger-soft text-danger", dot: "bg-danger" },
};

function StatusPill({ status, dot }: { status: OrderStatus; dot: boolean }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] ${style.pill}`}>
      {dot && <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />}
      <span className="truncate">{ORDER_STATUS_LABELS[status]}</span>
    </span>
  );
}

const SPEC_LABEL = "whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-dim";

/**
 * Boards 61c and 61d: one request, with the team leader's reason when they
 * sent it back. What the lead may still do with it is the domain's answer
 * (orderActions); an approved or rejected request has nothing left to do.
 */
function OrderPanel({
  order,
  level,
  onClose,
  onEdit,
  cancelOrder,
  onCancelled,
}: {
  order: Order | null;
  level: AccessLevel;
  onClose: () => void;
  onEdit: (order: Order) => void;
  cancelOrder: OrderWrites["cancelOrder"];
  onCancelled: (order: Order) => void;
}) {
  // The panel keeps showing the last request while it closes.
  const [shown, setShown] = useState<Order | null>(order);
  if (order !== null && order !== shown) setShown(order);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = order ?? shown;
  if (current === null) return null;
  const actions = orderActions(current.status, level);
  const total = orderTotal(current);

  const cancel = () =>
    startTransition(async () => {
      const result = await cancelOrder(current.id);
      if (!result.ok) {
        toast.error("Could not cancel the request", { description: result.error });
        return;
      }
      setAsking(false);
      onCancelled(current);
      toast.success(`Cancelled the request for ${current.item}`);
    });

  return (
    <SidePanel
      open={order !== null}
      onOpenChange={(next) => !next && onClose()}
      title={current.item}
      detail={[current.reason, formatEuro(total)].filter(Boolean).join(" · ")}
      footer={
        actions.cancel || actions.edit ? (
          <>
            {actions.cancel && (
              <button type="button" onClick={() => setAsking(true)} className={PANEL_DANGER_BUTTON}>
                Cancel request
              </button>
            )}
            {actions.edit && (
              <button
                type="button"
                onClick={() => onEdit(current)}
                className={`${PANEL_PRIMARY_BUTTON} ${actions.cancel ? "" : "col-span-2"}`}
              >
                {actions.edit === "edit-and-resend" ? "Edit and send again" : "Edit order"}
              </button>
            )}
          </>
        ) : undefined
      }
    >
      <PanelBody className="flex flex-col gap-6">
        {current.status === "changes-requested" && (
          <section className="rounded-xl border border-warning/40 bg-warning/[0.06] p-4">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-warning">
              <MessageSquareText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Changes requested
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-prt-text">“{current.changes.reason}”</p>
            <p className="mt-2 text-[12px] text-prt-muted">
              {current.changes.by}, team leader · {shortDate(current.changes.on)}
            </p>
          </section>
        )}

        <Spec label="Item">{current.item}</Spec>

        <div className="grid grid-cols-[0.7fr_1.3fr_1fr] gap-3">
          <Spec label="Quantity">{current.quantity}</Spec>
          <Spec label="Price without IVA">{formatEuro(current.unitPrice)} each</Spec>
          <Spec label="Total">{formatEuro(total)}</Spec>
        </div>

        {current.link && (
          <Spec label="Link">
            <a
              href={current.link}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-accent transition-colors duration-300 ease-out hover:text-accent-hover"
            >
              {current.link.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          </Spec>
        )}

        {current.reason && <Spec label="Why we need it">{current.reason}</Spec>}

        {current.quote && <QuoteCard quote={current.quote} />}
      </PanelBody>

      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        icon={<XCircle className="h-5 w-5" strokeWidth={1.75} />}
        title="Cancel this request?"
        description={`The request for ${current.item} leaves your orders, and the team leader no longer sees it.`}
        confirmLabel="Cancel request"
        cancelLabel="Keep it"
        danger
        pending={pending}
        onConfirm={cancel}
      />
    </SidePanel>
  );
}

function Spec({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={SPEC_LABEL}>{label}</p>
      <div className="mt-1.5 text-[14px] leading-relaxed text-prt-text">{children}</div>
    </div>
  );
}

function QuoteCard({ quote }: { quote: NonNullable<Order["quote"]> }) {
  const body = (
    <>
      <FileText aria-hidden className="h-5 w-5 shrink-0 text-accent" strokeWidth={1.75} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px]">{quote.name}</span>
        <span className="block text-[12px] text-prt-muted">{["Quote", quote.size === null ? null : fileSize(quote.size)].filter(Boolean).join(" · ")}</span>
      </span>
      {quote.href && <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />}
    </>
  );
  const card = "flex items-center gap-3 rounded-xl border border-hairline px-4 py-3";
  return quote.href ? (
    <a href={quote.href} target="_blank" rel="noopener noreferrer" className={`${card} transition-colors duration-300 ease-out hover:border-border-strong`}>
      {body}
    </a>
  ) : (
    <div className={card}>{body}</div>
  );
}

const EMPTY = { item: "", link: "", price: "", quantity: "1", reason: "" };

/**
 * New order (board 61b), and the same form for Edit order and Edit and send
 * again, opened on the request as it was sent. A new quote replaces the one
 * on file; leaving it empty keeps it.
 */
function OrderFormDrawer({
  open,
  onOpenChange,
  divisionName,
  editing,
  writes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionName: string;
  editing: Order | null;
  writes: OrderWrites;
  onSaved: (order: Order, isNew: boolean) => void;
}) {
  const [fields, setFields] = useState(editing === null ? EMPTY : orderFormFields(editing));
  const [quote, setQuote] = useState<File | null>(null);
  const [errors, setErrors] = useState<NewOrderErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const unitPrice = parseEuros(fields.price);
  const quantity = /^\d+$/.test(fields.quantity.trim()) ? Number(fields.quantity) : null;
  const total = unitPrice !== null && quantity !== null ? unitPrice * quantity : null;
  const resend = editing !== null && orderActions(editing.status, "edit").edit === "edit-and-resend";
  const failed = editing === null ? "Could not send the request" : "Could not save the request";

  const set = (name: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setFields((f) => ({ ...f, [name]: e.target.value }));
    setErrors((all) => ({ ...all, [name === "price" ? "unitPrice" : name]: undefined }));
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const checked = checkNewOrder(fields);
    const quoteError = quote === null ? null : checkQuote(quote);
    if (!checked.ok || quoteError !== null) {
      setErrors({ ...(checked.ok ? {} : checked.errors), ...(quoteError ? { quote: quoteError } : {}) });
      return;
    }
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    if (quote) form.set("quote", quote);
    setSubmitting(true);
    try {
      const result = editing === null ? await writes.placeOrder(form) : await writes.editOrder(editing.id, form);
      if (!result.ok) {
        toast.error(failed, { description: result.error, duration: 5000 });
        return;
      }
      onSaved(result.value, editing === null);
      toast.success(editing === null || resend ? `Sent ${result.value.item} to the team leader` : `Saved ${result.value.item}`);
    } catch (err) {
      toast.error(failed, {
        description: err instanceof Error ? err.message : "Please try again.",
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing === null ? "New order" : "Edit order"}
      detail={`For ${divisionName}`}
      submitLabel={editing === null || resend ? "Send request" : "Save changes"}
      submitting={submitting}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5">
        <Field label="Item" error={errors.item}>
          {(id, describedBy) => (
            <input id={id} value={fields.item} onChange={set("item")} aria-invalid={!!errors.item} aria-describedby={describedBy} className={inputClass(errors.item)} />
          )}
        </Field>

        <Field label="Link" error={errors.link}>
          {(id, describedBy) => (
            <div className="relative">
              <Link2 aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
              <input
                id={id}
                type="url"
                inputMode="url"
                value={fields.link}
                onChange={set("link")}
                placeholder="https://"
                aria-invalid={!!errors.link}
                aria-describedby={describedBy}
                className={`${inputClass(errors.link)} pl-10`}
              />
            </div>
          )}
        </Field>

        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-3">
          <Field label="Price without IVA" error={errors.unitPrice}>
            {(id, describedBy) => (
              <div className="relative">
                <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-prt-text">
                  €
                </span>
                <input
                  id={id}
                  inputMode="decimal"
                  value={fields.price}
                  onChange={set("price")}
                  aria-invalid={!!errors.unitPrice}
                  aria-describedby={describedBy}
                  className={`${inputClass(errors.unitPrice)} pl-8`}
                />
              </div>
            )}
          </Field>
          <Field label="Quantity" error={errors.quantity}>
            {(id, describedBy) => (
              <input
                id={id}
                inputMode="numeric"
                value={fields.quantity}
                onChange={set("quantity")}
                aria-invalid={!!errors.quantity}
                aria-describedby={describedBy}
                className={inputClass(errors.quantity)}
              />
            )}
          </Field>
        </div>

        <p className="-mt-1 flex h-9 items-center justify-between rounded-[8px] bg-white-5 px-3 text-[13px]">
          <span className="text-prt-muted">Total without IVA</span>
          <output className="font-semibold tabular-nums">{total === null ? "" : formatEuro(total)}</output>
        </p>

        <Field label="Reason" error={errors.reason}>
          {(id, describedBy) => (
            <textarea
              id={id}
              value={fields.reason}
              onChange={set("reason")}
              rows={3}
              aria-invalid={!!errors.reason}
              aria-describedby={describedBy}
              className={`${inputClass(errors.reason)} block h-auto min-h-[72px] resize-none py-3 leading-[1.5]`}
            />
          )}
        </Field>

        <QuoteField
          kept={editing?.quote?.name ?? null}
          file={quote}
          error={errors.quote}
          onFile={(file) => {
            setQuote(file);
            setErrors((all) => ({ ...all, quote: undefined }));
          }}
        />
      </div>
    </Drawer>
  );
}

function QuoteField({
  kept,
  file,
  error,
  onFile,
}: {
  /** The quote already on file when editing; a new file replaces it. */
  kept: string | null;
  file: File | null;
  error?: string;
  onFile: (file: File | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const border = error !== undefined ? "border-danger" : over ? "border-accent/60 bg-accent-soft" : "border-white-10";

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <Field label="Quote" hint="optional, PDF" error={error}>
      {(id, describedBy) => (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={input}
            id={id}
            type="file"
            accept="application/pdf,.pdf"
            aria-describedby={describedBy}
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {file === null ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={`flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] border text-[13px] text-text-2 transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${border}`}
            >
              <Upload aria-hidden className="h-4 w-4 shrink-0" />
              {kept === null ? (
                <span>
                  Drop a PDF here or <span className="font-semibold text-prt-text">browse</span>
                </span>
              ) : (
                <span className="min-w-0 truncate">
                  {kept} · <span className="font-semibold text-prt-text">replace</span>
                </span>
              )}
            </button>
          ) : (
            <div className={`flex h-[52px] items-center gap-3 rounded-[10px] border bg-white-5 px-3.5 ${border}`}>
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[14px]">{file.name}</span>
              <button
                type="button"
                onClick={() => onFile(null)}
                aria-label={`Remove ${file.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors duration-300 ease-out hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
