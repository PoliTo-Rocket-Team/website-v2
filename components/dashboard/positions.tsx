"use client";

import { useOptimistic, useState, useTransition, type CSSProperties } from "react";
import { ArrowUpDown, Plus, RadioTower } from "lucide-react";
import { toast } from "sonner";
import { setPositionOpen, setRecruitment } from "@/app/dashboard/recruitment-actions";
import type { WriteResult } from "@/lib/dashboard/write";
import type { RecruitmentControl } from "@/lib/apply/recruitment-switch";
import { startingDivisionId } from "@/lib/dashboard/new-position";
import {
  divisionOptions,
  NO_POSITIONS_FILTER,
  POSITIONS_SORTS,
  positionsModelOf,
  recruitmentNoticeOf,
  recruitmentWarningOf,
  shownPositions,
  type PositionsColumn,
  type PositionsFilter,
  type PositionsTool,
  type RecruitmentWarning,
} from "@/lib/dashboard/positions-view";
import { POSITION_TABS, type PositionApplications, type PositionRow, type PositionsPage } from "@/lib/dashboard/recruitment";
import { ConfirmDialog } from "./confirm-dialog";
import { FilterMenu, Segmented, Toggle } from "./controls";
import { SearchField } from "./search-field";
import { DrawerPage } from "./drawer";
import { NewPositionDrawer } from "./new-position-drawer";
import { PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";
import { TopBarAction } from "./top-bar-slot";

// The Positions page (Dashboard v2 board 57 and phone board 57m for a
// division lead, issue #171; board 41 for the operations lead, issue #142).
// Props in, nothing fetched: the page hands over what the dashboard data
// interface answered, and the switches and the New position drawer write
// through its server actions. A row or card opens the same drawer on that
// role to edit it (issue #207), or read-only where the viewer may not change
// it (issue #577); its open switch only opens or closes it. The site-wide switch is #121's, read and
// written through the same interface; this page only draws it as board 41.

/** Flip a switch at once; a refusal flips it back and says why. */
function useOptimisticSwitch(value: boolean, write: (next: boolean) => Promise<WriteResult<null>>) {
  const [shown, setShown] = useOptimistic(value);
  const [pending, startTransition] = useTransition();
  const flip = (next: boolean) =>
    startTransition(async () => {
      setShown(next);
      const result = await write(next);
      if (!result.ok) toast.error(result.error);
    });
  return [shown, flip, pending] as const;
}

/** What the drawer shows: nothing, New position, or one saved role to edit. */
type PositionDrawer = { readonly kind: "closed" } | { readonly kind: "new" } | { readonly kind: "edit"; readonly id: number };

const CLOSED: PositionDrawer = { kind: "closed" };

export function PositionsView({
  page,
  recruitment,
  initialDivision = null,
}: {
  page: PositionsPage;
  recruitment: RecruitmentControl;
  /** The division a link from the Overview opens the page on; null is all divisions, where the page starts (issue #230). */
  initialDivision?: string | null;
}) {
  // Every role's page starts on all departments, all divisions and all roles, newest first.
  const [filter, setFilter] = useState<PositionsFilter>({ ...NO_POSITIONS_FILTER, division: initialDivision });
  const [drawer, setDrawer] = useState<PositionDrawer>(CLOSED);
  const editing = drawer.kind === "edit" ? (page.positions.find((p) => p.id === drawer.id) ?? null) : null;
  const drawerOpen = drawer.kind === "new" || editing !== null;
  const create = () => setDrawer({ kind: "new" });
  const edit = (row: PositionRow) => setDrawer({ kind: "edit", id: row.id });
  // One toolbar and one set of columns for every role (issue #417): only the rows, and so the options, differ.
  const model = positionsModelOf(page);
  const has = (tool: PositionsTool) => model.tools.includes(tool);
  const narrow = (change: Partial<PositionsFilter>) => setFilter((f) => ({ ...f, ...change }));
  const shown = shownPositions(model.units, page.positions, filter);
  const rows = shown.rows;
  const canCreate = page.newPosition.divisions.length > 0;

  return (
    <DrawerPage drawerOpen={drawerOpen}>
      {/* On phones the shell's top bar carries the title and "+ New" (board 57m). */}
      <header className="flex items-start justify-between gap-4 max-md:sr-only">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em]">Positions</h1>
          <p className="mt-1 hidden text-[14px] text-prt-muted md:block">{model.intro}</p>
        </div>
        {canCreate && (
          <button type="button" onClick={create} className={`${PRIMARY_PILL} h-10 shrink-0 px-5 max-md:hidden`}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New position
          </button>
        )}
      </header>
      {canCreate && (
        <TopBarAction>
          <button type="button" onClick={create} className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New
          </button>
        </TopBarAction>
      )}

      {/* The recruitment manager may flip the switch from their own division's page (issue #875). */}
      {page.scope === "team" || recruitment.canSwitch ? (
        <RecruitmentSwitch open={recruitment.recruitment.isOpen} canSwitch={recruitment.canSwitch} />
      ) : (
        <RecruitmentNotice open={recruitment.recruitment.isOpen} scope={page.scope} />
      )}

      <div className="mt-4 flex flex-col gap-3 md:mt-6 md:flex-row md:flex-wrap md:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {has("department-filter") && (
            <FilterMenu
              label="Department"
              allLabel="All departments"
              value={filter.department}
              onChange={(department) => narrow({ department })}
              options={model.units.map((u) => ({ value: u.name, label: u.name }))}
            />
          )}
          {has("division-filter") && (
            <FilterMenu
              label="Division"
              allLabel="All divisions"
              value={shown.division}
              onChange={(division) => narrow({ division })}
              options={divisionOptions(model.units, filter.department).map((d) => ({ value: d, label: d }))}
            />
          )}
          <span aria-hidden className="hidden h-5 w-px bg-hairline md:block" />
          {has("status-switch") && (
            <Segmented
              label="Show positions"
              value={filter.tab}
              onChange={(tab) => narrow({ tab })}
              phone="chips"
              options={POSITION_TABS.map((t) => ({ value: t.tab, label: t.label, count: shown.counts[t.tab] }))}
            />
          )}
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          {/* The sort keeps its whole label on a phone, so it never reads as another select; the search takes what is left. */}
          {has("sort") && (
            <div className="shrink-0">
              <FilterMenu
                label="Sort"
                icon={ArrowUpDown}
                allLabel={POSITIONS_SORTS[0].label}
                value={filter.sort === "newest" ? null : filter.sort}
                onChange={(sort) => narrow({ sort: POSITIONS_SORTS.find((s) => s.sort === sort)?.sort ?? "newest" })}
                options={POSITIONS_SORTS.slice(1).map((s) => ({ value: s.sort, label: s.label }))}
              />
            </div>
          )}
          {has("search") && (
            <div className="min-w-0 flex-1 md:flex-none">
              <SearchField placeholder="Search positions" value={filter.query} onChange={(query) => narrow({ query })} className="md:w-[260px]" />
            </div>
          )}
        </div>
      </div>

      {/* From lg a table (board 57); below it stacked cards (board 57m). From xl
          an open drawer moves the page left of it, which leaves the table too
          narrow for its header labels until 2xl, so the cards stand in there (issue #222). */}
      {has("table-view") && (
        <div className={`${PANEL} mt-4 hidden overflow-hidden lg:block ${drawerOpen ? "xl:hidden 2xl:block" : ""}`}>
          <div
            aria-hidden="true"
            style={tracksOf(model.columns)}
            className="grid h-10 items-center gap-4 border-b border-hairline bg-white-5 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim"
          >
            {model.columns.map((column) => (
              <span key={column}>{COLUMN_LABELS[column]}</span>
            ))}
          </div>
          <ul className="divide-y divide-hairline">
            {rows.map((row) => (
              <PositionItem key={row.id} row={row} columns={model.columns} chosen={editing?.id === row.id} onEdit={edit} />
            ))}
          </ul>
          {rows.length === 0 && <p className="px-5 py-6 text-[13px] text-prt-muted">No positions match.</p>}
        </div>
      )}
      {has("phone-cards") && (
        <ul className={`mt-3 flex flex-col gap-2.5 lg:hidden ${drawerOpen ? "xl:flex 2xl:hidden" : ""}`}>
          {rows.map((row) => (
            <PositionCard key={row.id} row={row} chosen={editing?.id === row.id} onEdit={edit} />
          ))}
          {rows.length === 0 && <li className="px-1 py-4 text-[13px] text-prt-muted">No positions match.</li>}
        </ul>
      )}

      <NewPositionDrawer
        key={editing ? `edit-${editing.id}` : `new-${shown.division ?? "all"}`}
        open={drawerOpen}
        onOpenChange={(open) => !open && setDrawer(CLOSED)}
        divisions={page.newPosition.divisions}
        startDivisionId={startingDivisionId(page.newPosition.divisions, shown.division)}
        divisionHint={
          page.scope === "department" ? `${page.newPosition.divisions.length} in ${page.department.name}` : undefined
        }
        nextId={page.newPosition.nextId}
        editing={editing}
      />
    </DrawerPage>
  );
}

