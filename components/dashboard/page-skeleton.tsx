import type { ReactNode } from "react";
import { PANEL } from "./panel";

// What a dashboard page shows while its content streams in (issue #397, in
// place of #227's spinner): a quiet placeholder for each section of the page,
// laid out where that section will be, so the page keeps its shape as it
// arrives. Every page names its layout (`PageSkeletonKind`). The bars are flat
// `white-5`, as the sidebar's placeholder rows are, so nothing moves under any
// motion setting. Screen readers hear one "Loading" status; the bars are hidden
// from them.

export type PageSkeletonKind =
  /** The person, then stat cards over two columns of panels (the Overview). */
  | "overview"
  /** A title, a row of filters and a table (Members, Positions, Orders and the other list pages). */
  | "list"
  /** A title and a grid of cards (Projects). */
  | "cards"
  /** A title and the org chart (Team tree). */
  | "tree"
  /** A title and a stack of setting cards (My profile, My account, My alumni). */
  | "form"
  /** A title and a stack of entries (My applications). */
  | "stack"
  /** The edit shell over the dashboard: its bar and the page under it (the content editors). */
  | "editor"
  /** A title and one panel: any page, while the route itself loads. */
  | "plain";

export function PageSkeleton({ kind }: { kind: PageSkeletonKind }) {
  return (
    <div role="status" aria-label="Loading">
      <div aria-hidden>{SECTIONS[kind]()}</div>
    </div>
  );
}

/**
 * The Overview streams in by section (issue #397): the person shows at once,
 * and each section below it shows its own placeholder until it arrives.
 */
export type OverviewSkeletonSection =
  /** Everything under the person: the figures, then the two columns of panels (boards 99 and 99b, issue #652). */
  "board";

export function OverviewSectionSkeleton({ section }: { section: OverviewSkeletonSection }) {
  return (
    <div role="status" aria-label="Loading">
      <div aria-hidden>{OVERVIEW_SECTIONS[section]()}</div>
    </div>
  );
}

const OVERVIEW_SECTIONS: Readonly<Record<OverviewSkeletonSection, () => ReactNode>> = {
  board: () => (
    <>
      <div className="mt-5 md:mt-6">
        <StatsSection />
      </div>
      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <PanelSection rows={3} />
        <PanelSection rows={4} />
      </div>
    </>
  ),
};

const SECTIONS: Readonly<Record<PageSkeletonKind, () => ReactNode>> = {
  overview: () => (
    <>
      <PersonSection />
      {OVERVIEW_SECTIONS.board()}
    </>
  ),
  list: () => (
    <>
      <HeaderSection action />
      <FiltersSection />
      <TableSection rows={6} />
    </>
  ),
  cards: () => (
    <>
      <HeaderSection action />
      <CardsSection />
    </>
  ),
  tree: () => (
    <>
      <HeaderSection />
      <TreeSection />
    </>
  ),
  form: () => (
    <>
      <HeaderSection />
      <div className="mt-6 flex flex-col gap-5">
        <FieldsSection fields={2} />
        <FieldsSection fields={4} />
        <FieldsSection fields={2} />
      </div>
    </>
  ),
  stack: () => (
    <>
      <HeaderSection />
      <div className="mt-6 flex flex-col gap-4">
        <EntrySection />
        <EntrySection />
      </div>
    </>
  ),
  editor: () => <EditorSection />,
  plain: () => (
    <>
      <HeaderSection />
      <div className="mt-6">
        <PanelSection rows={4} />
      </div>
    </>
  ),
};

/** Row widths, so a column reads as a list of names rather than one block. */
const WIDTHS = ["w-40", "w-52", "w-32", "w-48", "w-36", "w-44"] as const;

function Bar({ className }: { className: string }) {
  return <span className={`block rounded-full bg-white-5 ${className}`} />;
}

function Dot({ className = "h-8 w-8" }: { className?: string }) {
  return <span className={`block shrink-0 rounded-full bg-white-5 ${className}`} />;
}

/** The title block: the page name (on the shell's top bar on phones), the line under it, its main action. */
function HeaderSection({ action = false }: { action?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Bar className="h-7 w-44 max-md:hidden" />
        <Bar className="h-3 w-80 max-w-full md:mt-3" />
      </div>
      {action && <Bar className="h-10 w-36 shrink-0 max-md:hidden" />}
    </div>
  );
}

/** The person at the top of an Overview: their circle and the lines beside it, framed from md. */
function PersonSection() {
  return (
    <div className="flex items-center gap-4 md:gap-5 md:rounded-xl md:border md:border-hairline md:bg-panel/60 md:px-6 md:py-6">
      <Dot className="h-14 w-14 md:h-[72px] md:w-[72px]" />
      <div className="min-w-0 flex-1">
        <Bar className="h-5 w-44 max-w-full md:h-6" />
        <Bar className="mt-2.5 h-3 w-64 max-w-full" />
      </div>
    </div>
  );
}

