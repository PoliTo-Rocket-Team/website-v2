"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ExternalLink, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setAlumnusShown } from "@/app/dashboard/team-actions";
import type { AlumnusKey } from "@/lib/about/alumni-record";
import { alumniRowsFor, RECENT_YEAR_TABS, yearTab, type AlumniDirectory, type AlumnusRow } from "@/lib/dashboard/alumni";
import { pageCount, pageOf } from "@/lib/dashboard/team";
import { AddAdvisorPanel, AlumniSwitch, AlumnusPanel } from "./alumni-panels";
import { Avatar } from "./avatar";
import { Controls, DepartmentFilter, Pager, SearchField, TH } from "./directory";
import { DrawerPage } from "./drawer";
import { GHOST_PILL, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// The Alumni page (board 78, issue #257): everyone the public Alumni page
// lists, filled in from the team's roles. Year tabs (the two latest, then
// "Earlier"), the department filter and search narrow the rows in the
// browser. The switch shows or hides someone on the public page; the row's
// menu opens the fix panel (78b), and "Add alumni" adds an external advisor
// (78c). Every write goes through the data interface (a cookie for a test
// developer) and changes only the public page, never a role.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Open = { readonly kind: "none" } | { readonly kind: "fix"; readonly key: AlumnusKey } | { readonly kind: "add" };

export function AlumniView({ directory, editable }: { directory: AlumniDirectory; editable: boolean }) {
  const [year, setYear] = useState<number | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Open>({ kind: "none" });

  const searched = useMemo(() => alumniRowsFor(directory.rows, { year: null, group, query }), [directory.rows, group, query]);
  const inTab = year === null ? searched : alumniRowsFor(searched, { year, group, query: "" });
  const last = pageCount(inTab.length);
  const current = Math.min(page, last);
  const rows = pageOf(inTab, current);
  const showing = `Showing ${rows.length} of ${inTab.length}`;
  const fixing = open.kind === "fix" ? (directory.rows.find((r) => r.key === open.key) ?? null) : null;

  const narrow = (apply: () => void) => {
    apply();
    setPage(1);
  };
  const countIn = (start: number) => searched.filter((row) => row.years.includes(start)).length;
  const openFix = (key: AlumnusKey) => setOpen({ kind: "fix", key });

  return (
    <DrawerPage drawerOpen={open.kind !== "none"}>
      <PageHeader
        title="Alumni"
        intro="Filled in from the team's roles. Fix how someone shows on the Alumni page, or hide them."
        action={
          editable && (
            <button type="button" onClick={() => setOpen({ kind: "add" })} className={PRIMARY_PILL}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              Add alumni
            </button>
          )
        }
      />

      <Controls
        search={
          <div className="flex w-full items-center gap-3 md:w-auto">
            <SearchField value={query} onChange={(next) => narrow(() => setQuery(next))} placeholder="Search name or email" className="md:w-[260px]" />
            <a href="/about/alumni" target="_blank" rel="noopener noreferrer" className={`${GHOST_PILL} hidden h-10 px-4 text-[14px] lg:inline-flex`}>
              <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              View Alumni page
            </a>
          </div>
        }
      >
        <YearTabs
          years={directory.years}
          value={year}
          all={searched.length}
          countIn={countIn}
          onChange={(next) => narrow(() => setYear(next))}
        />
        <DepartmentFilter departments={directory.groups} value={group} onChange={(next) => narrow(() => setGroup(next))} />
      </Controls>

      <ul aria-label="Alumni" className="mt-4 flex flex-col gap-2.5 md:hidden">
        {rows.map((row) => (
          <AlumnusCard key={row.key} row={row} editable={editable} onOpen={() => openFix(row.key)} />
        ))}
      </ul>
      <div className="mt-4 flex min-h-7 items-center justify-between gap-4 text-[13px] text-prt-muted md:hidden">
        <span>{showing}</span>
        <Pager page={current} last={last} onPage={setPage} />
      </div>

      <section className={`${PANEL} mt-6 hidden overflow-hidden md:block`}>
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-hairline">
            <tr>
              <th scope="col" className={TH}>
                Person
              </th>
              <th scope="col" className={`${TH} w-[24%]`}>
                Last role
              </th>
              <th scope="col" className={`${TH} hidden w-[15%] lg:table-cell ${open.kind !== "none" ? "xl:hidden" : ""}`}>
                On the team
              </th>
              <th scope="col" className={`${TH} w-[150px]`}>
                On the site
              </th>
              <th scope="col" className="w-14">
                <span className="sr-only">Fix</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <AlumnusTableRow
                key={row.key}
                row={row}
                editable={editable}
                selected={fixing?.key === row.key}
                panelOpen={open.kind !== "none"}
                onOpen={() => openFix(row.key)}
              />
            ))}
          </tbody>
        </table>
        <footer className="flex min-h-[52px] items-center justify-between gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
          <span>{showing}</span>
          <Pager page={current} last={last} onPage={setPage} />
        </footer>
      </section>

      <AlumnusPanel row={fixing} editable={editable} onClose={() => setOpen({ kind: "none" })} />
      {editable && (
        <AddAdvisorPanel open={open.kind === "add"} thisYear={directory.thisYear} onClose={() => setOpen({ kind: "none" })} />
      )}
    </DrawerPage>
  );
}

