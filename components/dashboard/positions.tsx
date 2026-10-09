"use client";

import { useOptimistic, useState, useTransition } from "react";
import { RadioTower } from "lucide-react";
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
import { PANEL } from "./panel";

// The Positions page (boards 41 and 41c). Props in, nothing fetched: the page
// hands over what the dashboard data interface answered, and the switches
// write through its server actions. The site-wide switch is #121's, read and
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
  const team = page.scope === "team";
  const counts = positionTabCounts(page.positions);
  const rows = filterPositions(page.positions, { tab, department, search });

  return (
    <>
      <header>
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">Positions</h1>
        <p className="mt-1 text-[14px] text-prt-muted">
          {team
            ? "Open or close roles. Open roles show on the site while recruitment is on."
            : `Roles in ${page.division ? `the ${page.division}` : "your division"}. Open roles show on the site while recruitment is on.`}
        </p>
      </header>

      {page.scope === "team" ? (
        <RecruitmentSwitch open={recruitment.recruitment.isOpen} canSwitch={recruitment.canSwitch} />
      ) : (
        <RecruitmentNotice open={recruitment.recruitment.isOpen} />
      )}

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Show positions"
            value={tab}
            onChange={setTab}
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
        <div className="md:ml-auto">
          <SearchField label="Search positions" value={search} onChange={setSearch} />
        </div>
      </div>

      <div className={`${PANEL} mt-4 overflow-hidden`}>
        <div
          aria-hidden="true"
          className={`hidden h-10 items-center gap-4 border-b border-hairline bg-white-5 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim lg:grid ${team ? COLUMNS_TEAM : COLUMNS_DIVISION}`}
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
    </>
  );
}

const COLUMNS_TEAM = "lg:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,0.75fr)_minmax(0,0.6fr)_112px]";
const COLUMNS_DIVISION = "lg:grid-cols-[minmax(0,2.6fr)_minmax(0,0.75fr)_minmax(0,0.6fr)_112px]";

function PositionItem({ row, team }: { row: PositionRow; team: boolean }) {
  const [open, flip] = useOptimisticSwitch(row.open, (next) => setPositionOpen(row.id, next));
  const applications = `${row.applications} ${row.applications === 1 ? "application" : "applications"}`;
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 lg:px-5 lg:py-2.5 ${team ? COLUMNS_TEAM : COLUMNS_DIVISION}`}>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium leading-snug">{row.title}</p>
        <p className="truncate text-[13px] leading-snug text-prt-muted">{row.division}</p>
        {/* Below lg the other columns fold into one line under the name. */}
        <p className="mt-1 text-[12px] text-prt-muted lg:hidden">
          {team && <>{row.department} · </>}
          {applications}
          {row.newApplications > 0 && <span className="text-accent"> · {row.newApplications} new</span>}
          {row.quiet && <> · {row.quiet}</>} · {row.updated}
        </p>
      </div>
      {team && <p className="hidden truncate text-[13px] text-text-2 lg:block">{row.department}</p>}
      <div className="hidden lg:block">
        <p className="text-[14px] leading-snug">{row.applications}</p>
        {row.newApplications > 0 && <p className="text-[12px] leading-snug text-accent">{row.newApplications} new</p>}
        {row.quiet && <p className="text-[12px] leading-snug text-prt-muted">{row.quiet}</p>}
      </div>
      <p className="hidden text-[13px] text-prt-muted lg:block">{row.updated}</p>
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
      className={`mt-6 flex items-center gap-4 rounded-xl border px-4 py-4 transition-colors duration-300 ease-out md:px-5 ${
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

// Board 41c: a division lead sees the switch's state, not the switch.
function RecruitmentNotice({ open }: { open: boolean }) {
  return (
    <p className={`${PANEL} mt-6 flex items-start gap-3 px-4 py-3 text-[13px] md:items-center md:px-5`}>
      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full md:mt-0 ${open ? "bg-success" : "bg-dim"}`} />
      <span>
        <span className="font-semibold text-prt-text">{open ? "Recruitment is open." : "Recruitment is closed."}</span>{" "}
        <span className="text-text-2">
          {open
            ? "Your open roles are public on the site. The operations lead turns recruitment on and off."
            : "Your open roles are hidden on the site until the operations lead turns recruitment on."}
        </span>
      </span>
    </p>
  );
}
