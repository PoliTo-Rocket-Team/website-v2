"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Circle, CircleCheck, CircleX, Lock, Monitor, Pencil, Smartphone, TriangleAlert } from "lucide-react";
import {
  checklistDone,
  editChips,
  PHONE_FRAME_WIDTH,
  scaledFrameOf,
  showsPageSwitch,
  type EditBlocks,
  type EditChip,
  type EditDevice,
  type PageCheck,
  type PageTarget,
  type PublishCheck,
  type ScaledFrame,
} from "@/lib/content/edit-shell";
import {
  checksAfterEdit,
  confirmPage,
  holdsPublish,
  markedTargets,
  pageToCheck,
  publishHoldOf,
  uncheckedFor,
  type CardLook,
  type PageChecks,
  type PublishHold,
} from "@/lib/content/publish-hold";
import { CONTENT_STATUS_LABELS, type ContentStatus } from "@/lib/content/versioned";
import { CONTENT_FOCUS } from "./content-parts";
import { EditFrame } from "./edit-frame";
import { ViewAsBanner } from "./view-as-banner";

// The edit shell (boards 74b, 74e, 75b and 75d, issue #288): a content type's
// real page under an edit bar, on top of the dashboard. Any content type
// mounts it: it is handed the page, the page's blocks and their panel
// sections, the publish state, the callbacks and its own edit panel, and
// knows nothing of what the page shows. The page marks each block with EditableBlock, always
// outlined with its name and an Edit chip that hands its section back.
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
//
// A content type may opt in to a scaled Desktop preview (board 93, issue
// #526): while its panel is open, Desktop keeps the page's desktop layout and
// scales it down to the room left of the panel, outlines and chips with it,
// instead of reflowing the page to that narrower width. Below md the panel
// covers the page, so there it changes nothing.
//
// A content type with a page switch holds Publish behind a check of the other
// pages its card shows on (board 93e, issues #530 and #581). It names those
// pages and its card's look, in the editor and on the site; the shell keeps
// the ticks (lib/content/publish-hold.ts holds the rule) and, while the hold
// is on, draws a warning strip under the bar, a cross or a tick after each
// page to check, and, on a page still to check, a bar over the page's foot
// asking whether it looks right. Publish stays off until every page is ticked.
//
// Below md the bar keeps its one 60px row, and the page switch, marks and
// all, moves to a row of its own under it, so a phone reaches every page and
// every check (Owner decision, 2026-10-22, issue #530).

