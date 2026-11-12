"use client";

import { useState, type FormEvent } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { AlertTriangle, ChevronDown, Info, Lock, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { addAdvisor, fixAlumnus, setAlumnusPhoto } from "@/app/dashboard/team-actions";
import { ADVISORS, type UnitRef } from "@/lib/about/alumni-record";
import type { FounderMark } from "@/lib/about/alumni-types";
import { CROP_SETTINGS } from "@/lib/dashboard/crop-settings";
import {
  FIRST_ALUMNI_YEAR,
  MAX_ALUMNI_NAME,
  MAX_ALUMNI_ROLE,
  spanOf,
  yearTab,
  type AlumniUnit,
  type AlumnusRow,
  type AlumnusYear,
} from "@/lib/dashboard/alumni";

import { Avatar } from "./avatar";
import { Drawer, PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON, PanelBody, SidePanel } from "./drawer";
import { Field, GroupLabel, inputClass } from "./field";
import { PhotoPicker } from "./photo-picker";

// The Alumni page's two panels (issue #257): the fix panel (board 78b),
// where an editor changes how one person shows on the public Alumni page and
// can add a year the record lacks (issue #981), and Add alumni (board 78c),
// which adds an external advisor to the Advisors group and nowhere else. Both
// write the page only: roles, dates and divisions stay as the team record
// has them.

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** "2022-23", as the panel's year rows print a year. */
function yearLine(start: number): string {
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const FOUNDER_OPTIONS: readonly { value: FounderMark | null; label: string }[] = [
  { value: null, label: "No" },
  { value: "co-founder", label: "Co-founder" },
  { value: "founder", label: "Founder" },
];

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

/** What "+ Add a year" needs (issue #981): the units it offers and this academic year, the last it offers. */
export type AddYearChoices = { readonly units: readonly AlumniUnit[]; readonly thisYear: number };

export function AlumnusPanel({
  row,
  editable,
  choices,
  onClose,
}: {
  row: AlumnusRow | null;
  editable: boolean;
  choices: AddYearChoices;
  onClose: () => void;
}) {
  // The panel keeps showing the last person while it closes.
  const [last, setLast] = useState<AlumnusRow | null>(row);
  if (row !== null && row !== last) setLast(row);
  const person = row ?? last;
  return person === null ? null : <FixForm key={person.key} open={row !== null} row={person} editable={editable} choices={choices} onClose={onClose} />;
}

/** A year added on the page only, as the panel holds it until Save. */
type AddedRow = { readonly year: number; readonly unit: UnitRef; readonly role: string };

function sameUnit(a: UnitRef, b: UnitRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function unitKey(unit: UnitRef): string {
  return `${unit.kind}:${unit.id}`;
}

function FixForm({
  open,
  row,
  editable,
  choices,
  onClose,
}: {
  open: boolean;
  row: AlumnusRow;
  editable: boolean;
  choices: AddYearChoices;
  onClose: () => void;
}) {
  const recordLines = row.lines.filter((line) => line.added === null);
  const [shown, setShown] = useState(row.shown);
  const [name, setName] = useState(row.name);
  const [founder, setFounder] = useState<FounderMark | null>(row.founder);
  const [roles, setRoles] = useState(() => recordLines.map((line) => line.role));
  const [added, setAdded] = useState<AddedRow[]>(() =>
    row.lines.flatMap((line) => (line.added === null ? [] : [{ year: line.year, unit: line.added, role: line.role }])),
  );
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
        roles: recordLines.map((line, i) => ({ year: line.year, group: line.group, role: roles[i] ?? "" })),
        added,
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
      detail={row.to === null ? `Still on the team · since ${row.from}` : `Alumni · on the team ${spanOf(row)}`}
      leading={<Avatar size="panel" person={{ photoUrl: photo }} />}
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
          <Avatar size="panel" person={{ photoUrl: photo }} />
          {editable && <PhotoPicker entry={CROP_SETTINGS.alumniPhoto} label={photo === null ? "Upload photo" : "Replace photo"} pending={uploading} onCropped={uploadPhoto} />}
        </div>
      </div>

      <div className="mt-6">
        <GroupLabel id={`${row.key}-years`} label="Years on the page" hint="group from the team record, or added here" />
        <ul aria-labelledby={`${row.key}-years`} className="flex flex-col gap-2">
          {yearRows(recordLines, added).map((item) =>
            item.kind === "record" ? (
              <li key={`record-${item.line.year}-${item.line.group}`} className={YEAR_ROW}>
                <YearCell year={item.line.year} unit={item.line.group} />
                <input
                  aria-label={`Role in ${item.line.group}, ${yearTab(item.line.year)}`}
                  value={roles[item.at] ?? ""}
                  placeholder={item.line.recordRole}
                  maxLength={MAX_ALUMNI_ROLE}
                  disabled={!editable}
                  onChange={(e) => setRoles((all) => all.map((role, j) => (j === item.at ? e.target.value : role)))}
                  className={inputClass()}
                />
              </li>
            ) : (
              <AddedYearRow
                key={`added-${item.row.year}-${unitKey(item.row.unit)}`}
                row={item.row}
                unit={unitName(choices.units, item.row.unit)}
                editable={editable}
                onRole={(role) => setAdded((all) => all.map((a) => (a === item.row ? { ...a, role } : a)))}
                onRemove={() => setAdded((all) => all.filter((a) => a !== item.row))}
              />
            ),
          )}
        </ul>
        {editable && (
          <AddYear
            key={added.length}
            choices={choices}
            firstYear={recordLines.at(-1)?.year ?? choices.thisYear}
            taken={(year, unit) => {
              const group = choices.units.find((u) => sameUnit(u.ref, unit))?.group;
              return (
                recordLines.some((l) => l.year === year && l.group === group) ||
                added.some((a) => a.year === year && choices.units.find((u) => sameUnit(u.ref, a.unit))?.group === group)
              );
            }}
            onAdd={(next) => setAdded((all) => [...all, next])}
          />
        )}
      </div>

      <p className="mt-6 flex items-start gap-3 rounded-xl border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
        {row.to === null
          ? "They are still on the team. These fixes only change how the Alumni page shows their past years: their roles stay as they are."
          : "These fixes only change the Alumni page. Roles, dates and divisions stay as the team record has them."}
      </p>
    </Drawer>
  );
}

// Years on the page, and "+ Add a year" (issue #981) -------------------------

const YEAR_ROW = "grid grid-cols-[112px_1fr] items-center gap-3";
const ADD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`;

/** The year and unit at the start of a year row. */
function YearCell({ year, unit }: { year: number; unit: string }) {
  return (
    <span className="min-w-0">
      <span className="block font-mono text-[12px] text-prt-text">{yearLine(year)}</span>
      <span className="block truncate text-[12px] text-prt-muted">{unit}</span>
    </span>
  );
}

type YearItem = { readonly kind: "record"; readonly line: AlumnusYear; readonly at: number } | { readonly kind: "added"; readonly row: AddedRow };

/** The record's years and the added ones in one list, newest first. */
function yearRows(recordLines: readonly AlumnusYear[], added: readonly AddedRow[]): YearItem[] {
  const yearOf = (item: YearItem) => (item.kind === "record" ? item.line.year : item.row.year);
  const items: YearItem[] = [...recordLines.map((line, at) => ({ kind: "record" as const, line, at })), ...added.map((row) => ({ kind: "added" as const, row }))];
  return items.sort((a, b) => yearOf(b) - yearOf(a));
}

function unitName(units: readonly AlumniUnit[], ref: UnitRef): string {
  return units.find((u) => sameUnit(u.ref, ref))?.name ?? "";
}

function unitOption(unit: AlumniUnit): string {
  const name = unit.under === null ? unit.name : `${unit.name} · ${unit.under}`;
  return unit.closed ? `${name} (closed)` : name;
}

/** An added year: the same row as a record year, its title editable and the row removable. */
function AddedYearRow({
  row,
  unit,
  editable,
  onRole,
  onRemove,
}: {
  row: AddedRow;
  unit: string;
  editable: boolean;
  onRole: (role: string) => void;
  onRemove: () => void;
}) {
  const where = `${unit}, ${yearTab(row.year)}`;
  return (
    <li className={YEAR_ROW}>
      <YearCell year={row.year} unit={unit} />
      <span className="flex h-11 min-w-0 items-center gap-1 rounded-[10px] border border-white-10 bg-white-5 pl-3.5 pr-1.5 transition-colors duration-300 ease-out focus-within:border-accent focus-within:bg-accent/[0.06]">
        <input
          aria-label={`Role in ${where}, added on the page`}
          value={row.role}
          maxLength={MAX_ALUMNI_ROLE}
          disabled={!editable}
          onChange={(e) => onRole(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-prt-text placeholder:text-dim focus:outline-none"
        />
        {editable && (
          <button
            type="button"
            aria-label={`Remove ${where}`}
            onClick={onRemove}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`}
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </span>
    </li>
  );
}

