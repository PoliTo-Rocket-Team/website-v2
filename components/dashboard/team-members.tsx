"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, List, ListFilter, MoreHorizontal, Plus, Search, Table2 } from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { memberDetailText } from "@/lib/dashboard/details";
import { pageCount, pageOf } from "@/lib/dashboard/team";
import {
  clearPicks,
  columnOptions,
  divisionChoices,
  filterTeam,
  NO_PICKS,
  TABLE_FILTER_LABELS,
  togglePick,
  wholeTeamLine,
  withPicks,
  type ColumnPicks,
  type TableFilter,
  type TeamMember,
  type WholeTeamMembers,
} from "@/lib/dashboard/team-members";
import { shortDate } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { DepartmentFilter, Pager, SearchField, TH } from "./directory";
import { Chips } from "./division-chips";
import { Private } from "./division-members";
import { DrawerPage } from "./drawer";
import { AddMemberDrawer, PersonDrawer } from "./member-panels";
import { PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// The team leader's Members page (boards 73 to 73c, issue #252): the whole
// team, heads and leads first, narrowed by the department and division
// selects and the search. List shows who and where, in pages; Table shows
// every member field at once, its name column pinned, scrolling both ways
// with no pages, a filter on seven columns. Phone, date of birth and gender
// stay blurred until hover. A row opens the member panel, read only here.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const DASH = <span className="text-dim">–</span>;

/** The list's page size: board 73 shows eight rows a page. */
const LIST_PAGE = 8;

type View = "list" | "table";

export function WholeTeamMembersView({ page, editable }: { page: WholeTeamMembers; editable: boolean }) {
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [divisionId, setDivisionId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("list");
  const [listPage, setListPage] = useState(1);
  const [picks, setPicks] = useState<ColumnPicks>(NO_PICKS);
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const divisions = divisionChoices(page.departments, departmentId);
  // A division left chosen from another department reads as all divisions.
  const shownDivision = divisions.some((d) => d.id === divisionId) ? divisionId : null;
  const filtered = useMemo(
    () => filterTeam(page.people, { departmentId, divisionId: shownDivision, query }),
    [page.people, departmentId, shownDivision, query],
  );
  const last = pageCount(filtered.length, LIST_PAGE);
  const current = Math.min(listPage, last);
  const open = page.people.find((p) => p.id === openId) ?? null;
  const narrow = (apply: () => void) => {
    apply();
    setListPage(1);
  };
  const departmentName = page.departments.find((d) => d.id === departmentId)?.name ?? null;
  const divisionName = divisions.find((d) => d.id === shownDivision)?.name ?? null;
  const start = page.divisions[0]?.id ?? null;

  return (
    <DrawerPage drawerOpen={open !== null || adding}>
      <PageHeader
        title="Members"
        intro={wholeTeamLine(page)}
        phone="bar"
        action={
          editable && start !== null ? (
            <button type="button" onClick={() => setAdding(true)} className={`${PRIMARY_PILL} md:h-10 md:px-5`}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              <span className="md:hidden">Add</span>
              <span className="hidden md:inline">Add member</span>
            </button>
          ) : undefined
        }
      />

      <div className="mt-4 flex flex-col gap-3 md:mt-6 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <DepartmentFilter
            departments={page.departments.map((d) => d.name)}
            value={departmentName}
            onChange={(name) => narrow(() => setDepartmentId(page.departments.find((d) => d.name === name)?.id ?? null))}
          />
          <DepartmentFilter
            allLabel="All divisions"
            departments={divisions.map((d) => d.name)}
            value={divisionName}
            onChange={(name) => narrow(() => setDivisionId(divisions.find((d) => d.name === name)?.id ?? null))}
          />
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          <ViewSwitch value={view} onChange={setView} />
          <SearchField
            value={query}
            onChange={(next) => narrow(() => setQuery(next))}
            placeholder="Search name, email, phone"
            className="md:w-[240px]"
          />
        </div>
      </div>

      {view === "list" ? (
        <ListView people={pageOf(filtered, current, LIST_PAGE)} page={current} last={last} onPage={setListPage} openId={openId} onOpen={setOpenId} />
      ) : (
        <TableView people={filtered} picks={picks} onPicks={setPicks} openId={openId} onOpen={setOpenId} />
      )}
      {/* Phones list cards whichever view is on: the table is a desktop sheet. */}
      <PhoneCards people={pageOf(filtered, current, LIST_PAGE)} onOpen={setOpenId} />
      <div className="mt-4 flex justify-center md:hidden">
        <Pager page={current} last={last} onPage={setListPage} />
      </div>

      <PersonDrawer person={open} editable={false} onClose={() => setOpenId(null)} onEdit={() => {}} />
      {editable && start !== null && (
        <AddMemberDrawer
          open={adding}
          onOpenChange={setAdding}
          target={{ kind: "department", department: "the team", divisions: page.divisions, start: shownDivision ?? start }}
        />
      )}
    </DrawerPage>
  );
}

/** List | Table (board 73): two buttons in one frame, the chosen one on white-10. */
function ViewSwitch({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  const options: readonly { view: View; label: string; icon: typeof List }[] = [
    { view: "list", label: "List", icon: List },
    { view: "table", label: "Table", icon: Table2 },
  ];
  return (
    <div role="group" aria-label="View" className="hidden h-10 items-center rounded-xl border border-hairline p-1 md:flex">
      {options.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          type="button"
          aria-pressed={value === view}
          onClick={() => onChange(view)}
          className={`flex h-full items-center gap-2 rounded-lg px-3 text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
            value === view ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
          }`}
        >
          <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Role in accent for the team leader, a board seat, a head or a division lead (board 73). */
function roleClass(person: TeamMember): string {
  return person.role === "member" ? "text-prt-text" : "text-accent";
}

function OpenButton({ person, onOpen }: { person: TeamMember; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label={`Open ${person.name}`}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${FOCUS}`}
    >
      <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}

// Board 73: member, divisions and role; no Phone or Discord column, those
// stay in the member panel. Pages of eight under "Heads and leads first".
function ListView({
  people,
  page,
  last,
  onPage,
  openId,
  onOpen,
}: {
  people: readonly TeamMember[];
  page: number;
  last: number;
  onPage: (page: number) => void;
  openId: number | null;
  onOpen: (id: number) => void;
}) {
  return (
    <section className={`${PANEL} mt-4 hidden overflow-hidden md:block`}>
      <table className="w-full table-fixed border-collapse">
        <thead className="border-b border-hairline bg-white-5">
          <tr>
            <th scope="col" className={TH}>
              Member
            </th>
            <th scope="col" className={`${TH} w-[22%]`}>
              Divisions
            </th>
            <th scope="col" className={`${TH} w-[18%]`}>
              Role
            </th>
            <th scope="col" className="w-14">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {people.map((p) => (
            <tr
              key={p.id}
              onClick={() => onOpen(p.id)}
              className={`cursor-pointer transition-colors duration-300 ease-out ${p.id === openId ? "bg-accent/[0.08]" : "hover:bg-white-5"}`}
            >
              <td className="px-5 py-2.5">
                <span className="flex min-w-0 items-center gap-3.5">
                  <Avatar name={p.name} photoUrl={p.photoUrl} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] text-prt-text">{p.name}</span>
                    <span className="block truncate text-[12px] text-prt-muted">{p.details.prtEmail || p.signInEmail}</span>
                  </span>
                </span>
              </td>
              <td className="px-5 py-2.5">
                <Chips chips={p.chips} />
              </td>
              <td className={`truncate px-5 py-2.5 text-[14px] ${roleClass(p)}`}>{p.roleLabel}</td>
              <td className="pr-4 text-right">
                <OpenButton person={p} onOpen={() => onOpen(p.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {people.length === 0 && <p className="px-5 py-6 text-[13px] text-prt-muted">No members match.</p>}
      <footer className="relative flex min-h-[52px] items-center gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
        <span>Heads and leads first</span>
        <span className="absolute left-1/2 -translate-x-1/2">
          <Pager page={page} last={last} onPage={onPage} />
        </span>
      </footer>
    </section>
  );
}

function PhoneCards({ people, onOpen }: { people: readonly TeamMember[]; onOpen: (id: number) => void }) {
  return (
    <ul aria-label="Members" className="mt-4 flex flex-col gap-2.5 md:hidden">
      {people.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onOpen(p.id)}
            className={`${PANEL} flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
          >
            <Avatar name={p.name} size="ml" photoUrl={p.photoUrl} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">{p.name}</span>
              <span className={`block truncate text-[13px] ${p.role === "member" ? "text-prt-muted" : "text-accent"}`}>{p.roleLabel}</span>
            </span>
            <Chips chips={p.chips} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One Table column: its header, its width, the column filter it carries, and its cell. */
type Column = {
  readonly key: string;
  readonly label: string;
  readonly width: string;
  readonly filter?: TableFilter;
  readonly cell: (person: TeamMember) => ReactNode;
};

function text(value: string | null): ReactNode {
  return value === null ? DASH : value;
}

/** Board 73b's columns, after the pinned name: every member field. Phone, date of birth and gender are blurred until hover. */
const COLUMNS: readonly Column[] = [
  { key: "divisions", label: "Divisions", width: "w-[150px]", filter: "divisions", cell: (p) => (p.chips.length === 0 ? DASH : <Chips chips={p.chips} />) },
  { key: "role", label: "Role", width: "w-[180px]", filter: "role", cell: (p) => <span className={roleClass(p)}>{p.roleLabel}</span> },
  { key: "prt-email", label: "PRT email", width: "w-[240px]", cell: (p) => text(memberDetailText(p.details, "prtEmail")) },
  {
    key: "phone",
    label: "Phone",
    width: "w-[160px]",
    cell: (p) => (p.details.phone === "" ? DASH : <Private label={`Phone of ${p.name}, hover to show`}>{p.details.phone}</Private>),
  },
  { key: "discord", label: "Discord", width: "w-[140px]", cell: (p) => text(memberDetailText(p.details, "discord")) },
  { key: "polito-id", label: "PoliTo ID", width: "w-[120px]", cell: (p) => text(memberDetailText(p.details, "politoId")) },
  { key: "program", label: "Program", width: "w-[220px]", filter: "program", cell: (p) => text(memberDetailText(p.details, "programme")) },
  { key: "level", label: "Level", width: "w-[170px]", filter: "level", cell: (p) => text(memberDetailText(p.details, "level")) },
  { key: "from", label: "From", width: "w-[130px]", filter: "from", cell: (p) => text(memberDetailText(p.details, "country")) },
  {
    key: "birth-date",
    label: "Date of birth",
    width: "w-[150px]",
    cell: (p) => {
      const value = memberDetailText(p.details, "birthDate");
      return value === null ? DASH : <Private label={`Date of birth of ${p.name}, hover to show`}>{value}</Private>;
    },
  },
  {
    key: "gender",
    label: "Gender",
    width: "w-[120px]",
    filter: "gender",
    cell: (p) => {
      const value = memberDetailText(p.details, "gender");
      return value === null ? DASH : <Private label={`Gender of ${p.name}, hover to show`}>{value}</Private>;
    },
  },
  {
    key: "nda",
    label: "NDA",
    width: "w-[140px]",
    filter: "nda",
    cell: (p) => (p.nda === null ? <span className="text-prt-muted">Not signed</span> : <span className="text-success">Signed {shortDate(p.nda.signedOn, 0)}</span>),
  },
];

// Boards 73b and 73c: the table fills the screen under the controls and
// scrolls both ways inside its frame, its header row and name column pinned.
function TableView({
  people,
  picks,
  onPicks,
  openId,
  onOpen,
}: {
  people: readonly TeamMember[];
  picks: ColumnPicks;
  onPicks: (picks: ColumnPicks) => void;
  openId: number | null;
  onOpen: (id: number) => void;
}) {
  const [filterOpen, setFilterOpen] = useState<TableFilter | null>(null);
  const rows = withPicks(people, picks);
  return (
    <section
      onScroll={() => setFilterOpen(null)}
      className={`${PANEL} mt-4 hidden h-[calc(100svh-188px)] min-h-[320px] overflow-auto overscroll-contain md:block`}
    >
      <table className="w-max min-w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            <th scope="col" className={`${TH} sticky left-0 top-0 z-30 w-[210px] border-b border-r border-hairline bg-panel`}>
              Name
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className={`${TH} sticky top-0 z-20 border-b border-r border-hairline bg-panel last:border-r-0 ${column.width}`}>
                <span className="flex items-center gap-1.5">
                  {column.label}
                  {column.filter && (
                    <ColumnFilter
                      column={column.filter}
                      people={people}
                      picks={picks}
                      onPicks={onPicks}
                      open={filterOpen === column.filter}
                      onOpenChange={(next) => setFilterOpen(next ? (column.filter ?? null) : null)}
                    />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const chosen = p.id === openId;
            return (
              <tr key={p.id} onClick={() => onOpen(p.id)} className="group cursor-pointer">
                <td
                  className={`sticky left-0 z-10 border-b border-r border-hairline px-3 py-2 transition-colors duration-300 ease-out ${
                    chosen ? "bg-surface-2" : "bg-panel group-hover:bg-surface-2"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={p.name} size="xs" photoUrl={p.photoUrl} />
                    <span className="truncate text-[13px] text-prt-text">{p.name}</span>
                  </span>
                </td>
                {COLUMNS.map((column) => (
                  <td
                    key={column.key}
                    onClick={column.key === "phone" || column.key === "birth-date" || column.key === "gender" ? (e) => e.stopPropagation() : undefined}
                    className={`truncate border-b border-r border-hairline px-3 py-2 text-[13px] text-text-2 transition-colors duration-300 ease-out last:border-r-0 ${
                      chosen ? "bg-accent/[0.08]" : "group-hover:bg-white-5"
                    }`}
                  >
                    {column.cell(p)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="sticky left-0 px-5 py-6 text-[13px] text-prt-muted">No members match.</p>}
    </section>
  );
}

/**
 * A column's filter (board 73c): a search, a tick per value with how many
 * hold it, the ticked ones first, then Clear and "N selected". Ticking
 * narrows the table at once. Not modal; it hangs under the header in a
 * portal, so the table's scroll does not clip it, and closes on Escape, an
 * outside press or a scroll.
 */
function ColumnFilter({
  column,
  people,
  picks,
  onPicks,
  open,
  onOpenChange,
}: {
  column: TableFilter;
  people: readonly TeamMember[];
  picks: ColumnPicks;
  onPicks: (picks: ColumnPicks) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const [search, setSearch] = useState("");
  const ticked = picks[column] ?? [];
  const label = TABLE_FILTER_LABELS[column];
  const options = columnOptions(people, picks, column).filter((o) => o.value.toLowerCase().includes(search.trim().toLowerCase()));
  const on = options.filter((o) => ticked.includes(o.value));
  const off = options.filter((o) => !ticked.includes(o.value));

  const change = (next: boolean) => {
    if (next && trigger.current) {
      const box = trigger.current.getBoundingClientRect();
      setAt({ top: box.bottom + 8, left: Math.max(8, Math.min(box.left - 40, window.innerWidth - 280)) });
      setSearch("");
    }
    onOpenChange(next);
  };

  const row = (option: { value: string; count: number }) => {
    const checked = ticked.includes(option.value);
    return (
      <li key={option.value} className="flex">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => onPicks(togglePick(picks, column, option.value))}
          className={`flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS} ${
            checked ? "text-prt-text" : "text-text-2"
          }`}
        >
          <span
            aria-hidden
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
              checked ? "border-accent bg-accent text-accent-on-accent" : "border-white-10"
            }`}
          >
            {checked && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1 truncate">{option.value}</span>
          <span className="shrink-0 font-mono text-[11px] text-prt-muted">{option.count}</span>
        </button>
      </li>
    );
  };

  return (
    <Dialog open={open} onOpenChange={change} modal={false}>
      <DialogPrimitive.Trigger
        ref={trigger}
        aria-label={`Filter by ${label.toLowerCase()}`}
        onClick={(e) => e.stopPropagation()}
        className={`flex h-5 w-5 items-center justify-center rounded transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS} ${
          ticked.length > 0 || open ? "text-accent" : "text-prt-muted"
        }`}
      >
        <ListFilter aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        {at && (
          <DialogPrimitive.Content
            aria-describedby={undefined}
            style={{ top: at.top, left: at.left }}
            onInteractOutside={(e) => {
              // The trigger toggles the panel itself; an outside press on it must not close and reopen it.
              if (trigger.current?.contains(e.target as Node)) e.preventDefault();
            }}
            className="fixed z-50 flex w-[272px] flex-col rounded-xl border border-hairline bg-panel p-1.5 font-display normal-case tracking-normal text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
          >
            <DialogTitle className="sr-only">{label}</DialogTitle>
            <label className="relative mb-1 block">
              <span className="sr-only">Search {label.toLowerCase()}</span>
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-prt-muted" strokeWidth={2} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${column === "role" ? "roles" : label.toLowerCase()}`}
                className="h-9 w-full rounded-lg border border-hairline bg-white-5 pl-9 pr-3 text-[13px] text-prt-text outline-none transition-colors duration-300 ease-out placeholder:text-prt-muted focus:border-border-strong"
              />
            </label>
            <div className="max-h-[300px] overflow-y-auto">
              {on.length > 0 && <ul className="pb-1">{on.map(row)}</ul>}
              {on.length > 0 && off.length > 0 && <div aria-hidden className="-mx-1.5 mb-1 h-px bg-hairline" />}
              {off.length > 0 && <ul>{off.map(row)}</ul>}
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-hairline px-1.5 pb-1 pt-2.5">
              <button
                type="button"
                onClick={() => onPicks(clearPicks(picks, column))}
                className={`rounded-md px-1 text-[13px] font-medium text-prt-text transition-colors duration-300 ease-out hover:text-text-2 ${FOCUS}`}
              >
                Clear
              </button>
              <span className="text-[12px] text-prt-muted">{ticked.length} selected</span>
            </div>
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
