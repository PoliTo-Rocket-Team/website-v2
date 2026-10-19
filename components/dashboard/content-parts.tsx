"use client";

import { useId, useState, type DragEvent } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { moveTo } from "@/lib/content/order";
import { textLength } from "@/lib/content/text";
import { CONTENT_STATUS_LABELS, type ContentStatus, type PublishStep } from "@/lib/content/versioned";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON } from "./drawer";
import { inputClass } from "./field";

// The parts every site-content editor shares (boards 76 to 79b, issues #256
// and #258): the status pill, a row's menu, dragging rows into a new order,
// a text field with its counter, and the edit panel's Remove, Save draft and
// Publish.

export const CONTENT_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const STATUS_TONE: Readonly<Record<ContentStatus, string>> = {
  published: "bg-success-soft text-success",
  draft: "bg-white-5 text-text-2",
  "draft-changes": "bg-warning-soft text-warning",
};

const STATUS_DOT: Readonly<Record<ContentStatus, string>> = {
  published: "bg-success",
  draft: "bg-prt-muted",
  "draft-changes": "bg-warning",
};

/** Published, Draft or Draft changes; `short` says Draft for a published item with a draft (board 76's list). */
export function StatusPill({ status, short = false }: { status: ContentStatus; short?: boolean }) {
  const label = short && status === "draft-changes" ? CONTENT_STATUS_LABELS.draft : CONTENT_STATUS_LABELS[status];
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[12px] font-medium ${STATUS_TONE[status]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {label}
    </span>
  );
}

const MENU_ITEM =
  "flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[disabled]:cursor-default data-[disabled]:opacity-40 data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text";

/** A row's ⋯ menu: Edit, Move up and Move down (the keyboard's way to reorder), Remove. */
export function RowMenu({
  name,
  onEdit,
  onUp,
  onDown,
  onRemove,
}: {
  name: string;
  onEdit: () => void;
  onUp: (() => void) | null;
  onDown: (() => void) | null;
  onRemove: () => void;
}) {
  return (
    <span onClick={(e) => e.stopPropagation()} className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`More for ${name}`}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text data-[state=open]:bg-white-5 ${CONTENT_FOCUS}`}
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuPrimitive.Content
            align="end"
            sideOffset={6}
            className="z-50 min-w-[180px] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
          >
            <DropdownMenuPrimitive.Item onSelect={onEdit} className={MENU_ITEM}>
              <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Edit
            </DropdownMenuPrimitive.Item>
            <DropdownMenuPrimitive.Item disabled={onUp === null} onSelect={() => onUp?.()} className={MENU_ITEM}>
              <ArrowUp aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Move up
            </DropdownMenuPrimitive.Item>
            <DropdownMenuPrimitive.Item disabled={onDown === null} onSelect={() => onDown?.()} className={MENU_ITEM}>
              <ArrowDown aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Move down
            </DropdownMenuPrimitive.Item>
            <DropdownMenuPrimitive.Separator className="-mx-1.5 my-1 h-px bg-hairline" />
            <DropdownMenuPrimitive.Item onSelect={onRemove} className={`${MENU_ITEM} text-danger data-[highlighted]:text-danger`}>
              <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Remove
            </DropdownMenuPrimitive.Item>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPortal>
      </DropdownMenu>
    </span>
  );
}

/** What one draggable row takes from `useDragOrder`. */
export type DragRow = {
  readonly dragged: boolean;
  readonly onDragStart: (event: DragEvent) => void;
  readonly onDragOver: (event: DragEvent) => void;
  readonly onDragEnd: () => void;
};

/**
 * Rows dragged into a new order. While a row is dragged the list shows the
 * order it would drop into; the drag ends on the dragged row, dropped or not,
 * and the order it shows then is the one handed to `onReorder`.
 */
export function useDragOrder<K extends string | number>(keys: readonly K[], onReorder: (order: K[]) => void) {
  const [dragging, setDragging] = useState<{ key: K; order: K[] } | null>(null);
  const order: readonly K[] = dragging === null ? keys : dragging.order;
  const row = (key: K, index: number): DragRow => ({
    dragged: dragging?.key === key,
    onDragStart: (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(key));
      setDragging({ key, order: [...keys] });
    },
    onDragOver: (event) => {
      if (dragging === null) return;
      event.preventDefault();
      const next = moveTo(dragging.order, dragging.key, index);
      if (next.join() !== dragging.order.join()) setDragging({ ...dragging, order: next });
    },
    onDragEnd: () => {
      if (dragging !== null && dragging.order.join() !== keys.join()) onReorder(dragging.order);
      setDragging(null);
    },
  });
  /** On the list: a drop anywhere in it is a drop, not the browser opening the dragged text. */
  const list = {
    onDragOver: (event: DragEvent) => dragging !== null && event.preventDefault(),
    onDrop: (event: DragEvent) => dragging !== null && event.preventDefault(),
  };
  return { order, row, list };
}

/** A labelled input or textarea, with a live counter on the right when the text has a limit (board 76b: "52 / 80"). */
export function TextField({
  label,
  hint,
  value,
  error,
  limit,
  rows,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  limit?: number;
  rows?: number;
  placeholder?: string;
  type?: "text" | "url";
  onChange: (value: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const length = textLength(value.trim());
  const over = limit !== undefined && length > limit;
  const control = {
    id,
    value,
    placeholder,
    "aria-invalid": error !== undefined || over,
    "aria-describedby": error === undefined ? undefined : errorId,
    onChange: (e: { target: { value: string } }) => onChange(e.target.value),
  };
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] leading-snug text-prt-text">
          {label}
          {hint && <span className="ml-1.5 text-prt-muted">{hint}</span>}
        </label>
        {limit !== undefined && (
          <span aria-live="polite" className={`font-mono text-[11px] ${over ? "text-danger" : "text-prt-muted"}`}>
            {length} / {limit}
          </span>
        )}
      </div>
      {rows === undefined ? (
        <input type={type} {...control} className={inputClass(error ?? (over ? "" : undefined))} />
      ) : (
        <textarea rows={rows} {...control} className={`${inputClass(error ?? (over ? "" : undefined))} h-auto resize-none py-2.5 leading-relaxed`} />
      )}
      {error !== undefined && (
        <p id={errorId} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** The edit panel's foot (boards 76b, 79b): Remove on the left, none for a new item; Save draft and Publish on the right. */
export function PublishFooter({
  onRemove,
  pending,
  onSubmit,
}: {
  onRemove: (() => void) | null;
  pending: boolean;
  onSubmit: (step: PublishStep) => void;
}) {
  return (
    <>
      {onRemove === null ? (
        <span />
      ) : (
        <button
          type="button"
          onClick={onRemove}
          className={`inline-flex h-11 items-center gap-2 rounded-full px-2 text-[14px] font-semibold text-danger transition-opacity duration-300 ease-out hover:opacity-80 ${CONTENT_FOCUS}`}
        >
          <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Remove
        </button>
      )}
      <span className="flex gap-3">
        <button type="button" disabled={pending} onClick={() => onSubmit("save-draft")} className={PANEL_GHOST_BUTTON}>
          Save draft
        </button>
        <button type="button" disabled={pending} onClick={() => onSubmit("publish")} className={PANEL_PRIMARY_BUTTON}>
          Publish
        </button>
      </span>
    </>
  );
}
