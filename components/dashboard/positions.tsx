"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Plus, RadioTower } from "lucide-react";
import { toast } from "sonner";
import { setPositionOpen, setRecruitment } from "@/app/dashboard/recruitment-actions";
import type { WriteResult } from "@/lib/dashboard/write";
import type { RecruitmentControl } from "@/lib/apply/recruitment-switch";
import {
  departmentsOf,
  filterPositions,
  POSITION_TABS,
  positionTabCounts,
  type PositionRow,
  type PositionsPage,
  type PositionTab,
} from "@/lib/dashboard/recruitment";
import { FilterMenu, SearchField, Segmented, Toggle } from "./controls";
import { DrawerPage } from "./drawer";
import { NewPositionDrawer } from "./new-position-drawer";
import { PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";
import { TopBarAction } from "./top-bar-slot";

// The Positions page (Dashboard v2 board 57 and phone board 57m for a
// division lead, issue #171; board 41 for the operations lead, issue #142).
// Props in, nothing fetched: the page hands over what the dashboard data
// interface answered, and the switches and the New position drawer write
// through its server actions. The site-wide switch is #121's, read and
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

export function PositionsView({ page, recruitment }: { page: PositionsPage; recruitment: RecruitmentControl }) {
  const [tab, setTab] = useState<PositionTab>("all");
  const [department, setDepartment] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const team = page.scope === "team";
  const counts = positionTabCounts(page.positions);
  const rows = filterPositions(page.positions, { tab, department, search });
  const canCreate = page.newPosition.divisions.length > 0;

  return (
    <DrawerPage drawerOpen={creating}>
      {/* On phones the shell's top bar carries the title and "+ New" (board 57m). */}
      <header className="flex items-start justify-between gap-4 max-md:sr-only">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em]">Positions</h1>
          <p className="mt-1 hidden text-[14px] text-prt-muted md:block">
            {team
              ? "Open or close roles. Open roles show on the site while recruitment is on."
              : `Roles in ${page.division ? `the ${page.division}` : "your division"}. Open roles show on the site while recruitment is on.`}
          </p>
        </div>
        {canCreate && (
          <button type="button" onClick={() => setCreating(true)} className={`${PRIMARY_PILL} h-10 shrink-0 px-5 max-md:hidden`}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New position
          </button>
        )}
      </header>
      {canCreate && (
        <TopBarAction>
          <button type="button" onClick={() => setCreating(true)} className={PRIMARY_PILL}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            New
          </button>
        </TopBarAction>
      )}

      {page.scope === "team" ? (
        <RecruitmentSwitch open={recruitment.recruitment.isOpen} canSwitch={recruitment.canSwitch} />
      ) : (
        <RecruitmentNotice open={recruitment.recruitment.isOpen} />
      )}

      <div className="mt-4 flex flex-col gap-3 md:mt-6 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Show positions"
            value={tab}
            onChange={setTab}
            phone="chips"
            options={POSITION_TABS.map((t) => ({ value: t.tab, label: t.label, count: counts[t.tab] }))}
          />
          {team && (
            <FilterMenu
              allLabel="All departments"
              value={department}
              onChange={setDepartment}
              options={departmentsOf(page.positions).map((d) => ({ value: d, label: d }))}
            />
          )}
        </div>
        <div className="hidden md:ml-auto md:block">
          <SearchField label="Search positions" value={search} onChange={setSearch} />
        </div>
      </div>

      {/* From lg a table (board 57); below it stacked cards (board 57m). */}
      <div className={`${PANEL} mt-4 hidden overflow-hidden lg:block`}>
        <div
          aria-hidden="true"
          className={`grid h-10 items-center gap-4 border-b border-hairline bg-white-5 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim ${team ? COLUMNS_TEAM : COLUMNS_DIVISION}`}
        >
          <span>Position</span>
          {team && <span>Department</span>}
          <span>Applications</span>
          <span>Updated</span>
          <span>Status</span>
        </div>
        <ul className="divide-y divide-hairline">
          {rows.map((row) => (
            <PositionItem key={row.id} row={row} team={team} />
          ))}
        </ul>
        {rows.length === 0 && <p className="px-5 py-6 text-[13px] text-prt-muted">No positions match.</p>}
      </div>
      <ul className="mt-3 flex flex-col gap-2.5 lg:hidden">
        {rows.map((row) => (
          <PositionCard key={row.id} row={row} team={team} />
        ))}
        {rows.length === 0 && <li className="px-1 py-4 text-[13px] text-prt-muted">No positions match.</li>}
      </ul>

      <NewPositionDrawer open={creating} onOpenChange={setCreating} divisions={page.newPosition.divisions} nextId={page.newPosition.nextId} />
    </DrawerPage>
  );
}