/** A department or division, current or closed: the departments first, then the divisions. */
function UnitSelect({ value, units, onChange }: { value: string; units: readonly AlumniUnit[]; onChange: (key: string) => void }) {
  const departments = units.filter((u) => u.ref.kind === "department");
  const divisions = units.filter((u) => u.ref.kind === "division");
  return (
    <span className="relative block min-w-0 flex-1">
      <select aria-label="Department or division" value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass()} appearance-none pr-10`}>
        <option value="" disabled className="bg-panel">
          Department or division
        </option>
        {[
          { label: "Departments", list: departments },
          { label: "Divisions", list: divisions },
        ].map(
          (group) =>
            group.list.length > 0 && (
              <optgroup key={group.label} label={group.label} className="bg-panel">
                {group.list.map((unit) => (
                  <option key={unitKey(unit.ref)} value={unitKey(unit.ref)} className="bg-panel">
                    {unitOption(unit)}
                  </option>
                ))}
              </optgroup>
            ),
        )}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
    </span>
  );
}

/**
 * "+ Add a year": the academic year, the unit and the title of a year the
 * record lacks. It refuses a year the person already has in that unit's group,
 * as the server does again on Save.
 */
function AddYear({
  choices,
  firstYear,
  taken,
  onAdd,
}: {
  choices: AddYearChoices;
  /** The person's first year on the record: the draft starts the year before. */
  firstYear: number;
  taken: (year: number, unit: UnitRef) => boolean;
  onAdd: (row: AddedRow) => void;
}) {
  const years = Array.from({ length: Math.max(1, choices.thisYear - FIRST_ALUMNI_YEAR + 1) }, (_, i) => choices.thisYear - i);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Math.min(choices.thisYear, Math.max(FIRST_ALUMNI_YEAR, firstYear - 1)));
  const [unit, setUnit] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`mt-3 ${ADD_LINK}`}>
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add a year
      </button>
    );
  }

  const add = () => {
    const picked = choices.units.find((u) => unitKey(u.ref) === unit);
    const title = role.trim().replace(/\s+/g, " ");
    if (picked === undefined) return setError("Pick a department or division.");
    if (title === "") return setError("Enter the title on the page.");
    if (taken(year, picked.ref)) return setError(`They already have ${yearTab(year)} in ${picked.group}.`);
    onAdd({ year, unit: picked.ref, role: title });
  };
  const cancel = () => {
    setOpen(false);
    setUnit("");
    setRole("");
    setError(undefined);
  };
  const change = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setError(undefined);
  };

  return (
    <div role="group" aria-label="Add a year" className="mt-3 rounded-xl border border-hairline p-3">
      <div className="flex items-center gap-2">
        <span className="block w-[132px] shrink-0">
          <YearSelect label="Academic year" value={year} years={years} onChange={change(setYear)} />
        </span>
        <UnitSelect value={unit} units={choices.units} onChange={change(setUnit)} />
      </div>
      <input
        aria-label="Title on the page"
        aria-describedby={error === undefined ? undefined : "add-year-error"}
        value={role}
        maxLength={MAX_ALUMNI_ROLE}
        placeholder="Title on the page, e.g. Recovery Engineer"
        onChange={(e) => change(setRole)(e.target.value)}
        onKeyDown={(e) => {
          // Enter adds the year; it never saves the whole panel.
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        className={`mt-2 ${inputClass(error)}`}
      />
      {error !== undefined && (
        <p id="add-year-error" className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={cancel} className={PANEL_GHOST_BUTTON}>
          Cancel
        </button>
        <button type="button" onClick={add} className={PANEL_PRIMARY_BUTTON}>
          Add year
        </button>
      </div>
    </div>
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
              {preview !== null && <Avatar size="panel" person={{ photoUrl: preview }} />}
              <PhotoPicker
                entry={CROP_SETTINGS.alumniPhoto}
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