const ChipContext = createContext<{
  readonly chipOf: (id: string) => EditChip;
  readonly startHere: string | null;
  readonly selected: string | null;
  /** The publish checklist hangs pinned over the page's top right, so every chip row keeps clear of it. */
  readonly checklistPinned: boolean;
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

/**
 * The frame of a scaled Desktop preview, from md: laid out at the size
 * `scaledFrameStyle` names and scaled from its top left corner, so it fills
 * the room exactly. Below md it keeps the plain frame under the panel.
 */
const SCALED_FRAME =
  "h-full w-full md:h-[var(--frame-h)] md:w-[var(--frame-w)] md:max-w-none md:origin-top-left md:scale-[var(--frame-scale)]";

function scaledFrameStyle(frame: ScaledFrame): CSSProperties {
  return { "--frame-w": `${frame.width}px`, "--frame-h": `${frame.height}px`, "--frame-scale": frame.scale } as CSSProperties;
}

/**
 * The scaled frame for the room the preview sits in, kept in step as the
 * room resizes; null while `on` is false or the room has no size yet.
 */
function useScaledFrame(room: RefObject<HTMLDivElement | null>, on: boolean): ScaledFrame | null {
  const [frame, setFrame] = useState<ScaledFrame | null>(null);
  useEffect(() => {
    const node = room.current;
    if (!on || node === null) {
      setFrame(null);
      return;
    }
    const measure = () => setFrame(scaledFrameOf({ width: node.clientWidth, height: node.clientHeight }));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [room, on]);
  return frame;
}

/** The question a page still to check asks, and what confirming it does. */
type PageCheckPrompt = { readonly question: string; readonly onConfirm: () => void };

/**
 * The pages of the switch a content type's card shows on, checked before
 * Publish while the card's look in the editor is not the one the site shows
 * (board 93e): that look, the live one (null for an item with no live
 * version, never saved or never published, which is always held), the
 * warning strip's words and the question each page's "Looks right" bar asks.
 */
export type PagesToCheck<Page extends string> = {
  readonly pages: readonly Page[];
  readonly look: CardLook;
  readonly live: CardLook | null;
  readonly notice: string;
  readonly question: (page: Page) => string;
};

/**
 * The hold over the pages to check, the ticks kept as the editor confirms
 * each page and cleared when the look changes. The ticks follow the look
 * while drawing, as React adjusts state that follows another value, so a look
 * changed and changed back is cleared too.
 */
function usePublishHold<Page extends string>(
  check: PagesToCheck<Page> | undefined,
): { readonly hold: PublishHold<Page>; readonly confirm: (page: Page) => void } {
  const look = check?.look ?? null;
  const [checks, setChecks] = useState<PageChecks<Page> | null>(() => (look === null ? null : uncheckedFor(look)));
  const current = look === null ? null : checks === null ? uncheckedFor<Page>(look) : checksAfterEdit(checks, look);
  if (current !== checks) setChecks(current);
  return {
    hold: check === undefined || current === null ? { kind: "free" } : publishHoldOf(current, check.live, check.pages),
    confirm: (page) => setChecks((c) => (c === null ? c : confirmPage(c, page))),
  };
}

/** The page switch: the pages this item shows on, and the one in view. */
export type PageSwitch<Page extends string> = {
  readonly targets: readonly PageTarget<Page>[];
  readonly current: Page;
  readonly onSelect: (page: Page) => void;
};

export function EditShell<Id extends string, Section extends string, Page extends string = never, Checked extends Page = Page>({
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
  onDeviceChange,
  tag,
  actions,
  children,
  panel,
  scalesDesktop = false,
  check,
}: {
  /** The dashboard page this item belongs to, as the breadcrumb's first step and where the arrow goes back to. */
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
  /** Told when Desktop | Phone changes, for a panel that edits the phone's copy in Phone (board 75c). */
  onDeviceChange?: (device: EditDevice) => void;
  /** After the state pill: a tag the content type's whole editor carries (board 80: "Visual changes only"). */
  tag?: ReactNode;
  /** Before Save draft: the content type's own bar actions, each a BarButton (board 80: "Reset to team"). */
  actions?: ReactNode;
  /** The page, its blocks marked with EditableBlock. */
  children: ReactNode;
  /** The content type's edit panel, drawn right of the page below the bar while open (board 74c); it sets its own width. */
  panel?: ReactNode;
  /** While the panel is open, Desktop keeps the desktop layout scaled to fit beside it (board 93) rather than reflowing. */
  scalesDesktop?: boolean;
  /** The pages of the switch the card shows on, checked before Publish (board 93e); every editor with a page switch names them. */
  check?: PagesToCheck<Checked>;
}) {
  const [device, setDevice] = useState<EditDevice>("desktop");
  const roomRef = useRef<HTMLDivElement>(null);
  const scaled = useScaledFrame(roomRef, scalesDesktop && device === "desktop" && Boolean(panel));
  const { hold, confirm } = usePublishHold(check);
  const switcher = pages !== undefined && showsPageSwitch(pages.targets) ? { ...pages, targets: markedTargets(pages.targets, hold) } : null;
  const toCheck = switcher === null ? null : pageToCheck(hold, switcher.current);
  const notice = check !== undefined && hold.kind === "checking" ? check.notice : undefined;
  const pageCheck: PageCheckPrompt | undefined =
    check === undefined || toCheck === null ? undefined : { question: check.question(toCheck), onConfirm: () => confirm(toCheck) };
  const publish = holdsPublish(hold) ? null : onPublish;
  const changeDevice = (next: EditDevice) => {
    setDevice(next);
    onDeviceChange?.(next);
  };
  const devices = <DeviceToggle device={device} onChange={changeDevice} />;
  const phone = device === "phone";
  const ready = checklistDone(publishChecklist);
  const checklistId = useId();
  const checklistPinned = !ready && !panel;
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ground text-prt-text">
      {/* The bar and every strip under it: the phone page switch, the View as
          banner and the notice. The publish checklist hangs from this stack's
          foot, and the room and panel below are clipped to their own row, so
          no overlay of the shell ever covers a strip, "Stop viewing" included
          (issue #650). */}
      <div className="relative shrink-0">
        {/* Three columns: the middle one is centred while the right group fits
            its half, and moves left when that group grows (Desktop | Phone and
            "Changes show on the page as you type" beside the page switch), so
            the controls never overlap. */}
        <header className="grid h-[60px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-hairline bg-panel px-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(max-content,1fr)] md:px-6">
          <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
            {/* One step back, to the dashboard page that lists the item (Owner
                decision, 2026-10-21): "← Outreach / Editing …". */}
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
                disabled={ready && publish === null}
                aria-disabled={ready ? undefined : true}
                aria-describedby={ready ? undefined : checklistId}
                onClick={() => {
                  if (ready) publish?.();
                }}
                className={`${BAR_BUTTON} bg-prt-text text-ground transition-opacity duration-300 ease-out ${ready ? "hover:opacity-90" : "cursor-not-allowed opacity-50"}`}
              >
                Publish
              </button>
              {!ready && <PublishChecklist id={checklistId} checks={publishChecklist} pinned={checklistPinned} />}
            </div>
          </div>
        </header>

        {/* Below md the bar has no room for the page switch, so it takes a row
            of its own under the bar: the only way to the other pages, and on a
            held Publish to their checks (Owner decision, 2026-10-22). Desktop |
            Phone stays off there: the window is a phone already. */}
        {switcher !== null && (
          <div className="flex overflow-x-auto border-b border-hairline bg-panel px-4 py-2 md:hidden">
            <PageSwitcher {...switcher} />
          </div>
        )}

        {/* The editor lies over the page's View as banner, so it draws its own (issue #611). */}
        <ViewAsBanner placement="editor" />

        {notice !== undefined && (
          <p role="status" className="flex items-center gap-2.5 border-b border-warning/20 bg-warning-soft px-4 py-3 text-[13px] text-warning md:px-6">
            <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {notice}
          </p>
        )}
      </div>

      {/* One frame for both devices: switching only resizes it, so the page
          keeps its state and scroll. Below md there is no Phone mode: the
          window is a phone already. The row clips what floats in it, so the
          page check bar and the phone panel stay below the strips above. */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* The room and what floats over its foot, which stays put while the page scrolls. */}
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <div
            ref={roomRef}
            className={`min-h-0 min-w-0 flex-1 ${scaled === null ? "overflow-auto" : "overflow-auto md:overflow-hidden"} ${phone ? "md:flex md:justify-center md:py-7" : ""}`}
          >
            <EditFrame
              title={`Page preview: ${heading}`}
              page={switcher?.current}
              className={`block bg-ground ${
                phone
                  ? "h-full w-full md:h-[844px] md:w-[var(--phone-frame)] md:shrink-0 md:rounded-[40px] md:border md:border-hairline"
                  : scaled === null
                    ? "h-full w-full"
                    : SCALED_FRAME
              }`}
              style={{ "--phone-frame": `${PHONE_FRAME_WIDTH}px`, ...(scaled === null ? {} : scaledFrameStyle(scaled)) } as CSSProperties}
            >
              <BlockChips blocks={blocks} onEdit={onEdit} startHere={startHere} selected={selected} checklistPinned={checklistPinned}>
                {children}
              </BlockChips>
            </EditFrame>
          </div>
          {pageCheck !== undefined && <PageCheckBar {...pageCheck} />}
        </div>
        {/* The panel's slot: beside the page from md; below md it covers this
            row alone, so the bar and the strips under it stay in view. */}
        {panel ? <div className="max-md:absolute max-md:inset-0 max-md:z-50 md:flex md:shrink-0">{panel}</div> : null}
      </div>
    </div>
  );
}

/**
 * The bar over the page's foot on a page still to check (board 93e): the
 * question on the left, "Looks right" on the right, which ticks the page.
 */
function PageCheckBar({ question, onConfirm }: PageCheckPrompt) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-[500px] items-center justify-between gap-4 rounded-full border border-white-10 bg-panel py-2 pl-5 pr-2 shadow-lg">
        <p className="min-w-0 text-[13px] text-prt-text">{question}</p>
        <button
          type="button"
          onClick={onConfirm}
          className={`${BAR_BUTTON} shrink-0 gap-1.5 bg-prt-text text-ground transition-opacity duration-300 ease-out hover:opacity-90`}
        >
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Looks right
        </button>
      </div>
    </div>
  );
}

