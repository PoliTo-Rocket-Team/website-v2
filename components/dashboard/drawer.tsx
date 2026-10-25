"use client";

import type { FormEvent, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

const FOOTER_LAYOUT = {
  pair: "grid grid-cols-2",
  row: "flex",
  spread: "flex items-center justify-between",
} as const;

/** The outlined footer button: Cancel, Cancel request. */
export const PANEL_GHOST_BUTTON = `inline-flex h-11 items-center justify-center rounded-full border border-white-10 px-4 text-[14px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline-offset-2 ${FOCUS}`;

/** The paper footer button: the panel's main action. */
export const PANEL_PRIMARY_BUTTON = `inline-flex h-11 items-center justify-center rounded-full bg-prt-text px-4 text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 ${FOCUS}`;

/** The red filled footer button: Reject order, the last step of a rejection (board 70e). */
export const PANEL_DANGER_FILLED_BUTTON = `inline-flex h-11 items-center justify-center rounded-full bg-danger px-4 text-[14px] font-semibold text-prt-text transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;

/** The red outlined footer button: Cancel request (board 61c). */
export const PANEL_DANGER_BUTTON = `inline-flex h-11 items-center justify-center rounded-full border border-danger/50 px-4 text-[14px] font-semibold text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;

// The right-side panel of a dashboard page (Dashboard v2 boards 59b, 60b,
// 61b, 61c): a title, a scrolling body, and the actions pinned at its foot.
// From md it slides in from the right over the page, and from xl the page
// moves left of it (DrawerPage), as the boards show. The page behind is dimmed
// at every width (issue #203). On a phone it is a full
// page with a back arrow and the same pinned footer (phone rule, issues #169
// and #172).
// Built on the repo's Radix dialog primitive: it slides in only under
// motion-safe and closes at once (issues #79, #80).
export function SidePanel({
  open,
  onOpenChange,
  title,
  detail,
  leading,
  below,
  action,
  footer,
  footerLayout = "pair",
  wide = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  detail?: string;
  /** Beside the title, before it: the person's avatar on the member panels (boards 61f, 61g). */
  leading?: ReactNode;
  /** Under the title, in place of `detail`: a status pill and a line (board 76b). */
  below?: ReactNode;
  /** A small action beside the close button: Edit on an order whose footer is busy deciding (board 70b). */
  action?: ReactNode;
  /** The pinned actions; none for a panel that only shows. */
  footer?: ReactNode;
  /**
   * Two buttons of equal width; a row where each button sizes itself (board
   * 70b: Reject, Ask for changes, Approve); or one action on the left and the
   * rest on the right (board 76b: Remove, then Save draft and Publish).
   */
  footerLayout?: "pair" | "row" | "spread";
  /** The 520px panel of board 76b, for a form with fields side by side. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ground/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={`fixed inset-0 z-50 flex flex-col bg-ground text-prt-text focus:outline-none md:inset-y-0 md:left-auto md:right-0 ${wide ? "md:w-[520px]" : "md:w-[440px]"} md:border-l md:border-hairline motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right`}
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-hairline px-5 py-4 md:justify-between md:px-7 md:py-5">
            <DialogClose
              aria-label="Back"
              className={`-ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-prt-text transition-colors duration-300 ease-out hover:text-accent md:hidden ${FOCUS}`}
            >
              <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            </DialogClose>
            <div className="flex min-w-0 items-center gap-3.5 md:mr-auto">
              {leading}
              <div className="min-w-0">
                <DialogTitle className="truncate text-[18px] font-semibold leading-8 md:text-[20px] md:leading-tight">{title}</DialogTitle>
                {/* Wraps rather than being cut on a narrow screen (issue #690). */}
                {detail && <p className="mt-0.5 text-[13px] text-prt-muted">{detail}</p>}
                {below}
              </div>
            </div>
            {action}
            <DialogClose
              aria-label="Close"
              className={`-mr-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text md:flex ${FOCUS}`}
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </DialogClose>
          </header>
          {children}
          {footer && (
            <footer
              className={`${FOOTER_LAYOUT[footerLayout]} shrink-0 gap-3 border-t border-hairline px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-7`}
            >
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** The panel's scrolling body. */
export function PanelBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-7 ${className}`}>{children}</div>;
}

// A side panel that is a form (boards 60b and 61b): Cancel beside the main
// button at the foot, and the button submits. `secondary` takes Cancel's
// place where the board puts another action there (Remove all access, 60c).
export function Drawer({
  open,
  onOpenChange,
  title,
  detail,
  leading,
  submitLabel,
  submitting,
  onSubmit,
  secondary,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  detail?: string;
  leading?: ReactNode;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  secondary?: ReactNode;
  children: ReactNode;
}) {
  const formId = `${title.toLowerCase().replace(/\W+/g, "-")}-form`;
  return (
    <SidePanel
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      detail={detail}
      leading={leading}
      footer={
        <>
          {secondary ?? <DialogClose className={PANEL_GHOST_BUTTON}>Cancel</DialogClose>}
          <button type="submit" form={formId} disabled={submitting} className={PANEL_PRIMARY_BUTTON}>
            {submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
        <PanelBody>{children}</PanelBody>
      </form>
    </SidePanel>
  );
}

/** The page under a side panel: from xl it keeps clear of the open panel, as the boards show. */
export function DrawerPage({ drawerOpen, wide = false, children }: { drawerOpen: boolean; wide?: boolean; children: ReactNode }) {
  return <div className={drawerOpen ? (wide ? "xl:pr-[508px]" : "xl:pr-[428px]") : undefined}>{children}</div>;
}
