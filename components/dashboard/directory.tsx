"use client";

import type { ReactNode } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { pagerItems, type TeamRole } from "@/lib/dashboard/team";

// The parts the Members and Alumni pages share (boards 46, 46c, 59): the
// page header, the tab strip with counts (a row of chips on a phone, board
// 59m), the department filter, search, the role pill and the pager. Props
// in, nothing fetched.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function PageHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <header>
      <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">{title}</h1>
      <p className="mt-1 text-[14px] text-prt-muted">{detail}</p>
    </header>
  );
}

/** The controls row: filters on the left, search on the right; stacked on phones. */
export function Controls({ children, search }: { children: ReactNode; search: ReactNode }) {
  return (
    <div className="mt-6 flex flex-col gap-3 md:mt-8 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-3">{children}</div>
      {search}
    </div>
  );
}

export type TabItem<K extends string> = { readonly key: K; readonly label: string; readonly count: number };

export function Tabs<K extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex max-w-full items-center gap-1.5 overflow-x-auto md:h-10 md:gap-0.5 md:rounded-xl md:border md:border-hairline md:p-1"
    >
      {items.map((item) => {
        const current = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={current}
            onClick={() => onChange(item.key)}
            className={`flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors duration-300 ease-out md:h-full md:rounded-lg md:border-0 md:text-[14px] ${FOCUS} ${
              current ? "border-white-10 bg-white-10 font-semibold text-prt-text" : "border-hairline text-text-2 hover:text-prt-text"
            }`}
          >
            {item.label}
            <span className={`text-[12px] ${current ? "text-prt-muted" : "text-dim"}`}>{item.count}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DepartmentFilter({
  departments,
  value,
  onChange,
}: {
  departments: readonly string[];
  value: string | null;
  onChange: (department: string | null) => void;
}) {
  const options: readonly (string | null)[] = [null, ...departments];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex h-10 items-center gap-2 rounded-xl border border-hairline px-3.5 text-[14px] text-prt-text transition-colors duration-300 ease-out hover:border-border-strong data-[state=open]:border-border-strong ${FOCUS}`}
      >
        {value ?? "All departments"}
        <ChevronDown aria-hidden className="h-4 w-4 text-prt-muted" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[320px] min-w-[220px] overflow-y-auto rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup
            value={value ?? ""}
            onValueChange={(next) => onChange(next === "" ? null : next)}
          >
            {options.map((option) => (
              <DropdownMenuPrimitive.RadioItem
                key={option ?? ""}
                value={option ?? ""}
                className="flex h-8 cursor-default items-center justify-between gap-4 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[state=checked]:text-prt-text data-[highlighted]:text-prt-text"
              >
                {option ?? "All departments"}
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                </DropdownMenuPrimitive.ItemIndicator>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className = "md:w-[360px]",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`relative flex h-10 w-full items-center ${className}`}>
      <span className="sr-only">{placeholder}</span>
      <Search aria-hidden className="pointer-events-none absolute left-3.5 h-4 w-4 text-prt-muted" strokeWidth={1.75} />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full w-full rounded-xl border border-hairline bg-transparent pl-10 pr-3.5 text-[14px] text-prt-text placeholder:text-prt-muted transition-colors duration-300 ease-out hover:border-border-strong focus:border-border-strong focus:outline-none"
      />
    </label>
  );
}

/** Leads on the accent tint, members on white-10 (boards 46 and 59). */
export function RolePill({ role, label }: { role: TeamRole; label: string }) {
  const lead = role !== "member";
  return (
    <span
      className={`inline-block h-6 max-w-full truncate whitespace-nowrap rounded-full px-2.5 text-[12px] font-medium leading-6 ${
        lead ? "bg-accent-soft text-accent" : "bg-white-10 text-text-2"
      }`}
    >
      {label}
    </span>
  );
}

/** The table's head row: small mono labels. */
export const TH = "px-5 py-3.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.3em] text-dim";

export function Pager({ page, last, onPage }: { page: number; last: number; onPage: (page: number) => void }) {
  if (last <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center gap-1">
      {pagerItems(page, last).map((item, i) =>
        item === null ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-[13px] text-prt-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPage(item)}
            aria-current={item === page ? "page" : undefined}
            aria-label={`Page ${item}`}
            className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
              item === page ? "bg-white-10 text-prt-text" : "text-prt-muted hover:text-prt-text"
            }`}
          >
            {item}
          </button>
        ),
      )}
    </nav>
  );
}
