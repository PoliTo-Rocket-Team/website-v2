"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, TimerOff, type LucideIcon } from "lucide-react";
import {
  ACTIVITY_AREA_LABELS,
  activityAreas,
  activityPeople,
  areaOf,
  DATE_RANGE_LABELS,
  DATE_RANGES,
  filterActivity,
  OPENING_FILTERS,
  sentenceOf,
  WHOLE_WINDOW_LABEL,
  whenLabel,
  type ActivityArea,
  type ActivityEntry,
  type ActivityFilters,
  type ActivityLogPage,
  type ActivityWho,
  type DateRange,
  type ViewAsEvent,
} from "@/lib/dashboard/activity-log";
import { pageCount, pageOf } from "@/lib/dashboard/team";
import { cn } from "@/lib/utils";
import { FilterMenu } from "./controls";
import { Pager, TH } from "./directory";
import { PageHeader } from "./page-header";
import { PANEL } from "./panel";
import { SearchField } from "./search-field";

// The Activity log (board 101, issue #642): every stored change, newest first,
// 12 to a page. Search, All / View as only, Area, Person and the date range
// narrow the list in the browser, and the pager counts only what they keep.
// A change made during View as shows "<seat title> as <person>" with the
// acting person under it; View as starts, stops and timeouts are rows of
// their own. Props in, nothing fetched, nothing written.
//
// On a desktop the 12 rows, the column header and the pager fit a 1440 x 900
// screen as on the board: the filters sit 16px under the intro, the table 12px
// under them, the header is 36px and every row is 52px, one-line and two-line
// Who alike, with a long change cut to one line (its full text on hover).

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The column header, 36px tall on the board, so the shared header loses some height. */
const HEAD = cn(TH, "py-2.5");

/** One row height for every row (board 101), whatever its Who holds. */
const CELL = "px-5 py-2 align-middle";

const VIEW_AS_ICONS: Readonly<Record<ViewAsEvent, LucideIcon>> = { start: Eye, stop: EyeOff, timeout: TimerOff };