// Each column is at least as wide as its header label (10px mono, 0.2em
// tracking: 8px a letter), so the labels never run together (issue #222).
// Every role's table has the same columns (issue #417), save Applications,
// which a viewer who does not read Applications has no track for (issue #487).
const TRACKS: Record<PositionsColumn, string> = {
  position: "minmax(0,1.7fr)",
  department: "minmax(80px,0.8fr)",
  applications: "minmax(96px,0.75fr)",
  updated: "minmax(56px,0.6fr)",
  status: "112px",
};

function tracksOf(columns: readonly PositionsColumn[]): CSSProperties {
  return { gridTemplateColumns: columns.map((c) => TRACKS[c]).join(" ") };
}

const COLUMN_LABELS: Record<PositionsColumn, string> = {
  position: "Position",
  department: "Department",
  applications: "Applications",
  updated: "Updated",
  status: "Status",
};

function applicationsLine({ total }: PositionApplications): string {
  return `${total} ${total === 1 ? "application" : "applications"}`;
}

// A row or card is one target: the title is a button whose ::after covers
// the whole row, as a /projects card's name covers its card, so a click
// anywhere on it, or Enter or Space on the title, opens Edit position, or the
// role read-only where the viewer may not change it (issue #577). The open
// switch sits above that cover, so it only flips the role.
const ROW_TARGET =
  "text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent";

