import Link from "next/link";
import { Check, FileText, Hourglass, Inbox, Info, Pencil, Timer, UserMinus, UserPlus, type LucideIcon } from "lucide-react";
import {
  checklistCount,
  interviewOrder,
  interviewSlot,
  interviewSummary,
  rosterSize,
  type ActivityItem,
  type ApplicationStatus,
  isDismissNotice,
  type AttentionAction,
  type AttentionItem,
  type AttentionKind,
  type Checklist,
  type OwnApplication,
  type Overview,
  type PersonalOverview,
  type Roster,
  type Stat,
  type UpcomingInterview,
} from "@/lib/dashboard/overview";
import { Avatar } from "./avatar";
import { DismissNotice } from "./dismiss-notice";
import { PANEL, Panel, RowAction } from "./panel";

// The Overview page: board 40 for the operations lead, 56 for a division
// lead, 52 for a member. Props in, nothing fetched: the page hands over what
// the dashboard data interface answered.
export function OverviewView({ overview }: { overview: Overview }) {
  switch (overview.shape) {
    case "team":
      return (
        <LeadView
          stats={overview.stats}
          attention={overview.attention}
          interviews={[]}
          activity={overview.activity}
          phone="full"
        />
      );
    case "division":
      return (
        <LeadView
          phone="board-56m"
          stats={overview.stats}
          attention={overview.attention}
          interviews={overview.interviews}
          activity={overview.activity}
        />
      );
    case "personal":
      return <PersonalView overview={overview} />;
  }
}

const GRID = "mt-6 grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]";

/**
 * How the lead's Overview reads on phones: board 40m keeps everything; board
 * 56m keeps the first two figures without their detail line, the attention
 * rows and the interviews as stacked cards, and no recent activity.
 */
type LeadPhoneForm = "full" | "board-56m";

