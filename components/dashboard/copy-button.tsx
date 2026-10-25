"use client";

import type { ReactNode } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

// The dashboard's one copy control: the member drawer's facts (board 94e) and
// Mark created's forwards-to row (board 94d, issue #586) both copy through it.

/** Writes `text` to the clipboard, then says so in a toast: "<what> copied", or that it could not. */
export async function copyText(text: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}`);
  }
}

/** A 28px icon button, muted until hover. */
export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </button>
  );
}

/** Copies `value` in one click, with `what` naming it in the button's label and the toast. */
export function CopyButton({ value, what }: { value: string; what: string }) {
  return (
    <IconButton label={`Copy ${what.toLowerCase()}`} onClick={() => copyText(value, what)}>
      <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
    </IconButton>
  );
}
