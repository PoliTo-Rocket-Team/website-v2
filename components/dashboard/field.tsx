"use client";

import { useId, type ReactNode } from "react";

// A labelled dashboard form field (boards 43 to 45): the label, a muted hint
// beside it ("from your division", "optional"), the control, and an error
// under it. The control gets the ids through `children`.
export function Field({
  label,
  hint,
  error,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-2 block text-[13px] leading-snug text-prt-text">
        {label}
        {hint && <span className="ml-1.5 text-prt-muted">{hint}</span>}
      </label>
      {children(id, error === undefined ? undefined : errorId)}
      {error !== undefined && (
        <p id={errorId} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** A heading for a group of controls that is not one labelled input ("Access", "Level"). */
export function GroupLabel({ id, label, hint }: { id: string; label: string; hint?: string }) {
  return (
    <p id={id} className="mb-2 text-[13px] leading-snug text-prt-text">
      {label}
      {hint && <span className="ml-1.5 text-prt-muted">{hint}</span>}
    </p>
  );
}

/**
 * The input box, as the application form draws it (components/apply): white-5
 * fill and a white-10 edge; the field in use takes the accent edge on its
 * tint (board 44's Item field).
 */
export function inputClass(error?: string): string {
  return `h-11 w-full rounded-[10px] border bg-white-5 px-3.5 text-[14px] text-prt-text placeholder:text-dim transition-colors duration-300 ease-out focus:outline-none focus:border-accent focus:bg-accent/[0.06] ${
    error === undefined ? "border-white-10" : "border-danger"
  }`;
}

/** A field the person cannot change: muted text and a lock (board 45's Name, Role, Team email). */
export const LOCKED_INPUT =
  "flex h-11 w-full items-center gap-2 rounded-[10px] border border-white-10 px-3.5 text-[14px] text-prt-muted";
