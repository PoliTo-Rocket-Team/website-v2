"use client";

import { useId, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Copy, ExternalLink, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  clockOf,
  firstNameOf,
  INTERVIEW_LENGTHS,
  isInterviewLength,
  MAX_OFFERED_SLOTS,
  addMonths,
  monthsBetween,
  monthTitle,
  pickedCount,
  pickerFirstMonth,
  pickerFirstWeekOf,
  pickerMonth,
  pickerWeek,
  slotAt,
  slotLength,
  timesOnDay,
  type InterviewLength,
  type PickerMonthRef,
  type SlotTime,
} from "@/lib/dashboard/application-flow";
import { interviewEmailHref } from "@/lib/dashboard/interview-email";
import { SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";

// Move to interview (boards 58c, 58j) and Change times (58d): the lead picks
// the times they can meet, in a week or a month view with no last week, and how long, then tells the applicant by email
// themselves, because the site sends no email. The main button waits until
// they tick that they did. A bottom sheet on a phone.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export type InterviewFor = {
  readonly name: string;
  readonly email: string;
  readonly position: string;
};

export function InterviewDialog({
  open,
  onOpenChange,
  mode,
  applicant,
  lead,
  now,
  offered,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "offer" | "change";
  applicant: InterviewFor;
  /** The lead's name: the email Open email starts signs with it. */
  lead: string;
  /** The moment the page is seen from: the picker greys out what is past. */
  now: string;
  /** The times already offered, for Change times. */
  offered: readonly SlotTime[];
  pending: boolean;
  onSubmit: (slots: SlotTime[]) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className={SHEET_OVERLAY} />
        <DialogPrimitive.Content aria-describedby={undefined} className={`${SHEET_CONTENT} sm:w-[560px] sm:px-8 sm:pb-7 sm:pt-7`}>
          {/* Mounted only while open, so each opening starts from what is saved. */}
          {open && <Picker mode={mode} applicant={applicant} lead={lead} now={now} offered={offered} pending={pending} onSubmit={onSubmit} />}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

function Picker({
  mode,
  applicant,
  lead,
  now,
  offered,
  pending,
  onSubmit,
}: {
  mode: "offer" | "change";
  applicant: InterviewFor;
  lead: string;
  now: string;
  offered: readonly SlotTime[];
  pending: boolean;
  onSubmit: (slots: SlotTime[]) => void;
}) {
  const first = firstNameOf(applicant.name);
  const initialLength = offered[0] === undefined ? undefined : slotLength(offered[0]);
  const [length, setLength] = useState<InterviewLength>(isInterviewLength(initialLength) ? initialLength : 30);
  // Change times starts from the times still to come.
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(offered.filter((s) => Date.parse(s.start) > Date.parse(now)).map((s) => new Date(s.start).toISOString())),
  );
  const [emailed, setEmailed] = useState(false);
  const boxId = useId();
  const ready = picked.size > 0 && emailed && !pending;

  const toggle = (start: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(start)) next.delete(start);
      else if (next.size < MAX_OFFERED_SLOTS) next.add(start);
      return next;
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(applicant.email);
      toast.success("Email address copied");
    } catch {
      toast.error("Could not copy. Select the address and copy it.");
    }
  };

  // Mounted only while open, so this runs in the browser: the link names the site the lead is on.
  const emailHref = interviewEmailHref({
    to: applicant.email,
    applicant: applicant.name,
    position: applicant.position,
    lead,
    site: window.location.origin,
  });

  return (
    <>
      <SheetGrabber />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <DialogTitle className="text-[20px] font-bold leading-snug">{mode === "offer" ? "Move to interview" : "Change interview times"}</DialogTitle>
          <p className="mt-0.5 text-[13px] text-prt-muted">
            {applicant.name} · {applicant.position}
          </p>
        </div>
        <DialogClose aria-label="Close" className={`-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${FOCUS}`}>
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
        </DialogClose>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-[14px]">
          <span className="font-semibold">1.</span> <span className="font-medium">Pick the times you can meet</span>{" "}
          <span className="text-prt-muted">
            {first} picks one
          </span>
        </p>
        <LengthMenu value={length} onChange={setLength} />
      </div>

      <Calendar now={now} picked={picked} onToggle={toggle} />
      <p className="mt-2.5 text-[12px] text-prt-muted">{pickedCount(picked)}</p>

      <section className="mt-5 rounded-xl border border-accent/40 bg-accent/[0.06] px-4 py-4">
        <h3 className="flex items-center gap-2.5 text-[14px] font-semibold">
          <Mail aria-hidden className="h-4 w-4 text-accent" strokeWidth={1.75} />
          <span>2.</span> Email {first} yourself
        </h3>
        <p className="mt-2.5 text-[13px] leading-relaxed text-text-2">
          {mode === "offer"
            ? `The site does not send emails. ${first} only learns about the interview from you. Ask them to open My applications on the PRT Dashboard and pick a time.`
            : `The site does not send emails. Tell ${first} the times changed and to pick a new one in My applications.`}
        </p>
        <div className="mt-3.5 flex flex-col gap-2 sm:flex-row">
          <p className="flex h-9 min-w-0 items-center truncate rounded-lg border border-white-10 bg-white-5 px-3 text-[13px] text-prt-text sm:flex-1">
            {applicant.email}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copy}
              className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white-10 px-3 text-[13px] font-medium transition-colors duration-300 ease-out hover:border-border-strong sm:flex-none ${FOCUS}`}
            >
              <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Copy
            </button>
            <a
              href={emailHref}
              target="_blank"
              rel="noopener"
              className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white-10 px-3 text-[13px] font-medium transition-colors duration-300 ease-out hover:border-border-strong sm:flex-none ${FOCUS}`}
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open email
            </a>
          </div>
        </div>
        <label htmlFor={boxId} className="mt-3.5 flex cursor-pointer items-center gap-2.5 text-[14px] font-medium">
          <input id={boxId} type="checkbox" checked={emailed} onChange={(e) => setEmailed(e.target.checked)} className="peer sr-only" />
          <span
            aria-hidden
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-300 ease-out peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent ${
              emailed ? "border-accent bg-accent text-accent-on-accent" : "border-border-strong"
            }`}
          >
            {emailed && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
          </span>
          I&apos;ve emailed {first}
        </label>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-2.5">
        <DialogClose className={`inline-flex h-11 items-center justify-center rounded-full border border-white-10 text-[14px] font-semibold transition-colors duration-300 ease-out hover:border-border-strong ${FOCUS}`}>
          Cancel
        </DialogClose>
        <button
          type="button"
          disabled={!ready}
          onClick={() => onSubmit([...picked].sort().map((start) => slotAt(start, length)))}
          className={`inline-flex h-11 items-center justify-center rounded-full bg-prt-text text-[14px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
        >
          {mode === "offer" ? "Move to interview" : "Save times"}
        </button>
      </div>
    </>
  );
}

