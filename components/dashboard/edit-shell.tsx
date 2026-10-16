"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Circle, CircleCheck, Monitor, Pencil, Smartphone } from "lucide-react";
import {
  checklistDone,
  editChips,
  PHONE_FRAME_WIDTH,
  showsPageSwitch,
  type EditBlocks,
  type EditChip,
  type EditDevice,
  type PageTarget,
  type PublishCheck,
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
//
// A new item (74f): the bar reads "<Section> / New post", Publish waits on
// the content type's checklist, which hangs under it, and the block to fill
// first is outlined with a "Start here" chip.
//
// A content type may add to the bar (board 80, issue #284): a tag after the
// state ("Visual changes only") and actions before Save draft ("Reset to
// team", drawn with BarButton). Below sm such a bar folds the actions to their
// icons and the state to its dot, so they never draw over the name and state;
// a bar with no actions (Outreach) keeps its layout. While its panel edits one
// block, it names that block `selected`, which keeps its outline with no
// chips (board 80b).

const ChipContext = createContext<{
  readonly chipOf: (id: string) => EditChip;
  readonly startHere: string | null;
  readonly selected: string | null;
} | null>(null);

const STATE_TONE: Readonly<Record<ContentStatus, { pill: string; dot: string }>> = {
  draft: { pill: "bg-white-5 text-text-2", dot: "bg-prt-muted" },
  "draft-changes": { pill: "bg-warning-soft text-warning", dot: "bg-warning" },
  published: { pill: "bg-success-soft text-success", dot: "bg-success" },
};

const BAR_BUTTON = `inline-flex h-[31px] items-center justify-center rounded-full px-4 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${CONTENT_FOCUS}`;

/**
 * An outlined button on the edit bar, as Save draft is; `null` shows it but
 * leaves it off. With an icon it folds to the icon alone below sm, so a
 * content type's extra action leaves the phone bar room for the item's name
 * and state; its label stays its accessible name.
 */
export function BarButton({ onClick, icon, children }: { onClick: (() => void) | null; icon?: ReactNode; children: ReactNode }) {
  const folds = icon !== undefined;
  return (
    <button
      type="button"
      disabled={onClick === null}
      onClick={() => onClick?.()}
      className={`${BAR_BUTTON} gap-2 whitespace-nowrap border border-white-10 transition-colors duration-300 ease-out enabled:hover:border-border-strong ${folds ? "max-sm:w-[31px] max-sm:px-0" : ""}`}
    >
      {icon}
      {folds ? <span className="max-sm:sr-only">{children}</span> : children}
    </button>
  );
}

/** The page switch: the pages this item shows on, and the one in view. */
export type PageSwitch<Page extends string> = {
  readonly targets: readonly PageTarget<Page>[];
  readonly current: Page;
  readonly onSelect: (page: Page) => void;
};

export function EditShell<Id extends string, Section extends string, Page extends string = never>({
  section,
  heading,
  status,
  saved,
  onSaveDraft,
  onPublish,
  publishChecklist = [],
  pages,
  blocks,
  startHere,
  selected,
  onEdit,
  tag,
  actions,
  children,
  panel,
}: {
  /** The dashboard page this item belongs to, as the breadcrumb's first step. */
  section: { readonly label: string; readonly href: string };
  /** The breadcrumb's second step: "Editing <item>" (74b), or "New post" for an item not saved yet (74f). */
  heading: string;
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
  /**
   * What the item still needs before it can go on the site (board 74f).
   * While a line is not done, Publish is off and the checklist hangs under
   * it: always while the edit panel is closed, and on hover or focus while
   * the panel is open, so it never covers the panel.
   */
  publishChecklist?: readonly PublishCheck[];
  /** The page switch; with fewer than two pages the bar shows none. */
  pages?: PageSwitch<Page>;
  blocks: EditBlocks<Id, Section>;
  /** A block outlined from the start with a "Start here" chip, as a new item opens (board 74f). */
  startHere?: Id;
  /** The block the content type's panel is editing: outlined, with no chips (board 80b). */
  selected?: Id;
  onEdit: (section: Section) => void;
  /** After the state pill: a tag the content type's whole editor carries (board 80: "Visual changes only"). */
  tag?: ReactNode;
  /** Before Save draft: the content type's own bar actions, each a BarButton (board 80: "Reset to team"). */
  actions?: ReactNode;
  /** The page, its blocks marked with EditableBlock. */
  children: ReactNode;
  /** The content type's edit panel, drawn right of the page below the bar while open (board 74c); it sets its own width. */
  panel?: ReactNode;
}) {
  const [device, setDevice] = useState<EditDevice>("desktop");
  const chips = useMemo(
    () => ({ chipOf: editChips(blocks, onEdit) as (id: string) => EditChip, startHere: startHere ?? null, selected: selected ?? null }),
    [blocks, onEdit, startHere, selected],
  );
  const switcher = pages !== undefined && showsPageSwitch(pages.targets) ? pages : null;
  const devices = <DeviceToggle device={device} onChange={setDevice} />;
  const phone = device === "phone";
  const ready = checklistDone(publishChecklist);
  const checklistId = useId();
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ground text-prt-text">
      {/* Three columns: the middle one is centred while the right group fits
          its half, and moves left when that group grows (Desktop | Phone and
          "Changes show on the page as you type" beside the page switch), so
          the controls never overlap. */}
      <header className="relative grid h-[60px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-hairline bg-panel px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] md:px-6">
        <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
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
          <h1 className="min-w-0 truncate font-semibold">{heading}</h1>
          <StatePill status={status} folds={actions !== undefined} />
          {tag !== undefined && <span className="hidden shrink-0 sm:contents">{tag}</span>}
        </div>

        <div className="hidden md:block">
          {switcher === null ? devices : <PageSwitcher {...switcher} />}
        </div>

        <div className="flex items-center justify-end gap-2.5">
          {switcher !== null && <div className="mr-0.5 hidden md:block">{devices}</div>}
          {saved !== undefined && <p className="hidden whitespace-nowrap text-[12px] text-prt-muted lg:block">{saved}</p>}
          {actions}
          <BarButton onClick={onSaveDraft}>Save draft</BarButton>
          {/* Publish stays focusable while the checklist is not done, so a
              keyboard reaches it and hears what is missing. */}
          <div className="group/publish">
            <button
              type="button"
              disabled={onPublish === null}
              aria-disabled={ready ? undefined : true}
              aria-describedby={ready ? undefined : checklistId}
              onClick={() => {
                if (ready) onPublish?.();
              }}
              className={`${BAR_BUTTON} bg-prt-text text-ground transition-opacity duration-300 ease-out ${ready ? "hover:opacity-90" : "cursor-not-allowed opacity-50"}`}
            >
              Publish
            </button>
            {!ready && <PublishChecklist id={checklistId} checks={publishChecklist} pinned={!panel} />}
          </div>
        </div>
      </header>

      {/* One frame for both devices: switching only resizes it, so the page
          keeps its state and scroll. Below md there is no Phone mode: the
          window is a phone already. */}
      <div className="flex min-h-0 flex-1">
        <div className={`min-h-0 min-w-0 flex-1 overflow-auto ${phone ? "md:flex md:justify-center md:py-7" : ""}`}>
          <EditFrame
            title={`Page preview: ${heading}`}
            page={switcher?.current}
            className={`block bg-ground ${phone ? "h-full w-full md:h-[844px] md:w-[var(--phone-frame)] md:shrink-0 md:rounded-[40px] md:border md:border-hairline" : "h-full w-full"}`}
            style={{ "--phone-frame": `${PHONE_FRAME_WIDTH}px` } as CSSProperties}
          >
            <ChipContext.Provider value={chips}>{children}</ChipContext.Provider>
          </EditFrame>
        </div>
        {panel}
      </div>
    </div>
  );
}

