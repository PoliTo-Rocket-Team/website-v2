"use client";

import { Search } from "lucide-react";

// The one search bar of the dashboard (issue #616): 40px tall, round 12px
// corners, 14px text and a 16px glass. Every list's search, and every search
// inside a drawer or a filter popover, draws this one; only the width differs
// per place. `.patterns/dashboard-lists.md` records the rule.

export function SearchField({
  value,
  onChange,
  placeholder,
  className = "md:w-[360px]",
}: {
  value: string;
  onChange: (value: string) => void;
  /** Shown in the empty field, and what a screen reader hears for it. */
  placeholder: string;
  /** The width (and outer room) for this place; full width when empty. */
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
