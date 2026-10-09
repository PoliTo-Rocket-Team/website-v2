"use client";

import { useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { FileText, Link2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  checkNewOrder,
  checkQuote,
  formatEuro,
  ORDER_STATUS_LABELS,
  orderBreakdown,
  orderFigures,
  orderTabs,
  orderTotal,
  parseEuros,
  sortOrders,
  type DivisionOrders,
  type NewOrderErrors,
  type Order,
  type OrderStatus,
} from "@/lib/dashboard/orders";
import { shortUnitName } from "@/lib/dashboard/division-access";
import type { WriteResult } from "@/lib/dashboard/write";
import { Drawer, DrawerPage } from "./drawer";
import { Field, inputClass } from "./field";
import { PANEL } from "./panel";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";

type PlaceOrder = (form: FormData) => Promise<WriteResult<Order>>;

// Board 44: the division's purchase requests, three figures over them, the
// status tabs, and the New order drawer. Props in, nothing fetched; the list
// lives in this page's state, so a sent request shows at once.
export function DivisionOrdersView({ data, placeOrder }: { data: DivisionOrders; placeOrder: PlaceOrder }) {
  const [orders, setOrders] = useState(data.orders);
  const [tab, setTab] = useState<OrderStatus | "all">("all");
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<number | null>(null);
  const figures = orderFigures(orders, data.year);
  const tabs = orderTabs(orders);
  const shown = useMemo(() => sortOrders(tab === "all" ? orders : orders.filter((o) => o.status === tab)), [orders, tab]);
  const unit = shortUnitName(data.division.name);

  return (
    <DrawerPage drawerOpen={open}>
      <PageHeader
        title="Orders"
        intro="Ask the team leader to place big orders the team card can't cover."
        action={
          <button type="button" onClick={() => setOpen(true)} className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New order
          </button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <Figure label="Waiting" value={String(figures.waiting.count)} detail={`${formatEuro(figures.waiting.total)} to be placed`} />
        <Figure label="Ordered" value={String(figures.ordered.count)} detail={`${formatEuro(figures.ordered.total)} on the way`} />
        <Figure label="This year" value={formatEuro(figures.yearSpend)} detail={`${unit} spend`} />
      </div>

      <div role="tablist" aria-label="Show orders" className="mt-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-[10px] border border-hairline p-1">
        {tabs.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={tab === t.status}
            onClick={() => setTab(t.status)}
            className={`flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              tab === t.status ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
            }`}
          >
            {t.label}
            <span className="font-mono text-[11px] font-normal text-prt-muted">{t.count}</span>
          </button>
        ))}
      </div>

      {shown.length > 0 && (
        <section aria-label="Orders" className={`${PANEL} mt-5 overflow-hidden`}>
          <div aria-hidden className={`${ROW} hidden h-9 border-b border-hairline md:grid`}>
            <span className={EYEBROW}>Item</span>
            <span className={EYEBROW}>Requested by</span>
            <span className={`${EYEBROW} text-right`}>Total</span>
            <span className={EYEBROW}>Status</span>
          </div>
          <ul className="divide-y divide-hairline">
            {shown.map((o) => (
              <li key={o.id} className={`${ROW} py-3 ${o.id === fresh ? "bg-accent/[0.06]" : ""}`}>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{o.item}</span>
                  {o.reason && <span className="block truncate text-[12px] text-prt-muted">{o.reason}</span>}
                  <span className="block truncate text-[12px] text-prt-muted md:hidden">{o.requestedBy}</span>
                </span>
                <span className="hidden truncate text-[13px] text-text-2 md:block">{o.requestedBy}</span>
                <span className="text-right">
                  <span className="block text-[14px] font-semibold tabular-nums">{formatEuro(orderTotal(o))}</span>
                  <span className="block text-[11px] tabular-nums text-prt-muted">{orderBreakdown(o)}</span>
                </span>
                <span className="col-span-2 md:col-span-1">
                  <StatusPill status={o.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewOrderDrawer
        key={open ? "open" : "closed"}
        open={open}
        onOpenChange={setOpen}
        divisionName={data.division.name}
        placeOrder={placeOrder}
        onPlaced={(order) => {
          setOrders((all) => [order, ...all]);
          setFresh(order.id);
          setTab("all");
          setOpen(false);
        }}
      />
    </DrawerPage>
  );
}

const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_96px] md:px-[18px]";

function Figure({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className={`${PANEL} px-4 pb-4 pt-4 md:pb-5`}>
      <p className={`${EYEBROW} tracking-[0.2em]`}>{label}</p>
      <p className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.01em] tabular-nums">{value}</p>
      <p className="mt-1 text-[12px] text-prt-muted">{detail}</p>
    </div>
  );
}

// Board 44 draws Ordered in blue; the palette has no blue, so it is the
// neutral pill, between Waiting's warning and Delivered's success.
const STATUS_STYLES: Readonly<Record<OrderStatus, string>> = {
  waiting: "bg-warning-soft text-warning",
  ordered: "bg-white-10 text-prt-text",
  delivered: "bg-success-soft text-success",
  declined: "bg-white-5 text-prt-muted",
};

function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] ${STATUS_STYLES[status]}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const EMPTY = { item: "", link: "", price: "", quantity: "1", reason: "" };

function NewOrderDrawer({
  open,
  onOpenChange,
  divisionName,
  placeOrder,
  onPlaced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionName: string;
  placeOrder: PlaceOrder;
  onPlaced: (order: Order) => void;
}) {
  const [fields, setFields] = useState(EMPTY);
  const [quote, setQuote] = useState<File | null>(null);
  const [errors, setErrors] = useState<NewOrderErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const unitPrice = parseEuros(fields.price);
  const quantity = /^\d+$/.test(fields.quantity.trim()) ? Number(fields.quantity) : null;
  const total = unitPrice !== null && quantity !== null ? unitPrice * quantity : null;

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
      const result = await placeOrder(form);
      if (!result.ok) {
        toast.error("Could not send the request", { description: result.error, duration: 5000 });
        return;
      }
      onPlaced(result.value);
      toast.success(`Sent ${result.value.item} to the team leader`);
    } catch (err) {
      toast.error("Could not send the request", {
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
      title="New order"
      detail={`For ${divisionName}`}
      submitLabel="Send request"
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

function QuoteField({ file, error, onFile }: { file: File | null; error?: string; onFile: (file: File | null) => void }) {
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
              <Upload aria-hidden className="h-4 w-4" />
              <span>
                Drop a PDF here or <span className="font-semibold text-prt-text">browse</span>
              </span>
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
