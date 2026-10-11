"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  MEMBER_TABS,
  MEMBER_TAB_LABELS,
  inMemberTab,
  memberRowsFor,
  pageCount,
  pageOf,
  type MemberDirectory,
  type MemberRow,
  type MemberTab,
} from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { Controls, DepartmentFilter, Pager, RolePill, SearchField, TH, Tabs } from "./directory";
import { DivisionMembersView } from "./division-members";
import { DrawerPage } from "./drawer";
import { MemberDrawer } from "./member-drawer";
import { PageHeader } from "./page-header";
import { PANEL } from "./panel";

// The Members page. The operations lead sees the whole team with the
// department filter and pages of nine (board 46); a division lead sees one of
// their divisions (boards 61e to 61h2, ./division-members.tsx).
export function MembersView({ directory, editable }: { directory: MemberDirectory; editable: boolean }) {
  if (directory.scope === "division") return <DivisionMembersView page={directory} editable={editable} />;
  if (directory.scope === "none") return <PageHeader title="Members" intro="" phone="bar" />;
  return <TeamMembersView rows={directory.rows} departments={directory.departments} editable={editable} />;
}

// Board 46: tabs, filter and search narrow the rows here, in the browser;
// choosing a row opens the member panel. On a phone the table is a stack of
// cards.
function TeamMembersView({
  rows: allRows,
  departments,
  editable,
}: {
  rows: readonly MemberRow[];
  departments: readonly string[];
  editable: boolean;
}) {
  const [tab, setTab] = useState<MemberTab>("all");
  const [department, setDepartment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(() => memberRowsFor(allRows, { department, query }), [allRows, department, query]);
  const inTab = filtered.filter((row) => inMemberTab(row, tab));
  const last = pageCount(inTab.length);
  const current = Math.min(page, last);
  const rows = pageOf(inTab, current);
  const open = allRows.find((row) => row.id === openId) ?? null;

  const narrow = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <DrawerPage drawerOpen={open !== null}>
      <PageHeader title="Members" intro="Everyone on the team this year. Changes show on the public Team page." phone="full" />

      <Controls
        search={
          <SearchField
            value={query}
            onChange={(next) => narrow(() => setQuery(next))}
            placeholder="Search name or email"
            className="hidden md:flex md:w-[260px]"
          />
        }
      >
        <Tabs
          label="Members"
          items={MEMBER_TABS.map((key) => ({
            key,
            label: MEMBER_TAB_LABELS[key],
            count: filtered.filter((row) => inMemberTab(row, key)).length,
          }))}
          value={tab}
          onChange={(next) => narrow(() => setTab(next))}
        />
        <DepartmentFilter departments={departments} value={department} onChange={(next) => narrow(() => setDepartment(next))} />
      </Controls>

      <ul aria-label="Members" className="mt-4 flex flex-col gap-2.5 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => setOpenId(row.id)}
              className={`${PANEL} flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
            >
              <Avatar name={row.name} size="ml" accent={row.role !== "member"} />
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold">{row.name}</span>
                <span className="block truncate text-[13px] text-prt-muted">
                  {cardLine(row)} · since {row.joined}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <section className={`${PANEL} mt-6 hidden overflow-hidden md:block`}>
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-hairline">
            <tr>
              <th scope="col" className={TH}>
                Member
              </th>
              <th scope="col" className={`${TH} w-[34%]`}>
                Department · Division
              </th>
              <th scope="col" className={`${TH} w-[168px]`}>
                Role
              </th>
              <th scope="col" className={`${TH} hidden w-[13%] lg:table-cell ${open ? "xl:hidden" : ""}`}>
                Joined
              </th>
              <th scope="col" className="w-16">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <MemberTableRow
                key={row.id}
                row={row}
                selected={row.id === openId}
                panelOpen={open !== null}
                onOpen={() => setOpenId(row.id)}
              />
            ))}
          </tbody>
        </table>
        <footer className="flex min-h-[52px] items-center justify-between gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
          <span>{`Showing ${rows.length} of ${inTab.length}`}</span>
          <Pager page={current} last={last} onPage={setPage} />
        </footer>
      </section>
      <div className="mt-4 flex justify-center md:hidden">
        <Pager page={current} last={last} onPage={setPage} />
      </div>

      <MemberDrawer row={open} editable={editable} onClose={() => setOpenId(null)} />
    </DrawerPage>
  );
}

/** The line under a name on a phone card: "Division lead", the Team page title, or "Member". */
function cardLine(row: MemberRow): string {
  if (row.role === "division-lead") return "Division lead";
  if (row.role !== "member") return row.roleLabel;
  return row.pageTitle ?? "Member";
}

function MemberTableRow({
  row,
  selected,
  panelOpen,
  onOpen,
}: {
  row: MemberRow;
  selected: boolean;
  panelOpen: boolean;
  onOpen: () => void;
}) {
  const lead = row.role !== "member";
  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer transition-colors duration-300 ease-out ${selected ? "bg-accent/[0.08]" : "hover:bg-white-5"}`}
    >
      <td className="px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-3.5">
          <Avatar name={row.name} accent={lead} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] text-prt-text">{row.name}</span>
            <span className="block truncate text-[13px] text-prt-muted">{row.email}</span>
          </span>
        </span>
      </td>
      <td className="px-5 py-2.5">
        <TwoLines first={row.department} second={row.division} />
      </td>
      <td className="px-5 py-2.5">
        <RolePill role={row.role} label={row.roleLabel} />
      </td>
      <td className={`hidden px-5 py-2.5 text-[15px] text-text-2 lg:table-cell ${panelOpen ? "xl:hidden" : ""}`}>{row.joined}</td>
      <td className="pr-5 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          aria-label={`Open ${row.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </td>
    </tr>
  );
}

function TwoLines({ first, second }: { first: string | null; second: string | null }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[15px] text-prt-text">{first ?? <span className="text-dim">–</span>}</span>
      {second && <span className="block truncate text-[13px] text-prt-muted">{second}</span>}
    </span>
  );
}