/**
 * The checklist under Publish (board 74f): "To publish, add:" and a line per
 * need, an open ring while it is missing and a check once it is there.
 */
function PublishChecklist({ id, checks, pinned }: { id: string; checks: readonly PublishCheck[]; pinned: boolean }) {
  return (
    <div
      id={id}
      className={`absolute right-4 top-full z-50 mt-2 w-[244px] rounded-xl border border-hairline bg-panel p-3.5 shadow-lg ${
        pinned ? "block" : "hidden group-focus-within/publish:block group-hover/publish:block"
      }`}
    >
      <p className="text-[12px] font-semibold text-prt-text">To publish, add:</p>
      <ul className="mt-2 space-y-[5px]">
        {checks.map((check) => (
          <li key={check.label} className={`flex items-center gap-2 text-[12px] ${check.done ? "text-dim" : "text-text-2"}`}>
            {check.done ? (
              <CircleCheck aria-hidden className="h-[13px] w-[13px] shrink-0 text-success" strokeWidth={1.75} />
            ) : (
              <Circle aria-hidden className="h-[13px] w-[13px] shrink-0 text-prt-muted" strokeWidth={1.75} />
            )}
            {check.label}
            <span className="sr-only">{check.done ? ": done" : ": missing"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The item's state. On a bar that also carries a content type's actions, it
 * folds to its dot below sm: a phone bar has no room for the name, the state
 * and four buttons, and the label stays its accessible name.
 */
function StatePill({ status, folds }: { status: ContentStatus; folds: boolean }) {
  const tone = STATE_TONE[status];
  const label = CONTENT_STATUS_LABELS[status];
  return (
    <span
      title={folds ? label : undefined}
      className={`inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] ${tone.pill}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {folds ? <span className="max-sm:sr-only">{label}</span> : label}
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
 * block's section to the shell's `onEdit` (board 74b). The shell's
 * `startHere` block shows its outline from the start, with a "Start here"
 * chip in place of Edit (board 74f).
 */
export function EditableBlock({
  id,
  narrow = false,
  className = "",
  children,
}: {
  id: string;
  /**
   * A block about as wide as its name chip, such as one person on the Team
   * page's org chart (board 80): the Edit chip hangs off the outline's right
   * edge, so the two chips never overlap.
   */
  narrow?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const chips = useContext(ChipContext);
  if (chips === null) throw new Error("EditableBlock is drawn outside an EditShell.");
  const start = chips.startHere === id;
  const selected = chips.selected === id;
  const chip = start ? { ...chips.chipOf(id), label: "Start here" } : chips.chipOf(id);
  const shown = start
    ? "opacity-100"
    : "opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100 motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out";
  // The publish checklist hangs pinned under Publish while a new item opens
  // (board 74f): 244px wide, 16px in from the window's right edge. "Start
  // here" sits left of it, so it moves in from the block's right edge far
  // enough to clear the checklist; from 1440px the page's centred column
  // leaves room for the board's own spot.
  const chipPlace = narrow
    ? "left-[calc(100%-4px)] md:left-[calc(100%-8px)]"
    : start
      ? "right-6 md:right-[220px] min-[1440px]:right-[145px]"
      : "right-6 md:right-[33px]";
  return (
    <div className={`group/block relative ${className}`}>
      {children}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-3 z-10 rounded-xl border-[1.5px] border-accent bg-accent/5 md:-inset-[22px] ${selected ? "opacity-100" : shown}`}
      >
        {!selected && (
          <span className="absolute left-4 top-0 -translate-y-1/2 whitespace-nowrap rounded-[4px] bg-accent px-2 py-[3px] font-mono text-[10px] uppercase leading-none tracking-[0.2em] text-accent-on-accent">
            {chip.name}
          </span>
        )}
      </div>
      {!selected && (
        <button
          type="button"
          onClick={chip.edit}
          aria-label={`${chip.label}: ${chip.name}`}
          className={`absolute -top-3 z-10 inline-flex h-7 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-on-accent md:-top-[22px] ${chipPlace} ${shown} focus-visible:opacity-100 ${CONTENT_FOCUS}`}
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {chip.label}
        </button>
      )}
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
