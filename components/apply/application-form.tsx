"use client";

import { Calendar, ChevronDown, FileText, Lock, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type ChangeEvent, type DragEvent, type FocusEvent, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { RocketLaunch } from "@/components/landing/rocket-arrow";
import { usePhoneGrouping } from "@/components/use-phone-grouping";
import { PHONE_PLACEHOLDER } from "@/lib/phone";
import {
  DEGREE_PROGRAMMES,
  GENDERS,
  MAX_PDF_LABEL,
  ORIGINS,
  REFERRAL_SOURCES,
  STUDY_PROGRAMMES,
  parseApplicationForm,
  pdfProblem,
  setPdfField,
  type FieldErrors,
  type FormDefaults,
  type PdfFieldName,
  type PdfPick,
  type PositionAsks,
  type PreviousFile,
  type PreviousFiles,
} from "@/lib/apply/application-form";
import { positionPage } from "@/lib/apply/page";
import { SUBMIT_MESSAGES, type SubmitResult } from "@/lib/apply/submit-result";

// Board 35 (35m on phones): the application form, in the board's order.
// About you, Your studies, the role's questions (only when it has some),
// Documents (the motivation letter only when the role asks for one), the
// statistics questions, then the send row. It validates with the same schema
// the server action uses, then sends; the server checks everything again.

const copy = positionPage.form;

/** A field starts on the file the applicant sent before, when there is one (issue #826). */
const previousPick = (file: PreviousFile | null): PdfPick => (file === null ? null : { kind: "previous", file });

export function ApplicationForm({
  email,
  defaults,
  previous,
  asks,
  send,
}: {
  /** The Google account's email: shown, locked, never sent. */
  email: string;
  defaults: FormDefaults;
  /** The CV and letter the applicant sent before: each field starts on its own, and a new upload replaces it. */
  previous: PreviousFiles;
  asks: PositionAsks;
  send: (form: FormData) => Promise<SubmitResult>;
}) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [cv, setCv] = useState<PdfPick>(() => previousPick(previous.cv));
  const [letter, setLetter] = useState<PdfPick>(() => previousPick(previous.motivationLetter));
  const [sending, setSending] = useState(false);
  const phone = usePhoneGrouping();

  const clear = (field: string) =>
    setErrors((e) => {
      if (e[field] === undefined) return e;
      const { [field]: _, ...rest } = e;
      return rest;
    });

  /**
   * Keeps a picked or dropped PDF, and flags it on its field at once when it
   * cannot be sent. Removing it goes back to the file sent before, if any.
   */
  const pickPdf = (field: PdfFieldName, before: PreviousFile | null, keep: (pick: PdfPick) => void) => (file: File | null) => {
    keep(file === null ? previousPick(before) : { kind: "upload", file });
    const problem = file === null ? null : pdfProblem(file);
    if (problem === null) clear(field);
    else setErrors((e) => ({ ...e, [field]: problem }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPdfField(form, "cv", cv);
    setPdfField(form, "motivationLetter", asks.requiresMotivationLetter ? letter : null);

    const checked = parseApplicationForm(form, asks);
    if (!checked.ok) {
      setErrors(checked.errors);
      toast.error(SUBMIT_MESSAGES.invalid);
      return;
    }

    setSending(true);
    try {
      const result = await send(form);
      if (result.ok) {
        router.refresh();
        return;
      }
      if (result.reason === "invalid") {
        setErrors(result.errors);
        toast.error(SUBMIT_MESSAGES.invalid);
        setSending(false);
        return;
      }
      toast.error(SUBMIT_MESSAGES[result.reason]);
      if (result.reason !== "failed") router.refresh();
      setSending(false);
    } catch (error) {
      console.error("Failed to send the application:", error);
      toast.error(SUBMIT_MESSAGES.failed, {
        description: error instanceof Error ? error.message : undefined,
        duration: 5000,
      });
      setSending(false);
    }
  }

  return (
    <form noValidate onSubmit={onSubmit} onChange={(e) => clear((e.target as HTMLInputElement).name)} className="glass-card rounded-xl p-5 md:p-9">
      <p className="font-mono text-[11px] tracking-[0.3em] text-accent">{positionPage.eyebrow}</p>

      <Section title={copy.about}>
        <div className="grid gap-x-3 gap-y-5 md:grid-cols-3">
          <TextField name="firstName" label="First name" autoComplete="given-name" defaultValue={defaults.firstName} errors={errors} />
          <TextField name="lastName" label="Last name" autoComplete="family-name" defaultValue={defaults.lastName} errors={errors} />
          <TextField
            name="politoId"
            label="PoliTo ID"
            hint="numbers only"
            inputMode="numeric"
            defaultValue={defaults.politoId}
            errors={errors}
          />
          <Field label="Email" hint="from your Google account">
            {(id) => (
              <div className="relative">
                <input
                  id={id}
                  type="email"
                  value={email}
                  readOnly
                  aria-readonly
                  tabIndex={-1}
                  className={`${inputClass(undefined, "text-prt-muted")} cursor-not-allowed pr-10`}
                />
                <Lock aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              </div>
            )}
          </Field>
          <TextField
            name="phone"
            label="Phone number"
            hint="with country code"
            type="tel"
            autoComplete="tel"
            placeholder={PHONE_PLACEHOLDER}
            defaultValue={defaults.phone}
            errors={errors}
            {...phone}
          />
          <Field label="Date of birth" error={errors.dateOfBirth}>
            {(id, describedBy) => (
              <div className="relative">
                {/* Chrome, Edge and Safari hide their own picker button under this icon; Firefox draws its own and offers no way to hide it, so there the field shows Firefox's alone (issue #895). */}
                <Calendar aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted supports-[-moz-appearance:none]:hidden" />
                <input
                  id={id}
                  name="dateOfBirth"
                  type="date"
                  autoComplete="bday"
                  defaultValue={defaults.dateOfBirth}
                  aria-invalid={errors.dateOfBirth !== undefined}
                  aria-describedby={describedBy}
                  className={`${inputClass(errors.dateOfBirth)} relative pl-10 supports-[-moz-appearance:none]:pl-3.5 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                />
              </div>
            )}
          </Field>
        </div>
      </Section>

      <Section title={copy.studies}>
        <div className="grid gap-x-3 gap-y-5 md:grid-cols-2">
          <SelectField name="studyProgramme" label="Study programme" options={STUDY_PROGRAMMES} defaultValue={defaults.studyProgramme} errors={errors} />
          <SelectField name="degreeProgramme" label="Degree programme" options={DEGREE_PROGRAMMES} defaultValue={defaults.degreeProgramme} errors={errors} />
        </div>
      </Section>

      {asks.questions.length > 0 && (
        <Section title={copy.questions.title} intro={copy.questions.intro}>
          <div className="flex flex-col gap-5">
            {asks.questions.map((question, i) => (
              <Field key={question} label={question} error={errors[`answers.${i}`]}>
                {(id, describedBy) => (
                  <textarea
                    id={id}
                    name="answers"
                    rows={4}
                    placeholder="Your answer"
                    aria-invalid={errors[`answers.${i}`] !== undefined}
                    aria-describedby={describedBy}
                    onChange={() => clear(`answers.${i}`)}
                    className={`${inputClass(errors[`answers.${i}`])} block h-auto min-h-[112px] resize-none py-3 leading-[1.5]`}
                  />
                )}
              </Field>
            ))}
          </div>
        </Section>
      )}

      <Section
        title={copy.documents.title}
        intro={asks.requiresMotivationLetter ? copy.documents.intro : copy.documents.introCvOnly}
      >
        <div className="grid gap-x-3 gap-y-5 md:grid-cols-2">
          <PdfField
            label="CV / Résumé"
            hint={`PDF, up to ${MAX_PDF_LABEL}`}
            pick={cv}
            onFile={pickPdf("cv", previous.cv, setCv)}
            error={errors.cv}
          />
          {asks.requiresMotivationLetter && (
            <PdfField
              label="Motivation letter"
              hint={`PDF, 1 page, up to ${MAX_PDF_LABEL}`}
              pick={letter}
              onFile={pickPdf("motivationLetter", previous.motivationLetter, setLetter)}
              error={errors.motivationLetter}
            />
          )}
        </div>
      </Section>

      <Section title={copy.more.title} intro={copy.more.intro}>
        <div className="grid gap-x-3 gap-y-5 md:grid-cols-2">
          <Segmented name="gender" label="Gender" options={GENDERS} defaultValue={defaults.gender} errors={errors} />
          <Segmented name="origin" label="International or domestic" options={ORIGINS} defaultValue={defaults.origin} errors={errors} />
          <SelectField
            name="referral"
            label="How did you find out about us?"
            options={REFERRAL_SOURCES}
            defaultValue={defaults.referral}
            errors={errors}
          />
        </div>
      </Section>

      <div className="mt-6 flex flex-col gap-4 border-t border-white-10 pt-6 md:flex-row md:items-center md:justify-between">
        <p className="text-[12px] leading-[1.5] text-prt-muted md:text-[13px]">{copy.oneEach}</p>
        <button
          type="submit"
          disabled={sending}
          aria-busy={sending}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-3 rounded-full bg-prt-text px-6 text-[15px] font-semibold text-ground transition-opacity duration-300 ease-out hover:opacity-90 active:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-70 max-md:w-full"
        >
          {sending ? copy.sending : copy.send}
          <RocketLaunch />
        </button>
      </div>
    </form>
  );
}

const inputBase =
  "h-11 w-full rounded-[10px] border bg-white-5 px-3.5 text-[15px] placeholder:text-dim transition-colors duration-300 ease-out focus:outline-none";

function inputClass(error?: string, text = "text-prt-text"): string {
  return `${inputBase} ${text} ${error === undefined ? "border-white-10 focus:border-border-strong" : "border-danger"}`;
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-white-10 pt-5 md:mt-6 md:pt-6">
      <h3 className="text-[17px] font-bold tracking-[-0.01em]">{title}</h3>
      {intro && <p className="mt-1.5 text-[13px] leading-[1.55] text-prt-muted">{intro}</p>}
      <div className="mt-4 md:mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-2 block text-[13px] leading-snug text-text-2">
        {label}
        {hint && <span className="ml-2 text-prt-muted">{hint}</span>}
      </label>
      {children(id, error === undefined ? undefined : errorId)}
      {error !== undefined && (
        <p id={errorId} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function TextField({
  name,
  label,
  hint,
  errors,
  type = "text",
  ...input
}: {
  name: string;
  label: string;
  hint?: string;
  errors: FieldErrors;
  type?: string;
  defaultValue: string;
  autoComplete?: string;
  inputMode?: "numeric";
  placeholder?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
}) {
  const error = errors[name];
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, describedBy) => (
        <input
          id={id}
          name={name}
          type={type}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
          className={inputClass(error)}
          {...input}
        />
      )}
    </Field>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
  errors: FieldErrors;
}) {
  const error = errors[name];
  return (
    <Field label={label} error={error}>
      {(id, describedBy) => (
        <div className="relative">
          <select
            id={id}
            name={name}
            defaultValue={defaultValue}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
            className={`${inputClass(error)} cursor-pointer appearance-none pr-10 invalid:text-dim`}
            required
          >
            <option value="" disabled hidden>
              Choose one
            </option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-2" />
        </div>
      )}
    </Field>
  );
}

/** A choice of two or three, drawn as one pill bar (board 35): native radios, so keys and screen readers work as usual. */
function Segmented({
  name,
  label,
  options,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  options: readonly string[];
  defaultValue: string;
  errors: FieldErrors;
}) {
  const error = errors[name];
  const labelId = useId();
  return (
    <div className="min-w-0" role="radiogroup" aria-labelledby={labelId} aria-invalid={error !== undefined}>
      <p id={labelId} className="mb-2 text-[13px] leading-snug text-text-2">
        {label}
      </p>
      <div
        className={`grid h-11 gap-1 rounded-[10px] border bg-white-5 p-1 ${error === undefined ? "border-white-10" : "border-danger"}`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <label
            key={o}
            className="flex cursor-pointer items-center justify-center rounded-[7px] text-[14px] text-text-2 transition-colors duration-300 ease-out hover:text-prt-text has-[:checked]:bg-prt-text has-[:checked]:font-semibold has-[:checked]:text-ground has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent"
          >
            <input type="radio" name={name} value={o} defaultChecked={o === defaultValue} className="sr-only" />
            {o}
          </label>
        ))}
      </div>
      {error !== undefined && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </div>
  );
}

/** The line under a file sent before, beside its size. */
const PREVIOUS_NOTE = "From your last application";

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * A PDF drop zone (board 35): drop or browse; once chosen, the file's name and
 * size with a remove button. A file sent before shows the same way, marked as
 * such, with a Change button that browses for another (issue #826); dropping a
 * PDF on it replaces it too.
 */
function PdfField({
  label,
  hint,
  pick,
  onFile,
  error,
}: {
  label: string;
  hint: string;
  pick: PdfPick;
  onFile: (file: File | null) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const border = error !== undefined ? "border-danger" : over ? "border-accent/60 bg-accent-soft" : "border-white-10";

  const onDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  return (
    <Field label={label} hint={hint} error={error}>
      {(id, describedBy) => (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <input
            ref={input}
            id={id}
            type="file"
            accept="application/pdf,.pdf"
            aria-describedby={describedBy}
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          {pick === null ? (
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-[10px] border text-[13px] text-text-2 transition-colors duration-300 ease-out hover:border-border-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${border}`}
            >
              <Upload aria-hidden className="h-4 w-4" />
              <span>
                Drop a PDF here or <span className="font-semibold text-prt-text">browse</span>
              </span>
            </button>
          ) : (
            <div className={`flex h-14 items-center gap-3 rounded-[10px] border bg-white-5 px-3.5 ${border}`}>
              <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-prt-text">{pick.file.name}</span>
                {/* Only the note shortens on a narrow screen; the size always shows in full (issue #857). */}
                <span className="flex min-w-0 text-[11px] text-prt-muted">
                  {pick.kind === "previous" ? (
                    <>
                      <span className="truncate">{PREVIOUS_NOTE}</span>
                      {pick.file.size === null ? null : (
                        <span className="shrink-0 whitespace-pre">{` · ${formatSize(pick.file.size)}`}</span>
                      )}
                    </>
                  ) : (
                    <span className="shrink-0">{formatSize(pick.file.size)}</span>
                  )}
                </span>
              </span>
              {pick.kind === "previous" ? (
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  aria-label={`Change ${pick.file.name}: upload a different PDF`}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold text-prt-text transition-colors duration-300 ease-out hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <Upload aria-hidden className="h-4 w-4" />
                  Change
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onFile(null)}
                  aria-label={`Remove ${pick.file.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-2 transition-colors duration-300 ease-out hover:text-prt-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
