"use client";

import type { ReactNode } from "react";

// A list row's way in from the keyboard (issue #616). Every dashboard list
// opens a row's side view on a click anywhere on the row; where the row is a
// table row or a draggable item, and so no button itself, its name is this
// button, so Tab reaches it and Enter or Space opens the same side view. It
// stops its own click, so the row's click does not open the view twice.
// `.patterns/dashboard-lists.md` records the rule.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function RowOpen({
  label,
  onOpen,
  className = "",
  children,
}: {
  /** What a screen reader hears: "Open Ada Rossi", "Fix how Ada Rossi shows". */
  label: string;
  onOpen: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className={`max-w-full rounded-md text-left ${FOCUS} ${className}`}
    >
      {children}
    </button>
  );
}
