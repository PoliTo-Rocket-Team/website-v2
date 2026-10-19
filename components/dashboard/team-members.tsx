"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, List, ListFilter, Lock, MoreHorizontal, Pencil, Plus, Search, Table2, UserMinus, UserX } from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { memberDetailText } from "@/lib/dashboard/details";
import type { DivisionHeader, WaitingPerson } from "@/lib/dashboard/division-members";
import {
  divisionOptions,
  shownMembers,
  type MemberEntry,
  type MembersModel,
  type MembersTool,
  type MembersUnit,
  type ShownMembers,
} from "@/lib/dashboard/members-view";
import { divisionLabel, pageCount, pageOf } from "@/lib/dashboard/team";
import {
  clearPicks,
  columnOptions,
  NO_PICKS,
  TABLE_FILTER_LABELS,
  togglePick,
  withPicks,
  type ColumnPicks,
  type TableFilter,
  type TeamMember,
} from "@/lib/dashboard/team-members";
import { shortDate } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { DepartmentFilter, Pager, SearchField, TH } from "./directory";
import { Chips } from "./division-chips";
import {
  ConfirmNdaButton,
  JoiningBanner,
  MailAvatar,
  MemberDialogs,
  MenuItem,
  NoEmailNote,
  Private,
  RowMenu,
  WaitingLine,
  type Asking,
} from "./division-members";
import { DrawerPage } from "./drawer";
import { AddMemberDrawer, EditDetailsDrawer, PersonDrawer, type AddTarget, type EditTarget } from "./member-panels";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// The Members page, one view for every role that opens it (Owner decision,
// 2026-10-19, issue #408): the team leader, a department head and a division
// lead all get the department and division selects, the search, List | Table
// (boards 73 to 73c), the column filters, pages of eight and the phone cards.
// Only the rows (./lib/dashboard/members-view.ts) and the actions the data
// allows differ: a row's ⋯ menu removes someone from a division or records
// that they leave the team, a waiting row confirms their NDA, and Add member
// adds where the viewer may. Phone, date of birth and gender stay blurred
// until hover.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const DASH = <span className="text-dim">–</span>;

/** The list's page size: board 73 shows eight rows a page. */
const LIST_PAGE = 8;

type View = "list" | "table";

type Waiting = ShownMembers["waiting"][number];