const TAB = `flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors duration-300 ease-out md:h-full md:rounded-lg md:border-0 md:text-[14px] ${FOCUS}`;

function tabClass(current: boolean): string {
  return `${TAB} ${current ? "border-white-10 bg-white-10 font-semibold text-prt-text" : "border-hairline text-text-2 hover:text-prt-text"}`;
}

function Count({ value, current }: { value: number; current: boolean }) {
  return <span className={`text-[12px] ${current ? "text-prt-muted" : "text-dim"}`}>{value}</span>;
}

/** "All years", the two latest years, then "Earlier ▾" with the older ones (board 78). */
function YearTabs({
  years,
  value,
  all,
  countIn,
  onChange,
}: {
  years: readonly number[];
  value: number | null;
  all: number;
  countIn: (start: number) => number;
  onChange: (year: number | null) => void;
}) {
  const recent = years.slice(0, RECENT_YEAR_TABS);
  const earlier = years.slice(RECENT_YEAR_TABS);
  const picked = value !== null && earlier.includes(value) ? value : null;
  const pickedEarlier = picked !== null;
  return (
    <div
      role="tablist"
      aria-label="Years"
      className="flex max-w-full items-center gap-1.5 overflow-x-auto md:h-10 md:gap-0.5 md:rounded-xl md:border md:border-hairline md:p-1"
    >
      <button type="button" role="tab" aria-selected={value === null} onClick={() => onChange(null)} className={tabClass(value === null)}>
        All years
        <Count value={all} current={value === null} />
      </button>
      {recent.map((start) => (
        <button key={start} type="button" role="tab" aria-selected={value === start} onClick={() => onChange(start)} className={tabClass(value === start)}>
          {yearTab(start)}
          <Count value={countIn(start)} current={value === start} />
        </button>
      ))}
      {earlier.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger role="tab" aria-selected={pickedEarlier} className={tabClass(pickedEarlier)}>
            {picked !== null ? yearTab(picked) : "Earlier"}
            {picked !== null && <Count value={countIn(picked)} current />}
            <ChevronDown aria-hidden className="h-3.5 w-3.5 text-prt-muted" strokeWidth={1.75} />
          </DropdownMenuTrigger>
          <DropdownMenuPortal>
            <DropdownMenuPrimitive.Content
              align="start"
              sideOffset={6}
              className="z-50 max-h-[320px] min-w-[180px] overflow-y-auto rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
            >
              <DropdownMenuPrimitive.RadioGroup value={picked !== null ? String(picked) : ""} onValueChange={(next) => onChange(Number(next))}>
                {earlier.map((start) => (
                  <DropdownMenuPrimitive.RadioItem
                    key={start}
                    value={String(start)}
                    className="flex h-8 cursor-default items-center justify-between gap-4 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[state=checked]:text-prt-text data-[highlighted]:text-prt-text"
                  >
                    <span className="flex items-center gap-1.5">
                      {yearTab(start)}
                      <span className="text-[12px] text-dim">{countIn(start)}</span>
                    </span>
                    <DropdownMenuPrimitive.ItemIndicator>
                      <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                    </DropdownMenuPrimitive.ItemIndicator>
                  </DropdownMenuPrimitive.RadioItem>
                ))}
              </DropdownMenuPrimitive.RadioGroup>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPortal>
        </DropdownMenu>
      )}
    </div>
  );
}

function years(row: AlumnusRow): string {
  return `${row.from} – ${row.to}`;
}

