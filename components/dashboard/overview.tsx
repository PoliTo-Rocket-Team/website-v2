import Link from "next/link";
import { ArrowRightLeft, ArrowUpRight, AtSign, CalendarClock, Check, ChevronRight, Hourglass, Inbox, Mail, Package, Pencil, ShoppingCart, Timer, UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import {
  APPLICANT_PILL_LABELS,
  NO_APPLICATIONS,
  type ApplicantApplications as ApplicantApplicationsPanel,
  type ApplicantOverview,
  type ApplicantPill,
  type NextStep,
} from "@/lib/dashboard/applicant-overview";
import type { AlumniCard, AlumniOverview } from "@/lib/dashboard/my-alumni";
import { sentLabel, SHOWN_FOR_A_MONTH } from "@/lib/dashboard/my-applications";
import { ACCESS_AREA_LABELS, accessCounts, type AccessSummary } from "@/lib/dashboard/access-summary";
import {
  checklistCount,
  departmentLine,
  departmentsMeta,
  divisionInitials,
  divisionShortName,
  divisionsMeta,
  interviewOrder,
  leadsLabel,
  type DepartmentSummary,
  type DivisionSummary,
  interviewSlot,
  interviewSummary,
  rosterSize,
  type ActivityItem,
  isAnswerAlias,
  isAnswerHandOver,
  isDismissNotice,
  type AttentionAction,
  type AttentionItem,
  type AttentionKind,
  type Checklist,
  type Overview,
  type PersonalPanels,
  type PersonHeader,
  type Roster,
  type ScopeBoard,
  type TeamSideOverview,
  type Stat,
  type UpcomingInterview,
} from "@/lib/dashboard/overview";
import type { OwnAlias } from "@/lib/dashboard/alias-setup";
import type { Pictured } from "@/lib/dashboard/stored-photo";
import { AliasReadyCard } from "./alias-setup";
import { Avatar } from "./avatar";
import { AnswerAlias } from "./answer-alias";
import { AnswerHandOver } from "./answer-hand-over";
import { DismissNotice } from "./dismiss-notice";
import { departmentLabel } from "@/lib/dashboard/recruitment";
import { PANEL, Panel, RowAction } from "./panel";

// The Overview page: one view for every team seat (issue #593), the personal
// panels of board 52 around the board the seat's scope reads (40 for the
// operations lead, 72 for the team leader, 62 for a department head, 56 for a
// division lead, and 56 over their grants for a member); 50e and 50f for a
// non-member, and issue #317's board 56 for an alumnus. Props in, nothing
// fetched: the page hands over what the dashboard data interface answered.
export function OverviewView({ overview, aliasCard = null }: { overview: Overview; aliasCard?: OwnAlias | null }) {
  switch (overview.shape) {
    case "team":
    case "leader":
    case "department":
    case "division":
      return <TeamView overview={overview} aliasCard={aliasCard} />;
    case "applicant":
      return <ApplicantView overview={overview} />;
    case "alumni":
      return <AlumniView overview={overview} />;
  }
}

const GRID = "mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]";

/** Off the team the panels stack, full width, under the person (boards 50e, 50f, 56). */
const STACK = "mt-6 flex min-w-0 flex-col gap-4";

/**
 * How the lead's Overview reads on phones: board 40m keeps everything; board
 * 56m keeps the first two figures without their detail line, the attention
 * rows and the interviews as stacked cards, and no recent activity.
 */
type LeadPhoneForm = "full" | "board-56m";

/** The scope board's own parts, and the phone form it reads in: board 56m's for a division or department board, 40m's otherwise. */
function boardParts(overview: ScopeBoard): {
  divisions: { readonly list: readonly DivisionSummary[]; readonly people: number } | null;
  departments: { readonly list: readonly DepartmentSummary[]; readonly people: number } | null;
  interviews: readonly UpcomingInterview[];
  phone: LeadPhoneForm;
} {
  switch (overview.shape) {
    case "team":
      return { divisions: null, departments: null, interviews: [], phone: "full" };
    case "leader":
      return { divisions: null, departments: { list: overview.departments, people: overview.people }, interviews: [], phone: "full" };
    case "department":
      return { divisions: { list: overview.divisions, people: overview.people }, departments: null, interviews: overview.interviews, phone: "board-56m" };
    case "division":
      return { divisions: null, departments: null, interviews: overview.interviews, phone: "board-56m" };
  }
}

// One Overview for every team seat (issue #593). Board 52's person leads it,
// with Edit profile from md, and board 94f's alias card under it until the
// alias is set up. The seat's figures follow, then its panels: in the two
// columns boards 99 and 99b set for every leader (issue #652), or board
// first, then their page on the site beside the roster, for every other seat.
// "Your access" closes the page: each grant, or nothing for a seat that
// holds no grant (issue #790). Board 52m: the person sits on the page with
// no frame and no edit button (My profile is in the user menu), and each
// panel's count moves beside its title. The page streams the person first
// and the rest once both its reads arrive (issue #397).
function TeamView({ overview, aliasCard }: { overview: TeamSideOverview; aliasCard: OwnAlias | null }) {
  return (
    <>
      <OverviewPersonSection person={overview.person} />
      {aliasCard && <OverviewAliasSection alias={aliasCard} />}
      <OverviewBodySection board={overview} panels={overview} />
    </>
  );
}

/** Board 52's person, with Edit profile from md. */
export function OverviewPersonSection({ person }: { person: PersonHeader }) {
  return (
    <section className={PERSON_FRAME}>
      <PersonLines person={person} since={person.since} />
      {person.edit && (
        <Link
          href={person.edit.href}
          className="hidden h-9 items-center gap-2 self-start rounded-full md:inline-flex bg-prt-text px-4 text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:self-center"
        >
          <Pencil aria-hidden className="h-4 w-4" strokeWidth={2} />
          {person.edit.label}
        </Link>
      )}
    </section>
  );
}

/** Board 94f's alias card, under the person until the alias is set up. */
export function OverviewAliasSection({ alias }: { alias: OwnAlias }) {
  return (
    <div className="mt-5 md:mt-6">
      <AliasReadyCard alias={alias} />
    </div>
  );
}

// Everything under the person: the seat's figures (boards 40, 56, 62, 72),
// then its panels in the layout the seat reads (`overviewLayoutOf`), then
// "Your access". A board with no figure (a member who holds no area grant)
// shows no figure row.
export function OverviewBodySection({ board, panels }: { board: ScopeBoard; panels: Omit<PersonalPanels, "person"> }) {
  const parts = boardParts(board);
  const { access } = panels;
  const compact = parts.phone === "board-56m";
  return (
    <>
      {board.stats.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 md:mt-6 md:gap-4 xl:grid-cols-4">
          {board.stats.map((stat, index) => (
            <StatCard key={stat.label} stat={stat} compact={compact} hiddenOnPhone={compact && index >= 2} />
          ))}
        </div>
      )}
      {panels.layout === "leader-columns" ? (
        <LeaderColumns board={board} parts={parts} panels={panels} />
      ) : (
        <BoardFirst board={board} parts={parts} panels={panels} />
      )}

      {access.kind === "lines" && <AccessPanel access={access.lines} />}
    </>
  );
}