export function ScopedMembersView({ page, editable: writes }: { page: MembersModel; editable: boolean }) {
  const [department, setDepartment] = useState<string | null>(null);
  const [divisionId, setDivisionId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("list");
  const [listPage, setListPage] = useState(1);
  const [picks, setPicks] = useState<ColumnPicks>(NO_PICKS);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // The division whose role Edit details edits; kept while the drawer closes.
  const [editDivision, setEditDivision] = useState<DivisionHeader | null>(null);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);

  const has = (tool: MembersTool) => page.tools.includes(tool);
  const divisions = divisionOptions(page.units, department);
  const shownDivision = divisions.some((d) => d.id === divisionId) ? divisionId : null;
  const shown = useMemo(() => shownMembers(page, { department, divisionId, query }), [page, department, divisionId, query]);
  const last = pageCount(shown.people.length, LIST_PAGE);
  const current = Math.min(listPage, last);
  const paged = pageOf(shown.people, current, LIST_PAGE);
  const open = [...shown.people, ...page.everyone].find((p) => p.id === openId) ?? null;
  const narrow = (apply: () => void) => {
    apply();
    setListPage(1);
  };
  const divisionName = divisions.find((d) => d.id === shownDivision)?.name ?? null;

  const editPerson = (entry: MemberEntry) => {
    setOpenId(null);
    if (entry.actions === null) return;
    setEditDivision(entry.actions.division);
    setEditing({ kind: "person", person: entry.actions.person });
  };
  const fillDetails = (w: Waiting) => {
    setEditDivision(w.division);
    setEditing({ kind: "waiting", waiting: w.waiting });
  };
  const add = writes ? addTarget(page, shownDivision) : null;
  const rowActions = (entry: MemberEntry) => (writes && !entry.self ? entry.actions : null);
  const drawerOpen = open !== null || editing !== null || adding;

  return (
    <DrawerPage drawerOpen={drawerOpen}>
      <PageHeader
        title="Members"
        intro={page.intro}
        phone="bar"
        action={
          add !== null ? (
            <button type="button" onClick={() => setAdding(true)} className={`${PRIMARY_PILL} md:h-10 md:px-5`}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              <span className="md:hidden">Add</span>
              <span className="hidden md:inline">Add member</span>
            </button>
          ) : undefined
        }
      />

      {page.switcher && (
        <nav aria-label="Your divisions" className="mt-6 flex flex-wrap gap-1.5">
          {page.switcher.options.map((d) => {
            const here = d.id === page.switcher?.current;
            return (
              <Link
                key={d.id}
                href={`/dashboard/members?division=${d.id}`}
                aria-current={here ? "page" : undefined}
                className={`flex h-8 items-center whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
                  here ? "border-white-10 bg-white-10 font-semibold text-prt-text" : "border-hairline text-text-2 hover:text-prt-text"
                }`}
              >
                {divisionLabel(d.name)}
              </Link>
            );
          })}
        </nav>
      )}

      {shown.joining.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {shown.joining.map(({ joining, division, editable }) => (
            <JoiningBanner key={joining.applicationId} joining={joining} division={division} editable={writes && editable} />
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-3 md:mt-6 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          {has("department-filter") && (
            <DepartmentFilter
              departments={page.units.map((u) => u.name)}
              value={department}
              onChange={(name) => narrow(() => setDepartment(name))}
            />
          )}
          {has("division-filter") && (
            <DepartmentFilter
              allLabel="All divisions"
              departments={divisions.map((d) => d.name)}
              value={divisionName}
              onChange={(name) => narrow(() => setDivisionId(divisions.find((d) => d.name === name)?.id ?? null))}
            />
          )}
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          {has("list-view") && has("table-view") && <ViewSwitch value={view} onChange={setView} />}
          {has("search") && (
            <SearchField
              value={query}
              onChange={(next) => narrow(() => setQuery(next))}
              placeholder="Search name, email, phone"
              className="md:w-[240px]"
            />
          )}
        </div>
      </div>

      {page.notice !== null && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-prt-muted">
          <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          {page.notice}
        </p>
      )}

      {shown.division && <DivisionBar division={shown.division} people={shown.people} />}

      {view === "table" && has("table-view") ? (
        <TableView people={shown.people} picks={picks} onPicks={setPicks} openId={openId} onOpen={setOpenId} withFilters={has("table-column-filters")} />
      ) : (
        <ListView
          people={has("list-paging") ? paged : shown.people}
          waiting={shown.waiting}
          writes={writes}
          page={current}
          last={has("list-paging") ? last : 1}
          onPage={setListPage}
          openId={openId}
          onOpen={setOpenId}
          actionsOf={rowActions}
          onAsk={setAsking}
          onFill={fillDetails}
        />
      )}
      {/* Phones list cards whichever view is on: the table is a desktop sheet. */}
      {has("phone-cards") && (
        <PhoneCards
          people={paged}
          waiting={current === 1 ? shown.waiting : []}
          writes={writes}
          onOpen={setOpenId}
          onAsk={setAsking}
        />
      )}
      <div className="mt-4 flex justify-center md:hidden">
        <Pager page={current} last={last} onPage={setListPage} />
      </div>

      {shown.waiting.map((w) => (
        <NoEmailNote key={w.waiting.joinId} waiting={w.waiting} editable={writes && w.editable} onFill={() => fillDetails(w)} />
      ))}

      <PersonDrawer
        person={open}
        editable={writes && page.panelEdits && open?.actions != null}
        onClose={() => setOpenId(null)}
        onEdit={editPerson}
      />
      {editDivision && <EditDetailsDrawer target={editing} division={editDivision} onClose={() => setEditing(null)} />}
      {add !== null && <AddMemberDrawer open={adding} onOpenChange={setAdding} target={add} />}
      <MemberDialogs asking={asking} onClose={() => setAsking(null)} />
    </DrawerPage>
  );
}

/** Where Add member adds to, starting on the chosen division where it may add there; null where the page offers no Add member. */
function addTarget(page: MembersModel, divisionId: number | null): AddTarget | null {
  const { add } = page;
  if (add === null) return null;
  if (add.kind === "division") return add;
  const first = add.divisions[0];
  if (first === undefined) return null;
  const start = add.divisions.some((d) => d.id === divisionId) && divisionId !== null ? divisionId : first.id;
  return { kind: "department", department: add.department, divisions: add.divisions, start };
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

/** Board 69b: the chosen division's code and name, and its leads. */
function DivisionBar({ division, people }: { division: MembersUnit["divisions"][number]; people: readonly MemberEntry[] }) {
  const leads = people.filter((p) => p.divisions.some((d) => d.divisionId === division.id && d.role === "lead"));
  return (
    <section aria-label={division.name} className={`${PANEL} mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3`}>
      <span className="flex min-w-0 items-center gap-3">
        {division.code !== null && <Chips chips={[{ divisionId: division.id, label: division.code, code: true }]} />}
        <h2 className="truncate text-[16px] font-semibold text-prt-text">{division.name}</h2>
      </span>
      {leads.length > 0 && (
        <>
          <span aria-hidden className="hidden h-6 w-px bg-hairline md:block" />
          <span className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <span className={EYEBROW}>Leads</span>
            {leads.map((lead) => (
              <span key={lead.id} className="flex items-center gap-2 text-[14px] text-prt-text">
                <Avatar size="xs" photoUrl={lead.photoUrl} />
                {lead.name}
              </span>
            ))}
          </span>
        </>
      )}
    </section>
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
// stay in the member panel. The people waiting for Confirm NDA come first
// (board 61e), then pages of eight under "Heads and leads first".
function ListView({
  people,
  waiting,
  writes,
  page,
  last,
  onPage,
  openId,
  onOpen,
  actionsOf,
  onAsk,
  onFill,
}: {
  people: readonly MemberEntry[];
  waiting: readonly Waiting[];
  writes: boolean;
  page: number;
  last: number;
  onPage: (page: number) => void;
  openId: number | null;
  onOpen: (id: number) => void;
  actionsOf: (entry: MemberEntry) => MemberEntry["actions"];
  onAsk: (asking: Asking) => void;
  onFill: (waiting: Waiting) => void;
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
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {page === 1 &&
            waiting.map((w) => (
              <WaitingRow
                key={`w${w.waiting.joinId}`}
                waiting={w.waiting}
                division={w.division}
                editable={writes && w.editable}
                onConfirm={() => onAsk({ kind: "nda", waiting: w.waiting, division: w.division.name })}
                onFill={() => onFill(w)}
                onCancel={() => onAsk({ kind: "cancel", waiting: w.waiting, short: divisionLabel(w.division.name) })}
              />
            ))}
          {people.map((p) => (
            <PersonRow key={p.id} person={p} actions={actionsOf(p)} selected={p.id === openId} onOpen={() => onOpen(p.id)} onAsk={onAsk} />
          ))}
        </tbody>
      </table>
      {people.length === 0 && waiting.length === 0 && <p className="px-5 py-6 text-[13px] text-prt-muted">No members match.</p>}
      <footer className="relative flex min-h-[52px] items-center gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
        <span>Heads and leads first</span>
        <span className="absolute left-1/2 -translate-x-1/2">
          <Pager page={page} last={last} onPage={onPage} />
        </span>
      </footer>
    </section>
  );
}

function PersonRow({
  person,
  actions,
  selected,
  onOpen,
  onAsk,
}: {
  person: MemberEntry;
  actions: MemberEntry["actions"];
  selected: boolean;
  onOpen: () => void;
  onAsk: (asking: Asking) => void;
}) {
  return (
    <tr onClick={onOpen} className={`cursor-pointer transition-colors duration-300 ease-out ${selected ? "bg-accent/[0.08]" : "hover:bg-white-5"}`}>
      <td className="px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-3.5">
          <Avatar photoUrl={person.photoUrl} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] text-prt-text">{person.name}</span>
            <span className="block truncate text-[12px] text-prt-muted">{person.details.prtEmail || person.signInEmail}</span>
          </span>
        </span>
      </td>
      <td className="px-5 py-2.5">
        <Chips chips={person.chips} />
      </td>
      <td className={`truncate px-5 py-2.5 text-[14px] ${roleClass(person)}`}>{person.roleLabel}</td>
      <td className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
        {actions === null ? <OpenButton person={person} onOpen={onOpen} /> : <PersonMenu actions={actions} onAsk={onAsk} />}
      </td>
    </tr>
  );
}

/** A row's ⋯ menu: Remove from each division it may, then Leaves the team; a locked item says why (Owner decision, 2026-10-11). */
function PersonMenu({ actions, onAsk }: { actions: NonNullable<MemberEntry["actions"]>; onAsk: (asking: Asking) => void }) {
  const { person } = actions;
  // Not offered where it is their only division: the menu then holds only "Leaves the team".
  const offered = actions.removals.filter((r) => r.removal.kind === "offered" || r.removal.kind === "locked");
  return (
    <RowMenu label={`Actions for ${person.name}`}>
      {offered.map((r) => (
        <MenuItem
          key={r.divisionId}
          onSelect={() => onAsk({ kind: "remove", person, divisionId: r.divisionId, short: r.short })}
          icon={<UserMinus className="h-3.5 w-3.5" strokeWidth={1.75} />}
          locked={r.removal.kind === "locked" ? r.removal.reason : null}
        >
          Remove from {r.short}
        </MenuItem>
      ))}
      <MenuItem onSelect={() => onAsk({ kind: "leave", person })} danger locked={person.leave.allowed ? null : person.leave.reason}>
        Leaves the team
      </MenuItem>
    </RowMenu>
  );
}

function WaitingRow({
  waiting,
  division,
  editable,
  onConfirm,
  onFill,
  onCancel,
}: {
  waiting: WaitingPerson;
  division: DivisionHeader;
  editable: boolean;
  onConfirm: () => void;
  onFill: () => void;
  onCancel: () => void;
}) {
  return (
    <tr className="bg-warning/[0.04]">
      <td className="px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-3.5">
          <MailAvatar />
          <span className="min-w-0">
            <span className="block truncate text-[14px] text-prt-text">{waiting.email}</span>
            <WaitingLine waiting={waiting} />
          </span>
        </span>
      </td>
      <td className="px-5 py-2.5">
        <Chips chips={[{ divisionId: division.id, label: division.code ?? divisionLabel(division.name), code: division.code !== null }]} />
      </td>
      <td className="px-5 py-2.5">{editable ? <ConfirmNdaButton onClick={onConfirm} /> : <span className="text-[14px] text-prt-muted">Waiting</span>}</td>
      <td className="pr-4 text-right">
        {editable && (
          <RowMenu label={`Actions for ${waiting.email}`}>
            <MenuItem onSelect={onFill} icon={<Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}>
              Fill details
            </MenuItem>
            <MenuItem onSelect={onCancel} danger icon={<UserX className="h-3.5 w-3.5" strokeWidth={1.75} />}>
              Cancel add
            </MenuItem>
          </RowMenu>
        )}
      </td>
    </tr>
  );
}

function PhoneCards({
  people,
  waiting,
  writes,
  onOpen,
  onAsk,
}: {
  people: readonly MemberEntry[];
  waiting: readonly Waiting[];
  writes: boolean;
  onOpen: (id: number) => void;
  onAsk: (asking: Asking) => void;
}) {
  return (
    <ul aria-label="Members" className="mt-4 flex flex-col gap-2.5 md:hidden">
      {waiting.map((w) => (
        <li key={`w${w.waiting.joinId}`} className={`${PANEL} flex items-center gap-3.5 border-warning/30 px-4 py-3.5`}>
          <MailAvatar />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{w.waiting.email}</span>
            <WaitingLine waiting={w.waiting} />
          </span>
          {writes && w.editable && <ConfirmNdaButton onClick={() => onAsk({ kind: "nda", waiting: w.waiting, division: w.division.name })} />}
        </li>
      ))}
      {people.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onOpen(p.id)}
            className={`${PANEL} flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
          >
            <Avatar size="ml" photoUrl={p.photoUrl} />
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
  withFilters,
}: {
  people: readonly MemberEntry[];
  picks: ColumnPicks;
  onPicks: (picks: ColumnPicks) => void;
  openId: number | null;
  onOpen: (id: number) => void;
  withFilters: boolean;
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
                  {withFilters && column.filter && (
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
                    <Avatar size="xs" photoUrl={p.photoUrl} />
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
