"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { AlertTriangle, ChevronDown, Info, Lock, Plus, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { DialogClose } from "@/components/ui/dialog";
import { addAdvisor, fixAlumnus, setAlumnusPhoto } from "@/app/dashboard/team-actions";
import { ADVISORS, type Mark, type Rank, type UnitRef } from "@/lib/about/alumni-record";
import type { FounderMark } from "@/lib/about/alumni-types";
import { CROP_SETTINGS } from "@/lib/dashboard/crop-settings";
import {
  FIRST_ALUMNI_YEAR,
  MARKS,
  MAX_ALUMNI_NAME,
  MAX_ALUMNI_ROLE,
  nextDraftYear,
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

/**
 * A refusal the panel shows. Each one is a new value, so the same words
 * refused twice still count as a new refusal.
 */
type Refusal = { readonly message: string };

/**
 * Brings a refusal into view when it appears (issue #992): the panel body
 * scrolls, so a refusal could sit past its edge.
 */
function useRevealed<T extends HTMLElement>(refusal: Refusal | undefined) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (refusal === undefined) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [refusal]);
  return ref;
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

/**
 * A year row as the panel holds it until Save. A record row keeps what the
 * record says, which an undo returns it to, and each fix over it, null where
 * the record's stands (issue #1006). An added row (issue #981) has no record
 * behind it; `id` keeps it the same row while its year and unit change.
 */
type YearRow =
  | {
      readonly kind: "record";
      readonly record: { readonly year: number; readonly group: string; readonly unit: string; readonly rank: Rank; readonly role: string };
      readonly role: string;
      readonly toYear: number | null;
      readonly toUnit: UnitRef | null;
      readonly mark: Mark | null;
    }
  | { readonly kind: "added"; readonly id: number; readonly year: number; readonly unit: UnitRef; readonly role: string; readonly mark: Mark };

/** A year added on the page only, as "+ Add a year" hands it over. */
type AddedRow = Omit<Extract<YearRow, { kind: "added" }>, "kind" | "id">;

function rowOf(line: AlumnusYear, id: number): YearRow {
  const { source } = line;
  if (source.kind === "added") return { kind: "added", id, year: line.year, unit: source.unit, role: line.role, mark: markOfRank(line.rank) ?? "member" };
  return {
    kind: "record",
    record: { year: source.year, group: source.group, unit: source.unit, rank: source.rank, role: line.recordRole },
    role: line.role,
    toYear: source.fix?.toYear ?? null,
    toUnit: source.fix?.toUnit ?? null,
    mark: source.fix?.mark ?? null,
  };
}

/** The mark a rank reads as; the team leader is none of the three. */
function markOfRank(rank: Rank): Mark | null {
  return rank === "leader" ? null : rank;
}

/** The year the page lists the row in. */
function rowYear(row: YearRow): number {
  return row.kind === "added" ? row.year : (row.toYear ?? row.record.year);
}

/** The group the page lists the row in: its unit's group, else the record's. */
function rowGroup(row: YearRow, units: readonly AlumniUnit[]): string | undefined {
  const unit = row.kind === "added" ? row.unit : row.toUnit;
  return unit === null ? (row.kind === "record" ? row.record.group : undefined) : units.find((u) => sameUnit(u.ref, unit))?.group;
}

