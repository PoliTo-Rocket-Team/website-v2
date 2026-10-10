"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { SHEET_CANCEL, SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";

// The "are you sure" step before a decisive move on an application (boards
// 58e Accept, 58f Reject, 58h Confirm join): an icon in a ring, the question,
// what it does, and two equal buttons, the cautious one first. It sits in
// the dashboard's one popup frame (confirm-dialog.tsx): a bottom sheet on a
// phone (50b-m), a centred card from sm.

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
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[460px]`}>
          <SheetGrabber />
          <span aria-hidden="true" className={`flex h-11 w-11 items-center justify-center rounded-full border ${RING[tone]}`}>
            {icon}
          </span>
          <DialogTitle className="mt-5 text-[20px] font-bold leading-snug">{title}</DialogTitle>
          <div className="mt-2 text-[14px] leading-relaxed text-text-2">{children}</div>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <DialogClose className={SHEET_CANCEL}>{cancelLabel}</DialogClose>
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
