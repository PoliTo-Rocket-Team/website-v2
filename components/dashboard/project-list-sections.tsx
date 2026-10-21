"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, ImagePlus, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MarkFallback } from "@/components/mark-fallback";
import { discardProjectPhoto, uploadProjectPhoto } from "@/app/dashboard/project-actions";
import type { WriteResult } from "@/lib/dashboard/write";
import {
  blankLaunch,
  blankStep,
  blankVersion,
  FLIGHT_LABELS,
  highlightVersion,
  isFlight,
  LAUNCH_PHOTOS_MAX,
  PLAN_STATUSES,
  removeGalleryItem,
  removeLaunch,
  removeStep,
  removeVersion,
  setOutcome,
  setStepStatus,
  type GalleryFields,
  type GalleryItemFields,
  type LaunchesFields,
  type LaunchFields,
  type NumberFields,
  type PhoneDrop,
  type PlanFields,
  type StepFields,
  type VersionFields,
  type VersionsFields,
} from "@/lib/project-content/list-fields";
import { specRows, twoDigits, type Outcome, type PlanStatus } from "@/lib/project-pages";
import { CONTENT_FOCUS, TextField, useDragOrder } from "./content-parts";
import { ErrorLine } from "./edit-panel";
import { Field, inputClass } from "./field";
import { PhotosSection, shrunkPhoto, type PhotoUploads } from "./outreach-post-photos";
import { CopyField, EditableList, RowButton, type FieldErrors } from "./project-panel-parts";

// The list sections of the Edit <project> panel (board 75c, issue #299):
// Versions, Launch history, Plan and Gallery. Each sits in its own section
// card with its show-on-page switch in the header (./project-edit-panel.tsx).
// The rules each list keeps (one version highlighted, a launch at least in a
// shown history, one plan step under way, a photo at least in a shown
// gallery) live in lib/project-content/list-fields.ts: an edit that would
// break one is refused there, and its message shows as a toast.

/** Photos of a launch or of the gallery go through the projects editor, as Outreach's go through its own. */
const PROJECT_UPLOADS: PhotoUploads = { upload: uploadProjectPhoto, discard: discardProjectPhoto };

/** Applies a refusable edit: the new fields, or the refusal's message. */
function apply<T>(result: WriteResult<T>, set: (value: T) => void) {
  if (result.ok) set(result.value);
  else toast.error(result.error);
}

export function OffNote({ shown }: { shown: boolean }) {
  return shown ? null : <p className="text-[12px] text-prt-muted">Off the page. Switch it on to show it; the text here is kept.</p>;
}

// Versions

/** A spec row's label as a field label: "LIFTOFF T/W" reads "Liftoff T/W". */
const specLabel = (label: string) =>
  label
    .split(" ")
    .map((word, i) => (word.includes("/") ? word : i === 0 ? word[0] + word.slice(1).toLowerCase() : word.toLowerCase()))
    .join(" ");