/** The tags beside a name: Founder or Co-founder, then "Name fixed" and "Role fixed". */
function Tags({ row }: { row: AlumnusRow }) {
  const fixed = [row.nameFixed && "Name fixed", row.roleFixed && "Role fixed"].filter((tag): tag is string => tag !== false);
  return (
    <>
      {row.founder !== null && (
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-accent">
          {row.founder === "founder" ? "Founder" : "Co-founder"}
        </span>
      )}
      {fixed.map((tag) => (
        <span key={tag} className="hidden shrink-0 items-center gap-1 rounded-full border border-white-10 px-2 py-0.5 text-[11px] text-prt-muted lg:inline-flex">
          <Pencil aria-hidden className="h-2.5 w-2.5" strokeWidth={1.75} />
          {tag}
        </span>
      ))}
    </>
  );
}

function OpenButton({ row, onOpen }: { row: AlumnusRow; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label={`Fix how ${row.name} shows`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${FOCUS}`}
    >
      <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

// A phone card (the Members phone cards, board 46): avatar, name, and the last
// role with the years; the card opens the fix panel.
function AlumnusCard({ row, editable, onOpen }: { row: AlumnusRow; editable: boolean; onOpen: () => void }) {
  return (
    <li className={`${PANEL} flex items-center gap-3.5 px-4 py-3.5`}>
      <button type="button" onClick={onOpen} className={`flex min-w-0 flex-1 items-center gap-3.5 rounded-lg text-left ${FOCUS}`}>
        <Avatar size="ml" photoUrl={row.photo} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[16px] font-semibold">{row.name}</span>
            <Tags row={row} />
          </span>
          {/* Only the role may be cut; the years always show whole (issue #222). */}
          <span className="flex min-w-0 text-[13px] text-prt-muted">
            <span className="min-w-0 truncate">{row.lastRole}</span>
            <span className="shrink-0 whitespace-nowrap">&nbsp;· {years(row)}</span>
          </span>
        </span>
      </button>
      <SiteSwitch row={row} editable={editable} />
    </li>
  );
}

function AlumnusTableRow({
  row,
  editable,
  selected,
  panelOpen,
  onOpen,
}: {
  row: AlumnusRow;
  editable: boolean;
  selected: boolean;
  panelOpen: boolean;
  onOpen: () => void;
}) {
  return (
    <tr className={`transition-colors duration-300 ease-out ${selected ? "bg-accent/[0.08]" : "hover:bg-white-5"}`}>
      <td className="px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-3.5">
          <Avatar photoUrl={row.photo} />
          {/* The name goes first: when it and its tags do not fit on one line (a side panel open
              at 1280px), the tags wrap under it instead of squeezing it (board 78b). */}
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3.5 gap-y-1">
            <span className="block max-w-full truncate text-[15px] text-prt-text">{row.name}</span>
            <Tags row={row} />
          </span>
        </span>
      </td>
      <td className="px-5 py-2.5">
        <span className="block truncate text-[14px] text-prt-text">{row.lastRole}</span>
        <span className="block truncate text-[12px] text-prt-muted">{row.lastUnit}</span>
      </td>
      <td className={`hidden px-5 py-2.5 text-[14px] text-text-2 lg:table-cell ${panelOpen ? "xl:hidden" : ""}`}>{years(row)}</td>
      <td className="px-5 py-2.5">
        <SiteSwitch row={row} editable={editable} />
      </td>
      <td className="pr-5 text-right">
        <OpenButton row={row} onOpen={onOpen} />
      </td>
    </tr>
  );
}

/** Shown or Hidden on the public Alumni page: the write lands at once, and a refusal puts it back. */
function SiteSwitch({ row, editable }: { row: AlumnusRow; editable: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(row.shown);
  const [, startTransition] = useTransition();
  const flip = (next: boolean) =>
    startTransition(async () => {
      setOptimistic(next);
      const result = await setAlumnusShown(row.key, next);
      if (!result.ok) toast.error(result.error);
    });
  return (
    <label className="flex items-center gap-3">
      <AlumniSwitch checked={optimistic} onCheckedChange={flip} disabled={!editable} label={`Show ${row.name} on the Alumni page`} />
      <span className={`text-[14px] ${optimistic ? "text-prt-text" : "text-prt-muted"}`}>{optimistic ? "Shown" : "Hidden"}</span>
    </label>
  );
}
