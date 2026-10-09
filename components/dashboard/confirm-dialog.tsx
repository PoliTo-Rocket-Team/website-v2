"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { LucideIcon } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

export type ConfirmTone = "accent" | "danger" | "success";

const ICON_TONES: Readonly<Record<ConfirmTone, string>> = {
  accent: "border-accent/40 bg-accent-soft text-accent",
  danger: "border-danger/40 bg-danger-soft text-danger",
  success: "border-success/40 bg-success-soft text-success",
};

const BUTTON = "inline-flex h-11 items-center justify-center rounded-full px-4 text-[14px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The "are you sure" step before a destructive or decisive action (boards 45,
// 45b, 59d, 59e). From md it is a popup in the middle of the page; on a phone
// it is a bottom sheet (phone rule, issue #172). It is centred by margins, not
// transforms, so the open animation never moves it off centre. It fades or slides in under
// motion-safe and closes at once, like every dialog on a redesigned page.
// With no `confirmLabel` it is a notice: the action cannot run yet, and the
// only button closes it. `children` is the message; `body` holds anything the
// person fills in before confirming.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  icon: Icon,
  tone = "accent",
  children,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: LucideIcon;
  tone?: ConfirmTone;
  children: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
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
          className="fixed inset-x-0 bottom-0 z-50 max-h-[90svh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 text-prt-text shadow-[0_-16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom md:inset-0 md:m-auto md:h-fit md:w-[calc(100%-40px)] md:max-w-[460px] md:rounded-xl md:border md:p-8 md:shadow-[0_16px_40px_rgba(0,0,0,0.6)] md:motion-safe:data-[state=open]:fade-in-0 md:motion-safe:data-[state=open]:slide-in-from-bottom-0"
        >
          <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-white-10 md:hidden" />
          {Icon && (
            <span aria-hidden className={`mb-5 flex h-11 w-11 items-center justify-center rounded-full border ${ICON_TONES[tone]}`}>
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
          )}
          <DialogTitle className="text-[20px] font-semibold leading-snug">{title}</DialogTitle>
          <div className="mt-2 text-[14px] leading-relaxed text-text-2">{children}</div>
          {body && <div className="mt-5">{body}</div>}
          {/* On a phone the main action sits on top and both span the sheet. */}
          <div className="mt-6 flex flex-col-reverse gap-3 md:grid md:grid-cols-2">
            <DialogClose className={`${BUTTON} border border-white-10 transition-colors duration-300 ease-out hover:border-border-strong ${confirmLabel ? "" : "md:col-span-2"}`}>
              {confirmLabel ? cancelLabel : "Close"}
            </DialogClose>
            {confirmLabel && (
              <button
                type="button"
                onClick={onConfirm}
                disabled={pending}
                className={`${BUTTON} transition-opacity duration-300 ease-out hover:opacity-90 disabled:cursor-wait disabled:opacity-70 ${
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
