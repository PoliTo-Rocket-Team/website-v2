"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

// The confirm step before a destructive action (board 45 Leave and Delete,
// board 45b Withdraw and Delete). It fades in under motion-safe and closes at
// once, like every dialog on a redesigned page. With no `confirmLabel` it is
// a notice: the action cannot run yet, and the only button closes it.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  danger = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ground/70 backdrop-blur-[3px]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-40px)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-hairline bg-panel p-6 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DialogTitle className="text-[18px] font-semibold leading-snug">{title}</DialogTitle>
          <div className="mt-2 text-[14px] leading-relaxed text-text-2">{children}</div>
          <div className="mt-6 flex justify-end gap-3">
            <DialogClose className="inline-flex h-10 items-center justify-center rounded-full border border-white-10 px-4 text-[14px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              {confirmLabel ? "Cancel" : "Close"}
            </DialogClose>
            {confirmLabel && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-[14px] font-semibold transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70 ${
                  danger ? "bg-danger text-prt-text" : "bg-prt-text text-ground"
                }`}
              >
                {confirmLabel}
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
