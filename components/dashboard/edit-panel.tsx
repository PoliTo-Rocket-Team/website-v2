"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown, X } from "lucide-react";
import { CONTENT_FOCUS } from "./content-parts";
import { PANEL_PRIMARY_BUTTON } from "./drawer";

// The edit panel beside a page under the edit shell (boards 74c and 75c):
// 480px wide, a header with the panel's name and a close button, one card
// per section, any of them open at once, and Done at the foot. Every content
// type that edits on the page brings its own sections; Save draft and
// Publish sit on the edit bar, not here.

const SECTION_CARD =
  "scroll-mt-4 rounded-xl border border-hairline bg-ground/40 transition-colors duration-300 ease-out data-[state=open]:border-accent/40";

export function EditPanel<Section extends string>({
  label,
  eyebrow,
  title,
  expanded,
  onExpandedChange,
  onClose,
  children,
}: {
  /** The panel's accessible name. */
  label: string;
  /** A line over the title (board 75c: "PROJECT PAGE"). */
  eyebrow?: string;
  title: string;
  expanded: readonly Section[];
  onExpandedChange: (sections: Section[]) => void;
  onClose: () => void;
  /** The sections, each a PanelSection. */
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className="flex flex-col border-l border-hairline bg-panel max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-[60px] max-md:z-50 md:w-[480px] md:shrink-0"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-[18px]">
        <div className="min-w-0">
          {eyebrow !== undefined && <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">{eyebrow}</p>}
          <h2 className={`truncate text-[18px] font-bold ${eyebrow === undefined ? "" : "mt-1"}`}>{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the panel"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${CONTENT_FOCUS}`}
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      <AccordionPrimitive.Root
        type="multiple"
        value={[...expanded]}
        onValueChange={(value) => onExpandedChange(value as Section[])}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-[18px] py-4"
      >
        {children}
      </AccordionPrimitive.Root>

      <footer className="flex shrink-0 justify-end border-t border-hairline px-6 py-4">
        <button type="button" onClick={onClose} className={PANEL_PRIMARY_BUTTON}>
          Done
        </button>
      </footer>
    </aside>
  );
}

/**
 * Brings the section an Edit chip just opened into view. `scrollTo` is a new
 * object each time a chip is clicked, so clicking the same chip again scrolls
 * again. Returns the ref each section card takes.
 */
export function usePanelScroll<Section extends string>(scrollTo: { readonly section: Section } | null) {
  const cards = useRef<Partial<Record<Section, HTMLDivElement | null>>>({});
  useEffect(() => {
    if (scrollTo !== null) cards.current[scrollTo.section]?.scrollIntoView({ block: "start" });
  }, [scrollTo]);
  return useCallback(
    (section: Section) => (node: HTMLDivElement | null) => {
      cards.current[section] = node;
    },
    [],
  );
}

/**
 * One section card: its title and a one-line summary while closed, the
 * fields while open. `control` sits in the header beside the chevron, outside
 * the toggle, as an optional section's show-on-page switch does (board 75c).
 */
export function PanelSection({
  value,
  title,
  summary,
  control,
  cardRef,
  children,
}: {
  value: string;
  title: string;
  summary: string;
  control?: ReactNode;
  cardRef?: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <AccordionPrimitive.Item ref={cardRef} value={value} className={SECTION_CARD}>
      <AccordionPrimitive.Header asChild>
        <h3 className="relative">
          <AccordionPrimitive.Trigger
            className={`group/section flex w-full items-center justify-between gap-4 rounded-xl px-4 py-3.5 text-left ${CONTENT_FOCUS}`}
          >
            <span className={`min-w-0 ${control === undefined ? "" : "pr-14"}`}>
              <span className="block text-[14px] font-semibold leading-snug">{title}</span>
              <span className="mt-0.5 block truncate text-[12px] text-prt-muted group-data-[state=open]/section:hidden">{summary}</span>
            </span>
            <ChevronDown
              aria-hidden
              className="h-4 w-4 shrink-0 text-prt-muted group-data-[state=open]/section:rotate-180"
              strokeWidth={1.75}
            />
          </AccordionPrimitive.Trigger>
          {control !== undefined && <span className="absolute right-11 top-1/2 flex -translate-y-1/2">{control}</span>}
        </h3>
      </AccordionPrimitive.Header>
      <AccordionPrimitive.Content className="px-4 pb-4">
        <div className="space-y-4">{children}</div>
      </AccordionPrimitive.Content>
    </AccordionPrimitive.Item>
  );
}

/** A section's error that belongs to no one field. */
export function ErrorLine({ error }: { error: string | undefined }) {
  return error === undefined ? null : <p className="text-[12px] text-danger">{error}</p>;
}