export function ActivityLogView({ log }: { log: ActivityLogPage }) {
  const [filters, setFilters] = useState<ActivityFilters>(OPENING_FILTERS);
  const [page, setPage] = useState(1);
  const now = useMemo(() => new Date(log.readAt), [log.readAt]);
  const shown = useMemo(() => filterActivity(log.entries, filters, now), [log.entries, filters, now]);
  const people = useMemo(() => activityPeople(log.entries), [log.entries]);
  const areas = useMemo(() => activityAreas(log.entries), [log.entries]);
  const last = pageCount(shown.length);
  const current = Math.min(page, last);
  const rows = pageOf(shown, current);

  const narrow = (next: Partial<ActivityFilters>) => {
    setFilters((all) => ({ ...all, ...next }));
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Activity log"
        intro="Every change in the dashboard, newest first. Changes made during View as show both people."
        phone="bar"
      />

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-2.5">
        <SearchField value={filters.query} onChange={(query) => narrow({ query })} placeholder="Search people or changes" className="md:w-[300px]" />
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Which changes" className="flex items-center gap-2">
            <ChoicePill on={!filters.viewAsOnly} onClick={() => narrow({ viewAsOnly: false })}>
              All
            </ChoicePill>
            <ChoicePill on={filters.viewAsOnly} onClick={() => narrow({ viewAsOnly: true })}>
              View as only
            </ChoicePill>
          </div>
          <FilterMenu
            look="chip"
            label="Area"
            allLabel="Area: any"
            options={areas.map((area) => ({ value: area, label: ACTIVITY_AREA_LABELS[area] }))}
            value={filters.area}
            onChange={(area) => narrow({ area: area as ActivityArea | null })}
          />
          <FilterMenu
            look="chip"
            label="Person"
            allLabel="Person: anyone"
            options={people.map((p) => ({ value: p.id, label: p.name }))}
            value={filters.personId}
            onChange={(personId) => narrow({ personId })}
          />
          <FilterMenu
            look="chip"
            label="Dates"
            allLabel={WHOLE_WINDOW_LABEL}
            options={DATE_RANGES.map((days) => ({ value: String(days), label: DATE_RANGE_LABELS[days] }))}
            value={filters.range === null ? null : String(filters.range)}
            onChange={(range) => narrow({ range: range === null ? null : (Number(range) as DateRange) })}
          />
        </div>
      </div>

      <ul aria-label="Activity log" className="mt-4 flex flex-col gap-2.5 md:hidden">
        {rows.map((entry) => (
          <li key={entry.key} className={`${PANEL} flex flex-col gap-2 px-4 py-3.5`}>
            <div className="flex items-start justify-between gap-3">
              <Who who={entry.who} />
              <span className="shrink-0 pt-0.5 text-[12px] tabular-nums text-prt-muted">{whenLabel(entry.at, now)}</span>
            </div>
            <Change entry={entry} />
            <span>
              <AreaPill area={areaOf(entry.change)} />
            </span>
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="mt-6 text-center text-[14px] text-prt-muted md:hidden">No changes match these filters.</p>}
      <div className="mt-4 flex justify-center md:hidden">
        <Pager page={current} last={last} onPage={setPage} />
      </div>

      <section className={`${PANEL} mt-3 hidden overflow-hidden md:block`}>
        <table className="w-full table-fixed border-collapse">
          <thead className="border-b border-hairline">
            <tr>
              <th scope="col" className={`${HEAD} w-[150px] lg:w-[160px]`}>
                When
              </th>
              <th scope="col" className={`${HEAD} w-[30%] lg:w-[25%]`}>
                Who
              </th>
              <th scope="col" className={HEAD}>
                Change
              </th>
              <th scope="col" className={`${HEAD} w-[150px]`}>
                Area
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((entry) => (
              <tr key={entry.key} className="h-[52px] transition-colors duration-300 ease-out hover:bg-white-5">
                <td className={`${CELL} whitespace-nowrap text-[13px] tabular-nums text-prt-muted`}>{whenLabel(entry.at, now)}</td>
                <td className={CELL}>
                  <Who who={entry.who} />
                </td>
                <td className={CELL}>
                  <Change entry={entry} oneLine />
                </td>
                <td className={CELL}>
                  <AreaPill area={areaOf(entry.change)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-10 text-center text-[14px] text-prt-muted">No changes match these filters.</p>}
        <footer className="relative flex min-h-[52px] items-center gap-4 border-t border-hairline px-5 py-3 text-[13px] text-prt-muted">
          <span>Newest first</span>
          <span className="absolute left-1/2 -translate-x-1/2">
            <Pager page={current} last={last} onPage={setPage} />
          </span>
        </footer>
      </section>
    </>
  );
}

/** "All" or "View as only": a round pill, filled while on. */
function ChoicePill({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
        on ? "border-white-10 bg-white-10 font-semibold text-prt-text" : "border-hairline bg-panel/60 text-text-2 hover:text-prt-text"
      }`}
    >
      {children}
    </button>
  );
}

/** The name and title, or during View as "<seat title> as <person>" over "by <acting person>". */
function Who({ who }: { who: ActivityWho }) {
  const [line, under] = who.kind === "self" ? [who.name, who.title] : [`${who.actingTitle} as ${who.name}`, `by ${who.actingName}`];
  return (
    <span className="block min-w-0">
      <span className="block truncate text-[14px] font-medium leading-5 text-prt-text">{line}</span>
      {under !== null && <span className="block truncate text-[12px] leading-4 text-prt-muted">{under}</span>}
    </span>
  );
}

/** The change's sentence; on the desktop table cut to one line, so every row keeps its height. */
function Change({ entry, oneLine = false }: { entry: ActivityEntry; oneLine?: boolean }) {
  const { change } = entry;
  const sentence = sentenceOf(change);
  const Icon = change.kind === "view-as" ? VIEW_AS_ICONS[change.event] : null;
  return (
    <span className="flex min-w-0 items-center gap-2 text-[14px] text-prt-text">
      {Icon && <Icon aria-hidden className="h-4 w-4 shrink-0 text-info" strokeWidth={1.75} />}
      <span className={`min-w-0 ${oneLine ? "truncate" : "break-words"}`} title={oneLine ? sentence : undefined}>
        {sentence}
      </span>
    </span>
  );
}

/** View as rows on the info tint (board 101); every other area on white-10. */
function AreaPill({ area }: { area: ActivityArea }) {
  return (
    <span
      className={`inline-flex h-6 max-w-full items-center truncate whitespace-nowrap rounded-full px-2.5 text-[12px] ${
        area === "view-as" ? "bg-info-soft text-info" : "bg-white-10 text-prt-text"
      }`}
    >
      {ACTIVITY_AREA_LABELS[area]}
    </span>
  );
}