type BodyProps = { board: ScopeBoard; parts: ReturnType<typeof boardParts>; panels: Omit<PersonalPanels, "person"> };

/** Whether the scope board has a panel of its own to show: attention rows, Divisions, Departments or interviews. */
function hasScopePanels({ board, parts }: Pick<BodyProps, "board" | "parts">): boolean {
  return (
    board.attention.length > 0 ||
    parts.interviews.length > 0 ||
    (parts.divisions !== null && parts.divisions.list.length > 0) ||
    (parts.departments !== null && parts.departments.list.length > 0)
  );
}

/**
 * The scope board's own panels: what needs attention, then Departments
 * (board 72), Divisions (board 62) or Upcoming interviews (board 56); a
 * department head's phone board 62m keeps the interviews, which board 62
 * leaves out. `checklist` slots their page on the site under the attention
 * rows (boards 99 and 99b).
 */
function ScopePanels({ board, parts, checklist }: Pick<BodyProps, "board" | "parts"> & { checklist: Checklist | null }) {
  const { divisions, departments, interviews } = parts;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {board.attention.length > 0 && <AttentionPanel attention={board.attention} compact={parts.phone === "board-56m"} />}
      {checklist !== null && <ChecklistPanel checklist={checklist} />}
      {divisions !== null && divisions.list.length > 0 && <DivisionsPanel divisions={divisions.list} people={divisions.people} />}
      {departments !== null && departments.list.length > 0 && <DepartmentsPanel departments={departments.list} people={departments.people} />}
      {interviews.length > 0 && (
        <div className={divisions !== null ? "md:hidden" : undefined}>
          <InterviewsPanel interviews={interviews} />
        </div>
      )}
    </div>
  );
}