export function VersionsEditor({
  versions,
  phone,
  errors,
  onChange,
}: {
  versions: VersionsFields;
  phone: boolean;
  errors: FieldErrors;
  onChange: (versions: VersionsFields) => void;
}) {
  return (
    <>
      <OffNote shown={versions.shown} />
      <TextField label="Title" value={versions.title} error={errors["versions.title"]} onChange={(title) => onChange({ ...versions, title })} />
      <CopyField
        label="Note under the table"
        rows={2}
        copy={versions.note}
        phone={phone}
        error={errors["versions.note"]}
        onChange={(note) => onChange({ ...versions, note })}
      />
      <EditableList
        label="Versions"
        hint="in table order"
        items={versions.items}
        limit={{ min: 0, max: 8 }}
        error={errors["versions.items"]}
        blank={blankVersion}
        rowName={(i) => `version ${i + 1}`}
        addLabel="Add version"
        onChange={(items) => onChange({ ...versions, items })}
        removeRow={(index) => {
          const result = removeVersion(versions, index);
          return result.ok ? { ok: true, value: result.value.items } : result;
        }}
        row={(version: VersionFields, i, update) => (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <TextField label="Name" hint="the pill" value={version.pill} error={errors[`versions.items.${i}.pill`]} onChange={(pill) => update({ ...version, pill })} />
              <TextField label="Phone tab" value={version.tab} error={errors[`versions.items.${i}.tab`]} onChange={(tab) => update({ ...version, tab })} />
            </div>
            <CopyField
              label="What it was for"
              rows={2}
              copy={version.role}
              phone={phone}
              error={errors[`versions.items.${i}.role`]}
              onChange={(role) => update({ ...version, role })}
            />
            <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-prt-text">
              <input
                type="radio"
                name="highlighted-version"
                checked={version.highlighted}
                onChange={() => onChange(highlightVersion(versions, i))}
                className="h-4 w-4 accent-accent"
              />
              Highlighted
              <span className="text-prt-muted">bold on desktop, the phone&apos;s first tab</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {specRows.map(([key, label]) => (
                <TextField
                  key={key}
                  label={specLabel(label)}
                  placeholder="–"
                  value={version.specs[key]}
                  onChange={(value) => update({ ...version, specs: { ...version.specs, [key]: value } })}
                />
              ))}
            </div>
            <p className="text-[12px] text-prt-muted">A spec left empty shows a dash.</p>
          </>
        )}
      />
    </>
  );
}

export function versionsSummary(versions: VersionsFields): string {
  if (!versions.shown) return "Not on the page";
  const names = versions.items.map((v) => v.pill.trim()).filter((name) => name !== "");
  return `${names.join(", ") || "No versions yet"} · specs table`;
}

// Launch history

const OUTCOMES: readonly { value: Outcome; label: string }[] = [
  { value: "nominal", label: "Nominal" },
  { value: "recovery-failed", label: "Recovery failed" },
  { value: "did-not-fly", label: "Did not fly" },
];

