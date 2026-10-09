"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

// The "are you sure" step before a decisive move on an application (boards
// 58e Accept, 58f Reject, 58h Confirm join): an icon in a ring, the question,
// what it does, and two equal buttons, the cautious one first. On a phone it
// is a bottom sheet (the Dashboard v2 phone rule, 50b-m). Like every dialog
// on a redesigned page it fades in under motion-safe and closes at once.

/** A popup's box: a bottom sheet on a phone, a centred card from md. */
export const SHEET =
  "fixed inset-x-0 bottom-0 z-50 max-h-[92svh] overflow-y-auto rounded-t-2xl border-t border-hairline bg-panel text-prt-text shadow-[0_-16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-bottom-4 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:max-h-[90vh] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border md:shadow-[0_16px_40px_rgba(0,0,0,0.6)] md:motion-safe:data-[state=open]:slide-in-from-bottom-0 md:motion-safe:data-[state=open]:fade-in-0";

/** The grab handle at the top of a bottom sheet; phones only. */
export function SheetHandle() {
  return <span aria-hidden="true" className="mx-auto mb-4 mt-[-4px] block h-1 w-10 rounded-full bg-white-10 md:hidden" />;
}

export const OVERLAY = "bg-ground/70 backdrop-blur-[3px]";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export type DecisionTone = "success" | "danger";

const RING: Readonly<Record<DecisionTone, string>> = {
  success: "border-success/40 bg-success-soft text-success",
  danger: "border-danger/40 bg-danger-soft text-danger",
};

const CONFIRM: Readonly<Record<DecisionTone, string>> = {
  success: "bg-success text-prt-text",
  danger: "bg-danger text-prt-text",
};

export function DecisionDialog({
  open,
  onOpenChange,
  tone,
  icon,
  title,
  children,
  cancelLabel,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: DecisionTone;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET} px-5 pb-6 pt-5 md:w-[460px] md:p-8`}>
          <SheetHandle />
          <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-full border ${RING[tone]}`}>
            {icon}
          </span>
          <DialogTitle className="mt-5 text-[20px] font-bold leading-snug">{title}</DialogTitle>
          <div className="mt-2 text-[14px] leading-relaxed text-text-2">{children}</div>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <DialogClose
              className={`inline-flex h-11 items-center justify-center rounded-full border border-white-10 px-4 text-[14px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
            >
              {cancelLabel}
            </DialogClose>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              className={`inline-flex h-11 items-center justify-center rounded-full px-4 text-[14px] font-semibold transition-opacity duration-300 ease-out hover:opacity-90 disabled:cursor-wait disabled:opacity-70 ${CONFIRM[tone]} ${FOCUS}`}
            >
              {confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** "What happens next": the numbered steps under the Accept question (58e). */
export function NextSteps({ steps }: { steps: readonly string[] }) {
  return (
    <div className="mt-5 rounded-xl border border-hairline bg-ground/40 px-4 py-3.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">What happens next</p>
      <ol className="mt-3 flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3 text-[13px] text-prt-text">
            <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white-10 font-mono text-[10px] text-text-2">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}
