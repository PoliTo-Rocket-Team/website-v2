import Link from "next/link";
import { Check, FileText, Hourglass, Inbox, Info, Pencil, Timer, UserPlus, type LucideIcon } from "lucide-react";
import {
  interviewOrder,
  interviewSlot,
  interviewSummary,
  type ActivityItem,
  type ApplicationStatus,
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
import { PANEL, Panel, RowAction } from "./panel";

// The Overview page: board 40 for the operations lead, 56 for a division
// lead, 52 for a member. Props in, nothing fetched: the page hands over what
// the dashboard data interface answered.
export function OverviewView({ overview }: { overview: Overview }) {
  switch (overview.shape) {
    case "team":
      return <LeadView stats={overview.stats} attention={overview.attention} interviews={[]} activity={overview.activity} />;
    case "division":
      return (
        <LeadView
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

// Boards 40 and 56: four figures, then what needs the lead's attention (and,
// on 56, the upcoming interviews under it) beside the recent activity.
function LeadView({
  stats,
  attention,
  interviews,
  activity,
}: {
  stats: readonly Stat[];
  attention: readonly AttentionItem[];
  interviews: readonly UpcomingInterview[];
  activity: readonly ActivityItem[];
}) {
  const left = attention.length > 0 || interviews.length > 0;
  return (
    <>
      <h1 className="sr-only">Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} stat={stat} />
        ))}
      </div>
      {(left || activity.length > 0) && (
        <div className={GRID}>
          {left && (
            <div className="flex min-w-0 flex-col gap-4">
              {attention.length > 0 && <AttentionPanel attention={attention} />}
              {interviews.length > 0 && <InterviewsPanel interviews={interviews} />}
            </div>
          )}
          {activity.length > 0 && (
            <Panel title="Recent activity" className={left ? "" : "lg:col-start-2"}>
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

function AttentionPanel({ attention }: { attention: readonly AttentionItem[] }) {
  return (
    <Panel title="Needs your attention" meta={attention.length === 1 ? "1 item" : `${attention.length} items`}>
      {attention.map((item) => {
        const Icon = ATTENTION_ICONS[item.kind];
        return (
          <li key={item.title} className="flex items-center gap-4 px-5 py-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white-5 text-text-2">
              <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">{item.title}</span>
              <span className="block text-[13px] text-prt-muted">{item.detail}</span>
            </span>
            <RowAction {...item.action} />
          </li>
        );
      })}
    </Panel>
  );
}

// Board 56: booked interviews under a date tile with their time on the right,
// then the ones waiting for the applicant to pick a time.
function InterviewsPanel({ interviews }: { interviews: readonly UpcomingInterview[] }) {
  return (
    <Panel title="Upcoming interviews" meta={interviewSummary(interviews)}>
      {interviewOrder(interviews).map((interview) => {
        const slot = interview.state === "booked" ? interviewSlot(interview.start, interview.end) : null;
        return (
          <li key={`${interview.applicant}-${interview.position}`} className="flex items-center gap-3.5 px-5 py-3.5">
            {slot ? (
              <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
                <span className="text-[15px] font-bold leading-none">{slot.day}</span>
                <span className="mt-1 font-mono text-[9px] leading-none tracking-[0.15em]">{slot.month}</span>
              </span>
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-hairline bg-white-5 text-text-2">
                <Hourglass aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium">{interview.applicant}</span>
              <span className="block truncate text-[13px] text-prt-muted">{interview.position}</span>
            </span>
            {slot ? (
              <span className="shrink-0 text-right text-[13px] font-semibold tabular-nums">{slot.when}</span>
            ) : (
              <span className="shrink-0 text-right text-[13px] text-prt-muted">Waiting for a time</span>
            )}
          </li>
        );
      })}
    </Panel>
  );
}

const ATTENTION_ICONS: Readonly<Record<AttentionKind, LucideIcon>> = {
  applications: Inbox,
  "quiet-position": Timer,
  unassigned: UserPlus,
  "no-photo": Timer,
};

function StatCard({ stat }: { stat: Stat }) {
  return (
    <div className={`${PANEL} px-4 pb-4 pt-5 md:px-5 md:pb-5 md:pt-6`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{stat.label}</p>
      <p className="mt-2 flex items-center gap-2.5 text-[24px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">
        {stat.live && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full bg-success" />}
        {stat.value}
      </p>
      <p className="mt-1.5 text-[13px] text-text-2">{stat.detail}</p>
    </div>
  );
}

// Board 40m: who the viewer is, then their own panels (their page on the
// site and their division, or their applications), then the access hint.
function PersonalView({ overview }: { overview: PersonalOverview }) {
  const { person, checklist, roster, applications, hint } = overview;
  const main = checklist ? <ChecklistPanel checklist={checklist} /> : applications ? <ApplicationsPanel applications={applications} /> : null;
  return (
    <>
      <section className={`${PANEL} flex flex-col gap-4 p-5 sm:flex-row sm:items-center md:px-6 md:py-6`}>
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-5">
          <Avatar name={person.name} size="lg" />
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold leading-tight tracking-[-0.01em] md:text-[24px]">{person.name}</h1>
            <p className="mt-1 text-[14px] text-text-2">{person.line}</p>
            {person.since && <p className="mt-0.5 text-[12px] text-prt-muted">{person.since}</p>}
          </div>
        </div>
        {person.edit && (
          <Link
            href={person.edit.href}
            className="inline-flex h-9 items-center gap-2 self-start rounded-full bg-prt-text px-4 text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:self-center"
          >
            <Pencil aria-hidden className="h-4 w-4" strokeWidth={2} />
            {person.edit.label}
          </Link>
        )}
      </section>

      {(main || roster) && (
        <div className={roster ? GRID : "mt-6"}>
          {main}
          {roster && <RosterPanel roster={roster} />}
        </div>
      )}

      {hint && (
        <p className={`${PANEL} mt-6 flex items-start gap-2.5 px-4 py-2.5 text-[13px] text-text-2`}>
          <Info aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={1.75} />
          {hint}
        </p>
      )}
    </>
  );
}

function ChecklistPanel({ checklist }: { checklist: Checklist }) {
  return (
    <Panel title={checklist.title} detail={checklist.detail}>
      {checklist.items.map((item) => (
        <li key={item.label} className="flex items-center gap-4 px-5 py-3">
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
    <Panel title={roster.title} detail={roster.detail}>
      {roster.people.map((p) => (
        <li key={p.name} className="flex items-center gap-3 px-5 py-2.5">
          <Avatar name={p.name} size="sm" accent={p.lead} />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">{p.name}</span>
            <span className="block text-[12px] text-prt-muted">{p.role}</span>
          </span>
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
