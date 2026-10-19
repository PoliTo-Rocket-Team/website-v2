"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Building2, Check, ChevronDown, Copy, Eye, EyeOff, FileCheck2, Lock, Mail, Upload, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { addMember, findForAdd, saveMemberDetails, setMemberPhoto } from "@/app/dashboard/team-actions";
import { DEGREE_PROGRAMMES, GENDERS, STUDY_PROGRAMMES } from "@/lib/apply/application-form";
import {
  levelLabel,
  memberDetailText,
  NO_MEMBER_DETAILS,
  type MemberDetailErrors,
  type MemberDetailKey,
  type MemberDetails,
} from "@/lib/dashboard/details";
import {
  checkAddMember,
  checkMemberEdit,
  checkMemberPhoto,
  type AddLookup,
  type AddMemberErrors,
  type DivisionHeader,
  type DivisionPerson,
  type TeamMatch,
  type WaitingPerson,
} from "@/lib/dashboard/division-members";
import { divisionLabel } from "@/lib/dashboard/team";
import { shortDate } from "@/lib/dashboard/write";
import { Avatar } from "./avatar";
import { DropdownMenu, DropdownMenuPortal, DropdownMenuPrimitive, DropdownMenuTrigger } from "./menu";
import { Chips } from "./division-chips";
import { Drawer, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { Toggle } from "./controls";
import { EYEBROW, GHOST_PILL } from "./page-header";
import { PHOTO_ACCEPT, PhotoCropDialog } from "./photo-crop-dialog";

// The member panels of a division's Members page (issue #231): the member
// panel with their private data (board 61f), Edit details (61g) and Add
// member (61h, 61h2). Private data is blurred until hover; there is no access
// section, since access lives only on the Access page.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className={`${EYEBROW} mb-3`}>
        {title}
        {hint && <span className="ml-2 normal-case tracking-normal text-dim">· {hint}</span>}
      </h3>
      {children}
    </section>
  );
}

async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}`);
  }
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${FOCUS}`}
    >
      {children}
    </button>
  );
}

/** One fact on the member panel: label, value, and a copy or show button. Empty reads as a dim dash. */
function Fact({
  label,
  value,
  copy,
  hidden,
}: {
  label: string;
  value: string | null;
  /** Copies the value, with this name in the toast. */
  copy?: string;
  /** Blurred until hover, with an eye that shows it for good. */
  hidden?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const blur = hidden && !shown && value !== null;
  return (
    <div className="flex min-h-7 items-center gap-3">
      <dt className="w-[132px] shrink-0 text-[14px] text-prt-muted">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-[14px] text-prt-text">
        {value === null ? (
          <span className="text-dim">–</span>
        ) : (
          <span className={`transition-[filter] duration-300 ease-out ${blur ? "blur-[5px] hover:blur-none" : ""}`}>{value}</span>
        )}
      </dd>
      {value !== null && copy && (
        <IconButton label={`Copy ${copy.toLowerCase()}`} onClick={() => copyText(value, copy)}>
          <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </IconButton>
      )}
      {value !== null && hidden && (
        <IconButton label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setShown((s) => !s)}>
          {shown ? <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> : <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />}
        </IconButton>
      )}
    </div>
  );
}

/** What the member panel shows of someone: a division page's person, or one on the team leader's whole-team page (issue #252). */
export type PanelPerson = Pick<DivisionPerson, "name" | "signInEmail" | "photoUrl" | "since" | "divisions" | "details" | "nda" | "self">;

