"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

/**
 * The popup's frame (Dashboard v2, issue #169): a centred card from sm, and
 * a bottom sheet with a grab bar on phones (board 50b-m, Huey's phone rule).
 * It fades in, or slides up on phones, under motion-safe only, and closes at
 * once, like every dialog on a redesigned page (issues #79, #80).
 */
export const SHEET_CONTENT =
  "fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel px-5 pb-6 pt-3 text-prt-text shadow-[0_-16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 max-sm:motion-safe:data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:p-8 sm:shadow-[0_16px_40px_rgba(0,0,0,0.6)]";

/** The grab bar on top of a phone sheet. */
export function SheetGrabber() {
  return <span aria-hidden className="mx-auto mb-5 block h-1 w-9 rounded-full bg-white-10 sm:hidden" />;
}

/** The two buttons at a popup's foot: side by side from sm, the action over the way out on phones (board 50b-m). */
export const SHEET_BUTTONS = "mt-6 flex flex-col-reverse gap-3 sm:grid sm:grid-cols-2";

export const SHEET_CANCEL =
  "inline-flex h-11 items-center justify-center rounded-full border border-white-10 px-4 text-[14px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function sheetConfirm(danger: boolean): string {
  return `inline-flex h-11 items-center justify-center rounded-full px-4 text-[14px] font-semibold transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 ${
    danger ? "bg-danger text-prt-text" : "bg-prt-text text-ground"
  }`;
}

// The "are you sure" step before a destructive or decisive action (boards
// 50b, 50c, 51c, 55b and 55c): an icon in a tinted ring, the question, what
// happens, anything the action needs (a reason, the word DELETE), and the way
// out beside the action.
export function ConfirmDialog({
  open,
  onOpenChange,
  icon,
  title,
  description,
  children,
  cancelLabel,
  confirmLabel,
  danger = false,
  pending = false,
  confirmDisabled = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ground/70 backdrop-blur-[3px]" />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[440px]`}>
          <SheetGrabber />
          <span
            aria-hidden
            className={`flex h-11 w-11 items-center justify-center rounded-full border ${
              danger ? "border-danger/40 bg-danger-soft text-danger" : "border-accent/40 bg-accent-soft text-accent"
            }`}
          >
            {icon}
          </span>
          <DialogTitle className="mt-5 text-[20px] font-bold leading-snug">{title}</DialogTitle>
          <div className="mt-2 text-[14px] leading-relaxed text-text-2">{description}</div>
          {children}
          <div className={SHEET_BUTTONS}>
            <DialogClose className={SHEET_CANCEL}>{cancelLabel}</DialogClose>
            <button type="button" onClick={onConfirm} disabled={pending || confirmDisabled} className={sheetConfirm(danger)}>
              {confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
