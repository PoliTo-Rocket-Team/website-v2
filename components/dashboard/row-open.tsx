"use client";

import type { KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

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

/**
 * Where a content list row's editor is (issue #617): its own page (Projects,
 * Outreach), or the list's side panel (Partners, FAQ).
 */
export type EditTarget = { readonly href: string } | { readonly onOpen: () => void };

/** The Edit chip's width, so a list's heading row can keep the chip's column. */
export const EDIT_CHIP_WIDTH = "w-7 md:w-[72px]";

// The edit shell's Edit chip (edit-shell.tsx), at a list row's end. The row
// brightens it on hover, since a click anywhere on the row does what it does.
// On phones a row has no room for the word beside its name, status and menu,
// so the chip is its pencil alone; its label still names it to a screen reader.
const EDIT_CHIP = `inline-flex h-7 ${EDIT_CHIP_WIDTH} shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-accent text-[13px] font-semibold text-accent-on-accent hover:bg-accent-hover group-hover/row:bg-accent-hover motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out ${FOCUS}`;

/**
 * A content list row's Edit chip (issue #617): a click anywhere on the row,
 * or Enter or Space on the chip, opens the row's editor.
 *
 * - An editor page: the chip is a link, and its `::after` covers the row, so
 *   the row needs `relative` and every control in it that does its own thing
 *   `relative z-10`, to sit above the cover.
 * - A side panel: the row takes the click (it is draggable, so no link), and
 *   the chip is a button that stops its own click, so the panel opens once.
 */
export function EditChip({ label, target }: { /** What a screen reader hears: "Edit Cavour". */ label: string; target: EditTarget }) {
  const face = (
    <>
      <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      <span className="hidden md:inline">Edit</span>
    </>
  );
  if ("href" in target) {
    return (
      <Link href={target.href} aria-label={label} onKeyDown={openOnSpace} className={`${EDIT_CHIP} after:absolute after:inset-0 after:content-['']`}>
        {face}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        target.onOpen();
      }}
      className={EDIT_CHIP}
    >
      {face}
    </button>
  );
}

/** A link opens on Enter; the chip is a button to the eye, so Space opens it too. */
function openOnSpace(event: KeyboardEvent<HTMLAnchorElement>) {
  if (event.key !== " ") return;
  event.preventDefault();
  event.currentTarget.click();
}