// Boards 99 and 99b (issue #652), for a department head, a division lead and
// the team leader, the operations lead and the IT lead (issue #760), the
// last three with no roster. Left: what needs attention, their page on the
// site (gone once every step is done, issue #641), then the scope's own
// panel. Right:
// the roster of their own unit, then recent activity, which phones on boards
// 56m and 62m drop. With one column empty the other takes the whole width,
// so no empty column is left (Owner decision, 2026-10-21).
function LeaderColumns({ board, parts, panels }: BodyProps) {
  const { checklist, rosters } = panels;
  const left = hasScopePanels({ board, parts }) || checklist !== null;
  const right = rosters.length > 0 || board.activity.length > 0;
  if (!left && !right) return null;
  return (
    <div className={left && right ? GRID : STACK}>
      {left && <ScopePanels board={board} parts={parts} checklist={checklist} />}
      {right && (
        <div className="flex min-w-0 flex-col gap-4">
          {rosters.map((roster) => (
            <RosterPanel key={roster.title} roster={roster} />
          ))}
          {board.activity.length > 0 && <ActivityPanel activity={board.activity} compact={parts.phone === "board-56m"} />}
        </div>
      )}
    </div>
  );
}

// Every other team seat (boards 40 and 52): the scope board's panels beside
// the recent activity, then their page on the site beside their roster (the
// roster on its own once every step of the page is done, issue #641). With
// no recent activity the panels take the whole width, so no empty column is
// left on the right (Owner decision, 2026-10-21).
function BoardFirst({ board, parts, panels }: BodyProps) {
  const { checklist, rosters } = panels;
  const left = hasScopePanels({ board, parts });
  const activity = board.activity.length > 0;
  return (
    <>
      {(left || activity) && (
        <div className={left && !activity ? STACK : GRID}>
          {left && <ScopePanels board={board} parts={parts} checklist={null} />}
          {activity && (
            <ActivityPanel activity={board.activity} compact={parts.phone === "board-56m"} className={left ? "" : "lg:col-start-2"} />
          )}
        </div>
      )}
      {(checklist !== null || rosters.length > 0) && (
        <div className={checklist !== null && rosters.length > 0 ? GRID : "mt-5 md:mt-6"}>
          {checklist !== null && <ChecklistPanel checklist={checklist} />}
          {rosters.length > 0 && (
            <div className="flex min-w-0 flex-col gap-4">
              {rosters.map((roster) => (
                <RosterPanel key={roster.title} roster={roster} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ActivityPanel({ activity, compact, className = "" }: { activity: readonly ActivityItem[]; compact: boolean; className?: string }) {
  return (
    <Panel title="Recent activity" className={`${className} ${compact ? "max-md:hidden" : ""}`}>
      {activity.map((item) => (
        <li key={`${item.text}-${item.when}`} className="flex items-start gap-3 px-5 py-3.5">
          {/* An activity item carries no person to read a photo off, so the row keeps the PRT mark it always drew. */}
          <Avatar size="sm" accent={item.self} person={null} />
          <span className="min-w-0">
            <span className="block text-[13px]">{item.text}</span>
            <span className="block text-[12px] text-prt-muted">{item.when}</span>
          </span>
        </li>
      ))}
    </Panel>
  );
}

// On board 56m each row is its own card, with no icon tile, the shorter
// title and a small filled pill. A hand-over waiting for the viewer (board
// 62c, issue #262) is the top row, on an accent tint with an accent icon
// tile, and answers with Decline and Confirm. An open alias request (board
// 94c, epic #538) follows it the same way, with Decline and Mark created.
// Below md, outside board 56m's cards, every row's buttons move under the
// text, Dismiss on a notice included, so the title and detail keep the row's
// width (issue #546); a detail with a long address wraps inside its column
// rather than running under a button. An alias notice draws the alias
// request's at-sign (boards 94c and 94f, issue #565).
function AttentionPanel({ attention, compact }: { attention: readonly AttentionItem[]; compact: boolean }) {
  return (
    <Panel title="Needs your attention" meta={attention.length === 1 ? "1 item" : `${attention.length} items`} phoneCards={compact}>
      {attention.map((item) => {
        const Icon = ATTENTION_ICONS[item.iconKind ?? item.kind];
        const handOver = item.kind === "hand-over" || item.kind === "alias-request";
        return (
          <li
            key={attentionKey(item)}
            className={`flex items-center gap-x-4 gap-y-3 px-4 py-3.5 md:px-5 ${handOver ? "bg-accent/[0.05] md:last:rounded-b-xl" : ""} ${compact ? "" : "max-md:flex-wrap"}`}
          >
            <span
              className={`h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                handOver ? "border-accent/30 bg-accent-soft text-accent" : "border-hairline bg-white-5 text-text-2"
              } ${compact ? "hidden md:flex" : "flex"}`}
            >
              <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              {compact && item.phoneTitle ? (
                <>
                  <span className="block text-[15px] font-semibold md:hidden">{item.phoneTitle}</span>
                  <span className="hidden text-[14px] font-medium md:block">{item.title}</span>
                </>
              ) : (
                <span className={`block ${compact ? "text-[15px] font-semibold md:text-[14px] md:font-medium" : "text-[14px] font-medium"}`}>
                  {item.title}
                </span>
              )}
              <span className="block break-words text-[13px] text-prt-muted">{item.detail}</span>
            </span>
            {compact ? (
              <>
                <span className="md:hidden">
                  <AttentionButton action={item.action} chip />
                </span>
                <span className="hidden md:block">
                  <AttentionButton action={item.action} />
                </span>
              </>
            ) : (
              <span className="flex shrink-0 max-md:basis-full max-md:pl-12">
                <AttentionButton action={item.action} />
              </span>
            )}
          </li>
        );
      })}
    </Panel>
  );
}

// Board 56: booked interviews under a date tile with their time on the right,
// then the ones waiting for the applicant to pick a time. Board 99b (issue
// #652) names who offered the times, "with Marco Bianchi", under the time.
// Board 56m: each one is its own card, with no tile, the time in a pill, and
// who offered it under the position.
function InterviewsPanel({ interviews }: { interviews: readonly UpcomingInterview[] }) {
  return (
    <Panel title="Upcoming interviews" meta={interviewSummary(interviews)} phoneCards>
      {interviewOrder(interviews).map((interview) => {
        const slot = interview.state === "booked" ? interviewSlot(interview.start, interview.end) : null;
        const setBy = interview.setBy === null ? null : `with ${interview.setBy}`;
        return (
          <li key={`${interview.applicant}-${interview.position}`} className="flex items-center gap-3.5 px-4 py-3.5 md:px-5">
            {slot ? (
              <span className="hidden h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent md:flex">
                <span className="text-[15px] font-bold leading-none">{slot.day}</span>
                <span className="mt-1 font-mono text-[9px] leading-none tracking-[0.15em]">{slot.month}</span>
              </span>
            ) : (
              <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white-5 text-text-2 md:flex">
                <Hourglass aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold md:text-[14px] md:font-medium">{interview.applicant}</span>
              <span className="block truncate text-[13px] text-prt-muted">{interview.position}</span>
              {setBy && <span className="block truncate text-[12px] text-prt-muted md:hidden">{setBy}</span>}
            </span>
            <span className="hidden shrink-0 flex-col items-end text-right md:flex">
              {slot ? (
                <span className="text-[13px] font-semibold tabular-nums">{slot.when}</span>
              ) : (
                <span className="text-[13px] text-prt-muted">Waiting for a time</span>
              )}
              {setBy && <span className="text-[12px] text-prt-muted">{setBy}</span>}
            </span>
            {slot ? (
              <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[12px] tabular-nums text-accent md:hidden">{slot.short}</span>
            ) : (
              <span className="shrink-0 rounded-md bg-white-10 px-2 py-0.5 text-[12px] text-text-2 md:hidden">No time yet</span>
            )}
          </li>
        );
      })}
    </Panel>
  );
}

// Board 62: one row per division, its initials on an accent tile, who leads
// it and how many people it has, and what waits there on the right. Board
// 62m: each division is its own card, its initials in a small mono tag, the
// leads on one line and the counts on the next, and a tap opens its
// Positions tab.
function DivisionsPanel({ divisions, people }: { divisions: readonly DivisionSummary[]; people: number }) {
  return (
    <Panel title="Divisions" meta={divisionsMeta(divisions, people)} phoneMeta={String(divisions.length)} phoneCards>
      {divisions.map((division) => {
        const lead = leadsLabel(division.leads);
        const leads = lead === null ? "No lead yet" : `${lead} ${division.leads.join(", ")}`;
        const counts = waitingCounts(division);
        return (
          <li key={division.id}>
            <Link
              href={`/dashboard/positions?division=${division.id}`}
              className={`flex items-center gap-4 rounded-xl px-4 py-3.5 transition-colors duration-300 ease-out hover:bg-white-5 md:rounded-none md:px-5 ${FOCUS} focus-visible:-outline-offset-2`}
            >
              <span
                aria-hidden
                className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-[14px] font-semibold text-accent md:flex"
              >
                {divisionInitials(division.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="rounded bg-white-10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-text-2 md:hidden">
                    {divisionInitials(division.name)}
                  </span>
                  <span className="block truncate text-[16px] font-semibold md:hidden">{divisionShortName(division.name)}</span>
                  <span className="hidden truncate text-[14px] font-medium md:block">{division.name}</span>
                </span>
                <span className="mt-1 block truncate text-[13px] text-prt-muted md:mt-0">
                  <span className="md:hidden">{lead === null ? leads : `${lead} · ${division.leads.join(", ")}`}</span>
                  <span className="hidden md:inline">
                    {leads} · {rosterSize(division.people)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-text-2 md:hidden">
                  {rosterSize(division.people)} · {counts}
                </span>
              </span>
              <span className="hidden shrink-0 text-[13px] font-semibold tabular-nums md:block">{counts}</span>
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-prt-muted md:hidden" strokeWidth={1.75} />
            </Link>
          </li>
        );
      })}
    </Panel>
  );
}

// Board 72: one row per department, its initials on an accent tile, who
// heads it, its divisions and people, and what waits there on the right.
function DepartmentsPanel({ departments, people }: { departments: readonly DepartmentSummary[]; people: number }) {
  return (
    <Panel title="Departments" meta={departmentsMeta(departments.length, people)} phoneMeta={String(departments.length)} phoneCards>
      {departments.map((department) => (
        <li key={department.id} className="flex items-center gap-4 px-4 py-3.5 md:px-5">
          <span
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-[14px] font-semibold text-accent"
          >
            {divisionInitials(department.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold md:text-[14px] md:font-medium">{departmentLabel(department.name)}</span>
            <span className="block truncate text-[13px] text-prt-muted">{departmentLine(department)}</span>
            <span className="mt-0.5 block text-[13px] text-text-2 md:hidden">{waitingCounts(department)}</span>
          </span>
          <span className="hidden shrink-0 text-[13px] font-semibold tabular-nums md:block">{waitingCounts(department)}</span>
        </li>
      ))}
    </Panel>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What waits in a unit, in words: "2 new applications · 1 open position" (Owner decision, 2026-10-21). */
function waitingCounts({ newApplications, openPositions }: { newApplications: number; openPositions: number }): string {
  return `${plural(newApplications, "new application", "new applications")} · ${plural(openPositions, "open position", "open positions")}`;
}

/** A link to the page that handles the row, or Dismiss on a stored notice. */
function AttentionButton({ action, chip = false }: { action: AttentionAction; chip?: boolean }) {
  if (isAnswerHandOver(action)) return <AnswerHandOver requestId={action.answerHandOver} chip={chip} />;
  if (isAnswerAlias(action)) return <AnswerAlias action={action} chip={chip} />;
  return isDismissNotice(action) ? (
    <DismissNotice noticeId={action.dismissNotice} label={action.label} chip={chip} />
  ) : (
    <RowAction {...action} chip={chip} />
  );
}

/** A notice, a hand-over or an alias request by its id: two of them may read alike. */
function attentionKey(item: AttentionItem): string {
  if (isAnswerHandOver(item.action)) return `hand-over-${item.action.answerHandOver}`;
  if (isAnswerAlias(item.action)) return `alias-${item.action.answerAlias}`;
  return isDismissNotice(item.action) ? `notice-${item.action.dismissNotice}` : item.title;
}

const ATTENTION_ICONS: Readonly<Record<AttentionKind, LucideIcon>> = {
  "acceptance-emails": Mail,
  applications: Inbox,
  "quiet-position": Timer,
  unassigned: UserPlus,
  "no-photo": Timer,
  notice: UserMinus,
  "orders-to-decide": ShoppingCart,
  "approved-orders": Package,
  "hand-over": ArrowRightLeft,
  "alias-request": AtSign,
};

function StatCard({ stat, compact, hiddenOnPhone }: { stat: Stat; compact: boolean; hiddenOnPhone: boolean }) {
  return (
    <div className={`${PANEL} px-4 pb-4 pt-5 md:px-5 md:pb-5 md:pt-6 ${hiddenOnPhone ? "max-md:hidden" : ""}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{stat.label}</p>
      <p className="mt-2 flex items-center gap-2.5 text-[24px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">
        {stat.live && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" />}
        {stat.value}
      </p>
      <p className={`mt-1.5 text-[13px] text-text-2 ${compact ? "max-md:hidden" : ""}`}>{stat.detail}</p>
    </div>
  );
}

// Issues #480 and #593: each grant the viewer holds, one linked row each.
// Counts only; the names stay on each area's own page.
function AccessPanel({ access }: { access: readonly AccessSummary[] }) {
  return (
    <Panel title="Your access" className="mt-5 md:mt-6">
      {access.map((summary) => (
        <li key={summary.area}>
          <Link href={summary.href} className={ROW_LINK}>
            <span className="min-w-0 flex-1 text-[14px]">
              <span className="font-medium">{ACCESS_AREA_LABELS[summary.area]}</span>
              <span className="text-prt-muted"> · {accessCounts(summary)}</span>
            </span>
            <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
          </Link>
        </li>
      ))}
    </Panel>
  );
}

function ChecklistPanel({ checklist }: { checklist: Checklist }) {
  return (
    <Panel title={checklist.title} detail={checklist.detail} phoneMeta={checklistCount(checklist.items)}>
      {checklist.items.map((item) => (
        <li key={item.label} className="flex items-center gap-4 px-4 py-3 md:px-5">
          {item.done ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <Check aria-label="Done" className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          ) : (
            <span aria-label="To do" role="img" className="h-6 w-6 shrink-0 rounded-full border border-border-strong" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">{item.label}</span>
            <span className="block break-words text-[13px] text-prt-muted">{item.detail}</span>
          </span>
          {item.action && <RowAction {...item.action} />}
        </li>
      ))}
    </Panel>
  );
}

// Board 99b (issue #652): at most six people of the viewer's own division or
// department, then "See all N on Members" to the Members page when they reach it.
function RosterPanel({ roster }: { roster: Roster }) {
  return (
    <Panel title={roster.title} detail={roster.detail} phoneMeta={rosterSize(roster.size)}>
      {roster.people.map((p, index) => (
        <li
          key={p.name}
          className={`flex items-center gap-3 px-4 py-2.5 md:px-5 ${p.self ? "max-md:bg-accent/[0.08]" : ""} ${
            p.self && index === roster.people.length - 1 && roster.seeAll === null ? "max-md:rounded-b-xl" : ""
          }`}
        >
          <Avatar size="sm" accent={p.lead} person={p} />
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-medium">{p.name}</span>
            <span className="block text-[12px] text-prt-muted">
              {p.self ? (
                <>
                  <span className="md:hidden">{p.role}</span>
                  <span className="hidden md:inline">You</span>
                </>
              ) : (
                p.role
              )}
            </span>
          </span>
          {p.self && <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-accent md:hidden">YOU</span>}
        </li>
      ))}
      {roster.seeAll && (
        <li>
          <FootLink {...roster.seeAll} />
        </li>
      )}
    </Panel>
  );
}

/** The person at the top of their own Overview: framed from md, on the page on phones (boards 52m, 50e-m). */
const PERSON_FRAME =
  "flex flex-col gap-4 sm:flex-row sm:items-center md:rounded-xl md:border md:border-hairline md:bg-panel/60 md:px-6 md:py-6";

// The circle shows their stored photo, else the PRT mark (issues #599 and
// #656), on every Overview: a team seat's, an applicant's and an alumnus's.
function PersonLines({ person, since }: { person: Pictured & { readonly name: string; readonly line: string }; since: string | null }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-5">
      <Avatar size="person" person={person} />
      <div className="min-w-0">
        <h1 className="text-[20px] font-bold leading-tight tracking-[-0.01em] md:text-[24px]">{person.name}</h1>
        <p className="mt-1 break-words text-[14px] text-text-2">{person.line}</p>
        {since && <p className="mt-0.5 text-[12px] text-prt-muted">{since}</p>}
      </div>
    </div>
  );
}

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const ROW_LINK = `flex items-center gap-4 px-4 py-3.5 transition-colors duration-300 ease-out hover:bg-white-5 md:px-5 ${FOCUS} focus-visible:-outline-offset-2`;
const ARROW = "opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100";

// Board 50e: the applicant, then what waits on them and their applications,
// full width, with no open positions (issue #317). Board 50f: with nothing
// shown, the panel that says so and how long an application stays. Board
// 50e-m: the person on the page, the Next step button full width under its
// text, and "Open My applications" at the foot of its panel.
function ApplicantView({ overview }: { overview: ApplicantOverview }) {
  const { person, nextStep, applications } = overview;
  return (
    <>
      <section className={PERSON_FRAME}>
        <PersonLines person={person} since={null} />
      </section>
      <div className={STACK}>
        {nextStep && <NextStepCard step={nextStep} />}
        {applications.kind === "rows" ? <ApplicantApplications applications={applications} /> : <NoApplicationsPanel />}
      </div>
    </>
  );
}

function NoApplicationsPanel() {
  return (
    <Panel title={NO_APPLICATIONS.title} detail={NO_APPLICATIONS.detail}>
      <li className="px-4 py-3.5 text-[13px] text-prt-muted md:px-5">{SHOWN_FOR_A_MONTH}</li>
    </Panel>
  );
}

// Issue #317's board 56: who the alumnus was on the team, then whether the
// Alumni page lists them, with the way to My alumni. While one of their
// applications is shown it follows, as on an applicant's Overview.
function AlumniView({ overview }: { overview: AlumniOverview }) {
  const { person, card, nextStep, applications } = overview;
  return (
    <>
      <section className={PERSON_FRAME}>
        <PersonLines person={person} since={null} />
      </section>
      <div className={STACK}>
        <AlumniCardPanel card={card} />
        {nextStep && <NextStepCard step={nextStep} />}
        {applications && <ApplicantApplications applications={applications} />}
      </div>
    </>
  );
}

function AlumniCardPanel({ card }: { card: AlumniCard }) {
  return (
    <Panel title={card.title} detail={card.detail}>
      <li>
        <FootLink {...card.link} />
      </li>
    </Panel>
  );
}

function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section
      aria-label="Next step"
      className="flex flex-col gap-4 rounded-xl border border-accent bg-accent/[0.06] p-4 md:flex-row md:items-center md:px-5 md:py-5"
    >
      <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent md:flex">
        <CalendarClock aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">Next step</p>
        <h2 className="mt-1.5 text-[16px] font-semibold leading-snug md:mt-1">{step.title}</h2>
        <p className="mt-1.5 text-[14px] text-text-2 md:mt-0.5 md:text-[13px]">{step.detail}</p>
      </div>
      <Link
        href={step.action.href}
        className={`inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-accent px-5 text-[14px] font-semibold text-accent-on-accent transition-colors duration-300 ease-out hover:bg-accent-hover md:h-10 ${FOCUS}`}
      >
        {step.action.label}
      </Link>
    </section>
  );
}

const PILL_TONES: Readonly<Record<ApplicantPill, string>> = {
  received: "bg-white-10 text-text-2",
  "in-review": "bg-white-10 text-text-2",
  interview: "bg-accent-soft text-accent",
  accepted: "bg-success-soft text-success",
  "not-selected": "bg-white-5 text-prt-muted",
};

function ApplicantApplications({ applications }: { applications: Extract<ApplicantApplicationsPanel, { kind: "rows" }> }) {
  const all = { label: "Open My applications", href: "/dashboard/my-applications" };
  return (
    <Panel
      title="Your applications"
      detail={applications.summary}
      meta={
        <Link href={all.href} className={`group hidden items-center gap-1.5 text-text-2 transition-colors duration-300 ease-out hover:text-accent md:inline-flex ${FOCUS}`}>
          {all.label}
          <RocketArrow className={ARROW} />
        </Link>
      }
    >
      {applications.rows.map((row) => (
        <li key={row.id}>
          <Link href={row.href} className={ROW_LINK}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-medium md:text-[14px]">{row.title}</span>
              <span className="block truncate text-[13px] text-prt-muted">
                {row.unit}
                <span className="hidden md:inline"> · sent {sentLabel(row.sent)}</span>
              </span>
            </span>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] ${PILL_TONES[row.pill]}`}>
              {APPLICANT_PILL_LABELS[row.pill]}
            </span>
            <ChevronRight aria-hidden className="hidden h-4 w-4 shrink-0 text-prt-muted md:block" strokeWidth={1.75} />
          </Link>
        </li>
      ))}
      <li className="md:hidden">
        <FootLink {...all} />
      </li>
    </Panel>
  );
}

function FootLink({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-1.5 px-4 py-3.5 text-[14px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover md:px-5 md:text-[13px] ${FOCUS} focus-visible:-outline-offset-2`}
    >
      {label}
      <RocketArrow className={ARROW} />
    </Link>
  );
}
