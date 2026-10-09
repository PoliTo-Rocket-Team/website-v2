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
import { Controls, DepartmentFilter, PageHeader, Pager, RolePill, SearchField, TH, Tabs } from "./directory";
import { MemberDrawer } from "./member-drawer";
import { PANEL } from "./panel";

// The Members page (boards 46 and 46b). The operations lead sees the whole
// team with the department filter and pages of nine; a division lead sees
// their division. Tabs, filter and search narrow the rows here, in the
// browser; choosing a row opens the member drawer.
export function MembersView({ directory, editable }: { directory: MemberDirectory; editable: boolean }) {
  const team = directory.scope === "team";
  const [tab, setTab] = useState<MemberTab>("all");
  const [department, setDepartment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(
    () => memberRowsFor(directory.rows, { department, query }),
    [directory.rows, department, query],
  );
  const inTab = filtered.filter((row) => inMemberTab(row, tab));
  const last = pageCount(inTab.length);
  const current = Math.min(page, last);
  const rows = team ? pageOf(inTab, current) : inTab;
  const open = directory.rows.find((row) => row.id === openId) ?? null;

  const narrow = (apply: () => void) => {
    apply();
    setPage(1);
  };

  return (
    <div className={team ? "" : "max-w-[712px]"}>
      <PageHeader
        title="Members"
        detail={
          team
            ? "Everyone on the team this year. Changes show on the public Team page."
            : `${directory.division} · ${people(directory.rows.length)}`
        }
      />

      <Controls
        search={
          <SearchField
            value={query}
            onChange={(next) => narrow(() => setQuery(next))}
            placeholder="Search name or email"
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
        {directory.scope === "team" && (
          <DepartmentFilter
            departments={directory.departments}
            value={department}
            onChange={(next) => narrow(() => setDepartment(next))}
          />
        )}
      </Controls>

      <section className={`${PANEL} mt-6 overflow-hidden`}>
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-hairline">
            <tr>
              <th scope="col" className={TH}>
                Member
              </th>
              <th scope="col" className={`${TH} hidden md:table-cell ${team ? "w-[34%]" : "w-[28%]"}`}>
                {team ? "Department · Division" : "Program"}
              </th>
              <th scope="col" className={`${TH} hidden sm:table-cell sm:w-[180px] md:w-[22%]`}>
                Role
              </th>
              {team && (
                <th scope="col" className={`${TH} hidden w-[13%] lg:table-cell`}>
                  Joined
                </th>
              )}
              <th scope="col" className="w-12 md:w-16">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <MemberTableRow key={row.id} row={row} team={team} selected={row.id === openId} onOpen={() => setOpenId(row.id)} />
            ))}
          </tbody>
        </table>
        <footer className="flex min-h-[52px] items-center justify-between gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
          <span>{team ? `Showing ${rows.length} of ${inTab.length}` : people(inTab.length)}</span>
          {team && <Pager page={current} last={last} onPage={setPage} />}
        </footer>
      </section>

      <MemberDrawer
        row={open}
        scope={directory.scope}
        editable={editable}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

function people(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

function MemberTableRow({
  row,
  team,
  selected,
  onOpen,
}: {
  row: MemberRow;
  team: boolean;
  selected: boolean;
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
            <span className="mt-1.5 block sm:hidden">
              <RolePill role={row.role} label={row.roleLabel} />
            </span>
          </span>
        </span>
      </td>
      <td className="hidden px-5 py-2.5 md:table-cell">
        {team ? (
          <TwoLines first={row.department} second={row.division} />
        ) : (
          <TwoLines first={row.program} second={row.study} />
        )}
      </td>
      <td className="hidden px-5 py-2.5 sm:table-cell">
        <RolePill role={row.role} label={row.roleLabel} />
      </td>
      {team && <td className="hidden px-5 py-2.5 text-[15px] text-text-2 lg:table-cell">{row.joined}</td>}
      <td className="pr-3 text-right md:pr-5">
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
