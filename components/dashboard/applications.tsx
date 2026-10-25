"use client";

import { useEffect, useOptimistic, useState, useTransition, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, CalendarClock, CalendarPlus, Check, ExternalLink, FileCheck2, FileText, MailCheck, Signature, Undo2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { moveApplication } from "@/app/dashboard/recruitment-actions";
import {
  APPLICATION_TABS,
  applyMove,
  dayMonth,
  firstNameOf,
  icsFileName,
  interviewIcs,
  memberDivisionNames,
  PROGRESS_STEPS,
  progressOf,
  pronounsOf,
  slotBadge,
  slotDayTime,
  slotRange,
  STATUS_NAMES,
  statusPill,
  studiesLine,
  takenByJoinElsewhere,
  type AcceptedStatus,
  type ApplicationState,
  type SlotTime,
  type LeadMove,
  type LeadMoveKind,
  type LeadStep,
  type Pronouns,
} from "@/lib/dashboard/application-flow";
import { applicantSections, type ApplicantField } from "@/lib/dashboard/applicant-details";
import {
  APPLICATION_FILTER_LABELS,
  applicationColumnOptions,
  clearApplicationPicks,
  NO_APPLICATION_PICKS,
  toggleApplicationPick,
  withApplicationPicks,
  type ApplicationFilter,
  type ApplicationPicks,
} from "@/lib/dashboard/application-columns";
import {
  APPLICATIONS_SORTS,
  applicationsModelOf,
  divisionOptions,
  NO_APPLICATIONS_FILTER,
  panelStepsOf,
  shownApplications,
  type ApplicationsFilter,
  type ApplicationsTool,
} from "@/lib/dashboard/applications-view";
import { shortUnitName } from "@/lib/dashboard/division-access";
import { documentsLine, type ApplicationEntry, type ApplicationsPage, type OtherApplication, type PositionRef } from "@/lib/dashboard/recruitment";
import { divisionLabel } from "@/lib/dashboard/team";
import { Avatar } from "./avatar";
import { ColumnFilter } from "./column-filter";
import { FilterMenu, Segmented } from "./controls";
import { SearchField } from "./search-field";
import { DecisionDialog, NextSteps } from "./decision-dialog";
import { InterviewDialog } from "./interview-dialog";
import { PANEL } from "./panel";
import { ICON_BUTTON, PhoneTopBar } from "./shell";
import { StatusPill, StatusTag, toneDot, toneSurface } from "./stage-pill";

// The Applications page (Dashboard v2 boards 58b, 58 to 58i and 97 to 97e,
// and phone boards 58m and 58d-m, issues #171 and #749): the status tabs, the
// position filter, the list, and the detail panel of the chosen application
// with its action buttons. Props in, nothing fetched. Every button goes
// through the dashboard's server action; which buttons a status offers, and
// the status each sets, is lib/dashboard/application-flow.ts's alone, and the
// page shows the result at once. Where the viewer may not move an
// application (`canChange` false, issue #577) the same panel shows its
// status and no button.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The detail panel and the room the list leaves for it are one pair (board 58):
// the panel is 460px wide, and the list card ends 28px before it. The shell's
// main already pads 40px on the right, so the list adds 460 + 28 - 40 = 448px.
// Below xl the content column is too narrow to share, so the panel lies over it.
const PANEL_WIDTH = "md:w-[460px]";
const ROOM_FOR_PANEL = "xl:mr-[448px]";

// Documents and Applied are the narrow columns: each keeps room for its whole header name and
// its column filter (issue #428), so the name is never cut. The wider columns give way.
const COLUMNS_FULL = "grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(108px,0.65fr)_minmax(92px,0.55fr)]";
const COLUMNS_NARROW = "grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(92px,0.5fr)]";

export function ApplicationsView({
  page,
  initialPosition,
  lead,
}: {
  page: ApplicationsPage;
  initialPosition: PositionRef | null;
  /** The viewer's name: the interview email is signed with it. */
  lead: string;
}) {
  const [states, setState] = useOptimistic(
    Object.fromEntries(page.applications.map((a) => [a.id, a.state])) as Record<number, ApplicationState>,
    (current, change: { id: number; state: ApplicationState }) => ({ ...current, [change.id]: change.state }),
  );
  const [pending, startTransition] = useTransition();
  // Every role's page starts on all departments, all divisions and all stages, newest first.
  const [filter, setFilter] = useState<ApplicationsFilter>({ ...NO_APPLICATIONS_FILTER, position: initialPosition });
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [picks, setPicks] = useState<ApplicationPicks>(NO_APPLICATION_PICKS);
  const [filterOpen, setFilterOpen] = useState<ApplicationFilter | null>(null);

  // One toolbar for every role (issue #416): only the rows, and so the options, differ.
  const model = applicationsModelOf(page);
  const has = (tool: ApplicationsTool) => model.tools.includes(tool);
  const narrow = (change: Partial<ApplicationsFilter>) => setFilter((f) => ({ ...f, ...change }));
  const applications = page.applications.map((a) => ({ ...a, state: states[a.id] ?? a.state }));
  const shown = shownApplications(page, model.units, applications, filter);
  const rows = shown.rows;
  // The desktop table's column filters narrow what the toolbar leaves; phones list cards of the toolbar's rows, as Members does.
  const tableRows = withApplicationPicks(rows, picks);
  const chosen = applications.find((a) => a.id === chosenId) ?? null;

  // The popover hangs fixed under its header, so a page scroll closes it, as the Members table's scroll does.
  useEffect(() => {
    if (filterOpen === null) return;
    const close = () => setFilterOpen(null);
    window.addEventListener("scroll", close, { passive: true });
    return () => window.removeEventListener("scroll", close);
  }, [filterOpen]);

  /** A header name and its one column filter: the Studies column's holds two fields, its program and its level. */
  const header = (name: string, [first, ...more]: readonly [ApplicationFilter, ...ApplicationFilter[]]) => {
    const ticks = (column: ApplicationFilter) => ({
      options: applicationColumnOptions(rows, picks, column),
      ticked: picks[column] ?? [],
      onToggle: (value: string) => setPicks((p) => toggleApplicationPick(p, column, value)),
    });
    const fields =
      more.length === 0
        ? ticks(first)
        : { sections: [first, ...more].map((column) => ({ title: APPLICATION_FILTER_LABELS[column], ...ticks(column) })) };
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <span aria-hidden="true" className="shrink-0 whitespace-nowrap">
          {name}
        </span>
        <ColumnFilter
          label={more.length === 0 ? APPLICATION_FILTER_LABELS[first] : name}
          {...fields}
          onClear={() => setPicks((p) => [first, ...more].reduce(clearApplicationPicks, p))}
          open={filterOpen === first}
          onOpenChange={(next) => setFilterOpen(next ? first : null)}
        />
      </span>
    );
  };

  /** Shows the step at once, then saves it; a refusal puts the row back and says why. */
  const move = (application: ApplicationEntry, step: LeadMove, done?: () => void) =>
    startTransition(async () => {
      const result = applyMove(application.state, step, new Date(page.now));
      if (result.ok) setState({ id: application.id, state: result.state });
      const saved = await moveApplication(application.id, step);
      if (!saved.ok) toast.error(saved.error);
      else done?.();
    });

  // Opening an application never changes its status (ruling R1.2 on #745).
  const choose = (application: ApplicationEntry) => setChosenId(application.id);

  return (
    <div className={chosen ? ROOM_FOR_PANEL : ""}>
      {/* On phones the shell's top bar carries the title (board 58m). */}
      <header className="max-md:sr-only">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em]">Applications</h1>
        <p className="mt-1 hidden text-[14px] text-prt-muted md:block">
          {model.intro}
        </p>
      </header>

      <div className="flex flex-col gap-3 md:mt-6 md:flex-row md:flex-wrap md:items-center">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {has("department-filter") && (
            <FilterMenu
              label="Department"
              allLabel="All departments"
              value={filter.department}
              onChange={(department) => narrow({ department })}
              options={model.units.map((u) => ({ value: u.name, label: u.name }))}
            />
          )}
          {has("division-filter") && (
            <FilterMenu
              label="Division"
              allLabel="All divisions"
              value={shown.division}
              onChange={(division) => narrow({ division })}
              options={divisionOptions(model.units, filter.department).map((d) => ({ value: d, label: d }))}
            />
          )}
          <span aria-hidden className="hidden h-5 w-px bg-hairline md:block" />
          {has("stage-switch") && (
            <Segmented
              label="Show applications"
              value={filter.tab}
              onChange={(tab) => narrow({ tab })}
              phone="chips"
              options={APPLICATION_TABS.map((t) => ({ value: t.tab, label: t.label, count: shown.counts[t.tab] }))}
            />
          )}
          {has("position-filter") && (
            <FilterMenu
              label="Position"
              allLabel="All positions"
              value={shown.position}
              onChange={(position) => narrow({ position })}
              options={shown.positions.map((p) => ({ value: p.ref, label: p.title }))}
            />
          )}
        </div>
        <div className="flex items-center gap-3 md:ml-auto">
          {has("sort") && (
            <FilterMenu
              label="Sort"
              allLabel={APPLICATIONS_SORTS[0].label}
              value={filter.sort === "newest" ? null : filter.sort}
              onChange={(sort) => narrow({ sort: APPLICATIONS_SORTS.find((s) => s.sort === sort)?.sort ?? "newest" })}
              options={APPLICATIONS_SORTS.slice(1).map((s) => ({ value: s.sort, label: s.label }))}
            />
          )}
          {has("search") && <SearchField placeholder="Search applicant or position" value={filter.query} onChange={(query) => narrow({ query })} className="md:w-[260px]" />}
        </div>
      </div>

      {/* From xl a table (board 58b, three columns beside the panel as board 58); below it stacked cards (board 58m). */}
      <div className={`${PANEL} mt-4 hidden overflow-hidden xl:block`}>
        {/* The header's names are for the eye; its column filters (issue #428) are buttons a screen reader reaches. */}
        <div
          className={`grid h-10 items-center gap-4 border-b border-hairline bg-white-5 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim ${chosen ? COLUMNS_NARROW : COLUMNS_FULL}`}
        >
          <span aria-hidden="true">Applicant</span>
          {header("Position", ["position"])}
          {!chosen && (
            <>
              {header("Studies", ["program", "level"])}
              {header("Stage", ["stage"])}
              {header("Documents", ["documents"])}
            </>
          )}
          {header("Applied", ["applied"])}
        </div>
        <ul className="divide-y divide-hairline">
          {tableRows.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => choose(a)}
                aria-current={a.id === chosenId ? "true" : undefined}
                className={`grid w-full items-center gap-4 px-5 py-3 text-left transition-colors duration-300 ease-out ${chosen ? COLUMNS_NARROW : COLUMNS_FULL} ${
                  a.id === chosenId ? "bg-accent/10" : "hover:bg-white-5"
                } focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar person={a.applicant} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium leading-snug">{a.applicant.name}</span>
                    <span className="block truncate text-[12px] leading-snug text-prt-muted">{a.applicant.email}</span>
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  {/* Every role's list says which division each role sits in (board 64): one view for all (issue #416). */}
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] leading-snug text-text-2">{a.position.title}</span>
                    <span className="block truncate text-[12px] leading-snug text-prt-muted">{shortUnitName(a.position.division)}</span>
                  </span>
                  <OtherTag count={a.otherApplications.length} />
                </span>
                {!chosen && (
                  <>
                    <span className="truncate text-[13px] text-text-2">{studiesLine(a.applicant.degree, a.applicant.year)}</span>
                    <span className="min-w-0">
                      <StatusPill state={a.state} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-prt-muted">
                      {a.documents.length > 0 && <FileText aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />}
                      <span className="truncate">{documentsLine(a.documents)}</span>
                    </span>
                  </>
                )}
                <span className="text-[13px] text-prt-muted">{a.applied.day}</span>
              </button>
            </li>
          ))}
        </ul>
        {tableRows.length === 0 && <p className="px-5 py-6 text-[13px] text-prt-muted">No applications here.</p>}
      </div>

      <ul className="mt-3 flex flex-col gap-2.5 xl:hidden">
        {rows.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => choose(a)}
              aria-current={a.id === chosenId ? "true" : undefined}
              className={`${PANEL} flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold leading-snug">{a.applicant.name}</span>
                <span className="block truncate text-[13px] leading-snug text-prt-muted">
                  {a.position.title}
                  {a.otherApplications.length > 0 && <> · +{a.otherApplications.length} other</>}
                </span>
              </span>
              <span className="shrink-0 pt-0.5">
                <span className="md:hidden">
                  <StatusPill state={a.state} short />
                </span>
                <span className="hidden md:inline">
                  <StatusPill state={a.state} />
                </span>
              </span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="px-1 py-4 text-[13px] text-prt-muted">No applications here.</li>}
      </ul>

      <DetailPanel
        application={chosen}
        now={page.now}
        lead={lead}
        pending={pending}
        onClose={() => setChosenId(null)}
        onMove={move}
      />
    </div>
  );
}

