"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { CONTENT_FOCUS } from "./content-parts";

// The content editors' one panel frame, drawn from the outreach post editor
// (boards 74c and 75c, ruling R1.1 on #720): 480px wide, a header with an
// optional eyebrow, the title and a close button, a scrolling body, and a
// foot for the panel's buttons (PANEL_PRIMARY_BUTTON and PANEL_GHOST_BUTTON
// from drawer.tsx). `EditorPanel` sits beside a page under the edit shell;
// `EditorPanelModal` opens the same frame over a list.

const CLOSE_BUTTON = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${CONTENT_FOCUS}`;

const TITLE = "truncate text-[18px] font-bold";

/** The shared DialogTitle sets its own leading and tracking; the modal's title inherits both, as the inline one does. */
const MODAL_TITLE = `${TITLE} leading-[inherit] tracking-[inherit]`;

type FrameProps = {
  /** A line over the title (board 75c: "PROJECT PAGE"). */
  eyebrow?: string;
  title: string;
  /** The buttons at the panel's foot, right-aligned; none leaves no foot. */
  foot?: ReactNode;
  children: ReactNode;
};

function Header({ eyebrow, heading, close }: { eyebrow?: string; heading: ReactNode; close: ReactNode }) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-[18px]">
      <div className="min-w-0">
        {eyebrow !== undefined && <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
        {heading}
      </div>
      {close}
    </header>
  );
}

function Body({ children }: { children: ReactNode }) {
  return <div className="min-h-0 flex-1 overflow-y-auto px-[18px] py-4">{children}</div>;
}

function Foot({ children, safeArea = false }: { children: ReactNode; safeArea?: boolean }) {
  return (
    <footer
      className={`flex shrink-0 justify-end gap-3 border-t border-hairline px-6 py-4 ${safeArea ? "pb-[max(1rem,env(safe-area-inset-bottom))]" : ""}`}
    >
      {children}
    </footer>
  );
}

/** The frame beside a page under the edit shell; the shell lays it out on a phone. */
export function EditorPanel({
  label,
  eyebrow,
  title,
  onClose,
  foot,
  children,
}: FrameProps & {
  /** The panel's accessible name. */
  label: string;
  onClose: () => void;
}) {
  return (
    <aside aria-label={label} className="flex flex-col border-l border-hairline bg-panel max-md:h-full md:w-[480px] md:shrink-0">
      <Header
        eyebrow={eyebrow}
        heading={<h2 className={TITLE}>{title}</h2>}
        close={
          <button type="button" onClick={onClose} aria-label="Close the panel" className={CLOSE_BUTTON}>
            <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
        }
      />
      <Body>{children}</Body>
      {foot !== undefined && <Foot>{foot}</Foot>}
    </aside>
  );
}

/**
 * The same frame over a list (Partners, FAQ): from md it slides in from the
 * right over the dimmed page, and on a phone it is a full page with the same
 * header. Built on the repo's Radix dialog primitive, as SidePanel is: it
 * slides in only under motion-safe and closes at once (issues #79, #80).
 */
export function EditorPanelModal({
  open,
  onOpenChange,
  eyebrow,
  title,
  foot,
  children,
}: FrameProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-ground/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-panel text-prt-text focus:outline-none md:inset-y-0 md:left-auto md:right-0 md:w-[480px] md:border-l md:border-hairline motion-safe:duration-300 motion-safe:ease-out motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:slide-in-from-right"
        >
          <Header
            eyebrow={eyebrow}
            heading={<DialogTitle className={MODAL_TITLE}>{title}</DialogTitle>}
            close={
              <DialogClose aria-label="Close the panel" className={CLOSE_BUTTON}>
                <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </DialogClose>
            }
          />
          <Body>{children}</Body>
          {foot !== undefined && <Foot safeArea>{foot}</Foot>}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
