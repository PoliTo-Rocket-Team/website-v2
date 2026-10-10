"use client";

import type { FormEvent, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

// The panel that slides in from the right over a dashboard page (boards 43
// and 44): a title, a scrolling form, and Cancel beside the main button at
// the foot. Built on the Radix dialog primitive like the shell's menu: it
// slides in only under motion-safe and closes at once (issues #79, #80).
// From xl the page moves left of it (DrawerPage), as the boards show. On
// phones it is a full page with a back arrow and the buttons pinned at the
// foot (Dashboard v2 phone rule, issue #169).
export function Drawer({
  open,
  onOpenChange,
  title,
  detail,
  submitLabel,
  submitting,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  detail?: string;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ground/50 xl:bg-transparent" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-hairline bg-ground text-prt-text focus:outline-none sm:w-[440px] motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right"
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-hairline px-5 py-5 sm:px-7">
            <DialogClose
              aria-label="Back"
              className="-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-prt-text transition-colors duration-300 ease-out hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:hidden"
            >
              <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </DialogClose>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[20px] font-semibold leading-tight">{title}</DialogTitle>
              {detail && <p className="mt-0.5 text-[13px] text-prt-muted">{detail}</p>}
            </div>
            <DialogClose
              aria-label="Close"
              className="-mr-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent sm:flex"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </DialogClose>
          </header>
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">{children}</div>
            <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-hairline px-5 py-4 sm:px-7">
              <DialogClose className="inline-flex h-11 items-center justify-center rounded-full border border-white-10 text-[14px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Cancel
              </DialogClose>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center rounded-full bg-prt-text text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70"
              >
                {submitLabel}
              </button>
            </footer>
          </form>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** The page under a drawer: from xl it keeps clear of the open drawer, as boards 43 and 44 show. */
export function DrawerPage({ drawerOpen, children }: { drawerOpen: boolean; children: ReactNode }) {
  return <div className={drawerOpen ? "xl:pr-[428px]" : undefined}>{children}</div>;
}