function OtherTag({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="shrink-0 rounded-full bg-white-10 px-2 py-0.5 text-[11px] text-text-2">+{count} other</span>;
}

type Move = (application: ApplicationEntry, step: LeadMove, done?: () => void) => void;

// The panel on the right (board 58); on a phone a full page with a back arrow
// and the steps pinned at the foot (58d-m). It is the repo's Radix dialog, not
// modal: the list stays usable beside it, so choosing another row swaps what
// it shows. Escape, the close cross and the back arrow close it. It fades in
// only under motion-safe and closes at once (design-system-manifest.md).
function DetailPanel({
  application,
  now,
  lead,
  pending,
  onClose,
  onMove,
}: {
  application: ApplicationEntry | null;
  now: string;
  lead: string;
  pending: boolean;
  onClose: () => void;
  onMove: Move;
}) {
  return (
    <Dialog open={application !== null} onOpenChange={(open) => !open && onClose()} modal={false}>
      <DialogPortal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => event.preventDefault()}
          className={`fixed inset-0 z-40 flex flex-col bg-ground text-prt-text focus:outline-none md:left-auto ${PANEL_WIDTH} md:border-l md:border-hairline motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0 motion-safe:data-[state=open]:duration-200`}
        >
          {application && <Detail key={application.id} application={application} now={now} lead={lead} pending={pending} onMove={onMove} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** Which button's confirm is open over the panel: every action button asks first (ADR 0011, amendment of 2026-10-25). */
type Asking = LeadMoveKind | null;

function capital(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** "sees" for she and he, "see" for they. */
function verb(they: Pronouns, singular: string, plural: string): string {
  return they.subject === "they" ? plural : singular;
}

function Detail({
  application: a,
  now,
  lead,
  pending,
  onMove,
}: {
  application: ApplicationEntry;
  now: string;
  lead: string;
  pending: boolean;
  onMove: Move;
}) {
  const [asking, setAsking] = useState<Asking>(null);
  const first = firstNameOf(a.applicant.name);
  const they = pronounsOf(a.applicant.gender);
  const unit = divisionLabel(a.position.division);
  const steps = panelStepsOf(a);
  const close = () => setAsking(null);
  // Confirm join sets these to "Accepted for another position" (ADR 0011, amendment of 2026-10-25).
  const othersTaken = a.otherApplications.filter((o) => takenByJoinElsewhere({ kind: "built-in", key: o.status })).length;
  const run = (step: LeadMove) => onMove(a, step, close);

  // Every field the applicant gave, grouped; empty ones are left out (issue #406).
  const details = applicantSections(a.applicant);

  return (
    <>
      {/* One title for both layouts; the visible names below are its two looks. */}
      <DialogTitle className="sr-only">{a.applicant.name}</DialogTitle>
      {/* Phone (58d-m): the shell's top bar, a back arrow in place of the menu. */}
      <PhoneTopBar
        title={<span aria-hidden="true">{a.applicant.name}</span>}
        leading={
          <DialogClose aria-label="Back to applications" className={ICON_BUTTON}>
            <ArrowLeft aria-hidden className="h-[22px] w-[22px]" strokeWidth={2} />
          </DialogClose>
        }
      />

      <div className="hidden border-b border-hairline px-7 pb-5 pt-7 md:block">
        <div className="flex items-start gap-4">
          <Avatar size="panel" person={a.applicant} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[20px] font-bold leading-tight" aria-hidden="true">
              {a.applicant.name}
            </p>
            <p className="mt-1 text-[13px] text-prt-muted">
              {a.position.title} · applied {a.applied.at}
            </p>
          </div>
          <DialogClose
            aria-label="Close"
            className={`-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${FOCUS}`}
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </DialogClose>
        </div>
        <StatusBox state={a.state} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 md:px-7 md:py-5">
        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <p className="min-w-0 truncate text-[13px] text-prt-muted">
            {a.position.title} · applied {a.applied.at}
          </p>
          <StatusPill state={a.state} short />
        </div>

        <StageCard application={a} first={first} they={they} changeTimes={steps.changeTimes} onAsk={setAsking} />
        {details.map((section) => (
          <Fields key={section.title} title={section.title} fields={section.fields} />
        ))}
        {a.otherApplications.length > 0 && (
          <Section title={`Other applications · ${a.otherApplications.length}`}>
            <ul className="flex flex-col gap-2.5">
              {a.otherApplications.map((o, i) => (
                <li key={i}>
                  <OtherCard other={o} />
                </li>
              ))}
            </ul>
          </Section>
        )}
        {a.documents.length > 0 && (
          <Section title="Documents">
            <ul className="flex flex-col gap-2.5">
              {a.documents.map((d) => (
                <li key={d.kind}>
                  <DocumentCard name={d.name} detail={[d.kind === "cv" ? "CV" : "Motivation letter", d.size].filter(Boolean).join(" · ")} href={d.href} />
                </li>
              ))}
            </ul>
          </Section>
        )}
        {a.answers.length > 0 && (
          <Section title="Questions for this role">
            {a.answers.map((qa) => (
              <div key={qa.question} className="mb-4 last:mb-0">
                <p className="text-[13px] text-prt-muted">{qa.question}</p>
                <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{qa.answer}</p>
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* The bottom bar: only the current status's buttons (board 97). It sits under the scrolling content, never over it. */}
      {steps.bar.length > 0 && (
        <div className="grid shrink-0 grid-cols-3 gap-3 border-t border-hairline bg-ground px-5 py-4 md:px-7">
          {/* Cancel closes the panel without deciding (Owner decision, 2026-10-19). */}
          <DialogPrimitive.Close
            className={`h-11 rounded-full text-[14px] font-semibold text-text-2 transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
          >
            Cancel
          </DialogPrimitive.Close>
          {steps.bar.map((step) => (
            <FooterButton key={step.move} step={step} wide={steps.bar.length === 1} onAsk={setAsking} />
          ))}
        </div>
      )}

      <InterviewDialog
        open={asking === "offer-interview"}
        onOpenChange={(open) => !open && close()}
        mode={a.state.status === "interview" ? "change" : "offer"}
        applicant={{ name: a.applicant.name, email: a.applicant.email, position: a.position.title }}
        lead={lead}
        now={now}
        offered={a.state.status === "interview" ? a.state.offered : []}
        pending={pending}
        onSubmit={(slots) => run({ kind: "offer-interview", slots })}
      />
      <DecisionDialog
        open={asking === "accept"}
        onOpenChange={(open) => !open && close()}
        tone="success"
        icon={<Check className="h-5 w-5" strokeWidth={2} />}
        title={`Accept ${first} for ${a.position.title}?`}
        cancelLabel="Not yet"
        confirmLabel="Yes, accept"
        pending={pending}
        onConfirm={() => run({ kind: "accept" })}
      >
        {capital(they.possessive)} status becomes Accepted · email to be sent.
        <NextSteps steps={[`The team leader emails ${first} the NDA and marks the email sent.`, `${first} signs it and sends it back.`, `You mark the NDA received and confirm ${they.possessive} join here.`]} />
      </DecisionDialog>
      <DecisionDialog
        open={asking === "reject"}
        onOpenChange={(open) => !open && close()}
        tone="danger"
        icon={<X className="h-5 w-5" strokeWidth={2} />}
        title={`Reject ${first} for ${a.position.title}?`}
        cancelLabel={`Keep ${they.possessive} application`}
        confirmLabel="Yes, reject"
        pending={pending}
        onConfirm={() => run({ kind: "reject" })}
      >
        {capital(they.possessive)} status becomes Rejected · email to be sent. The site sends no email: tell {they.object} yourself, then mark the
        email sent. You can&apos;t undo this.
      </DecisionDialog>
      <DecisionDialog
        open={asking === "withdraw-acceptance"}
        onOpenChange={(open) => !open && close()}
        tone="danger"
        icon={<Undo2 className="h-5 w-5" strokeWidth={2} />}
        title={`Withdraw ${first}'s acceptance?`}
        cancelLabel="Not yet"
        confirmLabel="Yes, withdraw"
        pending={pending}
        onConfirm={() => run({ kind: "withdraw-acceptance" })}
      >
        {capital(they.possessive)} application goes back to New.
      </DecisionDialog>
      {a.state.status === "rejected_email_to_be_sent" ? (
        <DecisionDialog
          open={asking === "mark-email-sent"}
          onOpenChange={(open) => !open && close()}
          tone="danger"
          icon={<MailCheck className="h-5 w-5" strokeWidth={1.75} />}
          title={`Mark the refusal email to ${first} sent?`}
          cancelLabel="Not yet"
          confirmLabel="Yes, it's sent"
          pending={pending}
          onConfirm={() => run({ kind: "mark-email-sent" })}
        >
          {capital(they.possessive)} status becomes Rejected · email sent, and {they.subject} {verb(they, "sees", "see")} &ldquo;Not selected&rdquo; on{" "}
          {they.possessive} My applications page.
        </DecisionDialog>
      ) : (
        <DecisionDialog
          open={asking === "mark-email-sent"}
          onOpenChange={(open) => !open && close()}
          tone="success"
          icon={<MailCheck className="h-5 w-5" strokeWidth={1.75} />}
          title={`Mark the acceptance email to ${first} sent?`}
          cancelLabel="Not yet"
          confirmLabel="Yes, it's sent"
          pending={pending}
          onConfirm={() => run({ kind: "mark-email-sent" })}
        >
          {capital(they.possessive)} status becomes Accepted · email sent, and {they.subject} {verb(they, "sees", "see")} the acceptance on{" "}
          {they.possessive} My applications page.
        </DecisionDialog>
      )}
      <DecisionDialog
        open={asking === "nda-received"}
        onOpenChange={(open) => !open && close()}
        tone="success"
        icon={<FileCheck2 className="h-5 w-5" strokeWidth={1.75} />}
        title={`Mark ${first}'s signed NDA received?`}
        cancelLabel="Not yet"
        confirmLabel="Yes, it arrived"
        pending={pending}
        onConfirm={() => run({ kind: "nda-received" })}
      >
        {capital(they.possessive)} status becomes NDA received. Then confirm {they.possessive} join.
      </DecisionDialog>
      {a.standing.kind === "member" ? (
        // 58h2: already on the team; they keep every division they are in.
        <DecisionDialog
          open={asking === "confirm-join"}
          onOpenChange={(open) => !open && close()}
          tone="success"
          icon={<UserPlus className="h-5 w-5" strokeWidth={1.75} />}
          title={`Add ${first} to ${unit}?`}
          cancelLabel="Not yet"
          confirmLabel="Yes, add them"
          pending={pending}
          onConfirm={() => run({ kind: "confirm-join" })}
        >
          {memberJoinLine(first, unit, memberDivisionNames(a.standing))}
          {othersTaken > 0 && ` ${otherApplicationsLine(othersTaken)}`}
        </DecisionDialog>
      ) : (
        // 58h: someone new, in neutral words whatever the form says.
        <DecisionDialog
          open={asking === "confirm-join"}
          onOpenChange={(open) => !open && close()}
          tone="success"
          icon={<UserPlus className="h-5 w-5" strokeWidth={1.75} />}
          title={`Confirm ${first} joins ${unit}?`}
          cancelLabel="Not yet"
          confirmLabel="Yes, they join"
          pending={pending}
          onConfirm={() => run({ kind: "confirm-join" })}
        >
          They become a member, get the member dashboard, and show up in Members and on the Team tree.
          {othersTaken > 0 && ` ${otherApplicationsLine(othersTaken)}`}
        </DecisionDialog>
      )}
    </>
  );
}

/** Confirm join's word on the person's other open applications, which it sets to "Accepted for another position". */
function otherApplicationsLine(count: number): string {
  return count === 1
    ? "Their other open application becomes Accepted for another position."
    : `Their ${count} other open applications become Accepted for another position.`;
}

/**
 * Board 58h2's question: "Matteo is already in Optimization and Analysis and
 * signed the NDA. They join Mission Analysis too and keep Optimization and
 * Analysis." Several divisions read "in A and in B", as names hold "and".
 */
function memberJoinLine(first: string, unit: string, divisions: readonly string[]): string {
  if (divisions.length === 0) return `${first} is already on the team and signed the NDA. They join ${unit}.`;
  if (divisions.length === 1) {
    return `${first} is already in ${divisions[0]} and signed the NDA. They join ${unit} too and keep ${divisions[0]}.`;
  }
  const places = `${divisions.slice(0, -1).join(", in ")} and in ${divisions[divisions.length - 1]}`;
  const kept = divisions.length === 2 ? "both" : `all ${divisions.length}`;
  return `${first} is already in ${places}, and signed the NDA. They join ${unit} too and keep ${kept}.`;
}

/** One action button of the bottom bar; it only opens the button's confirm. A lone button takes both columns beside Cancel. */
function FooterButton({ step, wide, onAsk }: { step: LeadStep; wide: boolean; onAsk: (asking: Asking) => void }) {
  const look =
    step.emphasis === "primary"
      ? "bg-prt-text text-ground hover:opacity-90"
      : step.sets.startsWith("rejected") || step.move === "withdraw-acceptance"
        ? "border border-danger/40 text-danger hover:border-danger md:border-white-10 md:text-prt-text md:hover:border-border-strong"
        : "border border-white-10 text-prt-text hover:border-border-strong";
  return (
    <button
      type="button"
      onClick={() => onAsk(step.move)}
      className={`h-11 rounded-full px-3 text-[14px] font-semibold transition duration-300 ease-out ${wide ? "col-span-2" : ""} ${look} ${FOCUS}`}
    >
      {step.label}
    </button>
  );
}

/**
 * The card for where the application stands now: the interview (58d), the
 * acceptance email and the NDA (58g), or the join. It only says where it
 * stands; the bottom bar's buttons move it, and Change times sits here, on
 * the interview, where `changeTimes` offers it.
 */
function StageCard({
  application: a,
  first,
  they,
  changeTimes,
  onAsk,
}: {
  application: ApplicationEntry;
  first: string;
  they: Pronouns;
  changeTimes: boolean;
  onAsk: (asking: Asking) => void;
}) {
  const state = a.state;
  switch (state.status) {
    case "interview": {
      const booked = state.booked;
      const offered = state.offered.length;
      return (
        <Section title="Interview">
          <div className={`rounded-xl border px-4 py-4 ${booked ? "border-accent/40 bg-accent/[0.06]" : "border-hairline bg-panel/60"}`}>
            {booked ? (
              <div className="flex items-center gap-3.5">
                <span className="hidden h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border border-accent/40 bg-accent-soft md:flex">
                  <span className="text-[16px] font-bold leading-none text-accent">{slotBadge(booked.slot).day}</span>
                  <span className="mt-0.5 font-mono text-[8px] tracking-[0.2em] text-accent">{slotBadge(booked.slot).month}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{slotRange(booked.slot)}</p>
                  <p className="mt-0.5 text-[12px] text-prt-muted">
                    {first} picked this on {dayMonth(booked.at)}
                  </p>
                </div>
              </div>
            ) : offered === 0 ? (
              <div>
                <p className="text-[15px] font-semibold">No times offered yet</p>
                <p className="mt-0.5 text-[12px] text-prt-muted">The interview is being arranged.</p>
              </div>
            ) : (
              <div>
                <p className="text-[15px] font-semibold">No time picked yet</p>
                <p className="mt-0.5 text-[12px] text-prt-muted">
                  {/* A viewer who may not move it offered nothing (issue #577). */}
                  {a.canChange ? `You offered ${offered} ${offered === 1 ? "time" : "times"}.` : `${offered} ${offered === 1 ? "time is" : "times are"} offered.`}{" "}
                  {first} picks one on {they.possessive} My applications page.
                </p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {state.offered.map((s) => (
                    <li key={s.start} className="rounded-md border border-hairline px-2 py-1 text-[12px] text-text-2">
                      {slotDayTime(s)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Change times is a button of the Interview status, so only where the viewer may move it (issue #577); Add to calendar is the viewer's own. */}
            {(booked || changeTimes) && (
              <div className={`mt-4 grid gap-2.5 ${booked && changeTimes ? "grid-cols-2" : "grid-cols-1"}`}>
                {booked && (
                  <button type="button" onClick={() => downloadIcs(a, booked.slot)} className={CARD_BUTTON}>
                    <CalendarPlus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Add to calendar
                  </button>
                )}
                {changeTimes && (
                  <button type="button" onClick={() => onAsk("offer-interview")} className={CARD_BUTTON}>
                    <CalendarClock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Change times
                  </button>
                )}
              </div>
            )}
          </div>
        </Section>
      );
    }
    case "accepted_email_to_be_sent":
    case "accepted_email_sent":
    case "nda_received":
      return (
        <Section title="Joining">
          <div className="rounded-xl border border-success/40 bg-success/5 px-4 py-4">
            <p className="flex items-center gap-2.5 text-[15px] font-semibold">
              <Signature aria-hidden className="h-4 w-4 text-success" strokeWidth={1.75} />
              {JOINING_TITLE[state.status]}
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-text-2">
              Accepted on {dayMonth(state.acceptedAt)}. {joiningLine(state.status, first, they, a.canChange)}
            </p>
          </div>
        </Section>
      );
    case "joined":
      return (
        <Section title="Joining">
          <p className="flex items-center gap-2.5 rounded-xl border border-success/40 bg-success/5 px-4 py-3.5 text-[14px] font-semibold">
            <UserPlus aria-hidden className="h-4 w-4 text-success" strokeWidth={1.75} />
            Joined the team on {dayMonth(state.joinedAt)}
          </p>
        </Section>
      );
    default:
      return null;
  }
}

/** The joining card's title for each accepted status (58g). */
const JOINING_TITLE: Readonly<Record<AcceptedStatus, string>> = {
  accepted_email_to_be_sent: "Waiting for the acceptance email",
  accepted_email_sent: "Waiting for the signed NDA",
  nda_received: "Ready to confirm the join",
};

/** What happens next on an accepted application; the step a viewer who may not move it cannot take is left out (issue #577). */
function joiningLine(status: AcceptedStatus, first: string, they: Pronouns, canChange: boolean): string {
  switch (status) {
    case "accepted_email_to_be_sent":
      return "The team leader sends the welcome email with the NDA, then marks it sent.";
    case "accepted_email_sent":
      return `The email with the NDA went out.${canChange ? ` When ${first} sends it back signed, mark it received.` : ""}`;
    case "nda_received":
      return `The signed NDA arrived.${canChange ? ` Confirm ${they.possessive} join.` : ""}`;
  }
}

const CARD_BUTTON = `inline-flex h-9 items-center justify-center gap-2 rounded-full border border-white-10 text-[13px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`;

/** Add to calendar: the booked time as an .ics file, made in the browser. The site sends no invite. */
function downloadIcs(a: ApplicationEntry, slot: SlotTime) {
  const ics = interviewIcs({ applicationId: a.id, applicant: a.applicant.name, position: a.position.title, slot }, new Date());
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = icsFileName(a.applicant.name);
  link.click();
  URL.revokeObjectURL(url);
}

function OtherCard({ other }: { other: OtherApplication }) {
  const reached = progressOf(other.status);
  return (
    <div className="rounded-xl border border-hairline bg-panel/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{other.title}</p>
          <p className="truncate text-[12px] text-prt-muted">
            {other.department} · {other.division}
          </p>
        </div>
        <StatusTag status={other.status} />
      </div>
      {reached !== null && (
        <div aria-hidden="true" className="mt-3 hidden grid-cols-4 gap-1.5 md:grid">
          {Array.from({ length: PROGRESS_STEPS }, (_, i) => (
            <span key={i} className={`h-[3px] rounded-full ${i < reached - 1 ? "bg-accent/60" : i === reached - 1 ? "bg-accent" : "bg-white-10"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ title, fields }: { title: string; fields: readonly ApplicantField[] }) {
  return (
    <Section title={title}>
      <dl className="flex flex-col gap-1.5">
        {fields.map(({ label, value, href }) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-[13px]">
            <dt className="shrink-0 text-prt-muted">{label}</dt>
            <dd className="min-w-0 break-words text-right">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-text-2 transition-colors duration-300 ease-out hover:text-accent ${FOCUS}`}
                >
                  {value}
                </a>
              ) : (
                value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function DocumentCard({ name, detail, href }: { name: string; detail: string; href: string | null }) {
  const body = (
    <>
      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent md:flex">
        <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold md:text-[13px] md:font-medium">{name}</span>
        <span className="block text-[12px] text-prt-muted">{detail}</span>
      </span>
      {href && <ExternalLink aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />}
    </>
  );
  const box = "flex items-center gap-3 rounded-xl border border-hairline px-4 py-3 md:rounded-lg md:px-3 md:py-2.5";
  if (!href) return <div className={box}>{body}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${box} transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}
    >
      {body}
    </a>
  );
}

/**
 * The status at the top of the panel (boards 58, 58d, 97). It only shows the
 * status: the bottom bar's buttons change it, each behind its confirm. The
 * Status picker that replaces it is issue #750.
 */
function StatusBox({ state }: { state: ApplicationState }) {
  const { tone } = statusPill(state);
  return (
    <p className={`mt-4 flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-[13px] font-medium ${toneSurface(tone)}`}>
      <span className="sr-only">Status: </span>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${toneDot(tone)}`} />
      <span className="truncate">{STATUS_NAMES[state.status]}</span>
    </p>
  );
}
