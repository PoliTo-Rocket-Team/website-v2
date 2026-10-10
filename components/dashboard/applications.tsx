"use client";

import { useId, useOptimistic, useState, useTransition, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, CalendarClock, CalendarPlus, Check, ChevronDown, ExternalLink, FileText, Signature, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { moveApplication } from "@/app/dashboard/recruitment-actions";
import {
  APPLICATION_TABS,
  applyMove,
  dayMonth,
  firstNameOf,
  footerSteps,
  icsFileName,
  inTab,
  interviewIcs,
  menuSteps,
  PROGRESS_STEPS,
  progressOf,
  pronounsOf,
  slotBadge,
  slotDayTime,
  slotRange,
  STAGE_LABELS,
  stagePill,
  studiesLine,
  tabCounts,
  type ApplicationState,
  type ApplicationTab,
  type SlotTime,
  type LeadMove,
  type LeadStep,
  type Pronouns,
} from "@/lib/dashboard/application-flow";
import {
  documentsLine,
  type ApplicationEntry,
  type ApplicationsPage,
  type OtherApplication,
  type PositionRef,
} from "@/lib/dashboard/recruitment";
import { Avatar } from "./avatar";
import { FilterMenu, Segmented } from "./controls";
import { DecisionDialog, NextSteps } from "./decision-dialog";
import { InterviewDialog } from "./interview-dialog";
import { PANEL } from "./panel";
import { StagePill, StageTag, toneDot, toneSurface } from "./stage-pill";

// The Applications page (Dashboard v2 boards 58b, 58 to 58i, and phone boards
// 58m and 58d-m, issue #171): the stage tabs, the position filter, the list,
// and the detail panel of the chosen application with its next steps. Props
// in, nothing fetched. Every step goes through the dashboard's server action;
// which steps are legal is lib/dashboard/application-flow.ts's alone, and the
// page shows the result at once.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// The detail panel and the room the list leaves for it are one pair (board 58):
// the panel is 460px wide, and the list card ends 28px before it. The shell's
// main already pads 40px on the right, so the list adds 460 + 28 - 40 = 448px.
// Below xl the content column is too narrow to share, so the panel lies over it.
const PANEL_WIDTH = "md:w-[460px]";
const ROOM_FOR_PANEL = "xl:mr-[448px]";

const COLUMNS_FULL = "grid-cols-[minmax(0,1.35fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.65fr)_minmax(0,0.55fr)]";
const COLUMNS_NARROW = "grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.5fr)]";

export function ApplicationsView({
  page,
  initialPosition,
}: {
  page: ApplicationsPage;
  initialPosition: PositionRef | null;
}) {
  const [states, setState] = useOptimistic(
    Object.fromEntries(page.applications.map((a) => [a.id, a.state])) as Record<number, ApplicationState>,
    (current, change: { id: number; state: ApplicationState }) => ({ ...current, [change.id]: change.state }),
  );
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<ApplicationTab>("all");
  const [position, setPosition] = useState<PositionRef | null>(initialPosition);
  const [chosenId, setChosenId] = useState<number | null>(null);

  const applications = page.applications.map((a) => ({ ...a, state: states[a.id] ?? a.state }));
  const inPosition = applications.filter((a) => position === null || a.position.ref === position);
  const counts = tabCounts(inPosition.map((a) => a.state.stage));
  const rows = inPosition.filter((a) => inTab(a.state.stage, tab));
  const chosen = applications.find((a) => a.id === chosenId) ?? null;

  /** Shows the step at once, then saves it; a refusal puts the row back and says why. */
  const move = (application: ApplicationEntry, step: LeadMove, done?: () => void) =>
    startTransition(async () => {
      const result = applyMove(application.state, step, new Date(page.now));
      if (result.ok) setState({ id: application.id, state: result.state });
      const saved = await moveApplication(application.id, step);
      if (!saved.ok) toast.error(saved.error);
      else done?.();
    });

  const choose = (application: ApplicationEntry) => {
    setChosenId(application.id);
    if (application.state.stage === "new") move(application, { kind: "open" });
  };

  return (
    <div className={chosen ? ROOM_FOR_PANEL : ""}>
      <header>
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.01em] md:text-[28px]">Applications</h1>
        <p className="mt-1 hidden text-[14px] text-prt-muted md:block">
          {page.division ? `Applications for ${page.division} roles.` : "Applications for the positions you lead."}
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3 md:mt-6">
        <Segmented
          label="Show applications"
          value={tab}
          onChange={setTab}
          phone="chips"
          options={APPLICATION_TABS.map((t) => ({ value: t.tab, label: t.label, count: counts[t.tab] }))}
        />
        <div className="hidden md:block">
          <FilterMenu
            allLabel="All positions"
            value={position}
            onChange={setPosition}
            options={page.positions.map((p) => ({ value: p.ref, label: p.title }))}
          />
        </div>
      </div>

      {/* From xl a table (board 58b, three columns beside the panel as board 58); below it stacked cards (board 58m). */}
      <div className={`${PANEL} mt-4 hidden overflow-hidden xl:block`}>
        <div
          aria-hidden="true"
          className={`grid h-10 items-center gap-4 border-b border-hairline bg-white-5 px-5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim ${chosen ? COLUMNS_NARROW : COLUMNS_FULL}`}
        >
          <span>Applicant</span>
          <span>Position</span>
          {!chosen && (
            <>
              <span>Studies</span>
              <span>Stage</span>
              <span>Documents</span>
            </>
          )}
          <span>Applied</span>
        </div>
        <ul className="divide-y divide-hairline">
          {rows.map((a) => (
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
                  <Avatar name={a.applicant.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium leading-snug">{a.applicant.name}</span>
                    <span className="block truncate text-[12px] leading-snug text-prt-muted">{a.applicant.email}</span>
                  </span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-[13px] text-text-2">{a.position.title}</span>
                  <OtherTag count={a.otherApplications.length} />
                </span>
                {!chosen && (
                  <>
                    <span className="truncate text-[13px] text-text-2">{studiesLine(a.studies.degree, a.studies.year)}</span>
                    <span className="min-w-0">
                      <StagePill state={a.state} />
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
        {rows.length === 0 && <p className="px-5 py-6 text-[13px] text-prt-muted">No applications here.</p>}
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
                  <StagePill state={a.state} short />
                </span>
                <span className="hidden md:inline">
                  <StagePill state={a.state} />
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
  pending,
  onClose,
  onMove,
}: {
  application: ApplicationEntry | null;
  now: string;
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
          {application && <Detail key={application.id} application={application} now={now} pending={pending} onMove={onMove} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

/** Which confirm step is open over the panel. */
type Asking = "offer-interview" | "accept" | "reject" | "confirm-join" | null;

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
  pending,
  onMove,
}: {
  application: ApplicationEntry;
  now: string;
  pending: boolean;
  onMove: Move;
}) {
  const [asking, setAsking] = useState<Asking>(null);
  const first = firstNameOf(a.applicant.name);
  const they = pronounsOf(a.applicant.gender);
  const footer = footerSteps(a.state);
  const pill = stagePill(a.state);
  const unit = a.position.division.replace(/ Division$/, "");
  const close = () => setAsking(null);
  const run = (step: LeadMove) => onMove(a, step, close);

  const contact = rows([
    ["Email", a.applicant.email],
    ["Phone", a.applicant.phone],
    ["PoliTo ID", a.applicant.politoId],
  ]);
  const studies = rows([
    ["Year", a.studies.year],
    ["Degree", a.studies.degree],
  ]);

  return (
    <>
      {/* One title for both layouts; the visible names below are its two looks. */}
      <DialogTitle className="sr-only">{a.applicant.name}</DialogTitle>
      {/* Phone (58d-m): a back arrow and the name. */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-3 md:hidden">
        <DialogClose aria-label="Back to applications" className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ease-out hover:bg-white-5 ${FOCUS}`}>
          <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
        </DialogClose>
        <p aria-hidden="true" className="truncate text-[18px] font-semibold">
          {a.applicant.name}
        </p>
      </div>

      <div className="hidden border-b border-hairline px-7 pb-5 pt-7 md:block">
        <div className="flex items-start gap-4">
          <Avatar name={a.applicant.name} size="panel" />
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
        <StageMenu label={STAGE_LABELS[a.state.stage]} tone={pill.tone} steps={menuSteps(a.state)} onStep={(step) => setAsking(step.move === "set-nda" || step.move === "open" ? null : step.move)} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 md:px-7 md:py-5">
        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <p className="min-w-0 truncate text-[13px] text-prt-muted">
            {a.position.title} · applied {a.applied.at}
          </p>
          <StagePill state={a.state} short />
        </div>

        <StageCard application={a} first={first} they={they} now={now} pending={pending} onAsk={setAsking} onMove={(step) => onMove(a, step)} />
        {contact.length > 0 && <Fields title="Contact" fields={contact} />}
        {studies.length > 0 && <Fields title="Studies" fields={studies} />}
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

      {footer && (
        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-hairline px-5 py-4 md:px-7">
          <FooterButton step={footer.secondary} kind="secondary" onAsk={setAsking} />
          <FooterButton step={footer.primary} kind="primary" ready={footer.primary.ready} onAsk={setAsking} />
        </div>
      )}

      <InterviewDialog
        open={asking === "offer-interview"}
        onOpenChange={(open) => !open && close()}
        mode={a.state.stage === "interview" ? "change" : "offer"}
        applicant={{ name: a.applicant.name, email: a.applicant.email, gender: a.applicant.gender, position: a.position.title }}
        now={now}
        offered={a.state.stage === "interview" ? a.state.offered : []}
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
        {capital(they.possessive)} application is marked as accepted.
        <NextSteps steps={[`The team leader emails ${first} the NDA.`, `${first} signs it and sends it back.`, `You confirm ${they.possessive} join here.`]} />
      </DecisionDialog>
      <DecisionDialog
        open={asking === "reject"}
        onOpenChange={(open) => !open && close()}
        tone="danger"
        icon={<X className="h-5 w-5" strokeWidth={2} />}
        title={a.state.stage === "accepted" ? `Withdraw ${first}'s acceptance?` : `Reject ${first} for ${a.position.title}?`}
        cancelLabel={a.state.stage === "accepted" ? "Not yet" : `Keep ${they.possessive} application`}
        confirmLabel={a.state.stage === "accepted" ? "Yes, withdraw" : "Yes, reject"}
        pending={pending}
        onConfirm={() => run({ kind: "reject" })}
      >
        {a.state.stage === "accepted"
          ? `${capital(they.possessive)} application moves to Rejected, and ${they.subject} ${verb(they, "sees", "see")} "Not selected" on ${they.possessive} My applications page. The site sends no email: tell ${they.object} yourself. You can't undo this.`
          : `${capital(they.subject)} ${verb(they, "sees", "see")} "Not selected" on ${they.possessive} My applications page. You can't undo this.`}
      </DecisionDialog>
      <DecisionDialog
        open={asking === "confirm-join"}
        onOpenChange={(open) => !open && close()}
        tone="success"
        icon={<UserPlus className="h-5 w-5" strokeWidth={1.75} />}
        title={`Confirm ${first} joins ${unit}?`}
        cancelLabel="Not yet"
        confirmLabel={`Yes, ${they.subject} ${verb(they, "joins", "join")}`}
        pending={pending}
        onConfirm={() => run({ kind: "confirm-join" })}
      >
        Only confirm once {they.possessive} signed NDA has arrived. {capital(they.subject)} {verb(they, "becomes", "become")} a member,{" "}
        {verb(they, "gets", "get")} the member dashboard, and {verb(they, "shows", "show")} up in Members and on the Team tree.
      </DecisionDialog>
    </>
  );
}

function FooterButton({
  step,
  kind,
  ready = true,
  onAsk,
}: {
  step: LeadStep;
  kind: "primary" | "secondary";
  ready?: boolean;
  onAsk: (asking: Asking) => void;
}) {
  const look =
    kind === "primary"
      ? "bg-prt-text text-ground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      : "border border-danger/40 text-danger hover:border-danger md:border-white-10 md:text-prt-text md:hover:border-border-strong";
  return (
    <button
      type="button"
      disabled={!ready}
      onClick={() => onAsk(step.move === "open" || step.move === "set-nda" ? null : step.move)}
      className={`h-11 rounded-full text-[14px] font-semibold transition duration-300 ease-out ${look} ${FOCUS}`}
    >
      {step.label}
    </button>
  );
}

/** The card for where the application stands now: the interview (58d), the NDA wait (58g), or the join. */
function StageCard({
  application: a,
  first,
  they,
  now,
  pending,
  onAsk,
  onMove,
}: {
  application: ApplicationEntry;
  first: string;
  they: Pronouns;
  now: string;
  pending: boolean;
  onAsk: (asking: Asking) => void;
  onMove: (step: LeadMove) => void;
}) {
  const state = a.state;
  const boxId = useId();
  if (state.stage === "interview") {
    const booked = state.booked;
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
          ) : (
            <div>
              <p className="text-[15px] font-semibold">No time picked yet</p>
              <p className="mt-0.5 text-[12px] text-prt-muted">
                You offered {state.offered.length} {state.offered.length === 1 ? "time" : "times"}. {first} picks one on {they.possessive} My applications page.
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
          <div className={`mt-4 grid gap-2.5 ${booked ? "grid-cols-2" : "grid-cols-1"}`}>
            {booked && (
              <button type="button" onClick={() => downloadIcs(a, booked.slot)} className={CARD_BUTTON}>
                <CalendarPlus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                Add to calendar
              </button>
            )}
            <button type="button" onClick={() => onAsk("offer-interview")} className={CARD_BUTTON}>
              <CalendarClock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Change times
            </button>
          </div>
        </div>
      </Section>
    );
  }
  if (state.stage === "accepted") {
    return (
      <Section title="Joining">
        <div className="rounded-xl border border-success/40 bg-success/5 px-4 py-4">
          <p className="flex items-center gap-2.5 text-[15px] font-semibold">
            <Signature aria-hidden className="h-4 w-4 text-success" strokeWidth={1.75} />
            {state.ndaArrived ? "The signed NDA arrived" : "Waiting for the signed NDA"}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-text-2">
            Accepted on {dayMonth(state.acceptedAt)}. The team leader sends the welcome email with the NDA. When {first} sends it back signed,
            confirm {they.possessive} join.
          </p>
          <label htmlFor={boxId} className="mt-3.5 flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
            <input
              id={boxId}
              type="checkbox"
              checked={state.ndaArrived}
              disabled={pending}
              onChange={(e) => onMove({ kind: "set-nda", arrived: e.target.checked })}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-300 ease-out peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
                state.ndaArrived ? "border-success bg-success text-prt-text" : "border-border-strong"
              }`}
            >
              {state.ndaArrived && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
            </span>
            The signed NDA arrived
          </label>
        </div>
      </Section>
    );
  }
  if (state.stage === "joined") {
    return (
      <Section title="Joining">
        <p className="flex items-center gap-2.5 rounded-xl border border-success/40 bg-success/5 px-4 py-3.5 text-[14px] font-semibold">
          <UserPlus aria-hidden className="h-4 w-4 text-success" strokeWidth={1.75} />
          Joined the team on {dayMonth(state.joinedAt)}
        </p>
      </Section>
    );
  }
  return null;
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
  const reached = progressOf(other.stage);
  return (
    <div className="rounded-xl border border-hairline bg-panel/60 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{other.title}</p>
          <p className="truncate text-[12px] text-prt-muted">
            {other.department} · {other.division}
          </p>
        </div>
        <StageTag stage={other.stage} />
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

function rows(fields: readonly (readonly [string, string | null])[]): [string, string][] {
  return fields.flatMap(([label, value]) => (value ? [[label, value] as [string, string]] : []));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6 last:mb-0">
      <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">{title}</h3>
      {children}
    </section>
  );
}

function Fields({ title, fields }: { title: string; fields: readonly [string, string][] }) {
  return (
    <Section title={title}>
      <dl className="flex flex-col gap-1.5">
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 text-[13px]">
            <dt className="shrink-0 text-prt-muted">{label}</dt>
            <dd className="min-w-0 break-words text-right">{value}</dd>
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

/** The stage at the top of the panel (boards 58, 58d, 58g); its menu offers the steps the flow allows from here. */
function StageMenu({
  label,
  tone,
  steps,
  onStep,
}: {
  label: string;
  tone: ReturnType<typeof stagePill>["tone"];
  steps: readonly LeadStep[];
  onStep: (step: LeadStep) => void;
}) {
  const trigger = `mt-4 flex h-9 w-full items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors duration-300 ease-out ${toneSurface(tone)} ${FOCUS}`;
  if (steps.length === 0) {
    return (
      <p className={trigger}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${toneDot(tone)}`} />
        {label}
      </p>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Stage: ${label}. Next steps`} className={`${trigger} hover:border-border-strong data-[state=open]:border-border-strong`}>
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${toneDot(tone)}`} />
        {label}
        <ChevronDown aria-hidden className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[200px] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          {steps.map((step) => (
            <DropdownMenuPrimitive.Item
              key={step.label}
              onSelect={() => onStep(step)}
              className="flex h-8 cursor-pointer items-center rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text"
            >
              {step.label}
            </DropdownMenuPrimitive.Item>
          ))}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