/** What the calendar shows: one picker week, or one month. The picked set lives above it, so a switch never drops a time. */
type CalendarView = { readonly kind: "week"; readonly week: number } | { readonly kind: "month"; readonly month: PickerMonthRef };

const ARROW = `flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-text-2 transition-colors duration-300 ease-out hover:border-border-strong hover:text-prt-text disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-hairline ${FOCUS}`;

function Calendar({ now, picked, onToggle }: { now: string; picked: ReadonlySet<string>; onToggle: (start: string) => void }) {
  const at = new Date(now);
  const [view, setView] = useState<CalendarView>({ kind: "week", week: 0 });
  const first = pickerFirstMonth(at);
  const week = view.kind === "week" ? pickerWeek(at, view.week) : null;
  const month = view.kind === "month" ? view.month : (week?.month ?? first);
  const atStart = view.kind === "week" ? view.week === 0 : monthsBetween(first, view.month) <= 0;
  const unit = view.kind;

  const step = (by: 1 | -1) =>
    setView((v) => (v.kind === "week" ? { kind: "week", week: Math.max(0, v.week + by) } : { kind: "month", month: addMonths(v.month, by) }));
  const jump = (to: PickerMonthRef) =>
    setView((v) => (v.kind === "week" ? { kind: "week", week: pickerFirstWeekOf(at, to) } : { kind: "month", month: to }));
  const switchTo = (kind: CalendarView["kind"]) => {
    if (kind === view.kind) return;
    setView(kind === "month" ? { kind: "month", month } : { kind: "week", week: pickerFirstWeekOf(at, month) });
  };

  return (
    <div className="mt-3 rounded-xl border border-hairline bg-ground/40 p-2.5 md:p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <MonthMenu first={first} value={month} onChange={jump} />
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Calendar view" className="flex h-8 items-center rounded-lg border border-hairline p-0.5">
            {(
              [
                ["week", "Week"],
                ["month", "Month"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                aria-pressed={view.kind === kind}
                onClick={() => switchTo(kind)}
                className={`h-full rounded-md px-3 text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
                  view.kind === kind ? "bg-white-10 font-semibold text-prt-text" : "text-prt-muted hover:text-prt-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button type="button" aria-label={`Earlier ${unit}`} disabled={atStart} onClick={() => step(-1)} className={ARROW}>
              <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
            <button type="button" aria-label={`Later ${unit}`} onClick={() => step(1)} className={ARROW}>
              <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {week ? week.title : monthTitle(month)}
      </p>
      {week ? (
        <div className="grid grid-cols-5 gap-1.5">
          {week.days.map((day) => (
            <div key={day.label} className="flex min-w-0 flex-col gap-1.5" role="group" aria-label={day.label}>
              <p className="text-center text-[11px] font-semibold text-prt-text md:text-[12px]">{day.label}</p>
              {day.starts.map(({ start, past }) => {
                const on = picked.has(start);
                return (
                  <button
                    key={start}
                    type="button"
                    disabled={past && !on}
                    aria-pressed={on}
                    aria-label={`${day.label}, ${clockOf(start)}`}
                    onClick={() => onToggle(start)}
                    className={`h-8 rounded-md border text-[12px] transition-colors duration-300 ease-out ${FOCUS} ${
                      on
                        ? "border-accent bg-accent font-semibold text-accent-on-accent"
                        : "border-hairline text-prt-muted hover:border-border-strong hover:text-prt-text disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-hairline"
                    }`}
                  >
                    {clockOf(start)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <MonthGrid now={at} month={month} picked={picked} onOpen={(w) => setView({ kind: "week", week: w })} />
      )}
    </div>
  );
}

const WEEKDAY_HEADS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The month view (58j): a day opens its week; past days are dimmed and open nothing. */
function MonthGrid({ now, month, picked, onOpen }: { now: Date; month: PickerMonthRef; picked: ReadonlySet<string>; onOpen: (week: number) => void }) {
  const grid = pickerMonth(now, month, picked);
  return (
    <>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_HEADS.map((head) => (
          <p key={head} aria-hidden className="text-center text-[11px] font-semibold text-prt-text md:text-[12px]">
            {head}
          </p>
        ))}
        {grid.days.map((day) => {
          const marked = day.count > 0;
          return (
            <button
              key={day.date}
              type="button"
              disabled={day.past}
              aria-current={day.today ? "date" : undefined}
              aria-label={`${day.label}${marked ? `, ${timesOnDay(day.count)} picked` : ""}`}
              onClick={() => !day.past && onOpen(day.week)}
              className={`flex h-11 min-w-0 flex-col items-start justify-start rounded-lg border px-1.5 pt-1 text-left transition-colors duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-40 md:h-[42px] md:px-2 ${FOCUS} ${
                marked ? "border-accent bg-accent-soft" : day.today ? "border-accent" : "border-hairline hover:border-border-strong disabled:hover:border-hairline"
              }`}
            >
              <span className={`text-[12px] leading-tight md:text-[13px] ${marked ? "font-semibold text-prt-text" : day.inMonth && !day.past ? "text-prt-text" : "text-prt-muted"}`}>
                {day.day}
              </span>
              {marked && (
                <span className="mt-0.5 max-w-full truncate text-[10px] font-medium leading-tight text-accent md:text-[11px]">
                  <span className="sm:hidden">{day.count}</span>
                  <span className="hidden sm:inline">{timesOnDay(day.count)}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[12px] text-prt-muted">Pick a day to set its times. Days with picked times are marked.</p>
    </>
  );
}

/** The month selector: from the picker's first month, a year ahead or on to the shown month, whichever is later. */
function MonthMenu({ first, value, onChange }: { first: PickerMonthRef; value: PickerMonthRef; onChange: (month: PickerMonthRef) => void }) {
  const months = Array.from({ length: Math.max(12, monthsBetween(first, value) + 1) }, (_, i) => addMonths(first, i));
  const key = (m: PickerMonthRef) => `${m.year}-${m.month}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Month: ${monthTitle(value)}`}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[14px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:border-border-strong data-[state=open]:border-border-strong ${FOCUS}`}
      >
        {monthTitle(value)}
        <ChevronDown aria-hidden className="h-3.5 w-3.5 text-prt-muted" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-[280px] min-w-[180px] overflow-y-auto rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup
            value={key(value)}
            onValueChange={(v) => {
              const chosen = months.find((m) => key(m) === v);
              if (chosen) onChange(chosen);
            }}
          >
            {months.map((m) => (
              <DropdownMenuPrimitive.RadioItem
                key={key(m)}
                value={key(m)}
                className="flex h-8 cursor-pointer items-center justify-between gap-4 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text"
              >
                {monthTitle(m)}
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                </DropdownMenuPrimitive.ItemIndicator>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}

function LengthMenu({ value, onChange }: { value: InterviewLength; onChange: (value: InterviewLength) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Interview length: ${value} minutes`}
        className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[12px] text-prt-text transition-colors duration-300 ease-out hover:border-border-strong data-[state=open]:border-border-strong ${FOCUS}`}
      >
        {value} min
        <ChevronDown aria-hidden className="h-3.5 w-3.5 text-prt-muted" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[120px] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup value={String(value)} onValueChange={(v) => onChange(Number(v) as InterviewLength)}>
            {INTERVIEW_LENGTHS.map((minutes) => (
              <DropdownMenuPrimitive.RadioItem
                key={minutes}
                value={String(minutes)}
                className="flex h-8 cursor-pointer items-center justify-between gap-4 rounded-lg px-2.5 text-[13px] text-text-2 outline-none transition-colors data-[highlighted]:bg-white-5 data-[highlighted]:text-prt-text"
              >
                {minutes} min
                <DropdownMenuPrimitive.ItemIndicator>
                  <Check aria-hidden className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                </DropdownMenuPrimitive.ItemIndicator>
              </DropdownMenuPrimitive.RadioItem>
            ))}
          </DropdownMenuPrimitive.RadioGroup>
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPortal>
    </DropdownMenu>
  );
}