/** A record row that differs from the record: Undo returns it. */
function isFixed(row: Extract<YearRow, { kind: "record" }>): boolean {
  const role = row.role.trim();
  return (role !== "" && role !== row.record.role) || row.toYear !== null || row.toUnit !== null || row.mark !== null;
}

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
  const [shown, setShown] = useState(row.shown);
  const [name, setName] = useState(row.name);
  const [founder, setFounder] = useState<FounderMark | null>(row.founder);
  // Newest first, as the lines come; an added row's id is its place in this first list.
  const [years, setYears] = useState<YearRow[]>(() => row.lines.map(rowOf));
  const [nextId, setNextId] = useState(row.lines.length);
  const change = (at: YearRow, next: YearRow) => setYears((all) => all.map((r) => (r === at ? next : r)));
  const [photo, setPhoto] = useState(row.photo);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Refusal | undefined>(undefined);
  const nameField = useRevealed<HTMLDivElement>(error);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editable) return;
    setSaving(true);
    try {
      const input = {
        shown,
        name,
        founder,
        roles: years.flatMap((r) =>
          r.kind === "record" ? [{ year: r.record.year, group: r.record.group, role: r.role, toYear: r.toYear, toUnit: r.toUnit, mark: r.mark }] : [],
        ),
        added: years.flatMap((r) => (r.kind === "added" ? [{ year: r.year, unit: r.unit, role: r.role, mark: r.mark }] : [])),
      };
      const result = await fixAlumnus(row.key, input);
      if (!result.ok) {
        setError({ message: result.error });
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

      <div ref={nameField} className="mt-6">
        <Field label="Name on the page" error={error?.message}>
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
                className={inputClass(error?.message)}
              />
              <p className="mt-2 text-[13px] text-prt-muted">Team record: {row.recordName}. Only the page changes.</p>
            </>
          )}
        </Field>
      </div>

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
        <GroupLabel id={`${row.key}-years`} label="Years on the page" hint="from the team record, or added here" />
        <ul aria-labelledby={`${row.key}-years`} className="flex flex-col gap-2">
          {years.map((item) => (
            <YearRowItem
              key={item.kind === "record" ? `record-${item.record.year}-${item.record.group}` : `added-${item.id}`}
              row={item}
              choices={choices}
              editable={editable}
              onChange={(next) => change(item, next)}
              onRemove={() => setYears((all) => all.filter((r) => r !== item))}
            />
          ))}
        </ul>
        {editable && (
          <AddYear
            key={nextId}
            choices={choices}
            draftYear={nextDraftYear(years.map(rowYear), choices.thisYear)}
            taken={(year, unit) => {
              const group = choices.units.find((u) => sameUnit(u.ref, unit))?.group;
              return years.some((r) => rowYear(r) === year && rowGroup(r, choices.units) === group);
            }}
            onAdd={(next) => {
              setYears((all) => [...all, { kind: "added", id: nextId, ...next }]);
              setNextId((id) => id + 1);
            }}
          />
        )}
      </div>

      <p className="mt-6 flex items-start gap-3 rounded-xl border border-hairline px-4 py-3.5 text-[13px] leading-relaxed text-text-2">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
        {row.to === null
          ? "They are still on the team. These fixes only change how the Alumni page shows their years, this one included: their roles stay as they are."
          : "These fixes only change the Alumni page. Roles, dates and divisions stay as the team record has them."}
      </p>
    </Drawer>
  );
}

// Years on the page, and "+ Add a year" (issue #981) -------------------------

