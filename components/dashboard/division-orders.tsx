"use client";

import { useId, useMemo, useRef, useState, useTransition, type DragEvent, type FormEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  ExternalLink,
  FileText,
  Link2,
  ListFilter,
  Lock,
  MessageSquareText,
  Minus,
  PackageCheck,
  Plus,
  Search,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  answeredLine,
  appliedSelection,
  approvedNote,
  canEditOrder,
  checkDecision,
  checkNewOrder,
  checkQuote,
  dayMonthYear,
  departmentTick,
  divisionShort,
  filterOrders,
  formatEuro,
  NO_FILTERS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  orderActions,
  orderBreakdown,
  orderFormFields,
  orderingDivisions,
  orderPage,
  ordersIntro,
  orderTotal,
  pagerSlots,
  parseEuros,
  toggleDepartment,
  unitLine,
  type NewOrderErrors,
  type Order,
  type OrderDecision,
  type OrderDivision,
  type OrderFilters,
  type OrdersPage,
  type OrdersScope,
  type OrderStatus,
  type OrgDepartmentUnits,
} from "@/lib/dashboard/orders";
import { fileSize } from "@/lib/dashboard/recruitment";
import { shortDate, type WriteResult } from "@/lib/dashboard/write";
import { ConfirmDialog, SHEET_FRAME, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";
import {
  Drawer,
  DrawerPage,
  PANEL_DANGER_BUTTON,
  PANEL_DANGER_FILLED_BUTTON,
  PANEL_GHOST_BUTTON,
  PANEL_PRIMARY_BUTTON,
  PanelBody,
  SidePanel,
} from "./drawer";
import { Field, inputClass } from "./field";
import { DivisionMenu } from "./new-position-drawer";
import { PANEL } from "./panel";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";

export type OrderWrites = {
  placeOrder: (form: FormData) => Promise<WriteResult<Order>>;
  editOrder: (orderId: number, form: FormData) => Promise<WriteResult<Order>>;
  cancelOrder: (orderId: number) => Promise<WriteResult<null>>;
  decideOrder: (orderId: number, decision: OrderDecision) => Promise<WriteResult<Order>>;
  markOrdered: (orderId: number) => Promise<WriteResult<Order>>;
};

/** What the page has open on the right: nothing, a request, a new request, or an edit of one. */
type Open =
  | { readonly kind: "none" }
  | { readonly kind: "order"; readonly id: number }
  | { readonly kind: "new" }
  | { readonly kind: "edit"; readonly id: number };

const CLOSED: Open = { kind: "none" };

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

// Boards 61 to 61d, 61m, 67, 67b and 67m (issues #172 and #233), and the
// team leader's 70 to 70e (issue #247): every order in the team, newest first,
// 12 to a page. The Department · Division and
// Status column headers each have a filter; rows outside the viewer's scope
// carry a lock and open read-only. The request panel has Cancel request and
// Edit order where the viewer may use them, Reject, Ask for changes and
// Approve, or Mark as ordered, for the people who decide, and New order sends
// a request for one of the viewer's divisions. While a side panel is open the Department
// column is hidden (board 61b), and Requested by too from xl to 1439px wide
// (rowGrid). Props in, nothing fetched; the list lives in
// this page's state, so a sent, edited or cancelled request shows at once. On a
// phone the table is a stack of cards, the filters are chips, and each panel
// is a full page.
export function OrdersView({ data, writes }: { data: OrdersPage; writes: OrderWrites }) {
  const [orders, setOrders] = useState(data.orders);
  const [filters, setFilters] = useState<OrderFilters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Open>(CLOSED);
  const [fresh, setFresh] = useState<number | null>(null);
  const choices = useMemo(() => orderingDivisions(data.scope, data.departments), [data.scope, data.departments]);
  const shown = useMemo(() => orderPage(filterOrders(orders, filters), page), [orders, filters, page]);
  const selected = open.kind === "order" || open.kind === "edit" ? (orders.find((o) => o.id === open.id) ?? null) : null;
  const drawerOpen = open.kind !== "none";

  const replace = (order: Order) => setOrders((all) => all.map((o) => (o.id === order.id ? order : o)));
  const filter = (next: OrderFilters) => {
    setFilters(next);
    setPage(1);
  };
  const departmentFilter = (variant: FilterVariant) => (
    <DepartmentFilter
      variant={variant}
      departments={data.departments}
      value={filters.divisionIds}
      onApply={(divisionIds) => filter({ ...filters, divisionIds })}
    />
  );
  const statusFilter = (variant: FilterVariant) => (
    <StatusFilter variant={variant} value={filters.statuses} onApply={(statuses) => filter({ ...filters, statuses })} />
  );

  return (
    <DrawerPage drawerOpen={drawerOpen}>
      <PageHeader
        title="Orders"
        intro={ordersIntro(data.scope)}
        phone="bar"
        action={
          choices.length > 0 ? (
            <button type="button" onClick={() => setOpen({ kind: "new" })} className={PRIMARY_PILL}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              <span className="md:hidden">New</span>
              <span className="hidden md:inline">New order</span>
            </button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2 md:hidden">
        {departmentFilter("chip")}
        {statusFilter("chip")}
        <span className="ml-auto text-[13px] text-prt-muted">Newest first</span>
      </div>

      <ul aria-label="Orders" className="mt-4 flex flex-col gap-2.5 md:hidden">
        {shown.orders.map((o) => {
          const locked = !canEditOrder(data.scope, o);
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setOpen({ kind: "order", id: o.id })}
                className={`${PANEL} block w-full px-4 py-3.5 text-left transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS} ${
                  o.id === fresh ? "border-accent/40" : ""
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-[16px] font-semibold">{o.item}</span>
                  <StatusPill status={o.status} dot={false} />
                </span>
                <span className="block truncate text-[13px] text-prt-muted">{[o.reason, o.requestedBy].filter(Boolean).join(" · ")}</span>
                {/* The department · division line wraps rather than cutting the division short beside the lock (issue #244). */}
                <span className="mt-2 flex items-start justify-between gap-3">
                  <span className="min-w-0 break-words text-[14px] tabular-nums text-text-2">
                    {formatEuro(orderTotal(o))} · {unitLine(o.unit)}
                  </span>
                  {locked && (
                    <span className="flex h-5 shrink-0 items-center">
                      <ReadOnlyLock />
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {shown.orders.length === 0 && <p className="mt-6 text-center text-[14px] text-prt-muted md:hidden">No orders match these filters.</p>}
      <Pager className="mt-5 md:hidden" page={shown.page} pages={shown.pages} onPage={setPage} />

      <section aria-label="Orders" className={`${PANEL} mt-5 hidden md:block`}>
        <div className={`${rowGrid(drawerOpen)} h-10 border-b border-hairline`}>
          <span className={`${EYEBROW} whitespace-nowrap`}>Item</span>
          {!drawerOpen && (
            <span className="flex items-center gap-1.5">
              <span className={`${EYEBROW} whitespace-nowrap`}>Department · Division</span>
              {departmentFilter("header")}
            </span>
          )}
          <span className={`${EYEBROW} whitespace-nowrap ${requestedByCell(drawerOpen)}`}>Requested by</span>
          <span className={`${EYEBROW} whitespace-nowrap text-right`}>Total</span>
          <span className="flex items-center gap-1.5">
            <span className={`${EYEBROW} whitespace-nowrap`}>Status</span>
            {statusFilter("header")}
          </span>
          <span aria-hidden />
        </div>
        <ul className="divide-y divide-hairline">
          {shown.orders.map((o) => {
            const on = selected?.id === o.id;
            const locked = !canEditOrder(data.scope, o);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => setOpen({ kind: "order", id: o.id })}
                  className={`${rowGrid(drawerOpen)} w-full py-3 text-left transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                    on || o.id === fresh ? "bg-accent/[0.06]" : "hover:bg-white-5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">{o.item}</span>
                    {o.reason && <span className="block truncate text-[12px] text-prt-muted">{o.reason}</span>}
                  </span>
                  {!drawerOpen && (
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] text-prt-text">{o.unit?.department?.name ?? "–"}</span>
                      {o.unit && <span className="block truncate text-[12px] text-prt-muted">{divisionShort(o.unit.division.name)}</span>}
                    </span>
                  )}
                  <span className={`truncate text-[13px] text-text-2 ${requestedByCell(drawerOpen)}`}>{o.requestedBy}</span>
                  <span className="text-right">
                    <span className="block text-[14px] font-semibold tabular-nums">{formatEuro(orderTotal(o))}</span>
                    <span className="block truncate text-[11px] tabular-nums text-prt-muted">{orderBreakdown(o)}</span>
                  </span>
                  <span className="min-w-0">
                    <StatusPill status={o.status} dot />
                  </span>
                  <span className="flex justify-end">{locked && <ReadOnlyLock />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {shown.orders.length === 0 && <p className="px-[18px] py-10 text-center text-[14px] text-prt-muted">No orders match these filters.</p>}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center border-t border-hairline px-[18px] py-3">
          <span className="text-[13px] text-prt-muted">Newest first</span>
          <Pager page={shown.page} pages={shown.pages} onPage={setPage} />
          <span aria-hidden />
        </div>
      </section>

      <OrderPanel
        order={open.kind === "order" ? selected : null}
        scope={data.scope}
        onClose={() => setOpen(CLOSED)}
        onEdit={(order) => setOpen({ kind: "edit", id: order.id })}
        writes={writes}
        onCancelled={(order) => {
          setOrders((all) => all.filter((o) => o.id !== order.id));
          setOpen(CLOSED);
        }}
        onChanged={replace}
      />

      <OrderFormDrawer
        key={open.kind === "new" ? "new" : open.kind === "edit" ? `edit-${open.id}` : "closed"}
        open={open.kind === "new" || (open.kind === "edit" && selected !== null)}
        onOpenChange={(next) => !next && setOpen(selected && open.kind === "edit" ? { kind: "order", id: selected.id } : CLOSED)}
        choices={choices}
        departments={data.departments}
        editing={open.kind === "edit" ? selected : null}
        writes={writes}
        onSaved={(order, isNew) => {
          if (isNew) {
            setOrders((all) => [order, ...all]);
            setFilters(NO_FILTERS);
            setPage(1);
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

/**
 * Board 61's columns. From xl the Department · Division column keeps room for
 * its header on one line: 21 mono letters at 10px with 0.3em tracking, then the
 * filter button (issue #244). While a side panel is open the Department column
 * goes (board 61b); from xl up to 1439px wide, where the panel leaves the table
 * about 520 to 680px, Requested by goes too, so no cell is squeezed to a few
 * letters. From 1440px the table is as wide as on boards 61b to 61d.
 */
function rowGrid(drawerOpen: boolean): string {
  const columns = drawerOpen
    ? "grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_100px_minmax(0,150px)_20px] xl:max-[1439px]:grid-cols-[minmax(0,1fr)_100px_minmax(0,150px)_20px]"
    : "grid-cols-[minmax(0,1.5fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_100px_minmax(0,150px)_20px] xl:grid-cols-[minmax(0,1.5fr)_minmax(220px,1.15fr)_minmax(0,0.9fr)_100px_minmax(0,150px)_20px]";
  return `grid ${columns} items-center gap-x-4 px-[18px]`;
}

/** The Requested by header and cells: hidden from xl to 1439px while a side panel is open (rowGrid). */
function requestedByCell(drawerOpen: boolean): string {
  return drawerOpen ? "xl:max-[1439px]:hidden" : "";
}

function ReadOnlyLock() {
  return (
    <>
      <Lock aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
      <span className="sr-only">Read-only</span>
    </>
  );
}

// Board 61: Waiting is the neutral pill, Approved green, Changes requested
// amber, Rejected red; board 70 adds Ordered, grey. The desktop table marks
// each with a dot; the phone cards (61m) show the pill alone.
const STATUS_STYLES: Readonly<Record<OrderStatus, { pill: string; dot: string }>> = {
  waiting: { pill: "bg-white-10 text-text-2", dot: "bg-warning" },
  approved: { pill: "bg-success-soft text-success", dot: "bg-success" },
  ordered: { pill: "bg-white-5 text-text-2", dot: "bg-prt-muted" },
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

/** "‹ 1 2 3 … 6 ›", centred, with no total count (Owner decision on #233). */
function Pager({ page, pages, onPage, className = "" }: { page: number; pages: number; onPage: (page: number) => void; className?: string }) {
  const step = `flex h-7 w-7 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text disabled:pointer-events-none disabled:opacity-40 ${FOCUS}`;
  return (
    <nav aria-label="Pages" className={`flex items-center justify-center gap-1.5 ${className}`}>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className={step}>
        <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </button>
      {pagerSlots(page, pages).map((slot, i) =>
        slot === "gap" ? (
          <span key={`gap-${i}`} aria-hidden className="w-7 text-center text-[13px] text-prt-muted">
            …
          </span>
        ) : (
          <button
            key={slot}
            type="button"
            aria-current={slot === page ? "page" : undefined}
            aria-label={`Page ${slot}`}
            onClick={() => onPage(slot)}
            className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] tabular-nums transition-colors duration-300 ease-out ${FOCUS} ${
              slot === page ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
            }`}
          >
            {slot}
          </button>
        ),
      )}
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className={step}>
        <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </nav>
  );
}

/** Where a column filter opens: from its table header (board 67b), or from a phone chip as a bottom sheet (board 61m). */
type FilterVariant = "header" | "chip";

/**
 * A column filter: the filter icon in a table header, or a chip on a phone,
 * opening a panel of checkboxes with Clear and Apply (board 67b). From the
 * header it hangs under the column, not modal, and closes on Escape or an
 * outside click; on a phone it is a bottom sheet. It opens under motion-safe
 * only and closes at once, like every dialog on a redesigned page.
 */
function ColumnFilter({
  variant,
  label,
  active,
  align,
  open,
  onOpenChange,
  children,
}: {
  variant: FilterVariant;
  label: string;
  active: boolean;
  align: "start" | "end";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const lit = active || open;
  if (variant === "chip") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger
          className={`flex h-8 items-center gap-1.5 rounded-full border bg-panel/60 px-3 text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
            lit ? "border-accent/60 text-prt-text" : "border-hairline text-text-2"
          }`}
        >
          {label}
          <ChevronDown aria-hidden className="h-3.5 w-3.5 text-prt-muted" strokeWidth={2} />
        </DialogTrigger>
        <DialogPortal>
          <DialogOverlay className={SHEET_OVERLAY} />
          <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_FRAME} flex flex-col sm:w-[340px]`}>
            <SheetGrabber />
            <DialogTitle className="mb-3 text-[16px] font-semibold">{label}</DialogTitle>
            {children}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <span className="relative">
        <DialogTrigger
          ref={trigger}
          aria-label={`Filter by ${label.toLowerCase()}`}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS} ${
            lit ? "text-accent" : "text-prt-muted"
          }`}
        >
          <ListFilter aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </DialogTrigger>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => {
            // The trigger toggles the panel itself; an outside press on it must not close and reopen it.
            if (trigger.current?.contains(e.target as Node)) e.preventDefault();
          }}
          className={`absolute top-8 z-40 flex w-[290px] flex-col rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 ${
            align === "start" ? "-left-[180px]" : "right-0"
          }`}
        >
          <DialogTitle className="sr-only">{label}</DialogTitle>
          {children}
        </DialogPrimitive.Content>
      </span>
    </Dialog>
  );
}

/** A tick box as board 67b draws it: accent when ticked, a dash when some of a department is. */
function Tick({ state }: { state: "all" | "some" | "none" }) {
  return (
    <span
      aria-hidden
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
        state === "none" ? "border-white-10" : "border-accent bg-accent text-accent-on-accent"
      }`}
    >
      {state === "all" && <Check className="h-3 w-3" strokeWidth={3} />}
      {state === "some" && <Minus className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

const TICK_ROW = `flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS}`;

/** Clear and Apply at a filter's foot (board 67b). */
function FilterFoot({ onClear, onApply }: { onClear: () => void; onApply: () => void }) {
  return (
    <div className="mt-1.5 flex items-center justify-between border-t border-hairline px-1.5 pt-2.5 pb-1">
      <button type="button" onClick={onClear} className={`rounded-md px-1 text-[13px] text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}>
        Clear
      </button>
      <button
        type="button"
        onClick={onApply}
        className={`inline-flex h-8 items-center rounded-full bg-prt-text px-3.5 text-[13px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 ${FOCUS}`}
      >
        Apply
      </button>
    </div>
  );
}

/**
 * The Department · Division filter (board 67b): a search, then each
 * department with a tick, its divisions nested under it. Ticking a
 * department ticks all its divisions. Apply with nothing ticked, or
 * everything, shows every order.
 */
function DepartmentFilter({
  variant,
  departments,
  value,
  onApply,
}: {
  variant: FilterVariant;
  departments: readonly OrgDepartmentUnits[];
  value: readonly number[] | null;
  onApply: (divisionIds: readonly number[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState<readonly number[]>([]);
  const [expanded, setExpanded] = useState<readonly number[]>([]);
  const [query, setQuery] = useState("");
  const all = departments.flatMap((d) => d.divisions.map((v) => v.id));

  const onOpenChange = (next: boolean) => {
    if (next) {
      const start = value ?? [];
      setTicked(start);
      setExpanded(departments.filter((d) => departmentTick(d, start) !== "none").map((d) => d.id));
      setQuery("");
    }
    setOpen(next);
  };
  const q = query.trim().toLowerCase();
  const matches = (d: OrgDepartmentUnits) => q === "" || d.name.toLowerCase().includes(q) || d.divisions.some((v) => v.name.toLowerCase().includes(q));
  const toggleDivision = (id: number) => setTicked((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  return (
    <ColumnFilter variant={variant} label="Department" active={value !== null} align="start" open={open} onOpenChange={onOpenChange}>
      <label className="relative mb-1 block">
        <span className="sr-only">Search departments</span>
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-prt-muted" strokeWidth={2} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search departments"
          className="h-9 w-full rounded-lg border border-hairline bg-white-5 pl-9 pr-3 text-[13px] text-prt-text outline-none transition-colors duration-300 ease-out placeholder:text-prt-muted focus:border-border-strong"
        />
      </label>
      <ul className="max-h-[320px] overflow-y-auto max-md:max-h-[50svh]">
        {departments.filter(matches).map((d) => {
          const state = departmentTick(d, ticked);
          const isOpen = expanded.includes(d.id) || q !== "";
          return (
            <li key={d.id}>
              <div className="flex items-center">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={state === "all" ? true : state === "some" ? "mixed" : false}
                  onClick={() => setTicked((t) => toggleDepartment(d, t))}
                  className={`${TICK_ROW} ${state === "none" ? "text-text-2" : "text-prt-text"}`}
                >
                  <Tick state={state} />
                  <span className="truncate">{d.name}</span>
                </button>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-label={`${isOpen ? "Hide" : "Show"} ${d.name} divisions`}
                  onClick={() => setExpanded((e) => (e.includes(d.id) ? e.filter((x) => x !== d.id) : [...e, d.id]))}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
                >
                  {isOpen ? <ChevronDown aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />}
                </button>
              </div>
              {isOpen && (
                <ul className="pl-6">
                  {d.divisions.map((v) => {
                    const on = ticked.includes(v.id);
                    return (
                      <li key={v.id} className="flex">
                        <button type="button" role="checkbox" aria-checked={on} onClick={() => toggleDivision(v.id)} className={`${TICK_ROW} ${on ? "text-prt-text" : "text-text-2"}`}>
                          <Tick state={on ? "all" : "none"} />
                          <span className="truncate">{divisionShort(v.name)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <FilterFoot
        onClear={() => setTicked([])}
        onApply={() => {
          onApply(appliedSelection(ticked, all));
          setOpen(false);
        }}
      />
    </ColumnFilter>
  );
}

/** The Status filter: one tick per status, with Clear and Apply as the Department filter has. */
function StatusFilter({
  variant,
  value,
  onApply,
}: {
  variant: FilterVariant;
  value: readonly OrderStatus[] | null;
  onApply: (statuses: readonly OrderStatus[] | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState<readonly OrderStatus[]>([]);
  return (
    <ColumnFilter
      variant={variant}
      label="Status"
      active={value !== null}
      align="end"
      open={open}
      onOpenChange={(next) => {
        if (next) setTicked(value ?? []);
        setOpen(next);
      }}
    >
      <ul>
        {ORDER_STATUSES.map((status) => {
          const on = ticked.includes(status);
          return (
            <li key={status} className="flex">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setTicked((t) => (on ? t.filter((s) => s !== status) : [...t, status]))}
                className={`${TICK_ROW} ${on ? "text-prt-text" : "text-text-2"}`}
              >
                <Tick state={on ? "all" : "none"} />
                {ORDER_STATUS_LABELS[status]}
              </button>
            </li>
          );
        })}
      </ul>
      <FilterFoot
        onClear={() => setTicked([])}
        onApply={() => {
          onApply(appliedSelection(ticked, ORDER_STATUSES));
          setOpen(false);
        }}
      />
    </ColumnFilter>
  );
}

const SPEC_LABEL = "whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-dim";

/** What the decide footer is doing (boards 70b, 70d, 70e): showing its three buttons, or writing a note to send back or reject with. */
type Deciding = "choose" | "ask-for-changes" | "reject";

/** The step "are you sure" asks about: a decision with its note, or Mark as ordered. */
type Asking =
  | { readonly kind: "cancel" }
  | { readonly kind: "decide"; readonly decision: OrderDecision }
  | { readonly kind: "mark-ordered" };

/**
 * Boards 61c, 61d and 70 to 70e: one request, with the team leader's answer
 * when there is one. What the viewer may do with it is the domain's answer
 * (orderActions): an order outside their scope, or one already answered, opens
 * read-only for editing; the team leader and holders of "Approve orders"
 * decide a waiting one (Reject, Ask for changes, Approve) and mark an approved
 * one as ordered. While they decide, Edit moves to the panel's head (board
 * 70b). Every action asks "are you sure" first.
 */
function OrderPanel({
  order,
  scope,
  onClose,
  onEdit,
  writes,
  onCancelled,
  onChanged,
}: {
  order: Order | null;
  scope: OrdersScope;
  onClose: () => void;
  onEdit: (order: Order) => void;
  writes: Pick<OrderWrites, "cancelOrder" | "decideOrder" | "markOrdered">;
  onCancelled: (order: Order) => void;
  onChanged: (order: Order) => void;
}) {
  // The panel keeps showing the last request while it closes.
  const [shown, setShown] = useState<Order | null>(order);
  const [deciding, setDeciding] = useState<Deciding>("choose");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string>();
  const [asking, setAsking] = useState<Asking | null>(null);
  const [pending, startTransition] = useTransition();
  const noteId = useId();
  if (order !== null && order !== shown) {
    // Another request opened: start its footer afresh.
    if (order.id !== shown?.id) {
      setDeciding("choose");
      setNote("");
      setNoteError(undefined);
    }
    setShown(order);
  }
  const current = order ?? shown;
  if (current === null) return null;
  const actions = orderActions(scope, current);
  const total = orderTotal(current);
  const requester = current.requestedBy || "The requester";
  // Board 70b's head: where the order belongs and what it costs, for the people who decide across the team.
  const detail =
    scope.decides !== null && current.unit !== null
      ? [divisionShort(current.unit.division.name), current.unit.department?.name, formatEuro(total)]
      : [current.reason, formatEuro(total)];
  const writingNote = actions.decide && deciding !== "choose";

  const startNote = (kind: Exclude<Deciding, "choose">) => {
    setDeciding(kind);
    setNote("");
    setNoteError(undefined);
  };
  /** The decision as the server will check it (`checkDecision`); a note it refuses shows under the box. */
  const askToSend = (input: { kind: "ask-for-changes" | "reject"; reason: string }) => {
    const checked = checkDecision(scope.decides, current.status, input);
    if (!checked.ok) return setNoteError(checked.error);
    setNoteError(undefined);
    setAsking({ kind: "decide", decision: checked.value });
  };

  const run = (step: Asking) =>
    startTransition(async () => {
      switch (step.kind) {
        case "cancel": {
          const result = await writes.cancelOrder(current.id);
          if (!result.ok) return void toast.error("Could not cancel the request", { description: result.error });
          setAsking(null);
          onCancelled(current);
          toast.success(`Cancelled the request for ${current.item}`);
          return;
        }
        case "decide": {
          const result = await writes.decideOrder(current.id, step.decision);
          if (!result.ok) return void toast.error("Could not answer the request", { description: result.error });
          setAsking(null);
          setDeciding("choose");
          onChanged(result.value);
          toast.success(DECIDED[step.decision.kind](current.item));
          return;
        }
        case "mark-ordered": {
          const result = await writes.markOrdered(current.id);
          if (!result.ok) return void toast.error("Could not mark it as ordered", { description: result.error });
          setAsking(null);
          onChanged(result.value);
          toast.success(`Marked ${current.item} as ordered`);
          return;
        }
      }
    });

  const footer = writingNote ? (
    <>
      <button type="button" onClick={() => setDeciding("choose")} className={`${PANEL_GHOST_BUTTON} flex-1`}>
        Cancel
      </button>
      {deciding === "ask-for-changes" ? (
        <button type="button" onClick={() => askToSend({ kind: "ask-for-changes", reason: note })} className={`${PANEL_PRIMARY_BUTTON} flex-1`}>
          Ask for changes
        </button>
      ) : (
        <button type="button" onClick={() => askToSend({ kind: "reject", reason: note })} className={`${PANEL_DANGER_FILLED_BUTTON} flex-1`}>
          Reject order
        </button>
      )}
    </>
  ) : actions.decide ? (
    <>
      <button type="button" onClick={() => startNote("reject")} className={PANEL_DANGER_BUTTON}>
        Reject
      </button>
      <button type="button" onClick={() => startNote("ask-for-changes")} className={PANEL_GHOST_BUTTON}>
        Ask for changes
      </button>
      <button type="button" onClick={() => setAsking({ kind: "decide", decision: { kind: "approve" } })} className={`${PANEL_PRIMARY_BUTTON} flex-1`}>
        Approve
      </button>
    </>
  ) : actions.markOrdered ? (
    <button type="button" onClick={() => setAsking({ kind: "mark-ordered" })} className={`${PANEL_PRIMARY_BUTTON} flex-1`}>
      Mark as ordered
    </button>
  ) : actions.cancel || actions.edit ? (
    <>
      {actions.cancel && (
        <button type="button" onClick={() => setAsking({ kind: "cancel" })} className={`${PANEL_DANGER_BUTTON} flex-1`}>
          Cancel request
        </button>
      )}
      {actions.edit && (
        <button type="button" onClick={() => onEdit(current)} className={`${PANEL_PRIMARY_BUTTON} flex-1`}>
          {actions.edit === "edit-and-resend" ? "Edit and send again" : "Edit order"}
        </button>
      )}
    </>
  ) : undefined;

  return (
    <SidePanel
      open={order !== null}
      onOpenChange={(next) => !next && onClose()}
      title={current.item}
      detail={detail.filter(Boolean).join(" · ")}
      // The footer is deciding, so Edit sits at the head (board 70b).
      action={
        actions.edit && (actions.decide || actions.markOrdered) ? (
          <button
            type="button"
            onClick={() => onEdit(current)}
            className={`rounded-md px-1.5 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
          >
            Edit
          </button>
        ) : undefined
      }
      footer={footer}
      footerLayout="row"
    >
      <PanelBody className="flex flex-col gap-6">
        {scope.decides !== null && (
          <div className="grid grid-cols-3 gap-3">
            <Spec label="Requested by">{current.requestedBy || "–"}</Spec>
            <Spec label="Sent">{dayMonthYear(current.requestedOn)}</Spec>
            <div className="min-w-0">
              <p className={SPEC_LABEL}>Status</p>
              <div className="mt-1.5">
                <StatusPill status={current.status} dot />
              </div>
            </div>
          </div>
        )}

        {(current.status === "approved" || current.status === "ordered") && (
          <p className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/[0.06] px-4 py-3.5 text-[13px] leading-relaxed text-prt-text">
            <CircleCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />
            {approvedNote(current, actions.markOrdered)}
          </p>
        )}

        {current.status === "rejected" && (
          <section className="rounded-xl border border-danger/40 bg-danger/[0.06] p-4">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-danger">
              <XCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Rejected
            </h3>
            {current.reason && <p className="mt-2 text-[13px] leading-relaxed text-prt-text">“{current.reason}”</p>}
            <p className="mt-2 text-[12px] text-prt-muted">{answeredLine(current.answer)}</p>
          </section>
        )}

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

        {writingNote && (
          <div>
            <label htmlFor={noteId} className={SPEC_LABEL}>
              {deciding === "ask-for-changes" ? "What should change" : "Why (optional)"}
            </label>
            <textarea
              id={noteId}
              autoFocus
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError(undefined);
              }}
              rows={4}
              aria-invalid={noteError !== undefined}
              aria-describedby={`${noteId}-hint`}
              className={`${inputClass(noteError)} mt-2 block h-auto min-h-[110px] resize-none py-3 leading-[1.6] ${deciding === "ask-for-changes" ? "border-accent/70" : ""}`}
            />
            {noteError && (
              <p role="alert" className="mt-2 text-[13px] text-danger">
                {noteError}
              </p>
            )}
            <p id={`${noteId}-hint`} className="mt-2 text-[12px] leading-relaxed text-prt-muted">
              {deciding === "ask-for-changes"
                ? `${requester} sees this note on the order. They can edit it and send it again.`
                : `${requester} sees the reason on the order. A rejected order can't be sent again; they make a new one.`}
            </p>
          </div>
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
        open={asking !== null}
        onOpenChange={(next) => !next && setAsking(null)}
        {...confirmCopy(asking, current, requester)}
        pending={pending}
        onConfirm={() => asking && run(asking)}
      />
    </SidePanel>
  );
}

/** The toast after a decision. */
const DECIDED: Readonly<Record<OrderDecision["kind"], (item: string) => string>> = {
  approve: (item) => `Approved ${item}`,
  reject: (item) => `Rejected ${item}`,
  "ask-for-changes": (item) => `Sent ${item} back for changes`,
};

/** What "are you sure" says before each step (docs/dashboard-rules.md, "4. Orders"). */
function confirmCopy(asking: Asking | null, order: Order, requester: string) {
  const first = requester.split(" ")[0];
  switch (asking?.kind) {
    case undefined:
    case "cancel":
      return {
        icon: <XCircle className="h-5 w-5" strokeWidth={1.75} />,
        title: "Cancel this request?",
        description: `The request for ${order.item} leaves the orders, and the team leader no longer sees it.`,
        confirmLabel: "Cancel request",
        cancelLabel: "Keep it",
        danger: true,
      };
    case "mark-ordered":
      return {
        icon: <PackageCheck className="h-5 w-5" strokeWidth={1.75} />,
        title: "Mark this request as ordered?",
        description: `Do this once you have placed the order for ${order.item}. It can't be undone.`,
        confirmLabel: "Mark as ordered",
        cancelLabel: "Not yet",
        tone: "success" as const,
      };
    case "decide":
      switch (asking.decision.kind) {
        case "approve":
          return {
            icon: <CircleCheck className="h-5 w-5" strokeWidth={1.75} />,
            title: "Approve this request?",
            description: `${order.item} for ${formatEuro(orderTotal(order))}. ${first} sees it approved, and it can be marked as ordered once it is placed.`,
            confirmLabel: "Approve",
            cancelLabel: "Not yet",
            tone: "success" as const,
          };
        case "ask-for-changes":
          return {
            icon: <MessageSquareText className="h-5 w-5" strokeWidth={1.75} />,
            title: "Send this request back?",
            description: `${first} sees your note and can edit the request and send it again.`,
            confirmLabel: "Ask for changes",
            cancelLabel: "Keep writing",
          };
        case "reject":
          return {
            icon: <XCircle className="h-5 w-5" strokeWidth={1.75} />,
            title: "Reject this request?",
            description: `${first} sees it rejected${asking.decision.reason ? " with your reason" : ""}. A rejected request can't be sent again.`,
            confirmLabel: "Reject order",
            cancelLabel: "Keep it",
            danger: true,
          };
      }
  }
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

/** A division as the Division field lists it, with its department under it. */
type DivisionOption = OrderDivision & { readonly department: string };

/**
 * New order (board 61b), and the same form for Edit order and Edit and send
 * again, opened on the request as it was sent. A viewer who may order for
 * more than one division (a department head) picks it first; an edit keeps
 * the order's own. A new quote replaces the one on file; leaving it empty
 * keeps it.
 */
function OrderFormDrawer({
  open,
  onOpenChange,
  choices,
  departments,
  editing,
  writes,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choices: readonly OrderDivision[];
  departments: readonly OrgDepartmentUnits[];
  editing: Order | null;
  writes: OrderWrites;
  onSaved: (order: Order, isNew: boolean) => void;
}) {
  const [fields, setFields] = useState(editing === null ? EMPTY : orderFormFields(editing));
  const options = useMemo(
    () =>
      choices.map((d): DivisionOption => ({
        ...d,
        department: departments.find((dep) => dep.divisions.some((v) => v.id === d.id))?.name ?? "",
      })),
    [choices, departments],
  );
  const [division, setDivision] = useState<DivisionOption | null>(options.length === 1 ? options[0] : null);
  const [quote, setQuote] = useState<File | null>(null);
  const [errors, setErrors] = useState<NewOrderErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const unitPrice = parseEuros(fields.price);
  const quantity = /^\d+$/.test(fields.quantity.trim()) ? Number(fields.quantity) : null;
  const total = unitPrice !== null && quantity !== null ? unitPrice * quantity : null;
  const resend = editing !== null && editing.status === "changes-requested";
  const failed = editing === null ? "Could not send the request" : "Could not save the request";
  const forDivision = editing?.unit?.division ?? (options.length === 1 ? options[0] : null);

  const set = (name: keyof typeof EMPTY) => (e: { target: { value: string } }) => {
    setFields((f) => ({ ...f, [name]: e.target.value }));
    setErrors((all) => ({ ...all, [name === "price" ? "unitPrice" : name]: undefined }));
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const checked = checkNewOrder(fields);
    const quoteError = quote === null ? null : checkQuote(quote);
    const divisionError = editing === null && division === null ? "Choose the division the order is for." : null;
    if (!checked.ok || quoteError !== null || divisionError !== null) {
      setErrors({
        ...(checked.ok ? {} : checked.errors),
        ...(quoteError ? { quote: quoteError } : {}),
        ...(divisionError ? { division: divisionError } : {}),
      });
      return;
    }
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    const sentDivision = editing?.unit?.division ?? division;
    if (sentDivision) form.set("division", String(sentDivision.id));
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
      detail={forDivision ? `For ${forDivision.name}` : undefined}
      submitLabel={editing === null || resend ? "Send request" : "Save changes"}
      submitting={submitting}
      onSubmit={submit}
    >
      <div className="flex flex-col gap-5">
        {editing === null && options.length > 1 && (
          <Field label="Division" hint={`you order for ${options.length}`} error={errors.division}>
            {(id, describedBy) => (
              <DivisionMenu
                id={id}
                describedBy={describedBy}
                divisions={options}
                value={division}
                onChange={(d) => {
                  setDivision(d);
                  setErrors((all) => ({ ...all, division: undefined }));
                }}
                invalid={errors.division !== undefined}
              />
            )}
          </Field>
        )}

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
              className={`flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[10px] border text-[13px] text-text-2 transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS} ${border}`}
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
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
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
