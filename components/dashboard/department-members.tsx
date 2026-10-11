"use client";

import { useMemo, useState } from "react";
import { Layers, Pencil, Plus, RotateCcw } from "lucide-react";
import {
  addMemberDivisions,
  ALL_TAB,
  departmentLine,
  departmentTabs,
  tabKey,
  tabOfKey,
  type ClosedDivision,
  type DepartmentMembers,
  type DepartmentTab,
  type DivisionRemoval,
} from "@/lib/dashboard/department-members";
import { matchesPerson, type DivisionHeader, type DivisionMembers, type DivisionPerson, type WaitingPerson } from "@/lib/dashboard/division-members";
import { divisionLabel } from "@/lib/dashboard/team";
import { shortDate } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { FilterMenu } from "./controls";
import { SearchField, Tabs } from "./directory";
import { Chips } from "./division-chips";
import { JoiningBanner, matchesWaiting, MemberDialogs, NoEmailNote, PeopleTable, type Asking } from "./division-members";
import { DrawerPage } from "./drawer";
import { AddMemberDrawer, EditDetailsDrawer, PersonDrawer, type EditTarget } from "./member-panels";
import { EYEBROW, GHOST_PILL, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// A department head's Members page (issue #235): tabs for All divisions, each
// division and Closed (board 69); a division tab adds the division bar with
// its leads and the division tools (69b); Add member starts with a Division
// select (69c); on a phone the tabs are one select chip (69m). Everything a
// row does is the lead's page's (./division-members.tsx, #231). "+ New
// division", "Edit division", "Close division" and "Reopen" are entry points:
// the drawers and dialogs they open are #232's.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const DANGER_PILL = `inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-full border border-danger/50 px-3.5 text-[13px] font-medium text-danger transition-colors duration-300 ease-out hover:border-danger hover:bg-danger/10 ${FOCUS}`;

export function DepartmentMembersView({ page, editable }: { page: DepartmentMembers; editable: boolean }) {
  const [tab, setTab] = useState<DepartmentTab>(ALL_TAB);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // The division whose role Edit details edits; kept while the drawer closes.
  const [editDivision, setEditDivision] = useState<DivisionHeader | null>(null);
  const [adding, setAdding] = useState(false);
  const [asking, setAsking] = useState<Asking | null>(null);

  const current = tab.kind === "division" ? (page.tabs.find((t) => t.division.id === tab.divisionId) ?? null) : null;
  const listed: readonly DivisionPerson[] = current?.people ?? page.everyone;
  const people = listed.filter((p) => matchesPerson(p, query));
  const waiting = (current?.waiting ?? []).filter((w) => matchesWaiting(w, query));
  const open = tab.kind === "closed" ? null : (listed.find((p) => p.id === openId) ?? null);
  const removals = useMemo(() => new Map(page.everyone.map((p) => [p.id, p.removals])), [page.everyone]);
  const joining = (current ? [current] : tab.kind === "all" ? page.tabs : []).flatMap((t) => t.joining.map((j) => ({ joining: j, division: t.division.name })));
  const add = addMemberDivisions(page, tab);
  const tools = editable && page.divisionTools;

  /** The division a row's Edit details sets the role in: the open tab's, else the person's first in the department. */
  const divisionFor = (person: DivisionPerson): DivisionHeader | null =>
    current?.division ?? page.tabs.find((t) => t.division.id === person.divisions[0]?.divisionId)?.division ?? null;
  const removalsOf = (person: DivisionPerson): readonly DivisionRemoval[] =>
    current ? [{ divisionId: current.division.id, short: divisionLabel(current.division.name), removal: person.removal }] : (removals.get(person.id) ?? []);
  const editPerson = (person: DivisionPerson) => {
    const division = divisionFor(person);
    setOpenId(null);
    if (!division) return;
    setEditDivision(division);
    setEditing({ kind: "person", person });
  };
  const fillDetails = (w: WaitingPerson) => {
    if (!current) return;
    setEditDivision(current.division);
    setEditing({ kind: "waiting", waiting: w });
  };
  const choose = (next: DepartmentTab) => {
    setTab(next);
    setOpenId(null);
  };

  const options = departmentTabs(page);
  const newDivision = tools ? (
    <button type="button" className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`}>
      <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      New division
    </button>
  ) : null;

  return (
    <DrawerPage drawerOpen={open !== null || editing !== null || adding}>
      <PageHeader
        title="Members"
        intro={departmentLine(page)}
        phone="bar"
        action={
          editable && add.start !== null ? (
            <button type="button" onClick={() => setAdding(true)} className={`${PRIMARY_PILL} md:h-10 md:px-5`}>
              <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
              <span className="md:hidden">Add</span>
              <span className="hidden md:inline">Add member</span>
            </button>
          ) : undefined
        }
      />

      {joining.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5">
          {joining.map(({ joining: j, division }) => (
            <JoiningBanner key={j.applicationId} joining={j} division={division} editable={editable} />
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3 md:gap-5">
          <div className="hidden min-w-0 md:block">
            <Tabs label="Divisions" items={options} value={tabKey(tab)} onChange={(key) => choose(tabOfKey(key, page))} />
          </div>
          <div className="md:hidden">
            <FilterMenu
              chip
              icon={Layers}
              label="Division"
              allLabel={options[0].label}
              value={tab.kind === "all" ? null : tabKey(tab)}
              onChange={(key) => choose(key === null ? ALL_TAB : tabOfKey(key, page))}
              options={options.slice(1).map((o) => ({ value: o.key, label: o.label }))}
            />
          </div>
          {newDivision}
        </div>
        {tab.kind !== "closed" && (
          <SearchField value={query} onChange={setQuery} placeholder="Search name, email, phone" className="hidden md:flex md:w-[240px]" />
        )}
      </div>

      {current && <DivisionBar tab={current} tools={tools} />}

      {tab.kind === "closed" ? (
        <ClosedList closed={page.closed} tools={tools} />
      ) : (
        <PeopleTable
          people={people}
          waiting={waiting}
          waitingDivision={current?.division ?? null}
          editable={editable}
          openId={openId}
          onOpen={setOpenId}
          removalsOf={removalsOf}
          onAsk={setAsking}
          onFill={fillDetails}
          phoneCard="line"
        />
      )}

      {current?.waiting.map((w) => (
        <NoEmailNote key={w.joinId} waiting={w} editable={editable} onFill={() => fillDetails(w)} />
      ))}

      <PersonDrawer person={open} editable={editable} onClose={() => setOpenId(null)} onEdit={editPerson} />
      {editDivision && <EditDetailsDrawer target={editing} division={editDivision} onClose={() => setEditing(null)} />}
      {add.start !== null && (
        <AddMemberDrawer
          open={adding}
          onOpenChange={setAdding}
          target={{ kind: "department", department: page.department.name, divisions: add.divisions, start: add.start }}
        />
      )}
      <MemberDialogs asking={asking} onClose={() => setAsking(null)} />
    </DrawerPage>
  );
}

/** Board 69b: the open division's code and name, its leads, and Edit division and Close division for whoever may change it. */
function DivisionBar({ tab, tools }: { tab: DivisionMembers; tools: boolean }) {
  const { division } = tab;
  const leads = tab.people.filter((p) => p.role === "lead");
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
                <Avatar name={lead.name} size="xs" photoUrl={lead.photoUrl} />
                {lead.name}
              </span>
            ))}
          </span>
        </>
      )}
      {tools && (
        <span className="flex items-center gap-2 md:ml-auto">
          <button type="button" className={GHOST_PILL}>
            <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Edit division
          </button>
          <button type="button" className={DANGER_PILL}>
            Close division
          </button>
        </span>
      )}
    </section>
  );
}

/** The Closed tab: the department's closed divisions, each with the day it closed and Reopen for whoever may reopen it. */
function ClosedList({ closed, tools }: { closed: readonly ClosedDivision[]; tools: boolean }) {
  const thisYear = new Date().getUTCFullYear();
  if (closed.length === 0) return <p className={`${PANEL} mt-4 px-5 py-6 text-[14px] text-prt-muted`}>No closed divisions.</p>;
  return (
    <ul aria-label="Closed divisions" className={`${PANEL} mt-4 divide-y divide-hairline`}>
      {closed.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          {d.code !== null && <Chips chips={[{ divisionId: d.id, label: d.code, code: true }]} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-prt-text">{d.name}</span>
            <span className="block text-[13px] text-prt-muted">Closed on {shortDate(d.closedOn, thisYear)}</span>
          </span>
          {tools && (
            <button type="button" className={GHOST_PILL}>
              <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Reopen
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
