"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { toast } from "sonner";
import { setShownOnSite } from "@/app/dashboard/team-actions";
import {
  alumniRowsFor,
  pageCount,
  pageOf,
  recentSeasons,
  seasonOf,
  type AlumniDirectory,
  type AlumnusRow,
} from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { Controls, DepartmentFilter, Pager, SearchField, TH, Tabs } from "./directory";
import { PageHeader } from "./page-header";
import { PANEL } from "./panel";

// The Alumni page (board 46c): everyone who was on the team, the years they
// were on it, and whether the public Team page lists them. Tabs, filter and
// search narrow the rows in the browser; the switch writes through the data
// interface (a cookie for a test developer).
export function AlumniView({ directory, editable }: { directory: AlumniDirectory; editable: boolean }) {
  const [leftIn, setLeftIn] = useState<number | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const seasons = useMemo(() => recentSeasons(directory.rows), [directory.rows]);
  const filtered = useMemo(
    () => alumniRowsFor(directory.rows, { department, query }),
    [directory.rows, department, query],
  );
  const inTab = leftIn === null ? filtered : filtered.filter((row) => row.to === leftIn);
  const last = pageCount(inTab.length);
  const current = Math.min(page, last);
  const rows = pageOf(inTab, current);
  const showSwitch = directory.rows.some((row) => row.shownOnSite !== null);
  const showing = `Showing ${rows.length} of ${inTab.length}`;

  const narrow = (apply: () => void) => {
    apply();
    setPage(1);
  };

  // A tab's key is the year people left in; "all" stands for every year.
  const tabs = [
    { key: "all", label: "All years", count: filtered.length },
    ...seasons.map((year) => ({
      key: String(year),
      label: seasonOf(year),
      count: filtered.filter((row) => row.to === year).length,
    })),
  ];

  return (
    <div>
      <PageHeader title="Alumni" intro="People who were on the team. The public Team page lists them by year." />

      <Controls
        search={
          <SearchField value={query} onChange={(next) => narrow(() => setQuery(next))} placeholder="Search name" />
        }
      >
        <Tabs
          label="Years"
          items={tabs}
          value={leftIn === null ? "all" : String(leftIn)}
          onChange={(key) => narrow(() => setLeftIn(key === "all" ? null : Number(key)))}
        />
        <DepartmentFilter
          departments={directory.departments}
          value={department}
          onChange={(next) => narrow(() => setDepartment(next))}
        />
      </Controls>

      <ul aria-label="Alumni" className="mt-4 flex flex-col gap-2.5 md:hidden">
        {rows.map((row) => (
          <AlumnusCard key={row.id} row={row} editable={editable} showSwitch={showSwitch} />
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
              <th scope="col" className={`${TH} hidden w-[24%] md:table-cell`}>
                Last role
              </th>
              <th scope="col" className={`${TH} hidden w-[16%] lg:table-cell`}>
                On the team
              </th>
              {showSwitch && (
                <th scope="col" className={`${TH} w-[132px] md:w-[18%]`}>
                  On the site
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((row) => (
              <AlumnusTableRow key={row.id} row={row} editable={editable} showSwitch={showSwitch} />
            ))}
          </tbody>
        </table>
        <footer className="flex min-h-[52px] items-center justify-between gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
          <span>{showing}</span>
          <Pager page={current} last={last} onPage={setPage} />
        </footer>
      </section>
    </div>
  );
}

function years(row: AlumnusRow): string {
  return `${row.from} – ${row.to}`;
}

// A phone card (the Members phone cards, board 46): avatar, name, and the last
// role with the years. Alumni open no panel, so the card is not a button.
function AlumnusCard({ row, editable, showSwitch }: { row: AlumnusRow; editable: boolean; showSwitch: boolean }) {
  return (
    <li className={`${PANEL} flex items-center gap-3.5 px-4 py-3.5`}>
      <Avatar name={row.name} size="ml" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{row.name}</span>
        <span className="block truncate text-[13px] text-prt-muted">
          {row.lastRole} · {years(row)}
        </span>
      </span>
      {showSwitch && row.shownOnSite !== null && (
        <SiteSwitch id={row.id} name={row.name} shown={row.shownOnSite} editable={editable} />
      )}
    </li>
  );
}

function AlumnusTableRow({ row, editable, showSwitch }: { row: AlumnusRow; editable: boolean; showSwitch: boolean }) {
  return (
    <tr>
      <td className="px-5 py-2.5">
        <span className="flex min-w-0 items-center gap-3.5">
          <Avatar name={row.name} />
          <span className="block min-w-0 truncate text-[15px] text-prt-text">{row.name}</span>
        </span>
      </td>
      <td className="hidden px-5 py-2.5 md:table-cell">
        <span className="block truncate text-[15px] text-prt-text">{row.lastRole}</span>
        <span className="block truncate text-[13px] text-prt-muted">{row.unit}</span>
      </td>
      <td className="hidden px-5 py-2.5 text-[15px] text-text-2 lg:table-cell">{years(row)}</td>
      {showSwitch && (
        <td className="px-5 py-2.5">
          {row.shownOnSite !== null && <SiteSwitch id={row.id} name={row.name} shown={row.shownOnSite} editable={editable} />}
        </td>
      )}
    </tr>
  );
}

function SiteSwitch({ id, name, shown, editable }: { id: number; name: string; shown: boolean; editable: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(shown);
  const [, startTransition] = useTransition();
  const flip = (next: boolean) =>
    startTransition(async () => {
      setOptimistic(next);
      const result = await setShownOnSite(id, next);
      if (!result.ok) toast.error(result.error);
    });
  return (
    <label className="flex items-center gap-3">
      <SwitchPrimitive.Root
        checked={optimistic}
        onCheckedChange={flip}
        disabled={!editable}
        aria-label={`Show ${name} on the site`}
        className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default data-[state=checked]:bg-accent data-[state=unchecked]:bg-white-10"
      >
        <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-prt-text motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out data-[state=checked]:translate-x-[18px]" />
      </SwitchPrimitive.Root>
      <span className={`text-[15px] ${optimistic ? "text-prt-text" : "text-prt-muted"}`}>{optimistic ? "Shown" : "Hidden"}</span>
    </label>
  );
}