/** The outcome as the card header shows it: green for a nominal flight, orange for a setback, never red (manifest, Colour). */
function OutcomeTag({ outcome }: { outcome: Outcome }) {
  const nominal = outcome === "nominal";
  return (
    <span
      className={`inline-flex h-[20px] shrink-0 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium ${
        nominal ? "bg-success-soft text-success" : "bg-accent-soft text-accent"
      }`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${nominal ? "bg-success" : "bg-accent"}`} />
      {OUTCOMES.find((o) => o.value === outcome)!.label}
    </span>
  );
}

export function LaunchesEditor({
  launches,
  versionNames,
  phone,
  errors,
  onChange,
}: {
  launches: LaunchesFields;
  /** The versions' names, for each launch's Version. */
  versionNames: readonly string[];
  phone: boolean;
  errors: FieldErrors;
  onChange: (change: (launches: LaunchesFields) => LaunchesFields) => void;
}) {
  // Each card keeps one key while it moves, so the open one stays open.
  const [keys, setKeys] = useState(() => launches.items.map((_, i) => i));
  const nextKey = useRef(launches.items.length);
  const rowKeys = keys.length === launches.items.length ? keys : launches.items.map((_, i) => i);
  const [open, setOpen] = useState<number | null>(null);
  const itemOf = new Map(rowKeys.map((key, i) => [key, launches.items[i]]));
  // A refused save opens the first card holding a field it names.
  const errorAt = launches.items.findIndex((_, i) => Object.keys(errors).some((field) => field.startsWith(`launches.items.${i}.`)));
  const errorKey = errorAt === -1 ? null : rowKeys[errorAt];
  useEffect(() => {
    if (errorKey !== null) setOpen(errorKey);
  }, [errorKey]);

  const reorder = (order: readonly number[]) => {
    setKeys([...order]);
    onChange((l) => ({ ...l, items: order.map((key) => itemOf.get(key)!) }));
  };
  const drag = useDragOrder(rowKeys, reorder);
  const move = (key: number, by: -1 | 1) => {
    const at = rowKeys.indexOf(key);
    const order = [...rowKeys];
    [order[at], order[at + by]] = [order[at + by], order[at]];
    reorder(order);
  };
  const remove = (key: number) =>
    apply(removeLaunch(launches, rowKeys.indexOf(key)), ({ fields: next, letGo }) => {
      setKeys(rowKeys.filter((k) => k !== key));
      onChange(() => next);
      // The server keeps a file while a stored version of a project shows it.
      for (const src of letGo) void PROJECT_UPLOADS.discard(src);
    });
  const add = () => {
    const key = nextKey.current++;
    setKeys([...rowKeys, key]);
    setOpen(key);
    onChange((l) => ({ ...l, items: [...l.items, blankLaunch()] }));
  };
  // A photo upload lands late, so it changes the launch as it is then.
  const updateAt = (key: number, change: (launch: LaunchFields) => LaunchFields) => {
    const at = rowKeys.indexOf(key);
    onChange((l) => ({ ...l, items: l.items.map((x, i) => (i === at ? change(x) : x)) }));
  };

  return (
    <>
      <OffNote shown={launches.shown} />
      <TextField label="Title" value={launches.title} error={errors["launches.title"]} onChange={(title) => onChange((l) => ({ ...l, title }))} />
      <div>
        <p className="mb-2 text-[13px] leading-snug text-prt-text">
          Launches<span className="ml-1.5 text-prt-muted">in date order</span>
        </p>
        <ol className="space-y-2" {...drag.list}>
          {drag.order.map((key, index) => {
            const launch = itemOf.get(key)!;
            const at = rowKeys.indexOf(key);
            const r = drag.row(key, index);
            const isOpen = open === key;
            const panelId = `launch-card-${key}`;
            return (
              <li
                key={key}
                onDragOver={r.onDragOver}
                className={`rounded-[10px] border bg-white-5 transition-colors duration-300 ease-out ${
                  isOpen ? "border-accent" : "border-hairline hover:border-border-strong"
                } ${r.dragged ? "opacity-50" : ""}`}
              >
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span draggable onDragStart={r.onDragStart} onDragEnd={r.onDragEnd} aria-hidden className="cursor-grab text-dim">
                    <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : key)}
                    className={`flex min-w-0 flex-1 items-center gap-2 rounded-md text-left ${CONTENT_FOCUS}`}
                  >
                    <span className="font-mono text-[10px] tracking-[0.2em] text-dim">{twoDigits(index + 1)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-prt-text">{launch.title.trim() || "New launch"}</span>
                    {launch.date.trim() !== "" && <span className="shrink-0 text-[12px] text-prt-muted">{launch.date}</span>}
                    <OutcomeTag outcome={launch.outcome} />
                    <ChevronDown aria-hidden className={`h-3.5 w-3.5 shrink-0 text-prt-muted ${isOpen ? "rotate-180" : ""}`} strokeWidth={1.75} />
                  </button>
                </div>
                {isOpen && (
                  <div id={panelId} className="space-y-3 border-t border-hairline px-3 pb-3 pt-3">
                    <LaunchCard
                      launch={launch}
                      at={`launches.items.${at}`}
                      versionNames={versionNames}
                      phone={phone}
                      errors={errors}
                      onChange={(change) => updateAt(key, change)}
                    />
                    <div className="flex items-center justify-end gap-1 border-t border-hairline pt-2">
                      <RowButton icon={ArrowUp} label={`Move launch ${index + 1} up`} onClick={index > 0 ? () => move(key, -1) : null} />
                      <RowButton
                        icon={ArrowDown}
                        label={`Move launch ${index + 1} down`}
                        onClick={index < drag.order.length - 1 ? () => move(key, 1) : null}
                      />
                      <RowButton icon={Trash2} label={`Remove launch ${index + 1}`} onClick={() => remove(key)} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <ErrorLine error={errors["launches.items"]} />
        <AddButton label="Add launch" onClick={add} />
      </div>
    </>
  );
}

/** One launch card's fields (board 75c): date and place, version, motor and outcome, what happened, the four numbers, the /projects line, the award and the photos. */
function LaunchCard({
  launch,
  at,
  versionNames,
  phone,
  errors,
  onChange,
}: {
  launch: LaunchFields;
  /** Where the launch sits in the fields, for its errors. */
  at: string;
  versionNames: readonly string[];
  phone: boolean;
  errors: FieldErrors;
  onChange: (change: (launch: LaunchFields) => LaunchFields) => void;
}) {
  const set = (change: Partial<LaunchFields>) => onChange((l) => ({ ...l, ...change }));
  const flight = isFlight(launch.outcome);
  // A version named before the versions changed stays pickable, so the card never shows another.
  const versions = launch.version === "" || versionNames.includes(launch.version) ? versionNames : [...versionNames, launch.version];
  const setNumber = (index: number, number: NumberFields) =>
    onChange((l) => {
      const [a, b, c, d] = l.numbers.map((n, i) => (i === index ? number : n));
      return { ...l, numbers: [a, b, c, d] };
    });

  return (
    <>
      <TextField label="Name" placeholder="European Rocketry Challenge" value={launch.title} error={errors[`${at}.title`]} onChange={(title) => set({ title })} />
      <div className="grid grid-cols-2 gap-2.5">
        <TextField label="Date" placeholder="12 Oct 2024" value={launch.date} error={errors[`${at}.date`]} onChange={(date) => set({ date })} />
        <CopyField label="Place" copy={launch.place} phone={phone} error={errors[`${at}.place`]} onChange={(place) => set({ place })} />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <Field label="Version" error={errors[`${at}.version`]}>
          {(id, describedBy) => (
            <select
              id={id}
              aria-describedby={describedBy}
              value={launch.version}
              onChange={(e) => set({ version: e.target.value })}
              className={`${inputClass(errors[`${at}.version`])} px-2.5`}
            >
              <option value="">Pick one</option>
              {versions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <TextField label="Motor" value={launch.motor} error={errors[`${at}.motor`]} onChange={(motor) => set({ motor })} />
        <Field label="Outcome">
          {(id) => (
            <select
              id={id}
              value={launch.outcome}
              onChange={(e) => onChange((l) => setOutcome(l, e.target.value as Outcome))}
              className={`${inputClass()} px-2.5`}
            >
              {OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {phone ? (
        <TextField
          label="What happened"
          hint="phone"
          rows={3}
          value={launch.summary.phone}
          error={errors[`${at}.summaryPhone`]}
          onChange={(p) => set({ summary: { ...launch.summary, phone: p } })}
        />
      ) : (
        <TextField
          label="What happened"
          rows={4}
          value={launch.summary.text}
          error={errors[`${at}.summary`]}
          onChange={(text) => set({ summary: { ...launch.summary, text } })}
        />
      )}

      <div>
        <p className="mb-2 text-[13px] leading-snug text-prt-text">
          Numbers<span className="ml-1.5 text-prt-muted">{phone ? "the phone keeps three" : "four on the card"}</span>
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          {launch.numbers.map((number, i) => (
            <NumberBox
              key={i}
              index={i}
              number={number}
              fixedLabel={flight && i < 2 ? FLIGHT_LABELS[i] : null}
              phone={phone}
              left={phone && launch.phoneDrops === i}
              error={errors[`${at}.numbers.${i}.value`] ?? errors[`${at}.numbers.${i}.label`]}
              onChange={(n) => setNumber(i, n)}
            />
          ))}
        </div>
        <ErrorLine error={launch.numbers.map((_, i) => errors[`${at}.numbers.${i}.value`] ?? errors[`${at}.numbers.${i}.label`]).find((e) => e !== undefined)} />
        {phone && (
          <Field label="The phone leaves out" className="mt-2.5" error={errors[`${at}.phoneDrops`]}>
            {(id) => (
              <select
                id={id}
                value={launch.phoneDrops}
                onChange={(e) => set({ phoneDrops: Number(e.target.value) as PhoneDrop })}
                className={`${inputClass(errors[`${at}.phoneDrops`])} px-2.5`}
              >
                {launch.numbers.map((n, i) =>
                  flight && i < 2 ? null : (
                    <option key={i} value={i}>
                      Number {i + 1}
                      {n.label.trim() && ` · ${n.label.trim()}`}
                    </option>
                  ),
                )}
              </select>
            )}
          </Field>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <TextField
          label="On the Projects list"
          placeholder="EuRoC, Santa Margarida, Portugal · Mark I"
          value={launch.where}
          error={errors[`${at}.where`]}
          onChange={(where) => set({ where })}
        />
        {flight ? (
          <TextField label="Country" hint="counted on /projects" value={launch.country} error={errors[`${at}.country`]} onChange={(country) => set({ country })} />
        ) : (
          <div />
        )}
      </div>
      <TextField label="Result" hint="on the Projects list" rows={2} value={launch.result} error={errors[`${at}.result`]} onChange={(result) => set({ result })} />

      <TextField
        label="Award"
        hint="optional"
        placeholder="1ST PLACE · DESIGN & BUILD QUALITY"
        value={launch.award.name}
        onChange={(name) => set({ award: { ...launch.award, name } })}
      />
      {launch.award.name.trim() !== "" && (
        <div className="grid grid-cols-2 gap-2.5">
          <TextField
            label="Short name"
            hint="on the Projects list, optional"
            value={launch.award.short}
            onChange={(short) => set({ award: { ...launch.award, short } })}
          />
          <TextField
            label="Citation"
            hint="optional"
            placeholder="of 140+ universities"
            value={launch.award.citation}
            onChange={(citation) => set({ award: { ...launch.award, citation } })}
          />
        </div>
      )}

      <div>
        <p className="mb-2 text-[13px] leading-snug text-prt-text">
          Photos<span className="ml-1.5 text-prt-muted">two at most, beside the card</span>
        </p>
        <PhotosSection
          photos={launch.photos}
          onChange={(change) => onChange((l) => ({ ...l, photos: change(l.photos) }))}
          uploads={PROJECT_UPLOADS}
          cover={false}
          max={LAUNCH_PHOTOS_MAX}
          error={errors[`${at}.photos`]}
        />
      </div>
    </>
  );
}

/** One of the four numbers (board 75c): the value on the left, its label on the right, in one box. */
function NumberBox({
  index,
  number,
  fixedLabel,
  phone,
  left,
  error,
  onChange,
}: {
  index: number;
  number: NumberFields;
  /** A flight's apogee and max speed keep the label the page gives them. */
  fixedLabel: string | null;
  phone: boolean;
  /** Left out of the phone card. */
  left: boolean;
  error?: string;
  onChange: (number: NumberFields) => void;
}) {
  const name = `Number ${index + 1}`;
  const label = phone ? number.phoneLabel : number.label;
  return (
    <div>
      <div
        className={`flex h-11 items-center gap-2 rounded-[10px] border bg-white-5 px-3 transition-colors duration-300 ease-out focus-within:border-accent focus-within:bg-accent/[0.06] ${
          error === undefined ? "border-white-10" : "border-danger"
        } ${left ? "opacity-50" : ""}`}
      >
        <input
          aria-label={`${name} value`}
          aria-invalid={error !== undefined}
          value={number.value}
          onChange={(e) => onChange({ ...number, value: e.target.value })}
          className="w-0 min-w-0 flex-1 bg-transparent text-[13px] text-prt-text placeholder:text-dim focus:outline-none"
          placeholder="3 160 m"
        />
        {fixedLabel !== null ? (
          <span className="shrink-0 text-[12px] text-prt-muted">{specLabel(fixedLabel)}</span>
        ) : (
          <input
            aria-label={phone ? `${name} phone label` : `${name} label`}
            value={label}
            placeholder={phone ? number.label : "LABEL"}
            onChange={(e) => onChange(phone ? { ...number, phoneLabel: e.target.value } : { ...number, label: e.target.value })}
            className="w-0 min-w-0 flex-1 bg-transparent text-right text-[12px] text-prt-muted placeholder:text-dim focus:outline-none"
          />
        )}
      </div>
      {left && <p className="mt-1 text-[11px] text-prt-muted">Not on the phone card</p>}
    </div>
  );
}

export function launchesSummary(launches: LaunchesFields): string {
  if (!launches.shown) return "Not on the page";
  const n = launches.items.length;
  return `${n} ${n === 1 ? "launch" : "launches"}`;
}

// Plan

const STATUS_LABELS: Readonly<Record<PlanStatus, string>> = { done: "Done", now: "Under way", next: "Next", later: "Later" };

export function PlanEditor({
  plan,
  phone,
  errors,
  onChange,
}: {
  plan: PlanFields;
  phone: boolean;
  errors: FieldErrors;
  onChange: (plan: PlanFields) => void;
}) {
  return (
    <>
      <OffNote shown={plan.shown} />
      <TextField label="Title" hint="a new line breaks it" rows={2} value={plan.title} error={errors["plan.title"]} onChange={(title) => onChange({ ...plan, title })} />
      <CopyField label="Intro" rows={2} copy={plan.intro} phone={phone} error={errors["plan.intro"]} onChange={(intro) => onChange({ ...plan, intro })} />
      <EditableList
        label="Steps"
        hint="the page orders them done, under way, next, later"
        items={plan.steps}
        limit={{ min: 0, max: 20 }}
        error={errors["plan.steps"]}
        blank={() => blankStep()}
        rowName={(i) => `step ${i + 1}`}
        addLabel="Add step"
        onChange={(steps) => onChange({ ...plan, steps })}
        removeRow={(index) => {
          const result = removeStep(plan, index);
          return result.ok ? { ok: true, value: result.value.steps } : result;
        }}
        row={(step: StepFields, i, update) => (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Status">
                {(id) => (
                  <select
                    id={id}
                    value={step.status}
                    onChange={(e) => apply(setStepStatus(plan, i, e.target.value as PlanStatus), onChange)}
                    className={`${inputClass()} px-2.5`}
                  >
                    {PLAN_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <TextField label="Date" hint="optional" value={step.date} onChange={(date) => update({ ...step, date })} />
            </div>
            <TextField label="Title" value={step.title} error={errors[`plan.steps.${i}.title`]} onChange={(title) => update({ ...step, title })} />
            <CopyField
              label="Text"
              rows={2}
              copy={step.text}
              phone={phone}
              error={errors[`plan.steps.${i}.text`]}
              onChange={(text) => update({ ...step, text })}
            />
          </>
        )}
      />
    </>
  );
}

export function planSummary(plan: PlanFields): string {
  if (!plan.shown) return "Not on the page";
  const n = plan.steps.length;
  const now = plan.steps.find((s) => s.status === "now")?.title.trim();
  return `${n} ${n === 1 ? "step" : "steps"}${now ? ` · under way: ${now}` : ""}`;
}

// Gallery

/**
 * The Gallery section's fields: its title, then its photos in carousel
 * order. The Edit post panel (issue #430) holds a post's gallery here too,
 * through the posts' own upload (`uploads`).
 */
export function GalleryEditor({
  gallery,
  errors,
  onChange,
  uploads = PROJECT_UPLOADS,
}: {
  gallery: GalleryFields;
  errors: FieldErrors;
  onChange: (change: (gallery: GalleryFields) => GalleryFields) => void;
  /** Where its photos are stored and let go: the projects' by default. */
  uploads?: PhotoUploads;
}) {
  return (
    <>
      <OffNote shown={gallery.shown} />
      <TextField label="Title" value={gallery.title} error={errors["gallery.title"]} onChange={(title) => onChange((g) => ({ ...g, title }))} />
      <GalleryPhotosEditor
        items={gallery.items}
        error={errors["gallery.items"]}
        onChange={(change) => onChange((g) => ({ ...g, items: change(g.items) }))}
        remove={(index) => {
          const result = removeGalleryItem(gallery, index);
          return result.ok ? { ok: true, value: { items: result.value.fields.items, letGo: result.value.letGo } } : result;
        }}
        uploads={uploads}
      />
    </>
  );
}

/** A removed gallery photo: the photos without it, and its uploaded file, which the editor lets go. */
export type GalleryPhotoRemoval = { readonly items: readonly GalleryItemFields[]; readonly letGo: readonly string[] };

/**
 * A gallery's photos in carousel order, each with its optional description
 * and caption, and Add photos under them. The Edit post panel's Gallery
 * section is this alone (issue #451); a project's has its title above.
 * `remove` keeps the gallery's own rule on taking a photo out.
 */
export function GalleryPhotosEditor({
  items,
  error,
  onChange,
  remove,
  uploads,
}: {
  items: readonly GalleryItemFields[];
  error?: string;
  onChange: (change: (items: readonly GalleryItemFields[]) => readonly GalleryItemFields[]) => void;
  remove: (index: number) => WriteResult<GalleryPhotoRemoval>;
  /** Where its photos are stored and let go. */
  uploads: PhotoUploads;
}) {
  const [uploading, setUploading] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files: readonly File[]) => {
    setUploading((n) => n + files.length);
    for (const file of files) {
      const form = new FormData();
      form.set("photo", await shrunkPhoto(file));
      const result = await uploads.upload(form);
      setUploading((n) => n - 1);
      if (!result.ok) toast.error(result.error);
      else onChange((now) => [...now, { src: result.value, alt: "", caption: "" }]);
    }
  };

  return (
    <>
      <EditableList
        label="Photos"
        hint="in carousel order"
        items={items}
        limit={{ min: 0, max: 50 }}
        error={error}
        blank={() => ({ src: null, alt: "", caption: "" })}
        rowName={(i) => `photo ${i + 1}`}
        addLabel={null}
        onChange={(next) => onChange(() => next)}
        removeRow={(index) => {
          const result = remove(index);
          if (!result.ok) return result;
          // The server keeps the file while a stored version shows it.
          for (const src of result.value.letGo) void uploads.discard(src);
          return { ok: true, value: result.value.items };
        }}
        row={(item: GalleryItemFields, _, update) => (
          <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2.5">
            <GalleryThumb src={item.src} />
            <div className="space-y-2.5">
              <TextField label="Description" hint="optional, for screen readers" value={item.alt} onChange={(alt) => update({ ...item, alt })} />
              <TextField label="Caption" hint="optional" value={item.caption} onChange={(caption) => update({ ...item, caption })} />
            </div>
          </div>
        )}
      />
      {Array.from({ length: uploading }, (_, i) => (
        <p key={i} className="flex items-center gap-2 text-[12px] text-prt-muted">
          <LoaderCircle aria-hidden className="h-3.5 w-3.5 motion-safe:animate-spin" strokeWidth={1.75} />
          Uploading a photo
        </p>
      ))}
      <AddButton label="Add photos" icon={<ImagePlus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />} onClick={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        aria-label="Add photos"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length > 0) void add(files);
        }}
      />
    </>
  );
}

/** A gallery slot's thumbnail: the photo, or the placeholder tile the carousel draws until one is uploaded. */
function GalleryThumb({ src }: { src: string | null }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-hairline bg-white-5">
      {src === null ? (
        <MarkFallback fit="frame" />
      ) : (
        // An uploaded photo (the public store, or a preview's data URL) is served as it is.
        <Image src={src} alt="" fill sizes="96px" unoptimized={!src.startsWith("/")} className="object-cover" />
      )}
    </div>
  );
}

export function gallerySummary(gallery: GalleryFields): string {
  if (!gallery.shown) return "Not on the page";
  const n = gallery.items.length;
  return `${n} ${n === 1 ? "photo" : "photos"}`;
}

function AddButton({ label, icon, onClick }: { label: string; icon?: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-2.5 inline-flex items-center gap-1.5 rounded-md text-[13px] text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
    >
      {icon ?? <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />}
      {label}
    </button>
  );
}