type RowProps = { row: PositionRow; chosen: boolean; onEdit: (row: PositionRow) => void };

function EditTarget({ row, onEdit, className }: { row: PositionRow; onEdit: (row: PositionRow) => void; className: string }) {
  return (
    <button type="button" onClick={() => onEdit(row)} aria-label={`${row.canChange ? "Edit" : "View"} ${row.title}`} className={`${ROW_TARGET} ${className}`}>
      {row.title}
    </button>
  );
}

/** One role as a card (board 57m): name, division, counts, and its switch top right. */
function PositionCard({ row, chosen, onEdit }: RowProps) {
  const [open, flip] = useOptimisticSwitch(row.open, (next) => setPositionOpen(row.id, next));
  return (
    <li
      className={`${PANEL} relative flex items-start gap-4 px-4 py-3.5 transition-colors duration-300 ease-out hover:border-border-strong ${
        chosen ? "border-accent/40" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <EditTarget row={row} onEdit={onEdit} className="block w-full truncate text-[16px] font-semibold leading-snug" />
        <p className="truncate text-[13px] leading-snug text-prt-muted">{`${row.department} · ${row.division}`}</p>
        {/* No counts where the viewer does not read Applications (issue #477). */}
        {row.applications !== null && (
          <p className="mt-2 text-[13px] text-text-2">
            {applicationsLine(row.applications)}
            {row.applications.fresh > 0 && <> · {row.applications.fresh} new</>}
            {row.applications.quiet && <span className="text-prt-muted"> · {row.applications.quiet}</span>}
          </p>
        )}
      </div>
      <span className="relative z-10 flex items-center gap-2.5">
        <Toggle checked={open} onCheckedChange={flip} label={`${row.title} is open`} disabled={!row.canChange} />
        {/* A switch the viewer cannot flip says the role's state in words too (issue #487). */}
        {!row.canChange && <OpenStatus open={open} />}
      </span>
    </li>
  );
}

function PositionItem({ row, columns, chosen, onEdit }: RowProps & { columns: readonly PositionsColumn[] }) {
  const [open, flip] = useOptimisticSwitch(row.open, (next) => setPositionOpen(row.id, next));
  const cell = (column: PositionsColumn) => {
    switch (column) {
      case "position":
        return (
          <div key={column} className="min-w-0">
            <EditTarget row={row} onEdit={onEdit} className="block w-full truncate text-[14px] font-medium leading-snug" />
            <p className="truncate text-[13px] leading-snug text-prt-muted">{row.division}</p>
          </div>
        );
      case "department":
        return (
          <p key={column} className="truncate text-[13px] text-text-2">
            {row.department}
          </p>
        );
      case "applications":
        // A role outside the viewer's Applications reach keeps its cell, empty (issue #477).
        return (
          <div key={column}>
            {row.applications !== null && (
              <>
                <p className="text-[14px] leading-snug">{row.applications.total}</p>
                {row.applications.fresh > 0 && <p className="text-[12px] leading-snug text-accent">{row.applications.fresh} new</p>}
                {row.applications.quiet && <p className="text-[12px] leading-snug text-prt-muted">{row.applications.quiet}</p>}
              </>
            )}
          </div>
        );
      case "updated":
        return (
          <p key={column} className="text-[13px] text-prt-muted">
            {row.updated}
          </p>
        );
      case "status":
        return (
          <div key={column} className="relative z-10 flex items-center gap-2.5">
            <Toggle checked={open} onCheckedChange={flip} label={`${row.title} is open`} disabled={!row.canChange} />
            <OpenStatus open={open} />
          </div>
        );
    }
  };
  return (
    <li
      style={tracksOf(columns)}
      className={`relative grid items-center gap-4 px-5 py-2.5 transition-colors duration-300 ease-out ${
        chosen ? "bg-accent/[0.06]" : "hover:bg-white-5"
      }`}
    >
      {columns.map(cell)}
    </li>
  );
}

function OpenStatus({ open }: { open: boolean }) {
  return <span className={`w-12 text-[13px] ${open ? "text-prt-text" : "text-prt-muted"}`}>{open ? "Open" : "Closed"}</span>;
}

// Board 41: the site-wide switch, for full access and the recruitment manager (issue #875).
// A click asks first (Owner decision, issue #691): the switch keeps the saved
// state while the warning is open and flips only on its Confirm.
function RecruitmentSwitch({ open: saved, canSwitch }: { open: boolean; canSwitch: boolean }) {
  const [open, flip] = useOptimisticSwitch(saved, setRecruitment);
  const [warning, setWarning] = useState<RecruitmentWarning | null>(null);
  const confirm = (asked: RecruitmentWarning) => {
    setWarning(null);
    flip(asked.opens);
  };
  return (
    <section
      className={`flex items-center gap-4 rounded-xl border px-4 py-4 transition-colors md:mt-6 duration-300 ease-out md:px-5 ${
        open ? "border-success/30 bg-success/5" : "border-hairline bg-panel/60"
      }`}
    >
      <span
        className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex ${
          open ? "bg-success-soft text-success" : "bg-white-5 text-prt-muted"
        }`}
      >
        <RadioTower aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[15px] font-semibold">{open ? "Recruitment is open" : "Recruitment is closed"}</h2>
        <p className="mt-0.5 text-[13px] text-text-2">
          {open
            ? "All open positions are public on the site. Turning this off hides every position and stops new applications."
            : "Every position is hidden on the site and no new applications come in. Turning this on shows the open positions."}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Toggle
          checked={open}
          onCheckedChange={(opens) => setWarning(recruitmentWarningOf(opens))}
          label="Recruitment is open"
          tone="success"
          disabled={!canSwitch}
        />
      </div>
      {warning && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setWarning(null)}
          icon={<RadioTower className="h-5 w-5" strokeWidth={1.75} />}
          title={warning.title}
          description={warning.description}
          cancelLabel="Cancel"
          confirmLabel={warning.confirmLabel}
          tone={warning.opens ? "success" : "danger"}
          danger={!warning.opens}
          onConfirm={() => confirm(warning)}
        />
      )}
    </section>
  );
}

// Boards 57 and 57m: a division lead who may not flip it sees the switch's state, not the switch,
// in one sentence and nothing more. On a phone the strip takes the state's tint.
// A department head's strip names their department's roles from md (board 63);
// a grant holder's names no owner, as they own no roles (issue #577).
function RecruitmentNotice({ open, scope }: { open: boolean; scope: PositionsPage["scope"] }) {
  const line = recruitmentNoticeOf(scope, open);
  return (
    <p
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] md:mt-6 md:items-center md:border-hairline md:bg-panel/60 md:px-5 ${
        open ? "border-success/30 bg-success/5" : "border-hairline bg-panel/60"
      }`}
    >
      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full md:mt-0 ${open ? "bg-success" : "bg-dim"}`} />
      <span>
        <span className="font-semibold text-prt-text">{open ? "Recruitment is open." : "Recruitment is closed."}</span>{" "}
        {line.phone === line.wide ? (
          <span className="text-text-2">{line.wide}</span>
        ) : (
          <>
            <span className="text-text-2 md:hidden">{line.phone}</span>
            <span className="hidden text-text-2 md:inline">{line.wide}</span>
          </>
        )}
      </span>
    </p>
  );
}
