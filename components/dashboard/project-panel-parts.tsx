"use client";

import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { written, type WriteResult } from "@/lib/dashboard/write";
import type { CopyFields } from "@/lib/project-content/fields";
import { twoDigits } from "@/lib/project-pages";
import { CONTENT_FOCUS, TextField, useDragOrder } from "./content-parts";
import { ErrorLine } from "./edit-panel";

// The fields the Edit <project> panel's sections share (issues #298 and
// #299): a text with a phone version, and a list of rows to add, remove and
// reorder.

/** A field's error by its path in the fields ("hero.facts.2.value"). */
export type FieldErrors = Readonly<Record<string, string>>;

/** A text with a phone version: Desktop edits the text, Phone the phone's, which shows the text while empty. */
export function CopyField({
  label,
  copy,
  phone,
  rows,
  error,
  onChange,
}: {
  label: string;
  copy: CopyFields;
  phone: boolean;
  rows?: number;
  error?: string;
  onChange: (copy: CopyFields) => void;
}) {
  if (!phone) return <TextField label={label} rows={rows} value={copy.text} error={error} onChange={(text) => onChange({ ...copy, text })} />;
  return (
    <TextField
      label={label}
      hint="phone"
      rows={rows}
      value={copy.phone}
      placeholder={copy.text}
      error={error}
      onChange={(p) => onChange({ ...copy, phone: p })}
    />
  );
}

/**
 * A list of rows the editor adds to, removes from and reorders: drag a row by
 * its grip, or use its Move up and Move down buttons from the keyboard. A
 * list at its least keeps its rows: Remove is off. A list whose rows carry a
 * rule (one highlighted version, a step under way) removes through
 * `removeRow`, which may refuse with a message. Each row keeps one key while
 * it moves, so a field being typed in stays itself.
 */
export function EditableList<T>({
  label,
  hint,
  items,
  limit,
  error,
  blank,
  rowName,
  rowLabel = (i) => twoDigits(i + 1),
  addLabel,
  onChange,
  removeRow = (index) => written(items.filter((_, i) => i !== index)),
  row,
}: {
  label: string;
  hint?: string;
  items: readonly T[];
  limit: { readonly min: number; readonly max: number };
  error?: string;
  blank: () => T;
  rowName: (index: number) => string;
  rowLabel?: (index: number, count: number) => string;
  /** The add button's text; null when the list adds its rows elsewhere (the gallery uploads them). */
  addLabel: string | null;
  onChange: (items: T[]) => void;
  /** The list without the row at `index`, or why that row stays. */
  removeRow?: (index: number) => WriteResult<readonly T[]>;
  row: (item: T, index: number, update: (item: T) => void) => ReactNode;
}) {
  const [keys, setKeys] = useState(() => items.map((_, i) => i));
  const nextKey = useRef(items.length);
  // A save hands back fresh fields of another length: start the keys afresh.
  const rowKeys = keys.length === items.length ? keys : items.map((_, i) => i);
  const itemOf = new Map(rowKeys.map((key, i) => [key, items[i]]));

  const reorder = (order: readonly number[]) => {
    setKeys([...order]);
    onChange(order.map((key) => itemOf.get(key)!));
  };
  const drag = useDragOrder(rowKeys, reorder);
  const move = (key: number, by: -1 | 1) => {
    const at = rowKeys.indexOf(key);
    const order = [...rowKeys];
    [order[at], order[at + by]] = [order[at + by], order[at]];
    reorder(order);
  };
  const remove = (key: number) => {
    const left = removeRow(rowKeys.indexOf(key));
    if (!left.ok) {
      toast.error(left.error);
      return;
    }
    setKeys(rowKeys.filter((k) => k !== key));
    onChange([...left.value]);
  };
  const add = () => {
    setKeys([...rowKeys, nextKey.current++]);
    onChange([...items, blank()]);
  };
  const shown = drag.order;

  return (
    <div>
      <p className="mb-2 text-[13px] leading-snug text-prt-text">
        {label}
        {hint && <span className="ml-1.5 text-prt-muted">{hint}</span>}
      </p>
      <ol className="space-y-2" {...drag.list}>
        {shown.map((key, index) => {
          const item = itemOf.get(key)!;
          const at = rowKeys.indexOf(key);
          const r = drag.row(key, index);
          const canRemove = items.length > limit.min;
          return (
            <li
              key={key}
              onDragOver={r.onDragOver}
              className={`rounded-[10px] border border-hairline bg-white-5 p-3 transition-colors duration-300 ease-out hover:border-border-strong ${r.dragged ? "opacity-50" : ""}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  draggable
                  onDragStart={r.onDragStart}
                  onDragEnd={r.onDragEnd}
                  aria-hidden
                  className="cursor-grab text-dim"
                >
                  <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <span className="flex-1 font-mono text-[10px] tracking-[0.2em] text-dim">{rowLabel(index, shown.length)}</span>
                <RowButton icon={ArrowUp} label={`Move ${rowName(index)} up`} onClick={index > 0 ? () => move(key, -1) : null} />
                <RowButton icon={ArrowDown} label={`Move ${rowName(index)} down`} onClick={index < shown.length - 1 ? () => move(key, 1) : null} />
                <RowButton icon={Trash2} label={`Remove ${rowName(index)}`} onClick={canRemove ? () => remove(key) : null} />
              </div>
              <div className="space-y-2.5">{row(item, at, (next) => onChange(items.map((x, i) => (i === at ? next : x))))}</div>
            </li>
          );
        })}
      </ol>
      <ErrorLine error={error} />
      {addLabel !== null && items.length < limit.max && (
        <button
          type="button"
          onClick={add}
          className={`mt-2.5 inline-flex items-center gap-1.5 rounded-md text-[13px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

export function RowButton({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: (() => void) | null }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={onClick === null}
      onClick={() => onClick?.()}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text disabled:pointer-events-none disabled:opacity-30 ${CONTENT_FOCUS}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}