const COLUMNS_TEAM = "grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,0.75fr)_minmax(0,0.6fr)_112px]";
const COLUMNS_DIVISION = "grid-cols-[minmax(0,2.6fr)_minmax(0,0.75fr)_minmax(0,0.6fr)_112px]";

function applicationsLine(row: PositionRow): string {
  return `${row.applications} ${row.applications === 1 ? "application" : "applications"}`;
}

/** One role as a card (board 57m): name, division, counts, and its switch top right. */
function PositionCard({ row, team }: { row: PositionRow; team: boolean }) {
  const [open, flip] = useOptimisticSwitch(row.open, (next) => setPositionOpen(row.id, next));
  return (
    <li className={`${PANEL} flex items-start gap-4 px-4 py-3.5`}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold leading-snug">{row.title}</p>
        <p className="truncate text-[13px] leading-snug text-prt-muted">{team ? `${row.department} · ${row.division}` : row.division}</p>
        <p className="mt-2 text-[13px] text-text-2">
          {applicationsLine(row)}
          {row.newApplications > 0 && <> · {row.newApplications} new</>}
          {row.quiet && <span className="text-prt-muted"> · {row.quiet}</span>}
        </p>
      </div>
      <Toggle checked={open} onCheckedChange={flip} label={`${row.title} is open`} />
    </li>
  );
}

function PositionItem({ row, team }: { row: PositionRow; team: boolean }) {
  const [open, flip] = useOptimisticSwitch(row.open, (next) => setPositionOpen(row.id, next));
  return (
    <li className={`grid items-center gap-4 px-5 py-2.5 ${team ? COLUMNS_TEAM : COLUMNS_DIVISION}`}>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium leading-snug">{row.title}</p>
        <p className="truncate text-[13px] leading-snug text-prt-muted">{row.division}</p>
      </div>
      {team && <p className="truncate text-[13px] text-text-2">{row.department}</p>}
      <div>
        <p className="text-[14px] leading-snug">{row.applications}</p>
        {row.newApplications > 0 && <p className="text-[12px] leading-snug text-accent">{row.newApplications} new</p>}
        {row.quiet && <p className="text-[12px] leading-snug text-prt-muted">{row.quiet}</p>}
      </div>
      <p className="text-[13px] text-prt-muted">{row.updated}</p>
      <div className="flex items-center gap-2.5">
        <Toggle checked={open} onCheckedChange={flip} label={`${row.title} is open`} />
        <span className={`w-12 text-[13px] ${open ? "text-prt-text" : "text-prt-muted"}`}>{open ? "Open" : "Closed"}</span>
      </div>
    </li>
  );
}

// Board 41: the site-wide switch, the operations lead's alone.
function RecruitmentSwitch({ open: saved, canSwitch }: { open: boolean; canSwitch: boolean }) {
  const [open, flip] = useOptimisticSwitch(saved, setRecruitment);
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
        <Toggle checked={open} onCheckedChange={flip} label="Recruitment is open" tone="success" disabled={!canSwitch} />
        <span className="text-[11px] text-prt-muted">Operations lead only</span>
      </div>
    </section>
  );
}

// Boards 57 and 57m: a division lead sees the switch's state, not the switch,
// in one sentence and nothing more. On a phone the strip takes the state's tint.
function RecruitmentNotice({ open }: { open: boolean }) {
  return (
    <p
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] md:mt-6 md:items-center md:border-hairline md:bg-panel/60 md:px-5 ${
        open ? "border-success/30 bg-success/5" : "border-hairline bg-panel/60"
      }`}
    >
      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full md:mt-0 ${open ? "bg-success" : "bg-dim"}`} />
      <span>
        <span className="font-semibold text-prt-text">{open ? "Recruitment is open." : "Recruitment is closed."}</span>{" "}
        <span className="text-text-2">{open ? "Your open roles are public on the site." : "Your open roles are hidden on the site."}</span>
      </span>
    </p>
  );
}
