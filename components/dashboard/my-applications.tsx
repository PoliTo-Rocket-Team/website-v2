"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarClock, Check, ChevronDown, FileText, Info, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { RocketArrow } from "@/components/landing/rocket-arrow";
import {
  canWithdraw,
  NEXT_STEPS_TEXT,
  nextStepNote,
  outcomePill,
  progressOf,
  sentLabel,
  slotDay,
  slotLabel,
  slotsByDay,
  slotTime,
  stagePill,
  stepsOf,
  type ActiveApplication,
  type Interview,
  type InterviewSlot,
  type MyApplications,
  type PastApplication,
  type Pill,
  type Step,
} from "@/lib/dashboard/my-applications";
import type { WriteResult } from "@/lib/dashboard/write";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "./confirm-dialog";
import { GHOST_PILL, PageHeader, PRIMARY_PILL } from "./page-header";
import { PANEL } from "./panel";

type Actions = {
  withdrawApplication: (applicationId: number) => Promise<WriteResult<null>>;
  chooseInterviewSlot: (applicationId: number, slotId: number) => Promise<WriteResult<InterviewSlot>>;
};

/** "ACTIVE · 2" over each list: board 50's mono label, a step brighter than a field label. */
const LIST_LABEL = "font-mono text-[11px] uppercase tracking-[0.3em] text-prt-muted";

const PILL_TONES: Readonly<Record<Pill["tone"], string>> = {
  neutral: "bg-white-10 text-text-2",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  muted: "bg-white-5 text-prt-muted",
};

