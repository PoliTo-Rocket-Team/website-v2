"use client";

import { useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ListFilter, Search } from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import type { ColumnOption } from "@/lib/dashboard/column-filters";

// A table column's filter, shared by the Members table and the Applications
// table (boards 73b and 73c, issue #428). The table owns the picks and the
// rules (lib/dashboard/column-filters.ts); this part only draws them.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** One field's ticks: every value with its count, as lib/dashboard/column-filters.ts's `optionsOf` orders them. */
type FieldTicks = {
  options: readonly ColumnOption[];
  ticked: readonly string[];
  onToggle: (value: string) => void;
};

/** A field of a column that filters more than one (the Applications Studies column: its program and its level). */
export type ColumnFilterSection = FieldTicks & {
  /** The field's name, shown over its ticks: "Program". */
  title: string;
};

/** A column filters one field, or several, each under its name in the one popover. */
type ColumnFields = (FieldTicks & { sections?: never }) | { sections: readonly ColumnFilterSection[] };

/**
 * A column's filter (board 73c): a search, a tick per value with how many
 * hold it, the ticked ones first, then Clear and "N selected". Ticking
 * narrows the table at once. Not modal; it hangs under the header in a
 * portal, so the table's scroll does not clip it, and closes on Escape or an
 * outside press; the table closes it on a scroll. A column over several
 * fields keeps one button, and its popover lists each field under its name.
 */
export function ColumnFilter({
  label,
  placeholder = `Search ${label.toLowerCase()}`,
  onClear,
  open,
  onOpenChange,
  ...fields
}: {
  /** The column's name: "Filter by role", the popover's title. */
  label: string;
  placeholder?: string;
  /** Clears every field of the column. */
  onClear: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ColumnFields) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const sections: readonly (FieldTicks & { title: string | null })[] =
    fields.sections ?? [{ title: null, options: fields.options, ticked: fields.ticked, onToggle: fields.onToggle }];
  const tickedCount = sections.reduce((n, s) => n + s.ticked.length, 0);
  const matches = (o: ColumnOption) => o.value.toLowerCase().includes(search.trim().toLowerCase());

  const change = (next: boolean) => {
    if (next && trigger.current) {
      const box = trigger.current.getBoundingClientRect();
      setAt({ top: box.bottom + 8, left: Math.max(8, Math.min(box.left - 40, window.innerWidth - 280)) });
      setSearch("");
    }
    onOpenChange(next);
  };

  const row = (field: FieldTicks) => (option: ColumnOption) => {
    const checked = field.ticked.includes(option.value);
    return (
      <li key={option.value} className="flex">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => field.onToggle(option.value)}
          className={`flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS} ${
            checked ? "text-prt-text" : "text-text-2"
          }`}
        >
          <span
            aria-hidden
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
              checked ? "border-accent bg-accent text-accent-on-accent" : "border-white-10"
            }`}
          >
            {checked && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1 truncate">{option.value}</span>
          <span className="shrink-0 font-mono text-[11px] text-prt-muted">{option.count}</span>
        </button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={change} modal={false}>
      <DialogPrimitive.Trigger
        ref={trigger}
        aria-label={`Filter by ${label.toLowerCase()}`}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-5 w-5 items-center justify-center rounded transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS} ${
          tickedCount > 0 || open ? "text-accent" : "text-prt-muted"
        }`}
      >
        <ListFilter aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        {at && (
          <DialogPrimitive.Content
            aria-describedby={undefined}
            style={{ top: at.top, left: at.left }}
            onInteractOutside={(e) => {
              // The trigger toggles the panel itself; an outside press on it must not close and reopen it.
              if (trigger.current?.contains(e.target as Node)) e.preventDefault();
            }}
            className="fixed z-50 flex w-[272px] flex-col rounded-xl border border-hairline bg-panel p-1.5 font-display normal-case tracking-normal text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
          >
            <DialogTitle className="sr-only">{label}</DialogTitle>
            <label className="relative mb-1 block">
              <span className="sr-only">Search {label.toLowerCase()}</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-prt-muted" strokeWidth={2} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="h-9 w-full rounded-lg border border-hairline bg-white-5 pl-9 pr-3 text-[13px] text-prt-text outline-none transition-colors duration-300 ease-out placeholder:text-prt-muted focus:border-border-strong"
              />
            </label>
            <div className="max-h-[300px] overflow-y-auto">
              {sections.map((field, i) => {
                const options = field.options.filter(matches);
                if (field.title !== null && options.length === 0) return null;
                const on = options.filter((o) => field.ticked.includes(o.value));
                const off = options.filter((o) => !field.ticked.includes(o.value));
                return (
                  <div key={field.title ?? label} role={field.title === null ? undefined : "group"} aria-label={field.title ?? undefined}>
                    {field.title !== null && (
                      <p
                        aria-hidden
                        className={`px-2.5 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-prt-muted ${i > 0 ? "mt-1 border-t border-hairline pt-2.5" : "pt-1.5"}`}
                      >
                        {field.title}
                      </p>
                    )}
                    {on.length > 0 && <ul className="pb-1">{on.map(row(field))}</ul>}
                    {on.length > 0 && off.length > 0 && <div aria-hidden className="-mx-1.5 mb-1 h-px bg-hairline" />}
                    {off.length > 0 && <ul>{off.map(row(field))}</ul>}
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-hairline px-1.5 pb-1 pt-2.5">
              <button
                type="button"
                onClick={onClear}
                className={`rounded-md px-1 text-[13px] font-medium text-prt-text transition-colors duration-300 ease-out hover:text-text-2 ${FOCUS}`}
              >
                Clear
              </button>
              <span className="text-[12px] text-prt-muted">{tickedCount} selected</span>
            </div>
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