/** The member panel (board 61f): divisions, contact, studies, personal and the NDA. Close, and Edit details. */
export function PersonDrawer<P extends PanelPerson>({
  person,
  editable,
  onClose,
  onEdit,
}: {
  person: P | null;
  editable: boolean;
  onClose: () => void;
  onEdit: (person: P) => void;
}) {
  // The panel keeps showing the last person while it closes.
  const [shown, setShown] = useState(person);
  if (person !== null && person !== shown) setShown(person);
  const p = person ?? shown;
  if (p === null) return null;
  const d = p.details;
  const count = p.divisions.length;
  return (
    <SidePanel
      open={person !== null}
      onOpenChange={(next) => !next && onClose()}
      title={p.name}
      detail={`Member since ${p.since} · ${count} ${count === 1 ? "division" : "divisions"}`}
      leading={<Avatar size="panel" photoUrl={p.photoUrl} />}
      footer={
        editable && !p.self ? (
          <>
            <DialogClose className={PANEL_GHOST_BUTTON}>Close</DialogClose>
            <button type="button" onClick={() => onEdit(p)} className={PANEL_PRIMARY_BUTTON}>
              Edit details
            </button>
          </>
        ) : (
          <DialogClose className={`${PANEL_GHOST_BUTTON} col-span-2`}>Close</DialogClose>
        )
      }
    >
      <PanelBody>
        <Section title="Divisions">
          <ul className="flex flex-col gap-2">
            {p.divisions.map((x) => (
              <li key={x.divisionId} className="flex items-center gap-3 rounded-[10px] border border-hairline bg-white-5 px-3.5 py-2.5">
                {x.sameDepartment ? (
                  <Chips chips={[{ divisionId: x.divisionId, label: x.code ?? x.name, code: x.code !== null }]} />
                ) : (
                  <Building2 aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
                )}
                <span className="min-w-0 flex-1 truncate text-[14px] text-prt-text">
                  {x.sameDepartment ? x.name : `${x.department} · ${x.name}`}
                </span>
                <span className={`shrink-0 text-[13px] ${x.role === "lead" ? "text-accent" : "text-prt-muted"}`}>
                  {x.role === "lead" ? "Division Lead" : (x.title ?? "Member")}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Contact">
          <dl className="flex flex-col gap-1.5">
            <Fact label="PRT email" value={memberDetailText(d, "prtEmail")} copy="PRT email" />
            <Fact label="Personal email" value={p.signInEmail} copy="Email" />
            <Fact label="Phone" value={memberDetailText(d, "phone")} hidden />
            <Fact label="Discord" value={memberDetailText(d, "discord")} copy="Discord" />
            <Fact label="LinkedIn" value={memberDetailText(d, "linkedin")} />
          </dl>
        </Section>

        <Section title="Studies">
          <dl className="flex flex-col gap-1.5">
            <Fact label="PoliTo ID" value={memberDetailText(d, "politoId")} />
            <Fact label="Program" value={memberDetailText(d, "programme")} />
            <Fact label="Level" value={memberDetailText(d, "level")} />
            <Fact label="From" value={memberDetailText(d, "country")} />
          </dl>
        </Section>

        <Section title="Personal" hint="hover to show">
          <dl className="flex flex-col gap-1.5">
            <Fact label="Date of birth" value={memberDetailText(d, "birthDate")} hidden />
            <Fact label="Gender" value={memberDetailText(d, "gender")} hidden />
          </dl>
        </Section>

        {p.nda && (
          <Section title="NDA">
            <p className="flex items-center gap-2.5 rounded-[10px] border border-success/40 bg-success/[0.06] px-3.5 py-2.5 text-[13px] text-prt-text">
              <FileCheck2 aria-hidden className="h-4 w-4 shrink-0 text-success" strokeWidth={1.75} />
              Signed {shortDate(p.nda.signedOn, 0)}
              {p.nda.confirmedBy && ` · confirmed by ${p.nda.confirmedBy}`}
            </p>
          </Section>
        )}
      </PanelBody>
    </SidePanel>
  );
}

/** Who Edit details is open for: someone in the division, or someone waiting (Fill details). */
export type EditTarget = { readonly kind: "person"; readonly person: DivisionPerson } | { readonly kind: "waiting"; readonly waiting: WaitingPerson };

type Draft = Record<MemberDetailKey, string> & { title: string };

function draftOf(title: string | null, details: MemberDetails): Draft {
  return { ...details, title: title ?? "" };
}

function SelectBox({
  id,
  describedBy,
  value,
  error,
  onChange,
  options,
  label = (o) => o,
}: {
  id: string;
  describedBy: string | undefined;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  options: readonly string[];
  label?: (option: string) => string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        aria-describedby={describedBy}
        aria-invalid={error !== undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass(error)} cursor-pointer appearance-none pr-10 ${value === "" ? "text-dim" : ""}`}
      >
        <option value="" className="bg-panel">
          Choose
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-panel text-prt-text">
            {label(o)}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
    </div>
  );
}

const PLACEHOLDERS: Partial<Record<MemberDetailKey, string>> = {
  prtEmail: "name@politorocketteam.it",
  linkedin: "linkedin.com/in/...",
  phone: "+39 333 123 4567",
  discord: "username",
  politoId: "s312456",
  country: "Italy",
};

/** One member detail as a form control: a select for the lists, a date, or text. */
function DetailInput({
  name,
  label,
  draft,
  errors,
  set,
  className = "",
}: {
  name: MemberDetailKey;
  label: string;
  draft: Draft;
  errors: MemberDetailErrors;
  set: (key: keyof Draft, value: string) => void;
  className?: string;
}) {
  const error = errors[name];
  return (
    <Field label={label} error={error} className={className}>
      {(id, describedBy) =>
        name === "programme" ? (
          <SelectBox id={id} describedBy={describedBy} value={draft.programme} error={error} onChange={(v) => set("programme", v)} options={DEGREE_PROGRAMMES} />
        ) : name === "level" ? (
          <SelectBox
            id={id}
            describedBy={describedBy}
            value={draft.level}
            error={error}
            onChange={(v) => set("level", v)}
            options={STUDY_PROGRAMMES}
            label={(o) => levelLabel(o as (typeof STUDY_PROGRAMMES)[number])}
          />
        ) : name === "gender" ? (
          <SelectBox id={id} describedBy={describedBy} value={draft.gender} error={error} onChange={(v) => set("gender", v)} options={GENDERS} />
        ) : (
          <input
            id={id}
            type={name === "birthDate" ? "date" : name === "phone" ? "tel" : name === "prtEmail" ? "email" : "text"}
            value={draft[name]}
            aria-describedby={describedBy}
            aria-invalid={error !== undefined}
            placeholder={PLACEHOLDERS[name]}
            onChange={(e) => set(name, e.target.value)}
            className={inputClass(error)}
          />
        )
      }
    </Field>
  );
}

function useDraft(start: Draft) {
  const [draft, setDraft] = useState(start);
  const [errors, setErrors] = useState<AddMemberErrors>({});
  const set = (key: keyof Draft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };
  return { draft, setDraft, errors, setErrors, set };
}

function detailsOf(draft: Draft): Record<MemberDetailKey, string> {
  const { title: _title, ...details } = draft;
  return details;
}

/** Edit details (board 61g), or Fill details for someone waiting: the role in this division only, contact, studies, personal. */
export function EditDetailsDrawer({ target, division, onClose }: { target: EditTarget | null; division: DivisionHeader; onClose: () => void }) {
  const [shown, setShown] = useState(target);
  if (target !== null && target !== shown) setShown(target);
  const t = target ?? shown;
  if (t === null) return null;
  return <EditForm key={t.kind === "person" ? `p${t.person.id}` : `w${t.waiting.joinId}`} open={target !== null} target={t} division={division} onClose={onClose} />;
}

function EditForm({ open, target, division, onClose }: { open: boolean; target: EditTarget; division: DivisionHeader; onClose: () => void }) {
  const person = target.kind === "person" ? target.person : null;
  const waiting = target.kind === "waiting" ? target.waiting : null;
  const name = person?.name ?? waiting?.name ?? waiting?.email ?? "";
  const email = person?.signInEmail ?? waiting?.email ?? "";
  const { draft, errors, setErrors, set } = useDraft(draftOf(person?.title ?? waiting?.title ?? null, person?.details ?? waiting?.details ?? NO_MEMBER_DETAILS));
  const [pending, setPending] = useState(false);
  const short = divisionLabel(division.name);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = { title: draft.title, details: detailsOf(draft) };
    const checked = checkMemberEdit(input);
    if (!checked.ok) return setErrors(checked.errors);
    setPending(true);
    try {
      const result = await saveMemberDetails(
        person ? { kind: "person", id: person.id } : { kind: "waiting", joinId: waiting!.joinId },
        division.id,
        input,
      );
      if (!result.ok) {
        toast.error("Could not save the details", { description: result.error });
        return;
      }
      toast.success(`Saved ${name}`);
      onClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={name}
      detail={person ? "Edit details" : "Fill details"}
      leading={person ? <Avatar size="panel" photoUrl={person.photoUrl} /> : undefined}
      submitLabel="Save"
      submitting={pending}
      onSubmit={submit}
    >
      {person && (
        <Section title="Photo">
          <PhotoField person={person} divisionId={division.id} />
        </Section>
      )}

      <Section title="Role">
        <Field label={`Role in ${short}`} hint="shown on the Team page" error={errors.title}>
          {(id, describedBy) => (
            <input
              id={id}
              value={draft.title}
              maxLength={80}
              aria-describedby={describedBy}
              aria-invalid={errors.title !== undefined}
              onChange={(e) => set("title", e.target.value)}
              className={inputClass(errors.title)}
            />
          )}
        </Field>
      </Section>

      <Section title="Contact">
        <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
          <DetailInput name="prtEmail" label="PRT email" draft={draft} errors={errors} set={set} />
          <Field label="Personal email" hint="sign-in email">
            {(id) => (
              <span id={id} className={LOCKED_INPUT}>
                <span className="min-w-0 flex-1 truncate">{email}</span>
                <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              </span>
            )}
          </Field>
          <DetailInput name="phone" label="Phone" draft={draft} errors={errors} set={set} />
          <DetailInput name="discord" label="Discord" draft={draft} errors={errors} set={set} />
          <DetailInput name="linkedin" label="LinkedIn" draft={draft} errors={errors} set={set} className="sm:col-span-2" />
        </div>
      </Section>

      <Section title="Studies">
        <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
          <DetailInput name="politoId" label="PoliTo ID" draft={draft} errors={errors} set={set} />
          <DetailInput name="programme" label="Program" draft={draft} errors={errors} set={set} />
          <DetailInput name="level" label="Level" draft={draft} errors={errors} set={set} />
          <DetailInput name="country" label="From" draft={draft} errors={errors} set={set} />
        </div>
      </Section>

      <Section title="Personal">
        <div className="grid gap-x-3 gap-y-4 sm:grid-cols-2">
          <DetailInput name="birthDate" label="Date of birth" draft={draft} errors={errors} set={set} />
          <DetailInput name="gender" label="Gender" draft={draft} errors={errors} set={set} />
        </div>
      </Section>
    </Drawer>
  );
}

/** The photo row of Edit details: Upload photo opens the square crop; the saved photo is a JPEG under 500 KB. */
function PhotoField({ person, divisionId }: { person: DivisionPerson; divisionId: number }) {
  const [cropping, setCropping] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [preview, setPreview] = useState<string | null>(person.photoUrl);
  const input = useRef<HTMLInputElement>(null);

  const save = async (square: File) => {
    const error = checkMemberPhoto(square);
    if (error !== null) {
      toast.error("Could not use that photo", { description: error });
      return;
    }
    setPending(true);
    try {
      const form = new FormData();
      form.set("photo", square);
      const result = await setMemberPhoto(person.id, divisionId, form);
      if (!result.ok) {
        toast.error("Could not upload the photo", { description: result.error });
        return;
      }
      setPreview(URL.createObjectURL(square));
      setCropping(null);
      toast.success("Photo updated");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar size="panel" photoUrl={preview} />
      <input
        ref={input}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) setCropping(file);
        }}
      />
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className={GHOST_PILL}>
        <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        Upload photo
      </button>
      <span className="text-[13px] text-prt-muted">Square JPEG, under 500 KB</span>
      <PhotoCropDialog
        file={cropping}
        onOpenChange={(next) => !next && setCropping(null)}
        onChooseAnother={() => input.current?.click()}
        onSave={save}
        pending={pending}
      />
    </div>
  );
}

const EMPTY_DRAFT: Draft = { ...NO_MEMBER_DETAILS, title: "" };

/** Where Add member adds to: one division (a lead's page), or a choice of the department's divisions (a head's, board 69c). */
export type AddTarget =
  | { readonly kind: "division"; readonly division: DivisionHeader }
  | {
      readonly kind: "department";
      /** "Aerodynamics" */
      readonly department: string;
      readonly divisions: readonly DivisionHeader[];
      /** The division the select starts on: the open tab's, else the first. */
      readonly start: number;
    };

/**
 * Add member (boards 61h, 61h2 and 69c): type an email or search the team by
 * name. Someone on the team joins at once and keeps their other divisions; an
 * email new to the team shows the amber "Not in the team yet" line and waits
 * for Confirm NDA. "Fill in their other details now" opens the rest of the
 * form. The site sends no emails, so the drawer says to tell them. A head
 * picks the division first, from their department's divisions only.
 */
export function AddMemberDrawer({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: AddTarget }) {
  const [round, setRound] = useState(0);
  const start = target.kind === "division" ? target.division.id : target.start;
  return (
    <AddForm
      // A new round, or a new starting division, starts a fresh form.
      key={`${round}-${start}`}
      open={open}
      target={target}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setRound((r) => r + 1);
      }}
    />
  );
}

/** The Division select at the top of a head's Add member (board 69c): a code chip and the name, the department's divisions only. */
function DivisionSelect({
  id,
  divisions,
  value,
  onChange,
}: {
  id: string;
  divisions: readonly DivisionHeader[];
  value: DivisionHeader;
  onChange: (divisionId: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger id={id} className={`${inputClass()} flex items-center gap-2.5 text-left data-[state=open]:border-accent ${FOCUS}`}>
        <DivisionName division={value} />
        <ChevronDown aria-hidden className="ml-auto h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] rounded-xl border border-hairline bg-panel p-1.5 text-prt-text shadow-[0_16px_40px_rgba(0,0,0,0.6)] focus:outline-none motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0"
        >
          <DropdownMenuPrimitive.RadioGroup value={String(value.id)} onValueChange={(next) => onChange(Number(next))}>
            {divisions.map((d) => (
              <DropdownMenuPrimitive.RadioItem
                key={d.id}
                value={String(d.id)}
                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-[14px] outline-none transition-colors data-[highlighted]:bg-white-5"
              >
                <DivisionName division={d} />
                <DropdownMenuPrimitive.ItemIndicator className="ml-auto">
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

function DivisionName({ division }: { division: DivisionHeader }) {
  return (
    <>
      {division.code !== null && <Chips chips={[{ divisionId: division.id, label: division.code, code: true }]} />}
      <span className="min-w-0 truncate text-[14px] text-prt-text">{divisionLabel(division.name)}</span>
    </>
  );
}

function AddForm({ open, onOpenChange, target }: { open: boolean; onOpenChange: (open: boolean) => void; target: AddTarget }) {
  const choices = target.kind === "department" ? target.divisions : [target.division];
  const [divisionId, setDivisionId] = useState(target.kind === "division" ? target.division.id : target.start);
  const division = choices.find((d) => d.id === divisionId) ?? choices[0];
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<AddLookup>({ kind: "none" });
  const [picked, setPicked] = useState<TeamMatch | null>(null);
  const [names, setNames] = useState({ firstName: "", lastName: "" });
  const [fillNow, setFillNow] = useState(false);
  const { draft, errors, setErrors, set } = useDraft(EMPTY_DRAFT);
  const [pending, setPending] = useState(false);
  const asked = useRef(0);
  const short = divisionLabel(division.name);

  useEffect(() => {
    if (picked !== null) return;
    const ask = ++asked.current;
    const timer = setTimeout(async () => {
      const answer = await findForAdd(division.id, query);
      if (ask === asked.current) setLookup(answer);
    }, 250);
    return () => clearTimeout(timer);
  }, [query, picked, division.id]);

  const isNew = picked === null && lookup.kind === "new-email";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = picked
      ? { kind: "member", divisionId: division.id, personId: picked.id, title: draft.title }
      : {
          kind: "email",
          divisionId: division.id,
          email: query,
          firstName: names.firstName,
          lastName: names.lastName,
          title: draft.title,
          details: fillNow ? detailsOf(draft) : null,
        };
    const checked = checkAddMember(input);
    if (!checked.ok) return setErrors(checked.errors);
    if (!picked && !isNew) {
      return setErrors({ email: lookup.kind === "waiting" ? "They are already waiting for their NDA here." : "Pick someone from the team, or write a new email." });
    }
    setPending(true);
    try {
      const result = await addMember(input);
      if (!result.ok) {
        toast.error("Could not add them", { description: result.error });
        return;
      }
      toast.success(
        result.value === "joined"
          ? `${picked?.name ?? query} joined ${short}`
          : `${query} is waiting for their NDA. Let them know: the site sends no emails.`,
      );
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add member"
      detail={target.kind === "department" ? `To a division in ${target.department}` : `To ${division.name}`}
      submitLabel="Add member"
      submitting={pending}
      onSubmit={submit}
    >
      {target.kind === "department" && (
        <div className="mb-5">
          <Field label="Division" hint={`${choices.length} in ${target.department}`}>
            {(id) => (
              <DivisionSelect
                id={id}
                divisions={choices}
                value={division}
                onChange={(next) => {
                  setDivisionId(next);
                  // Who is already here, or waiting here, depends on the division.
                  setPicked(null);
                  setLookup({ kind: "none" });
                }}
              />
            )}
          </Field>
          <p className="mt-2 text-[12px] text-prt-muted">Already in other divisions? They keep them.</p>
        </div>
      )}
      <Field label="Email" hint="or search the team by name" error={errors.email}>
        {(id, describedBy) =>
          picked ? (
            <span className="flex items-center gap-3 rounded-[10px] border border-accent bg-accent/[0.06] px-3.5 py-2.5">
              <Avatar size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] text-prt-text">{picked.name}</span>
                <span className="block truncate text-[12px] text-prt-muted">{picked.email}</span>
              </span>
              <Chips chips={picked.chips} />
              <IconButton label="Choose someone else" onClick={() => setPicked(null)}>
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </IconButton>
            </span>
          ) : (
            <div className="relative">
              <Mail aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
              <input
                id={id}
                value={query}
                autoComplete="off"
                aria-describedby={describedBy}
                aria-invalid={errors.email !== undefined}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setErrors((x) => ({ ...x, email: undefined }));
                }}
                className={`${inputClass(errors.email)} pl-10`}
              />
            </div>
          )
        }
      </Field>

      {picked === null && lookup.kind === "people" && (
        <ul aria-label="On the team" className="mt-2 flex flex-col gap-1 rounded-[10px] border border-hairline bg-panel p-1.5">
          {lookup.people.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                disabled={m.here}
                onClick={() => setPicked(m)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-300 ease-out enabled:hover:bg-white-5 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS}`}
              >
                <Avatar size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-prt-text">{m.name}</span>
                  <span className="block truncate text-[12px] text-prt-muted">{m.here ? `Already in ${short}` : m.email}</span>
                </span>
                <Chips chips={m.chips} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {picked !== null && target.kind === "division" && <p className="mt-2 text-[12px] text-prt-muted">Already in other divisions? They keep them.</p>}
      {picked === null && lookup.kind === "waiting" && (
        <p className="mt-2 flex items-start gap-2 text-[13px] text-warning">
          <UserPlus aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Already waiting for their NDA here.
        </p>
      )}
      {isNew && (
        <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-warning">
          <UserPlus aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>
            Not in the team yet. They join after you confirm their signed NDA.
            {fillNow && " The site doesn't send emails, so you need to let them know."}
          </span>
        </p>
      )}

      {isNew && (
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Field label="First name" error={errors.firstName}>
            {(id) => (
              <input id={id} value={names.firstName} autoComplete="off" onChange={(e) => setNames((n) => ({ ...n, firstName: e.target.value }))} className={inputClass(errors.firstName)} />
            )}
          </Field>
          <Field label="Last name" error={errors.lastName}>
            {(id) => (
              <input id={id} value={names.lastName} autoComplete="off" onChange={(e) => setNames((n) => ({ ...n, lastName: e.target.value }))} className={inputClass(errors.lastName)} />
            )}
          </Field>
        </div>
      )}

      {(isNew || picked !== null) && (
        <div className="mt-5">
          <Field label={`Role in ${short}`} hint="shown on the Team page" error={errors.title}>
            {(id) => <input id={id} value={draft.title} maxLength={80} onChange={(e) => set("title", e.target.value)} className={inputClass(errors.title)} />}
          </Field>
        </div>
      )}

      {isNew && (
        <div className="mt-5 rounded-xl border border-hairline p-4">
          <label className="flex cursor-pointer items-center gap-3">
            <Toggle checked={fillNow} onCheckedChange={setFillNow} label="Fill in their other details now" />
            <span className="text-[14px] font-medium text-prt-text">Fill in their other details now</span>
          </label>
          {fillNow ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-4">
                <DetailInput name="prtEmail" label="PRT email" draft={draft} errors={errors} set={set} />
                <DetailInput name="linkedin" label="LinkedIn" draft={draft} errors={errors} set={set} />
                <DetailInput name="phone" label="Phone" draft={draft} errors={errors} set={set} />
                <DetailInput name="discord" label="Discord" draft={draft} errors={errors} set={set} />
                <DetailInput name="politoId" label="PoliTo ID" draft={draft} errors={errors} set={set} />
                <DetailInput name="programme" label="Program" draft={draft} errors={errors} set={set} />
                <DetailInput name="level" label="Level" draft={draft} errors={errors} set={set} />
                <DetailInput name="country" label="From" draft={draft} errors={errors} set={set} />
                <DetailInput name="birthDate" label="Date of birth" draft={draft} errors={errors} set={set} />
                <DetailInput name="gender" label="Gender" draft={draft} errors={errors} set={set} />
              </div>
              <p className="mt-4 text-[12px] text-prt-muted">Everything here is optional. Empty fields can be filled later by you or by them.</p>
            </>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-prt-muted">
              Phone, Discord, studies and personal details. Leave this off and they can sign in with this email and fill them in themselves, or you
              can add them later.
            </p>
          )}
        </div>
      )}

      {isNew && !fillNow && (
        <p className="mt-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/[0.05] px-4 py-3 text-[13px] text-text-2">
          <Mail aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
          The site doesn&apos;t send emails, so you need to let them know you added them.
        </p>
      )}
    </Drawer>
  );
}