const ADD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${FOCUS}`;
const ROW_ACTION = `inline-flex items-center gap-1.5 rounded-md text-[13px] text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${FOCUS}`;

function unitName(units: readonly AlumniUnit[], ref: UnitRef): string {
  return units.find((u) => sameUnit(u.ref, ref))?.name ?? "";
}

function unitOption(unit: AlumniUnit): string {
  const name = unit.under === null ? unit.name : `${unit.name} · ${unit.under}`;
  return unit.closed ? `${name} (closed)` : name;
}

const MARK_LABEL: Readonly<Record<Mark, string>> = { member: "Member", lead: "Lead", head: "Head" };

/** Member, Lead or Head (issue #1006): how the page marks them in this year's group. */
function MarkPicker({ value, label, disabled, onChange }: { value: Mark | null; label: string; disabled: boolean; onChange: (mark: Mark) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-1 rounded-xl border border-white-10 bg-white-5 p-1">
      {MARKS.map((mark) => {
        const current = mark === value;
        return (
          <button
            key={mark}
            type="button"
            role="radio"
            aria-checked={current}
            disabled={disabled}
            onClick={() => onChange(mark)}
            className={`h-8 rounded-lg text-[13px] transition-colors duration-300 ease-out ${FOCUS} ${
              current ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
            }`}
          >
            {MARK_LABEL[mark]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One year row: its academic year, its department or division, its mark and
 * its title, each editable (issue #1006). A record row shows the record's
 * values until one is changed, and Undo returns it to them; an added row
 * (issue #981) is removed instead.
 */
function YearRowItem({
  row,
  choices,
  editable,
  onChange,
  onRemove,
}: {
  row: YearRow;
  choices: AddYearChoices;
  editable: boolean;
  onChange: (next: YearRow) => void;
  onRemove: () => void;
}) {
  const year = rowYear(row);
  const unit = row.kind === "added" ? row.unit : row.toUnit;
  const unitLabel = unit === null ? (row.kind === "record" ? row.record.unit : "") : unitName(choices.units, unit);
  const where = `${unitLabel}, ${yearTab(year)}`;
  const recordYear = row.kind === "record" ? row.record.year : null;
  const years = [...new Set([...Array.from({ length: Math.max(1, choices.thisYear - FIRST_ALUMNI_YEAR + 1) }, (_, i) => choices.thisYear - i), ...(recordYear === null ? [] : [recordYear])])].sort(
    (a, b) => b - a,
  );
  const mark = row.kind === "added" ? row.mark : (row.mark ?? markOfRank(row.record.rank));

  const setYear = (next: number) =>
    onChange(row.kind === "added" ? { ...row, year: next } : { ...row, toYear: next === row.record.year ? null : next });
  const setUnit = (key: string) => {
    const picked = choices.units.find((u) => unitKey(u.ref) === key)?.ref ?? null;
    if (row.kind === "record") onChange({ ...row, toUnit: picked });
    else if (picked !== null) onChange({ ...row, unit: picked });
  };
  const setMark = (next: Mark) =>
    onChange(row.kind === "added" ? { ...row, mark: next } : { ...row, mark: next === markOfRank(row.record.rank) ? null : next });

  return (
    <li className="rounded-xl border border-hairline p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="block sm:w-[132px] sm:shrink-0">
          <YearSelect label={`Academic year of ${where}`} value={year} years={years} disabled={!editable} onChange={setYear} />
        </span>
        <UnitSelect
          label={`Department or division of ${where}`}
          value={unit === null ? "" : unitKey(unit)}
          units={choices.units}
          record={row.kind === "record" ? `${row.record.unit} (team record)` : undefined}
          disabled={!editable}
          onChange={setUnit}
        />
      </div>
      <div className="mt-2">
        <MarkPicker value={mark} label={`Mark in ${where}`} disabled={!editable} onChange={setMark} />
      </div>
      <input
        aria-label={row.kind === "record" ? `Role in ${where}` : `Role in ${where}, added on the page`}
        value={row.role}
        placeholder={row.kind === "record" ? row.record.role : undefined}
        maxLength={MAX_ALUMNI_ROLE}
        disabled={!editable}
        onChange={(e) => onChange({ ...row, role: e.target.value })}
        className={`mt-2 ${inputClass()}`}
      />
      {editable && (row.kind === "added" || isFixed(row)) && (
        <div className="mt-2 flex justify-end">
          {row.kind === "added" ? (
            <button type="button" onClick={onRemove} aria-label={`Remove ${where}`} className={ROW_ACTION}>
              <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChange({ ...row, role: row.record.role, toYear: null, toUnit: null, mark: null })}
              aria-label={`Undo the fixes to ${where}`}
              className={ROW_ACTION}
            >
              <Undo2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Undo fixes
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * A department or division, current or closed: the departments first, then
 * the divisions. On a record row the empty value is where the record puts
 * it, named by `record`; elsewhere it is the prompt to pick one.
 */
function UnitSelect({
  label = "Department or division",
  value,
  units,
  record,
  disabled = false,
  onChange,
}: {
  label?: string;
  value: string;
  units: readonly AlumniUnit[];
  record?: string;
  disabled?: boolean;
  onChange: (key: string) => void;
}) {
  const departments = units.filter((u) => u.ref.kind === "department");
  const divisions = units.filter((u) => u.ref.kind === "division");
  return (
    <span className="relative block min-w-0 flex-1">
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${inputClass()} appearance-none pr-10`}>
        <option value="" disabled={record === undefined} className="bg-panel">
          {record ?? "Department or division"}
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
  draftYear,
  taken,
  onAdd,
}: {
  choices: AddYearChoices;
  /** The year the draft opens on: one the panel does not list yet (`nextDraftYear`). */
  draftYear: number;
  taken: (year: number, unit: UnitRef) => boolean;
  onAdd: (row: AddedRow) => void;
}) {
  const years = Array.from({ length: Math.max(1, choices.thisYear - FIRST_ALUMNI_YEAR + 1) }, (_, i) => choices.thisYear - i);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(draftYear);
  const [unit, setUnit] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<Refusal | undefined>(undefined);
  const refusal = useRevealed<HTMLParagraphElement>(error);

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
    if (picked === undefined) return setError({ message: "Pick a department or division." });
    if (title === "") return setError({ message: "Enter the title on the page." });
    if (taken(year, picked.ref)) return setError({ message: `They already have ${yearTab(year)} in ${picked.group}.` });
    onAdd({ year, unit: picked.ref, role: title, mark: "member" });
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
      {/* On phones the unit select takes its own row, so its placeholder shows whole. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className="block sm:w-[132px] sm:shrink-0">
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
        className={`mt-2 ${inputClass(error?.message)}`}
      />
      {error !== undefined && (
        <p ref={refusal} id="add-year-error" className="mt-1.5 text-[12px] text-danger">
          {error.message}
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
export function YearSelect({
  label,
  value,
  years,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  years: readonly number[];
  disabled?: boolean;
  onChange: (year: number) => void;
}) {
  return (
    <span className="relative block min-w-0 flex-1">
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
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
