"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";

// The popover a position page shows in place of the form (boards 35e, 35c and
// 35d; 35em, 35cm and 35dm on phones): a centred 440px panel from md, a
// bottom sheet with a handle below it, over the page dimmed and blurred. It
// is always open and has no way to close: no close button, and Escape and a
// click outside do nothing. Every state it holds either has a button that
// leads away or is the sign-in no one applies without (issue #147). It is the
// repo's Radix dialog, so the title labels it, focus stays in it and the page
// behind is hidden from assistive tech. It is centred with margins, not a
// transform, so the open animation's transform cannot move it; that animation
// runs only under `motion-safe:` (issue #80). On open, focus goes to the
// popover itself rather than its first button, so a screen reader starts at
// the title and no focus ring shows before the visitor moves.
export function StatePopover({ children }: { children: ReactNode }) {
  return (
    <Dialog open>
      <DialogPortal>
        <DialogOverlay className="bg-ground/60 backdrop-blur-[6px]" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement | null)?.focus();
          }}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          className="fixed inset-x-0 bottom-0 z-50 max-h-[calc(100svh-24px)] overflow-y-auto rounded-t-[20px] border-t border-border-strong bg-panel px-6 pb-10 pt-3 text-center text-prt-text shadow-2xl focus:outline-none md:inset-0 md:m-auto md:h-fit md:w-[440px] md:max-w-[calc(100vw-40px)] md:rounded-2xl md:border md:px-10 md:pb-12 md:pt-16 motion-safe:data-[state=open]:duration-300 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 max-md:motion-safe:data-[state=open]:slide-in-from-bottom md:motion-safe:data-[state=open]:zoom-in-95"
        >
          <span aria-hidden className="mx-auto mb-7 block h-1 w-10 rounded-full bg-dim md:hidden" />
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