function StatusPill({ pill }: { pill: Pill }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] ${PILL_TONES[pill.tone]}`}>
      {pill.check && <Check aria-hidden className="h-3 w-3" strokeWidth={2.25} />}
      {pill.label}
    </span>
  );
}

// Boards 50, 50b, 50c, 50d and 53 (50m to 50d-m on phones): the viewer's own
// applications, each followed from sent to decision, and the ones that are
// over under Past. Props in, nothing fetched; a withdrawal or a picked time
// lives in this page's state once the write answers.
/**
 * My applications for someone who has not applied yet (issue #179): the
 * page header, one line, and the way to the open positions. Nothing else.
 */
export function NoApplicationsView() {
  return (
    <>
      <PageHeader title="My applications" intro="You have not applied to a position yet." />
      <Link href="/apply" className={cn(PRIMARY_PILL, "group mt-6 h-12 w-full px-6 text-[15px] sm:w-auto")}>
        See open positions
        <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
      </Link>
    </>
  );
}

export function MyApplicationsView({ applications, ...actions }: { applications: MyApplications } & Actions) {
  const [active, setActive] = useState(applications.active);
  const [past, setPast] = useState(applications.past);
  const [withdrawing, setWithdrawing] = useState<ActiveApplication | null>(null);
  const [pending, setPending] = useState(false);

  const withdraw = async () => {
    if (withdrawing === null) return;
    setPending(true);
    try {
      const result = await actions.withdrawApplication(withdrawing.id);
      if (!result.ok) {
        toast.error("Could not withdraw", { description: result.error });
        return;
      }
      const { id, title, department, division, sent } = withdrawing;
      setActive((all) => all.filter((a) => a.id !== id));
      setPast((all) => [{ id, title, department, division, sent, outcome: { kind: "withdrawn" } }, ...all]);
      toast.success(`You withdrew your application for ${title}`);
      setWithdrawing(null);
    } finally {
      setPending(false);
    }
  };

  const picked = (applicationId: number, slot: InterviewSlot) =>
    setActive((all) =>
      all.map((a) =>
        a.id === applicationId && a.stage.kind === "interview"
          ? { ...a, stage: { kind: "interview", interview: { ...a.stage.interview, chosen: slot } } }
          : a,
      ),
    );

  return (
    <>
      <PageHeader
        title="My applications"
        intro="Follow each application from sent to decision."
        action={
          <Link href="/apply" className={`${GHOST_PILL} group h-11 w-full px-5 text-[14px] font-semibold sm:h-10 sm:w-auto`}>
            See open positions
            <RocketArrow className="opacity-80 transition-[transform,opacity] duration-300 ease-out group-hover:translate-x-1.5 group-hover:opacity-100" />
          </Link>
        }
      />

      {active.length > 0 && (
        <section aria-label="Active applications" className="mt-6">
          <h2 className={LIST_LABEL}>Active · {active.length}</h2>
          <ul className="mt-3 flex flex-col gap-4 md:gap-5">
            {active.map((a) => (
              <li key={a.id}>
                <ApplicationCard
                  application={a}
                  me={applications}
                  onWithdraw={() => setWithdrawing(a)}
                  onPicked={(slot) => picked(a.id, slot)}
                  chooseInterviewSlot={actions.chooseInterviewSlot}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section aria-label="Past applications" className="mt-6 md:mt-7">
          <h2 className={LIST_LABEL}>Past · {past.length}</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {past.map((p) => (
              <li key={p.id}>
                <PastCard application={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(open) => !open && setWithdrawing(null)}
        icon={<Undo2 className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        title="Withdraw your application?"
        description={
          <>
            {withdrawing?.title} · {withdrawing?.code}. The lead won&apos;t see it anymore.{" "}
            <span className="sm:mt-3 sm:block sm:text-[13px] sm:text-prt-muted">You can apply again while the role is open.</span>
          </>
        }
        cancelLabel="Keep application"
        confirmLabel="Withdraw"
        danger
        pending={pending}
        onConfirm={withdraw}
      />
    </>
  );
}

function placeLine(a: Pick<ActiveApplication, "department" | "division">): string {
  return [a.department, a.division].filter(Boolean).join(" · ");
}

function ApplicationCard({
  application: a,
  me,
  onWithdraw,
  onPicked,
  chooseInterviewSlot,
}: {
  application: ActiveApplication;
  me: Pick<MyApplications, "firstName" | "email">;
  onWithdraw: () => void;
  onPicked: (slot: InterviewSlot) => void;
  chooseInterviewSlot: Actions["chooseInterviewSlot"];
}) {
  const [answersOpen, setAnswersOpen] = useState(false);
  const answersId = useId();
  const withdrawable = canWithdraw(a.stage);

  const answersToggle = a.answers.length > 0 && (
    <button
      type="button"
      aria-expanded={answersOpen}
      aria-controls={answersId}
      onClick={() => setAnswersOpen((o) => !o)}
      className="inline-flex h-8 items-center gap-1.5 text-[13px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      Your answers
      <ChevronDown aria-hidden className={`h-4 w-4 transition-transform duration-300 ease-out ${answersOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
    </button>
  );
  const withdrawButton = withdrawable && (
    <button type="button" onClick={onWithdraw} className={`${GHOST_PILL} ml-auto`}>
      Withdraw
    </button>
  );

  return (
    <article className={`${PANEL} px-4 py-5 md:p-6`}>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.2em] text-accent">{a.code}</p>
          <h3 className="mt-1.5 text-[18px] font-bold leading-snug md:mt-1">{a.title}</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-prt-muted md:mt-1">
            {placeLine(a)}
            <span className="hidden md:inline"> · sent {sentLabel(a.sent)}</span>
            <span className="block md:hidden">Sent {sentLabel(a.sent)}</span>
          </p>
        </div>
        <StatusPill pill={stagePill(a.stage)} />
      </header>

      <Stepper steps={stepsOf(a.stage)} />
      <PhoneProgress application={a} />

      <p className="mt-4 text-[14px] leading-relaxed text-text-2 md:mt-5">{nextStepNote(a, me)}</p>

      {a.stage.kind === "interview" &&
        (a.stage.interview.chosen === null ? (
          <SlotPicker application={a} interview={a.stage.interview} chooseInterviewSlot={chooseInterviewSlot} onPicked={onPicked} />
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3.5 md:mt-5">
            <CalendarCheck aria-hidden className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
            <p className="text-[14px]">
              <span className="font-semibold">Your interview</span>
              <span className="text-text-2"> · {slotLabel(a.stage.interview.chosen)}</span>
            </p>
          </div>
        ))}

      {a.stage.kind === "accepted" && (
        <div className="mt-4 rounded-xl border border-success/30 bg-success/[0.07] px-4 py-3.5 md:mt-5">
          <p className="flex items-center gap-2.5 text-[14px] font-semibold">
            <Info aria-hidden className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />
            Next steps
          </p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-text-2">{NEXT_STEPS_TEXT}</p>
        </div>
      )}

      {/* Files, Your answers and Withdraw: one row from md, files over the rest on phones (board 50m). */}
      <div className="mt-4 border-t border-hairline pt-4 md:mt-5 md:flex md:flex-wrap md:items-center md:gap-3">
        {a.files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {a.files.map((f) => (
              <li key={f.name} className="inline-flex h-8 items-center gap-2 rounded-lg border border-white-10 px-3 text-[13px]">
                <FileText aria-hidden className="h-3.5 w-3.5 text-text-2" strokeWidth={1.75} />
                {f.name}
                {f.size && <span className="hidden text-prt-muted md:inline">{f.size}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center gap-3 border-t border-hairline pt-3 md:mt-0 md:flex-1 md:border-0 md:pt-0">
          {answersToggle}
          {withdrawButton}
        </div>
      </div>
      {answersOpen && (
        <dl id={answersId} className="mt-4 flex flex-col gap-3 rounded-xl bg-white-5 px-4 py-3.5">
          {a.answers.map((q) => (
            <div key={q.question}>
              <dt className="text-[13px] text-prt-muted">{q.question}</dt>
              <dd className="mt-1 text-[14px] leading-relaxed">{q.answer}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}

/** Board 50's stepper, from md: a ring per step on one line, joined in accent up to the step under way. */
function Stepper({ steps }: { steps: readonly Step[] }) {
  return (
    <ol className="mt-5 hidden items-center gap-3 md:flex">
      {steps.map((step, i) => (
        <li key={step.label} className={`flex items-center gap-3 ${i < steps.length - 1 ? "flex-1" : ""}`}>
          <span className="flex shrink-0 items-center gap-2.5">
            <span
              aria-hidden
              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                step.state === "done"
                  ? "bg-accent text-accent-on-accent"
                  : step.state === "current"
                    ? "border-[1.5px] border-accent bg-accent-soft"
                    : "border border-white-10 bg-white-5"
              }`}
            >
              {step.state === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
            </span>
            <span
              className={`text-[14px] ${step.state === "current" ? "font-semibold text-prt-text" : step.state === "done" ? "text-prt-text" : "text-prt-muted"}`}
            >
              {step.label}
              {step.state === "current" && <span className="sr-only"> (now)</span>}
            </span>
          </span>
          {i < steps.length - 1 && <span aria-hidden className={`h-px flex-1 ${step.state === "done" ? "bg-accent" : "bg-hairline"}`} />}
        </li>
      ))}
    </ol>
  );
}

/** Board 50m's progress, on phones: four segments and the step in words. */
function PhoneProgress({ application }: { application: ActiveApplication }) {
  const { filled, of, label } = progressOf(application.stage);
  return (
    <div className="mt-4 md:hidden">
      <div aria-hidden className="flex gap-1.5">
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full ${i < filled ? "bg-accent" : "bg-white-10"}`} />
        ))}
      </div>
      <p className="mt-2 text-[12px] text-text-2">{label}</p>
    </div>
  );
}

/** Board 50c (50c-m on phones): the lead's offered times by day; pick one, then confirm it. */
function SlotPicker({
  application,
  interview,
  chooseInterviewSlot,
  onPicked,
}: {
  application: ActiveApplication;
  interview: Interview;
  chooseInterviewSlot: Actions["chooseInterviewSlot"];
  onPicked: (slot: InterviewSlot) => void;
}) {
  const [selected, setSelected] = useState<InterviewSlot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const days = slotsByDay(interview.slots);

  const confirm = async () => {
    if (selected === null) return;
    setPending(true);
    try {
      const result = await chooseInterviewSlot(application.id, selected.id);
      if (!result.ok) {
        toast.error("Could not confirm the time", { description: result.error });
        return;
      }
      setConfirming(false);
      onPicked(result.value);
      toast.success(`Interview set for ${slotLabel(result.value)}`);
    } finally {
      setPending(false);
    }
  };

  const chip = (slot: InterviewSlot) => {
    const on = selected?.id === slot.id;
    return (
      <button
        key={slot.id}
        type="button"
        aria-pressed={on}
        onClick={() => setSelected(slot)}
        className={`inline-flex h-10 min-w-[64px] items-center justify-center rounded-lg border px-3.5 text-[14px] font-semibold tabular-nums transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          on ? "border-accent bg-accent text-accent-on-accent" : "border-white-10 bg-white-5 hover:border-border-strong"
        }`}
      >
        {slotTime(slot)}
      </button>
    );
  };

  return (
    <div className="mt-4 rounded-xl border border-accent/30 bg-accent/[0.06] p-4 md:mt-5">
      <p className="text-[14px] font-semibold">Pick your interview time</p>
      <div role="group" aria-label="Offered times" className="mt-3 flex flex-col gap-3 md:flex-row md:flex-wrap md:gap-6">
        {days.map(({ day, slots }) => (
          <div key={day} className="flex items-center gap-3 md:flex-col md:items-start md:gap-2">
            <p className="w-[92px] shrink-0 text-[13px] font-medium text-text-2 md:w-auto">{day}</p>
            <div className="flex flex-wrap gap-2">{slots.map(chip)}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 md:flex md:items-center md:justify-between md:gap-4">
        <p className="hidden text-[13px] text-text-2 md:block">{selected === null ? "Pick a time above." : slotLabel(selected)}</p>
        <button
          type="button"
          disabled={selected === null}
          onClick={() => setConfirming(true)}
          className={`${PRIMARY_PILL} h-11 w-full disabled:cursor-not-allowed disabled:opacity-50 md:h-9 md:w-auto`}
        >
          <span className="md:hidden">{selected === null ? "Pick a time" : `Confirm ${slotDay(selected)}, ${slotTime(selected)}`}</span>
          <span className="hidden md:inline">Confirm time</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        icon={<CalendarClock className="h-[18px] w-[18px]" strokeWidth={1.75} />}
        title="Confirm this interview time?"
        description={
          <>
            {selected === null ? "" : slotLabel(selected)} with {interview.lead}. Once you confirm, the time is set.
          </>
        }
        cancelLabel="Pick another"
        confirmLabel="Confirm time"
        pending={pending}
        onConfirm={confirm}
      />
    </div>
  );
}

function PastCard({ application: p }: { application: PastApplication }) {
  return (
    <article className={`${PANEL} flex items-center justify-between gap-4 px-4 py-3.5 md:px-6 md:py-4`}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-medium">{p.title}</h3>
        <p className="mt-0.5 text-[13px] text-prt-muted">
          <span className="hidden md:inline">{placeLine(p)} · sent </span>
          <span className="md:hidden">Sent </span>
          {sentLabel(p.sent)}
        </p>
      </div>
      <StatusPill pill={outcomePill(p.outcome)} />
    </article>
  );
}