function FiltersSection() {
  return (
    <div className="mt-4 flex items-center gap-3 md:mt-6">
      <Bar className="h-8 w-24" />
      <Bar className="h-8 w-28" />
      <Bar className="h-8 w-20 max-md:hidden" />
      <Bar className="ml-auto h-9 w-[260px] max-md:hidden" />
    </div>
  );
}

function TableSection({ rows }: { rows: number }) {
  return (
    <div className={`${PANEL} mt-4 overflow-hidden`}>
      <div className="flex items-center gap-10 border-b border-hairline px-5 py-3.5 max-md:hidden">
        <Bar className="h-2 w-20" />
        <Bar className="h-2 w-16" />
        <Bar className="h-2 w-24" />
      </div>
      <Rows rows={rows} />
    </div>
  );
}

function PanelSection({ rows }: { rows: number }) {
  return (
    <div className={PANEL}>
      <div className="border-b border-hairline px-5 py-4">
        <Bar className="h-3.5 w-36" />
        <Bar className="mt-2 h-2.5 w-56 max-w-full" />
      </div>
      <Rows rows={rows} />
    </div>
  );
}

function Rows({ rows }: { rows: number }) {
  return (
    <ul className="divide-y divide-hairline">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-5 py-4">
          <Dot />
          <span className="min-w-0 flex-1">
            <Bar className={`h-2.5 max-w-full ${WIDTHS[index % WIDTHS.length]}`} />
            <Bar className="mt-2 h-2 w-24" />
          </span>
          <Bar className="h-2.5 w-16 max-md:hidden" />
        </li>
      ))}
    </ul>
  );
}

function StatsSection() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {WIDTHS.slice(0, 4).map((width, index) => (
        <div key={width} className={`${PANEL} px-4 pb-4 pt-5 md:px-5 md:pb-5 md:pt-6 ${index >= 2 ? "max-md:hidden" : ""}`}>
          <Bar className="h-2 w-20" />
          <Bar className="mt-3 h-7 w-16" />
          <Bar className="mt-2.5 h-2.5 w-28 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function CardsSection() {
  return (
    <ul className="mt-6 grid gap-x-5 gap-y-10 lg:grid-cols-3">
      {WIDTHS.slice(0, 3).map((width) => (
        <li key={width}>
          <div className={`${PANEL} aspect-[4/3]`} />
          <Bar className={`mt-4 h-3.5 ${width}`} />
          <Bar className="mt-2 h-2.5 w-24" />
        </li>
      ))}
    </ul>
  );
}

function TreeSection() {
  const node = "h-14 rounded-lg border border-hairline bg-panel/60";
  return (
    <div className={`${PANEL} mt-6 flex flex-col items-center gap-10 px-5 py-10`}>
      <div className={`${node} w-56`} />
      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 md:grid-cols-4">
        {WIDTHS.slice(0, 4).map((width) => (
          <div key={width} className={node} />
        ))}
      </div>
      <div className="grid w-full max-w-3xl grid-cols-3 gap-4 max-md:hidden md:grid-cols-6">
        {WIDTHS.map((width) => (
          <div key={width} className={node} />
        ))}
      </div>
    </div>
  );
}

function FieldsSection({ fields }: { fields: number }) {
  return (
    <div className={`${PANEL} px-5 py-5`}>
      <Bar className="h-3.5 w-32" />
      <Bar className="mt-2 h-2.5 w-64 max-w-full" />
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        {WIDTHS.slice(0, fields).map((width) => (
          <div key={width}>
            <Bar className="h-2 w-16" />
            <Bar className="mt-2.5 h-3 w-32 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EntrySection() {
  return (
    <div className={`${PANEL} px-4 py-5 md:p-6`}>
      <div className="flex items-center justify-between gap-4">
        <Bar className="h-4 w-48 max-w-full" />
        <Bar className="h-6 w-20 shrink-0" />
      </div>
      <Bar className="mt-3 h-2.5 w-64 max-w-full" />
      <Bar className="mt-6 h-2 w-full" />
    </div>
  );
}

/** The edit shell lies over the whole dashboard, so its placeholder does too. */
function EditorSection() {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-ground">
      <div className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-hairline bg-panel px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <Dot className="h-4 w-4" />
          <Bar className="h-3 w-40" />
          <Bar className="h-5 w-14" />
        </div>
        <div className="flex items-center gap-2.5">
          <Bar className="h-[31px] w-24" />
          <Bar className="h-[31px] w-20" />
        </div>
      </div>
      <div className="min-h-0 flex-1 p-4 md:p-6">
        <div className={`${PANEL} mx-auto flex h-full max-w-[1200px] flex-col gap-4 p-8`}>
          <Bar className="h-8 w-72 max-w-full" />
          <Bar className="h-3 w-96 max-w-full" />
          <div className="mt-4 min-h-0 flex-1 rounded-lg bg-white-5" />
        </div>
      </div>
    </div>
  );
}
