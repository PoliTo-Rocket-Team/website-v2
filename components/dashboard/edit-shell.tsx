"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Monitor, Pencil, Smartphone } from "lucide-react";
import {
  editChips,
  PHONE_FRAME_WIDTH,
  showsPageSwitch,
  type EditBlocks,
  type EditChip,
  type EditDevice,
  type PageTarget,
} from "@/lib/content/edit-shell";
import { CONTENT_STATUS_LABELS, type ContentStatus } from "@/lib/content/versioned";
import { CONTENT_FOCUS } from "./content-parts";
import { EditFrame } from "./edit-frame";

// The edit shell (boards 74b, 74e, 75b and 75d, issue #288): a content type's
// real page under an edit bar, on top of the dashboard. Any content type
// mounts it: it is handed the page, the page's blocks and their panel
// sections, the publish state, the callbacks and its own edit panel, and
// knows nothing of what the page shows. The page marks each block with EditableBlock; hovering one
// outlines it with its name and an Edit chip that hands its section back.
//
// The bar: "<Section> / Editing <item>" and the state on the left; Save draft
// and Publish on the right. Desktop | Phone sits in the middle (74b), unless
// the shell has pages to switch between: then the page switch takes the
// middle and Desktop | Phone moves beside Save draft (75b, 75d). On a page
// other than the item's own, the content type marks its item's card with
// CardInPlace (75d): the card outlined with an Edit card chip, the other
// cards dimmed.

const ChipContext = createContext<((id: string) => EditChip) | null>(null);

const STATE_TONE: Readonly<Record<ContentStatus, { pill: string; dot: string }>> = {
  draft: { pill: "bg-white-5 text-text-2", dot: "bg-prt-muted" },
  "draft-changes": { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  published: { pill: "bg-success-soft text-success", dot: "bg-success" },
};

const BAR_BUTTON = `inline-flex h-[31px] items-center justify-center rounded-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${CONTENT_FOCUS}`;

/** The page switch: the pages this item shows on, and the one in view. */
export type PageSwitch<Page extends string> = {
  readonly targets: readonly PageTarget<Page>[];
  readonly current: Page;
  readonly onSelect: (page: Page) => void;
};

export function EditShell<Id extends string, Section extends string, Page extends string = never>({
  section,
  item,
  status,
  saved,
  onSaveDraft,
  onPublish,
  pages,
  blocks,
  onEdit,
  children,
  panel,
}: {
  /** The dashboard page this item belongs to, as the breadcrumb's first step. */
  section: { readonly label: string; readonly href: string };
  /** The item's name: "Editing <item>". */
  item: string;
  status: ContentStatus;
  /**
   * A short line before Save draft: when the draft was last saved ("Saved 2
   * min ago"), or, while the edit panel is open, "Changes show on the page as
   * you type" (board 74c).
   */
  saved?: string;
  /** Null shows the button but leaves it off, as on a page that cannot be edited yet. */
  onSaveDraft: (() => void) | null;
  onPublish: (() => void) | null;
  /** The page switch; with fewer than two pages the bar shows none. */
  pages?: PageSwitch<Page>;
  blocks: EditBlocks<Id, Section>;
  onEdit: (section: Section) => void;
  /** The page, its blocks marked with EditableBlock. */
  children: ReactNode;
  /** The content type's edit panel, drawn right of the page below the bar while open (board 74c); it sets its own width. */
  panel?: ReactNode;
}) {
  const [device, setDevice] = useState<EditDevice>("desktop");
  const chipOf = useMemo(() => editChips(blocks, onEdit), [blocks, onEdit]);
  const switcher = pages !== undefined && showsPageSwitch(pages.targets) ? pages : null;
  const devices = <DeviceToggle device={device} onChange={setDevice} />;
  const phone = device === "phone";
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ground text-prt-text">
      <header className="relative flex h-[60px] shrink-0 items-center gap-4 border-b border-hairline bg-panel px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 text-[13px]">
          <Link
            href={section.href}
            aria-label={`Back to ${section.label}`}
            className={`group inline-flex shrink-0 items-center gap-2.5 rounded-md text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${CONTENT_FOCUS}`}
          >
            <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">{section.label}</span>
          </Link>
          <span aria-hidden className="hidden text-dim sm:inline">
            /
          </span>
          <h1 className="min-w-0 truncate font-semibold">Editing {item}</h1>
          <StatePill status={status} />
        </div>

        <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
          {switcher === null ? devices : <PageSwitcher {...switcher} />}
        </div>

        <div className="flex flex-1 items-center justify-end gap-2.5">
          {switcher !== null && <div className="mr-0.5 hidden md:block">{devices}</div>}
          {saved !== undefined && <p className="hidden whitespace-nowrap text-[12px] text-prt-muted lg:block">{saved}</p>}
          <button
            type="button"
            disabled={onSaveDraft === null}
            onClick={() => onSaveDraft?.()}
            className={`${BAR_BUTTON} border border-white-10 transition-colors duration-300 ease-out hover:border-border-strong`}
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={onPublish === null}
            onClick={() => onPublish?.()}
            className={`${BAR_BUTTON} bg-prt-text text-ground transition-opacity duration-300 ease-out hover:opacity-90`}
          >
            Publish
          </button>
        </div>
      </header>

      {/* One frame for both devices: switching only resizes it, so the page
          keeps its state and scroll. Below md there is no Phone mode: the
          window is a phone already. */}
      <div className="flex min-h-0 flex-1">
        <div className={`min-h-0 min-w-0 flex-1 overflow-auto ${phone ? "md:flex md:justify-center md:py-7" : ""}`}>
          <EditFrame
            title={`Page preview: ${item}`}
            page={switcher?.current}
            className={`block bg-ground ${phone ? "h-full w-full md:h-[844px] md:w-[var(--phone-frame)] md:shrink-0 md:rounded-[40px] md:border md:border-hairline" : "h-full w-full"}`}
            style={{ "--phone-frame": `${PHONE_FRAME_WIDTH}px` } as CSSProperties}
          >
            <ChipContext.Provider value={chipOf as (id: string) => EditChip}>{children}</ChipContext.Provider>
          </EditFrame>
        </div>
        {panel}
      </div>
    </div>
  );
}

