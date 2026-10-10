"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { Check, ChevronDown, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// The small controls of the recruitment pages (boards 41, 41b, 41c): the
// switch, the segmented filter with counts, the filter menu and the search
// field. Built on the repo's Radix primitives, styled with the PRT tokens.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Orange for a position, green for the site-wide recruitment switch. */
export function Toggle({
  checked,
  onCheckedChange,
  label,
  tone = "accent",
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  tone?: "accent" | "success";
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={`inline-flex h-5 w-[34px] shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-colors duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-60 data-[state=unchecked]:bg-white-10 ${
        tone === "accent" ? "data-[state=checked]:bg-accent" : "data-[state=checked]:bg-success"
      } ${FOCUS}`}
    >
      <SwitchPrimitive.Thumb className="block h-4 w-4 rounded-full bg-prt-text shadow-sm transition-transform duration-300 ease-out data-[state=checked]:translate-x-[14px]" />
    </SwitchPrimitive.Root>
  );
}

/**
 * "All 18 · Open 6 · Closed 12": one choice, each with its count. With
 * `phone="chips"` the choices are separate pills below md, as the Dashboard v2
 * phone boards draw them (57m, 58m).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  phone = "segmented",
}: {
  label: string;
  options: readonly { readonly value: T; readonly label: string; readonly count: number }[];
  value: T;
  onChange: (value: T) => void;
  phone?: "segmented" | "chips";
}) {
  const chips = phone === "chips";
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex max-w-full overflow-x-auto ${
        chips ? "gap-2 md:gap-0 md:rounded-lg md:border md:border-hairline md:bg-panel/60 md:p-0.5" : "rounded-lg border border-hairline bg-panel/60 p-0.5"
      }`}
    >
      {options.map((option) => {
        const current = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={current}
            onClick={() => onChange(option.value)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] md:h-7 md:rounded-md md:border-0 md:px-3 transition-colors duration-300 ease-out ${FOCUS} ${
              chips ? "h-8 rounded-full border border-hairline px-3" : "h-7 rounded-md"
            } ${current ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"}`}
          >
            {option.label}
            <span className="font-mono text-[11px] font-normal text-dim">{option.count}</span>
          </button>
        );
      })}
    </div>
  );
}

/** "All departments ⌄": one of a list, or all of them (`null`). */
export function FilterMenu({
  allLabel,
  options,
  value,
  onChange,
}: {
  allLabel: string;
  options: readonly { readonly value: string; readonly label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const current = options.find((o) => o.value === value)?.label ?? allLabel;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`flex h-8 min-w-0 max-w-full items-center gap-2 rounded-lg border border-hairline px-3 text-[13px] text-prt-text transition-colors duration-300 ease-out hover:border-border-strong data-[state=open]:border-border-strong ${FOCUS}`}
      >
        <span className="truncate">{current}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[320px] min-w-[200px] overflow-y-auto rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup value={value ?? ""} onValueChange={(v) => onChange(v === "" ? null : v)}>
            {[{ value: "", label: allLabel }, ...options].map((option) => (
              <DropdownMenuPrimitive.RadioItem
                key={option.value}
                value={option.value}
                className="flex h-8 cursor-pointer items-center justify-between gap-4 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text"
              >
                {option.label}
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
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block w-full md:w-[260px]">
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-prt-muted" strokeWidth={2} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        className="h-8 w-full rounded-lg border border-hairline bg-transparent pl-9 pr-3 text-[13px] text-prt-text outline-none transition-colors duration-300 ease-out placeholder:text-prt-muted hover:border-border-strong focus:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      />
    </label>
  );
}
