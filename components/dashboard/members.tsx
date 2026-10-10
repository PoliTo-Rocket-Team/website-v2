"use client";

import { useMemo, useState, useTransition } from "react";
import { MoreHorizontal, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmJoin } from "@/app/dashboard/team-actions";
import {
  MEMBER_TABS,
  MEMBER_TAB_LABELS,
  inMemberTab,
  memberRowsFor,
  pageCount,
  pageOf,
  type Joining,
  type MemberDirectory,
  type MemberRow,
  type MemberTab,
} from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { ConfirmDialog } from "./confirm-dialog";
import { Controls, DepartmentFilter, Pager, RolePill, SearchField, TH, Tabs } from "./directory";
import { DrawerPage } from "./drawer";
import { MemberDrawer } from "./member-drawer";
import { PageHeader } from "./page-header";
import { PANEL } from "./panel";

// The Members page. The operations lead sees the whole team with the
// department filter and pages of nine (board 46); a division lead sees their
// division, with anyone accepted and waiting to join above it (boards 59 and
// 59m). Tabs, filter and search narrow the rows here, in the browser;
// choosing a row opens the member panel. On a phone the table is a stack of
// cards.
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
    <DrawerPage drawerOpen={open !== null}>
      <PageHeader
        title="Members"
        intro={
          team
            ? "Everyone on the team this year. Changes show on the public Team page."
            : `${directory.division} · ${people(directory.rows.length)}`
        }
        phone={team ? "full" : "bar"}
      />

      {directory.scope === "division" && directory.joining.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2.5 max-md:mt-0">
          {directory.joining.map((joining) => (
            <JoiningBanner key={joining.applicationId} joining={joining} division={directory.division} editable={editable} />
          ))}
        </ul>
      )}

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
        {directory.scope === "team" && (
          <DepartmentFilter
            departments={directory.departments}
            value={department}
            onChange={(next) => narrow(() => setDepartment(next))}
          />
        )}
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
              <th scope="col" className={`${TH} ${team ? "w-[34%]" : "w-[26%]"}`}>
                {team ? "Department · Division" : "Program"}
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
                team={team}
                selected={row.id === openId}
                panelOpen={open !== null}
                onOpen={() => setOpenId(row.id)}
              />
            ))}
          </tbody>
        </table>
        <footer className="flex min-h-[52px] items-center justify-between gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
          <span>{team ? `Showing ${rows.length} of ${inTab.length}` : people(inTab.length)}</span>
          {team && <Pager page={current} last={last} onPage={setPage} />}
        </footer>
      </section>
      {team && (
        <div className="mt-4 flex justify-center md:hidden">
          <Pager page={current} last={last} onPage={setPage} />
        </div>
      )}

      <MemberDrawer
        row={open}
        directory={directory}
        editable={editable}
        onClose={() => setOpenId(null)}
      />
    </DrawerPage>
  );
}

function people(n: number): string {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

/** The line under a name on a phone card: "Division lead", the Team page title, or "Member". */
function cardLine(row: MemberRow): string {
  if (row.role === "division-lead") return "Division lead";
  if (row.role !== "member") return row.roleLabel;
  return row.pageTitle ?? "Member";
}

/** "Giulia Rossi is joining" (boards 59 and 59m): Confirm join, once the signed NDA is in. */
function JoiningBanner({ joining, division, editable }: { joining: Joining; division: string; editable: boolean }) {
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();
  const firstName = joining.name.split(" ")[0];

  const confirm = () =>
    startTransition(async () => {
      const result = await confirmJoin(joining.applicationId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAsking(false);
      toast.success(`${joining.name} joined ${division}`);
    });

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-success/40 bg-success/[0.06] px-4 py-3.5 md:flex-row md:items-center md:gap-4">
      <span className="flex min-w-0 flex-1 items-center gap-3.5">
        <span className="hidden md:block">
          <Avatar name={joining.name} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{joining.name} is joining</span>
          <span className="block text-[13px] text-prt-muted">
            Accepted for {joining.position} · waiting for the signed NDA
          </span>
        </span>
      </span>
      {editable && (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-success/60 px-4 text-[14px] font-semibold text-success transition-colors duration-300 ease-out hover:border-success hover:bg-success/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-8 md:px-3.5 md:text-[13px]"
        >
          Confirm join
        </button>
      )}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        icon={<UserCheck className="h-5 w-5" strokeWidth={1.75} />}
        tone="success"
        title={`Confirm ${joining.name} joins?`}
        description={`${firstName} becomes a member of ${division} as ${joining.position}. Confirm once you have their signed NDA.`}
        cancelLabel="Cancel"
        confirmLabel="Confirm join"
        pending={pending}
        onConfirm={confirm}
      />
    </li>
  );
}

function MemberTableRow({
  row,
  team,
  selected,
  panelOpen,
  onOpen,
}: {
  row: MemberRow;
  team: boolean;
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
        {team ? (
          <TwoLines first={row.department} second={row.division} />
        ) : (
          <TwoLines first={row.program} second={row.study} />
        )}
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