// Boards 40 and 56: four figures, then what needs the lead's attention (and,
// on 56, the upcoming interviews under it) beside the recent activity.
function LeadView({
  stats,
  attention,
  interviews,
  activity,
  phone,
}: {
  stats: readonly Stat[];
  attention: readonly AttentionItem[];
  interviews: readonly UpcomingInterview[];
  activity: readonly ActivityItem[];
  phone: LeadPhoneForm;
}) {
  const compact = phone === "board-56m";
  const left = attention.length > 0 || interviews.length > 0;
  return (
    <>
      <h1 className="sr-only">Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={stat.label} stat={stat} compact={compact} hiddenOnPhone={compact && index >= 2} />
        ))}
      </div>
      {(left || activity.length > 0) && (
        <div className={GRID}>
          {left && (
            <div className="flex min-w-0 flex-col gap-4">
              {attention.length > 0 && <AttentionPanel attention={attention} compact={compact} />}
              {interviews.length > 0 && <InterviewsPanel interviews={interviews} />}
            </div>
          )}
          {activity.length > 0 && (
            <Panel title="Recent activity" className={`${left ? "" : "lg:col-start-2"} ${compact ? "max-md:hidden" : ""}`}>
              {activity.map((item) => (
                <li key={`${item.text}-${item.when}`} className="flex items-start gap-3 px-5 py-3.5">
                  <Avatar name={item.actor} size="sm" accent={item.self} />
                  <span className="min-w-0">
                    <span className="block text-[13px]">{item.text}</span>
                    <span className="block text-[12px] text-prt-muted">{item.when}</span>
                  </span>
                </li>
              ))}
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

// On board 56m each row is its own card, with no icon tile, the shorter
// title and a small filled pill.
function AttentionPanel({ attention, compact }: { attention: readonly AttentionItem[]; compact: boolean }) {
  return (
    <Panel title="Needs your attention" meta={attention.length === 1 ? "1 item" : `${attention.length} items`} phoneCards={compact}>
      {attention.map((item) => {
        const Icon = ATTENTION_ICONS[item.kind];
        return (
          <li key={attentionKey(item)} className="flex items-center gap-4 px-4 py-3.5 md:px-5">
            <span
              className={`h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white-5 text-text-2 ${
                compact ? "hidden md:flex" : "flex"
              }`}
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
              <span className="block text-[13px] text-prt-muted">{item.detail}</span>
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
              <AttentionButton action={item.action} />
            )}
          </li>
        );
      })}
    </Panel>
  );
}

// Board 56: booked interviews under a date tile with their time on the right,
// then the ones waiting for the applicant to pick a time. Board 56m: each one
// is its own card, with no tile and the time in a pill.
function InterviewsPanel({ interviews }: { interviews: readonly UpcomingInterview[] }) {
  return (
    <Panel title="Upcoming interviews" meta={interviewSummary(interviews)} phoneCards>
      {interviewOrder(interviews).map((interview) => {
        const slot = interview.state === "booked" ? interviewSlot(interview.start, interview.end) : null;
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
            </span>
            {slot ? (
              <>
                <span className="hidden shrink-0 text-right text-[13px] font-semibold tabular-nums md:block">{slot.when}</span>
                <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[12px] tabular-nums text-accent md:hidden">
                  {slot.short}
                </span>
              </>
            ) : (
              <>
                <span className="hidden shrink-0 text-right text-[13px] text-prt-muted md:block">Waiting for a time</span>
                <span className="shrink-0 rounded-md bg-white-10 px-2 py-0.5 text-[12px] text-text-2 md:hidden">No time yet</span>
              </>
            )}
          </li>
        );
      })}
    </Panel>
  );
}

/** A link to the page that handles the row, or Dismiss on a stored notice. */
function AttentionButton({ action, chip = false }: { action: AttentionAction; chip?: boolean }) {
  return isDismissNotice(action) ? (
    <DismissNotice noticeId={action.dismissNotice} label={action.label} chip={chip} />
  ) : (
    <RowAction {...action} chip={chip} />
  );
}

/** A notice by its id: two notices may read alike. */
function attentionKey(item: AttentionItem): string {
  return isDismissNotice(item.action) ? `notice-${item.action.dismissNotice}` : item.title;
}

const ATTENTION_ICONS: Readonly<Record<AttentionKind, LucideIcon>> = {
  applications: Inbox,
  "quiet-position": Timer,
  unassigned: UserPlus,
  "no-photo": Timer,
  notice: UserMinus,
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

// Boards 40m and 52: who the viewer is, then their own panels (their page on
// the site and their division, or their applications), then the access hint.
// Board 52m: the person sits on the page with no frame and no edit button
// (My profile is in the user menu), each panel's count moves beside its title,
// and the hint is left out.
function PersonalView({ overview }: { overview: PersonalOverview }) {
  const { person, checklist, roster, applications, hint } = overview;
  const main = checklist ? <ChecklistPanel checklist={checklist} /> : applications ? <ApplicationsPanel applications={applications} /> : null;
  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center md:rounded-xl md:border md:border-hairline md:bg-panel/60 md:px-6 md:py-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-5">
          <Avatar name={person.name} size="person" />
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-tight tracking-[-0.01em] md:text-[24px]">{person.name}</h1>
            <p className="mt-1 text-[14px] text-text-2">{person.line}</p>
            {person.since && <p className="mt-0.5 text-[12px] text-prt-muted">{person.since}</p>}
          </div>
        </div>
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

      {(main || roster) && (
        <div className={roster ? GRID : "mt-5 md:mt-6"}>
          {main}
          {roster && <RosterPanel roster={roster} />}
        </div>
      )}

      {hint && (
        <p className={`${PANEL} mt-6 items-start gap-2.5 px-4 py-2.5 text-[13px] text-text-2 max-md:hidden md:flex`}>
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={1.75} />
          {hint}
        </p>
      )}
    </>
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

function RosterPanel({ roster }: { roster: Roster }) {
  return (
    <Panel title={roster.title} detail={roster.detail} phoneMeta={rosterSize(roster.size)}>
      {roster.people.map((p) => (
        <li
          key={p.name}
          className={`flex items-center gap-3 px-4 py-2.5 md:px-5 ${p.self ? "max-md:rounded-b-xl max-md:bg-accent/[0.08]" : ""}`}
        >
          <Avatar name={p.name} size="sm" accent={p.lead} />
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
    </Panel>
  );
}

const STATUS: Readonly<Record<ApplicationStatus, { label: string; className: string }>> = {
  received: { label: "Received", className: "bg-white-10 text-text-2" },
  "in-review": { label: "In review", className: "bg-accent-soft text-accent" },
  accepted: { label: "Accepted", className: "bg-success-soft text-success" },
  declined: { label: "Declined", className: "bg-white-5 text-prt-muted" },
};

function ApplicationsPanel({ applications }: { applications: readonly OwnApplication[] }) {
  return (
    <Panel title="Your applications" meta={<Link href="/apply" className="transition-colors duration-300 ease-out hover:text-accent">See open positions</Link>}>
      {applications.map((a) => (
        <li key={a.title} className="flex items-center gap-4 px-5 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white-5 text-text-2">
            <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium">{a.title}</span>
            <span className="block text-[13px] text-prt-muted">{a.detail}</span>
          </span>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] ${STATUS[a.status].className}`}>
            {STATUS[a.status].label}
          </span>
        </li>
      ))}
    </Panel>
  );
}
