"use client";

import { useMemo, useState } from "react";
import { Layers, Plus } from "lucide-react";
import {
  addMemberDivisions,
  ALL_TAB,
  departmentLine,
  departmentTabs,
  tabKey,
  tabOfKey,
  type DepartmentMembers,
  type DepartmentTab,
  type DivisionRemoval,
} from "@/lib/dashboard/department-members";
import { matchesPerson, type DivisionHeader, type DivisionMembers, type DivisionPerson, type WaitingPerson } from "@/lib/dashboard/division-members";
import { divisionLabel } from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { FilterMenu } from "./controls";
import { SearchField, Tabs } from "./directory";
import { Chips } from "./division-chips";
import { JoiningBanner, matchesWaiting, MemberDialogs, NoEmailNote, PeopleTable, type Asking } from "./division-members";
import { DrawerPage } from "./drawer";
import { AddMemberDrawer, EditDetailsDrawer, PersonDrawer, type EditTarget } from "./member-panels";
import { EYEBROW, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

// A department head's Members page (issue #235): tabs for All divisions and
// each division (board 69); a division tab adds the division bar with its
// leads (69b); Add member starts with a Division select (69c); on a phone the
// tabs are one select chip (69m). Everything a row does is the lead's page's
// (./division-members.tsx, #231). It holds no structure tools: divisions are
// created, edited and closed in the Team tree's edit view (issue #251,
// ./team-tree-edit.tsx), and a closed division is listed nowhere.

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
  const open = listed.find((p) => p.id === openId) ?? null;
  const removals = useMemo(() => new Map(page.everyone.map((p) => [p.id, p.removals])), [page.everyone]);
  const joining = (current ? [current] : tab.kind === "all" ? page.tabs : []).flatMap((t) => t.joining.map((j) => ({ joining: j, division: t.division.name })));
  const add = addMemberDivisions(page, tab);

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
  const drawerOpen = open !== null || editing !== null || adding;

  return (
    <DrawerPage drawerOpen={drawerOpen}>
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
              look="chip"
              icon={Layers}
              label="Division"
              allLabel={options[0].label}
              value={tab.kind === "all" ? null : tabKey(tab)}
              onChange={(key) => choose(key === null ? ALL_TAB : tabOfKey(key, page))}
              options={options.slice(1).map((o) => ({ value: o.key, label: o.label }))}
            />
          </div>
        </div>
        <SearchField value={query} onChange={setQuery} placeholder="Search name, email, phone" className="hidden md:flex md:w-[240px]" />
      </div>

      {current && <DivisionBar tab={current} />}

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
        drawerOpen={drawerOpen}
      />

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

/** Board 69b: the open division's code and name, and its leads. */
function DivisionBar({ tab }: { tab: DivisionMembers }) {
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
    </section>
  );
}