/**
 * The checklist under Publish (board 74f): "To publish, add:" and a line per
 * need, an open ring while it is missing and a check once it is there.
 * Below md the window is a phone, where a pinned checklist would sit over
 * most of the page's top, chips and all, so there it shows only while
 * Publish is tapped, hovered or focused.
 */
function PublishChecklist({ id, checks, pinned }: { id: string; checks: readonly PublishCheck[]; pinned: boolean }) {
  return (
    <div
      id={id}
      className={`absolute right-4 top-full z-50 mt-2 w-[244px] rounded-xl border border-hairline bg-panel p-3.5 shadow-lg ${
        pinned
          ? "block max-md:hidden max-md:group-focus-within/publish:block max-md:group-hover/publish:block"
          : "hidden group-focus-within/publish:block group-hover/publish:block"
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

type Segment<T extends string> = { readonly id: T; readonly label: string; readonly icon?: ReactNode; readonly trail?: ReactNode };

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
            {segment.trail}
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

/** A page's check mark after its name (board 93e): a red cross until it is checked, then a green tick. */
function CheckMark({ check }: { check: PageCheck }) {
  const Mark = check === "checked" ? CircleCheck : CircleX;
  return (
    <>
      <Mark aria-hidden className={`h-[13px] w-[13px] shrink-0 ${check === "checked" ? "text-success" : "text-danger"}`} strokeWidth={1.75} />
      <span className="sr-only">{check === "checked" ? ", checked" : ", not checked yet"}</span>
    </>
  );
}

function PageSwitcher<Page extends string>({ targets, current, onSelect }: PageSwitch<Page>) {
  const segments = targets.map((t) => (t.check === undefined ? t : { ...t, trail: <CheckMark check={t.check} /> }));
  return <Segmented label="Page" segments={segments} value={current} onChange={onSelect} />;
}

/**
 * Hands each EditableBlock under it its chip, and which block starts the
 * page or is being edited. EditShell draws it round the page in its frame.
 */
export function BlockChips<Id extends string, Section extends string>({
  blocks,
  onEdit,
  startHere,
  selected,
  checklistPinned = false,
  children,
}: {
  blocks: EditBlocks<Id, Section>;
  onEdit: (section: Section) => void;
  startHere?: Id;
  selected?: Id;
  checklistPinned?: boolean;
  children: ReactNode;
}) {
  const chips = useMemo(
    () => ({
      chipOf: editChips(blocks, onEdit) as (id: string) => EditChip,
      startHere: startHere ?? null,
      selected: selected ?? null,
      checklistPinned,
    }),
    [blocks, onEdit, startHere, selected, checklistPinned],
  );
  return <ChipContext.Provider value={chips}>{children}</ChipContext.Provider>;
}

/**
 * How a block's outline is drawn (Owner decision, 2026-10-21: what is
 * editable shows at all times, on every device). At rest a dashed accent
 * hairline with no fill, which hover or focus inside only brightens to the
 * full accent; the `startHere` block keeps board 74f's outline; the
 * `selected` block, the one its panel edits, is drawn strongest (board 80b).
 */
const BLOCK_OUTLINE = {
  rest: "border border-dashed border-accent/50 group-hover/block:border-accent group-focus-within/block:border-accent motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out",
  start: "border-[1.5px] border-accent bg-accent/5",
  selected: "border-2 border-accent bg-accent/5",
} as const;

/**
 * How a block sits on the page, which says where its outline and chips go
 * so that every chip shows at once inside the frame and none covers
 * another.
 *
 * - `around`: a block with room round it. The outline stands 12px (22px
 *   from md) outside the block and one row rides its top edge: the name on
 *   the left, cut short when the row runs out of room, and Edit on the
 *   right. The name sits at the block's own left edge. Below md a page has
 *   too little room between its parts for a row on the edge, which would sit
 *   on the heading or text above, so the block keeps 32px at its top and the
 *   row sits there, inside the outline.
 * - `narrow`: a block about as wide as its name chip, such as one person on
 *   the Team page's org chart (board 80). The name chip spans the outline's
 *   top edge, and the Edit chip sits on the outline's foot, the block keeping
 *   room under it. Board 80 hangs that chip off the outline's right edge, but
 *   with every chip shown at once it would sit on the arc's end labels, its
 *   add buttons and the next person's outline; under a person nothing else
 *   is drawn, on the arc or in the grid below xl. The outline's foot stands
 *   further out than its other sides, so the chip on it stays clear of the
 *   person's contact icons.
 * - `column`: a block whose content runs past the page's column to the
 *   frame's edges, as a project's gallery carousel does. The outline and its
 *   chip row sit on the page's column as an `around` block's do (20px sides
 *   on phones, 64px from md, the 1312px column centred), and the content
 *   passes under the outline's sides, so no outline spans the frame and no
 *   chip falls outside it.
 */
export type BlockShape = "around" | "narrow" | "column";

const AROUND_OUTLINE = "-inset-3 md:-inset-[22px]";
const ON_TOP_EDGE = "-top-3 -translate-y-1/2 md:-top-[22px]";

/**
 * Each shape's placement. `rowEnd` is where the chip row ends; `clearEnd`
 * where it ends while the publish checklist hangs pinned under Publish
 * (board 74f): 244px wide, 16px in from the window's right edge, so the row
 * moves in from the block's right edge far enough to clear it. An `around`
 * block sits in the page's column, 64px in from md; from 1440px the column
 * is centred and leaves room for the board's own spot. A `column` block's
 * edge is the frame's, so its places count in from the frame to the column.
 */
const BLOCK_SHAPE: Readonly<
  Record<
    BlockShape,
    { outline: string; row: string; rowStart: string; rowEnd: string; clearEnd: string; editAtFoot: boolean; room: string }
  >
> = {
  around: {
    outline: AROUND_OUTLINE,
    row: "top-0 md:-top-[22px] md:-translate-y-1/2",
    rowStart: "left-1 md:left-0",
    rowEnd: "right-6 md:right-[33px]",
    clearEnd: "right-6 md:right-[220px] min-[1440px]:right-[145px]",
    editAtFoot: false,
    room: "max-md:pt-8",
  },
  narrow: {
    outline: "-inset-x-3 -top-3 -bottom-6 md:-inset-x-[22px] md:-top-[22px] md:-bottom-[30px]",
    row: ON_TOP_EDGE,
    rowStart: "left-1 md:-left-3",
    rowEnd: "right-1 md:-right-3",
    clearEnd: "right-1 md:-right-3",
    editAtFoot: true,
    room: "mb-10",
  },
  column: {
    outline: "-inset-y-3 inset-x-2 md:-inset-y-[22px] md:inset-x-[max(42px,calc((100%_-_1312px)/2_-_22px))]",
    row: "top-0 md:-top-[22px] md:-translate-y-1/2",
    rowStart: "left-6 md:left-[max(64px,calc((100%_-_1312px)/2))]",
    rowEnd: "right-11 md:right-[max(97px,calc((100%_-_1312px)/2_+_33px))]",
    clearEnd: "right-11 md:right-[284px]",
    editAtFoot: false,
    room: "max-md:pt-8",
  },
};

/**
 * One named block of the page in the shell. It always shows its outline,
 * with its name and an Edit chip that hands the block's section to the
 * shell's `onEdit` (board 74b), on Desktop, Phone and touch alike; hover or
 * focus inside only brightens the outline. The shell's `startHere` block
 * shows a "Start here" chip in place of Edit (board 74f), and the
 * `selected` block a stronger outline with no chips (board 80b).
 */
export function EditableBlock({
  id,
  shape = "around",
  className = "",
  children,
}: {
  id: string;
  /** How the block sits on the page (BlockShape). */
  shape?: BlockShape;
  className?: string;
  children: ReactNode;
}) {
  const chips = useContext(ChipContext);
  if (chips === null) throw new Error("EditableBlock is drawn outside an EditShell.");
  const start = chips.startHere === id;
  const selected = chips.selected === id;
  const chip = start ? { ...chips.chipOf(id), label: "Start here" } : chips.chipOf(id);
  const outline = selected ? BLOCK_OUTLINE.selected : start ? BLOCK_OUTLINE.start : BLOCK_OUTLINE.rest;
  const place = BLOCK_SHAPE[shape];
  // "Start here" keeps board 74f's spot, left of the checklist; while the
  // checklist hangs pinned, every chip row keeps clear of it the same way.
  const rowEnd = start || chips.checklistPinned ? place.clearEnd : place.rowEnd;
  const edit = (
    <button
      type="button"
      onClick={chip.edit}
      aria-label={`${chip.label}: ${chip.name}`}
      className={`pointer-events-auto z-10 inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-on-accent hover:bg-accent-hover motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out ${CONTENT_FOCUS} ${
        place.editAtFoot ? "absolute -bottom-6 left-1/2 -translate-x-1/2 translate-y-1/2 md:-bottom-[30px]" : "ml-auto"
      }`}
    >
      <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {chip.label}
    </button>
  );
  return (
    <div className={`group/block relative ${place.room} ${className}`}>
      {children}
      <div aria-hidden className={`pointer-events-none absolute z-10 rounded-xl ${place.outline} ${outline}`} />
      {!selected && (
        <>
          <div className={`pointer-events-none absolute z-10 flex items-center gap-2 ${place.row} ${place.rowStart} ${rowEnd}`}>
            <span
              aria-hidden
              className="min-w-0 truncate whitespace-nowrap rounded-[4px] bg-accent px-2 py-[3px] font-mono text-[10px] uppercase leading-none tracking-[0.2em] text-accent-on-accent"
            >
              {chip.name}
            </span>
            {!place.editAtFoot && edit}
          </div>
          {place.editAtFoot && edit}
        </>
      )}
    </div>
  );
}

/**
 * The room a card in place keeps above it when it is scrolled into view: the
 * Edit card chip rises 20px above the card's top, so the card clears it and
 * 12px more (board 75d draws the chip in full). The pages the switch shows
 * draw no site navbar (issue #495), so there is no fixed bar to clear, on
 * Desktop or on Phone.
 */
const CARD_CLEARANCE = "scroll-mt-8";

/**
 * Scrolls the page in the frame so the edited card sits in the room under
 * its clearance: centred there when it fits, its top at the clearance when it
 * is taller. Centring it in the whole window put a tall card's top edge, and
 * its chip, above the frame's top. A card in a swipe row (Home's Projects) is
 * brought in sideways first, to where the row snaps it. Only the frame's page
 * and that row move: scrollIntoView would also scroll the dashboard around
 * the frame, which in Phone hides the frame's top, chip and all.
 */
function bringIntoView(card: HTMLElement) {
  const view = card.ownerDocument.defaultView;
  if (view === null) return;
  const row = card.parentElement;
  if (row !== null && row.scrollWidth > row.clientWidth) {
    const edge = row.getBoundingClientRect().left + (parseFloat(view.getComputedStyle(row).scrollPaddingLeft) || 0);
    row.scrollLeft += card.getBoundingClientRect().left - edge;
  }
  const clearance = parseFloat(view.getComputedStyle(card).scrollMarginTop) || 0;
  const slack = Math.max(0, (view.innerHeight - clearance - card.offsetHeight) / 2);
  view.scrollTo({ top: view.scrollY + card.getBoundingClientRect().top - clearance - slack });
}

/**
 * Brings the card back into view each time the frame's page changes width:
 * opening or closing a panel beside the frame, or a Desktop / Phone switch,
 * re-lays the page out and moves the card. Height changes are left alone, so
 * content growing below the card never pulls the page back under the person
 * scrolling it. The observer is the frame window's own, as the card lives in
 * that document. Returns the call that stops watching.
 */
function keepInViewOnResize(card: HTMLElement): () => void {
  const view = card.ownerDocument.defaultView;
  if (view === null || typeof view.ResizeObserver !== "function") return () => {};
  const page = card.ownerDocument.documentElement;
  let width = page.clientWidth;
  const observer = new view.ResizeObserver(() => {
    if (page.clientWidth === width) return;
    width = page.clientWidth;
    bringIntoView(card);
  });
  observer.observe(page);
  return () => observer.disconnect();
}

/**
 * One card on a page the switch shows (board 75d). The edited item's card is
 * outlined, with an "Edit card" chip that hands back to the content type, and
 * is scrolled into view, chip and all, when the page opens, and
 * again whenever the page changes width while it stays edited; every
 * other card is dimmed. `className` lays the card out where the page puts it;
 * the card fills it. `outline` rounds the outline, 6px outside the card's own
 * corners.
 *
 * A content type may give a card its own `actions` (issues #431 and #496:
 * Outreach's Feature and Unfeature), each a CardChip. On the edited card they
 * sit left of Edit card; on a dimmed card they always show, undimmed, with a
 * hairline outline that hover or focus inside only brightens (Owner decision,
 * 2026-10-21). Without them the card is drawn as it always was.
 */
export function CardInPlace({
  edited,
  onEdit,
  className = "",
  outline = "rounded-[18px]",
  actions,
  children,
}: {
  edited: boolean;
  onEdit: () => void;
  className?: string;
  outline?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const card = ref.current;
    if (!edited || card === null) return;
    bringIntoView(card);
    return keepInViewOnResize(card);
  }, [edited]);
  const editCard = (
    <button
      type="button"
      onClick={onEdit}
      className={`${actions === undefined ? "absolute -top-1.5 right-6 z-10 -translate-y-1/2 " : ""}inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3 text-[13px] font-semibold text-accent-on-accent transition-colors duration-300 ease-out hover:bg-accent-hover ${CONTENT_FOCUS}`}
    >
      <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      Edit card
    </button>
  );
  if (!edited) {
    if (actions === undefined) return <div className={`opacity-40 ${className}`}>{children}</div>;
    return (
      <div className={`group/card relative ${className}`}>
        <div className={`opacity-40 ${className}`}>{children}</div>
        <div
          aria-hidden
          className={`pointer-events-none absolute -inset-1.5 z-10 border border-border-strong group-hover/card:border-dim group-focus-within/card:border-dim motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out ${outline}`}
        />
        <div className="absolute -top-1.5 right-6 z-10 flex -translate-y-1/2 items-center gap-2">{actions}</div>
      </div>
    );
  }
  return (
    <div ref={ref} className={`relative ${CARD_CLEARANCE} ${className}`}>
      {children}
      <div aria-hidden className={`pointer-events-none absolute -inset-1.5 z-10 border-2 border-accent ${outline}`} />
      {actions === undefined ? (
        editCard
      ) : (
        <div className="absolute -top-1.5 right-6 z-10 flex -translate-y-1/2 items-center gap-2">
          {actions}
          {editCard}
        </div>
      )}
    </div>
  );
}

/**
 * One of a card's own actions over a card in place (issue #431): a pill on
 * the panel's ground, beside the accent Edit card. `locked` shows it off,
 * with a lock and the reason as its title; pressing it still says why.
 */
export function CardChip({
  icon,
  label,
  locked = null,
  onClick,
  children,
}: {
  icon: ReactNode;
  /** The accessible name, naming the card: every card may carry the same chip. */
  label: string;
  locked?: string | null;
  onClick: () => void;
  children: ReactNode;
}) {
  const off = locked !== null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-disabled={off ? true : undefined}
      title={locked ?? undefined}
      className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-white-10 bg-panel px-3 text-[13px] font-semibold transition-colors duration-300 ease-out ${
        off ? "cursor-not-allowed text-prt-muted" : "text-prt-text hover:border-border-strong"
      } ${CONTENT_FOCUS}`}
    >
      {off ? <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> : icon}
      {children}
    </button>
  );
}