function StatePill({ status }: { status: ContentStatus }) {
  const tone = STATE_TONE[status];
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] ${tone.pill}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {CONTENT_STATUS_LABELS[status]}
    </span>
  );
}

type Segment<T extends string> = { readonly id: T; readonly label: string; readonly icon?: ReactNode };

/** A row of buttons, one of them pressed: Desktop | Phone, and the page switch. */
function Segmented<T extends string>({
  label,
  segments,
  value,
  onChange,
}: {
  label: string;
  segments: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-[10px] border border-hairline bg-ground p-[3px]">
      {segments.map((segment) => {
        const on = segment.id === value;
        return (
          <button
            key={segment.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(segment.id)}
            className={`inline-flex h-[30px] items-center gap-2 whitespace-nowrap rounded-[7px] px-3 text-[13px] transition-colors duration-300 ease-out ${CONTENT_FOCUS} ${
              on ? "bg-surface-2 font-semibold text-prt-text" : "text-prt-muted hover:text-prt-text"
            }`}
          >
            {segment.icon}
            {segment.label}
          </button>
        );
      })}
    </div>
  );
}

const DEVICES: readonly Segment<EditDevice>[] = [
  { id: "desktop", label: "Desktop", icon: <Monitor aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> },
  { id: "phone", label: "Phone", icon: <Smartphone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> },
];

function DeviceToggle({ device, onChange }: { device: EditDevice; onChange: (device: EditDevice) => void }) {
  return <Segmented label="Preview size" segments={DEVICES} value={device} onChange={onChange} />;
}

function PageSwitcher<Page extends string>({ targets, current, onSelect }: PageSwitch<Page>) {
  return <Segmented label="Page" segments={targets} value={current} onChange={onSelect} />;
}

/**
 * One named block of the page in the shell. Hovered, or with focus inside,
 * it shows an accent outline with its name and an Edit chip that hands the
 * block's section to the shell's `onEdit` (board 74b).
 */
export function EditableBlock({ id, className = "", children }: { id: string; className?: string; children: ReactNode }) {
  const chipOf = useContext(ChipContext);
  if (chipOf === null) throw new Error("EditableBlock is drawn outside an EditShell.");
  const chip = chipOf(id);
  const shown = "opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out";
  return (
    <div className={`group/block relative ${className}`}>
      {children}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-3 z-10 rounded-xl border-[1.5px] border-accent bg-accent/5 md:-inset-[22px] ${shown}`}
      >
        <span className="absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap rounded-[4px] bg-accent px-2 py-[3px] font-mono text-[10px] uppercase leading-none tracking-[0.2em] text-accent-on-accent">
          {chip.name}
        </span>
      </div>
      <button
        type="button"
        onClick={chip.edit}
        aria-label={`${chip.label}: ${chip.name}`}
        className={`absolute -top-3 right-6 z-10 inline-flex h-7 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-on-accent md:-top-[22px] md:right-[33px] ${shown} focus-visible:opacity-100 ${CONTENT_FOCUS}`}
      >
        <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        {chip.label}
      </button>
    </div>
  );
}

/**
 * One card on a page the switch shows (board 75d). The edited item's card is
 * outlined, with an "Edit card" chip that hands back to the content type, and
 * is scrolled into view when the page opens; every other card is dimmed.
 * `className` lays the card out where the page puts it; the card fills it.
 */
export function CardInPlace({
  edited,
  onEdit,
  className = "",
  children,
}: {
  edited: boolean;
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (edited) ref.current?.scrollIntoView({ block: "center" });
  }, [edited]);
  if (!edited) return <div className={`opacity-40 ${className}`}>{children}</div>;
  return (
    <div ref={ref} className={`relative ${className}`}>
      {children}
      <div aria-hidden className="pointer-events-none absolute -inset-1.5 z-10 rounded-[18px] border-2 border-accent" />
      <button
        type="button"
        onClick={onEdit}
        className={`absolute -top-1.5 right-6 z-10 inline-flex h-7 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-on-accent transition-colors duration-300 ease-out hover:bg-accent-hover ${CONTENT_FOCUS}`}
      >
        <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Edit card
      </button>
    </div>
  );
}
