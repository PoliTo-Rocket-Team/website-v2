"use client";

import { useRef, useState, type FormEvent } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { AlertTriangle, ChevronDown, Info, Lock, Upload } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { addAdvisor, fixAlumnus, setAlumnusPhoto } from "@/app/dashboard/team-actions";
import { ADVISORS } from "@/lib/about/alumni-record";
import type { FounderMark } from "@/lib/about/alumni-types";
import { FIRST_ALUMNI_YEAR, MAX_ALUMNI_NAME, MAX_ALUMNI_ROLE, yearTab, type AlumnusRow } from "@/lib/dashboard/alumni";

import { Avatar } from "./avatar";
import { Drawer, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { Field, GroupLabel, inputClass } from "./field";
import { PHOTO_ACCEPT, PhotoCropDialog } from "./photo-crop-dialog";

// The Alumni page's two panels (issue #257): the fix panel (board 78b),
// where an editor changes how one person shows on the public Alumni page,
// and Add alumni (board 78c), which adds an external advisor to the Advisors
// group and nowhere else. Both write the page only: roles, dates and
// divisions stay as the team record has them.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** The accent text button that picks a photo ("Replace photo", "Upload photo"). */
const PHOTO_BUTTON = `inline-flex items-center gap-1.5 rounded-md text-[14px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover disabled:cursor-wait disabled:opacity-60 ${FOCUS}`;

/** "2022-23", as the panel's year rows print a year. */
function yearLine(start: number): string {
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const FOUNDER_OPTIONS: readonly { value: FounderMark | null; label: string }[] = [
  { value: null, label: "No" },
  { value: "co-founder", label: "Co-founder" },
  { value: "founder", label: "Founder" },
];

/** A file input kept off screen, and the square crop it opens (the member photo's flow, board 61g). */
function PhotoPicker({
  label,
  pending,
  onCropped,
}: {
  label: string;
  pending: boolean;
  onCropped: (square: File) => Promise<boolean> | boolean;
}) {
  const [cropping, setCropping] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
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
      <button type="button" disabled={pending} onClick={() => input.current?.click()} className={PHOTO_BUTTON}>
        <Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {label}
      </button>
      <PhotoCropDialog
        file={cropping}
        onOpenChange={(next) => !next && setCropping(null)}
        onChooseAnother={() => input.current?.click()}
        onSave={async (square) => {
          if (await onCropped(square)) setCropping(null);
        }}
        pending={pending}
      />
    </>
  );
}

/** The accent switch on board 78's rows and in the fix panel. */
export function AlumniSwitch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full motion-safe:transition-colors motion-safe:duration-300 motion-safe:ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default data-[state=checked]:bg-accent data-[state=unchecked]:bg-white-10"
    >
      <SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-prt-text motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

function photoForm(photo: File): FormData {
  const form = new FormData();
  form.set("photo", photo);
  return form;
}

// The fix panel (board 78b) ----------------------------------------------------

export function AlumnusPanel({ row, editable, onClose }: { row: AlumnusRow | null; editable: boolean; onClose: () => void }) {
  // The panel keeps showing the last person while it closes.
  const [last, setLast] = useState<AlumnusRow | null>(row);
  if (row !== null && row !== last) setLast(row);
  const person = row ?? last;
  return person === null ? null : <FixForm key={person.key} open={row !== null} row={person} editable={editable} onClose={onClose} />;
}

function FixForm({ open, row, editable, onClose }: { open: boolean; row: AlumnusRow; editable: boolean; onClose: () => void }) {
  const [shown, setShown] = useState(row.shown);
  const [name, setName] = useState(row.name);
  const [founder, setFounder] = useState<FounderMark | null>(row.founder);
  const [roles, setRoles] = useState(() => row.lines.map((line) => line.role));
  const [photo, setPhoto] = useState(row.photo);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable) return;
    setSaving(true);
    try {
      const input = {
        shown,
        name,
        founder,
        roles: row.lines.map((line, i) => ({ year: line.year, group: line.group, role: roles[i] ?? "" })),
      };
      const result = await fixAlumnus(row.key, input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(`Saved ${name.trim() || row.recordName}`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (square: File): Promise<boolean> => {
    setUploading(true);
    try {
      const result = await setAlumnusPhoto(row.key, photoForm(square));
      if (!result.ok) {
        toast.error("Could not upload the photo", { description: result.error });
        return false;
      }
      setPhoto(URL.createObjectURL(square));
      toast.success("Photo updated");
      return true;
    } finally {
      setUploading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={row.name}
      detail={`Alumni · on the team ${row.from} – ${row.to}`}
      leading={<Avatar name={row.name} size="panel" photoUrl={photo} />}
      submitLabel={saving ? "Saving…" : "Save"}
      submitting={saving || !editable}
      onSubmit={submit}
    >
      <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline bg-white-5 px-4 py-3.5">
        <span className="min-w-0">
          <span className="block text-[14px] font-medium text-prt-text">On the Alumni page</span>
          <span className="block text-[13px] text-prt-muted">Hide someone who asks not to be listed.</span>
        </span>
        <AlumniSwitch checked={shown} onCheckedChange={setShown} disabled={!editable} label="On the Alumni page" />
      </div>

      <Field label="Name on the page" error={error} className="mt-6">
        {(id, describedBy) => (
          <>
            <input
              id={id}
              aria-describedby={describedBy}
              value={name}
              maxLength={MAX_ALUMNI_NAME}
              disabled={!editable}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              className={inputClass(error)}
            />
            <p className="mt-2 text-[13px] text-prt-muted">Team record: {row.recordName}. Only the page changes.</p>
          </>
        )}
      </Field>

      <div className="mt-6">
        <GroupLabel id={`${row.key}-founder`} label="Founder" hint="shown in The founders" />
        <div role="radiogroup" aria-labelledby={`${row.key}-founder`} className="grid grid-cols-3 gap-1 rounded-xl border border-white-10 bg-white-5 p-1">
          {FOUNDER_OPTIONS.map((option) => {
            const current = option.value === founder;
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={current}
                disabled={!editable}
                onClick={() => setFounder(option.value)}
                className={`h-9 rounded-lg text-[14px] transition-colors duration-300 ease-out ${FOCUS} ${
                  current ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <GroupLabel id={`${row.key}-photo`} label="Photo" hint="optional" />
        <div className="flex items-center gap-4">
          <Avatar name={row.name} size="panel" photoUrl={photo} />
          {editable && <PhotoPicker label={photo === null ? "Upload photo" : "Replace photo"} pending={uploading} onCropped={uploadPhoto} />}
        </div>
      </div>

      <div className="mt-6">
        <GroupLabel id={`${row.key}-years`} label="Years on the page" hint="group from the team record" />
        <ul aria-labelledby={`${row.key}-years`} className="flex flex-col gap-2">
          {row.lines.map((line, i) => (
            <li key={`${line.year}-${line.group}`} className="grid grid-cols-[112px_1fr] items-center gap-3">
              <span className="min-w-0">
                <span className="block font-mono text-[12px] text-prt-text">{yearLine(line.year)}</span>
                <span className="block truncate text-[12px] text-prt-muted">{line.group}</span>
              </span>
              <input
                aria-label={`Role in ${line.group}, ${yearTab(line.year)}`}
                value={roles[i] ?? ""}
                placeholder={line.recordRole}
                maxLength={MAX_ALUMNI_ROLE}
                disabled={!editable}
                onChange={(e) => setRoles((all) => all.map((role, j) => (j === i ? e.target.value : role)))}
                className={inputClass()}
              />
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 flex items-start gap-3 rounded-xl border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
        These fixes only change the Alumni page. Roles, dates and divisions stay as the team record has them.
      </p>
    </Drawer>
  );
}

// Add alumni (board 78c) -------------------------------------------------------

export function AddAdvisorPanel({ open, thisYear, onClose }: { open: boolean; thisYear: number; onClose: () => void }) {
  const [round, setRound] = useState(0);
  return (
    <AdvisorForm
      // Each opening starts a fresh form.
      key={round}
      open={open}
      thisYear={thisYear}
      onClose={() => {
        onClose();
        setRound((r) => r + 1);
      }}
    />
  );
}

/** One academic year from `years`, shown as "2024–25"; Add alumni and End advising (board 80d) pick their years with it. */
export function YearSelect({ label, value, years, onChange }: { label: string; value: number; years: readonly number[]; onChange: (year: number) => void }) {
  return (
    <span className="relative block min-w-0 flex-1">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputClass()} appearance-none pr-10`}
      >
        {years.map((year) => (
          <option key={year} value={year} className="bg-panel">
            {yearTab(year)}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
    </span>
  );
}

function AdvisorForm({ open, thisYear, onClose }: { open: boolean; thisYear: number; onClose: () => void }) {
  const years = Array.from({ length: Math.max(1, thisYear - FIRST_ALUMNI_YEAR + 1) }, (_, i) => thisYear - i);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [from, setFrom] = useState(thisYear);
  const [to, setTo] = useState(thisYear);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ready = name.trim() !== "" && role.trim() !== "" && from <= to;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setSaving(true);
    try {
      const result = await addAdvisor({ name, role, group: ADVISORS, from, to }, photo === null ? null : photoForm(photo));
      if (!result.ok) {
        toast.error("Could not add the advisor", { description: result.error });
        return;
      }
      toast.success(`${name.trim()} added to Advisors`);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Add alumni"
      detail="Advisors group on the Alumni page"
      footer={
        <>
          <DialogClose className={PANEL_GHOST_BUTTON}>Cancel</DialogClose>
          <button
            type="submit"
            form="add-advisor-form"
            disabled={!ready || saving}
            className={`${PANEL_PRIMARY_BUTTON} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {saving ? "Adding…" : "Add advisor"}
          </button>
        </>
      }
    >
      <form id="add-advisor-form" noValidate onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <PanelBody>
          <div role="note" className="flex items-start gap-3 rounded-xl border border-warning/50 bg-warning-soft px-4 py-3.5">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-prt-text">For external advisors only</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-2">
                Use this only for people outside the student team, such as faculty advisors, industry mentors and consultants. Do not
                add students or former members here: they appear on the Alumni page automatically from their roles when they leave
                the team. To correct a former member&apos;s entry, edit it from the list instead.
              </p>
            </div>
          </div>

          <Field label="Full name" className="mt-6">
            {(id) => (
              <input id={id} value={name} maxLength={MAX_ALUMNI_NAME} placeholder="e.g. Flora Punzi" onChange={(e) => setName(e.target.value)} className={inputClass()} />
            )}
          </Field>
          <Field label="Role on the page" className="mt-5">
            {(id) => (
              <input
                id={id}
                value={role}
                maxLength={MAX_ALUMNI_ROLE}
                placeholder="e.g. Senior FEA Analyst · Counselor"
                onChange={(e) => setRole(e.target.value)}
                className={inputClass()}
              />
            )}
          </Field>
          <Field label="Group" className="mt-5">
            {(id) => (
              <span id={id} className="flex h-11 w-full items-center gap-2 rounded-[10px] border border-white-10 bg-white-5 px-3.5 text-[14px] text-prt-text">
                <span className="min-w-0 flex-1 truncate">{ADVISORS}</span>
                <Lock aria-label="Locked" className="h-3.5 w-3.5 shrink-0 text-prt-muted" strokeWidth={1.75} />
              </span>
            )}
          </Field>
          <div className="mt-5">
            <GroupLabel id="add-advisor-years" label="Academic years" hint="shown under each year they advised" />
            <div role="group" aria-labelledby="add-advisor-years" className="flex items-center gap-3">
              <YearSelect
                label="From"
                value={from}
                years={years}
                onChange={(next) => {
                  setFrom(next);
                  setTo((current) => Math.max(current, next));
                }}
              />
              <span className="text-[13px] text-prt-muted">to</span>
              <YearSelect label="To" value={to} years={years.filter((y) => y >= from)} onChange={setTo} />
            </div>
          </div>
          <div className="mt-5">
            <GroupLabel id="add-advisor-photo" label="Photo" hint="optional" />
            <div className="flex items-center gap-4">
              {preview !== null && <Avatar name={name || "?"} size="panel" photoUrl={preview} />}
              <PhotoPicker
                label={photo === null ? "Upload photo" : "Replace photo"}
                pending={saving}
                onCropped={(square) => {
                  setPhoto(square);
                  setPreview(URL.createObjectURL(square));
                  return true;
                }}
              />
            </div>
          </div>
        </PanelBody>
      </form>
    </SidePanel>
  );
}
