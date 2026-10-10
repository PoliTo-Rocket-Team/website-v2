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
  pickedCount,
  pickerWeek,
  PICKER_WEEKS,
  slotAt,
  slotLength,
  type InterviewLength,
  type SlotTime,
} from "@/lib/dashboard/application-flow";
import { interviewEmailHref } from "@/lib/dashboard/interview-email";
import { SHEET_CONTENT, SHEET_OVERLAY, SheetGrabber } from "./confirm-dialog";

// Move to interview (board 58c) and Change times (58d): the lead picks the
// times they can meet and how long, then tells the applicant by email
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
  const [week, setWeek] = useState(0);
  const [emailed, setEmailed] = useState(false);
  const boxId = useId();
  const shown = pickerWeek(new Date(now), week);
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

      <div className="mt-3 rounded-xl border border-hairline bg-ground/40 p-2.5 md:p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Earlier week"
            disabled={week === 0}
            onClick={() => setWeek((w) => w - 1)}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-text-2 transition-colors duration-300 ease-out hover:bg-white-5 disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS}`}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
          <p className="text-[13px] font-semibold" aria-live="polite">
            {shown.title}
          </p>
          <button
            type="button"
            aria-label="Later week"
            disabled={week === PICKER_WEEKS - 1}
            onClick={() => setWeek((w) => w + 1)}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-text-2 transition-colors duration-300 ease-out hover:bg-white-5 disabled:cursor-not-allowed disabled:opacity-30 ${FOCUS}`}
          >
            <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {shown.days.map((day) => (
            <div key={day.label} className="flex min-w-0 flex-col gap-1.5" role="group" aria-label={day.label}>
              <p className="text-center text-[11px] font-medium text-text-2 md:text-[12px]">{day.label}</p>
              {day.starts.map(({ start, past }) => {
                const on = picked.has(start);
                return (
                  <button
                    key={start}
                    type="button"
                    disabled={past && !on}
                    aria-pressed={on}
                    aria-label={`${day.label}, ${clockOf(start)}`}
                    onClick={() => toggle(start)}
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
      </div>
      <p className="mt-2.5 text-[12px] text-prt-muted">{pickedCount(picked.size)}</p>

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
