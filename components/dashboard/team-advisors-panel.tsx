"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, GripVertical, Info, LogOut, Plus, Trash2, Upload } from "lucide-react";
import { Avatar } from "@/components/about/person";
import {
  ADVISOR_STANDINGS,
  advisorFieldErrors,
  inPageOrder,
  NEW_ADVISOR,
  type AdvisorFields,
  type AdvisorRow,
  type AdvisorStanding,
} from "@/lib/about/advisors";
import type { PhotoChoice } from "@/lib/about/team-page-edit";
import { CONTENT_FOCUS, useDragOrder, type DragRow } from "./content-parts";
import { PANEL_PRIMARY_BUTTON } from "./drawer";
import { Field, inputClass } from "./field";
import { PANEL_HINT, PhotoChoices, TeamPanel } from "./team-panel-parts";

// The Advisors panel (board 80d, issue #286), opened from the Advisors
// block's "Edit advisors": principal advisors, then specialists, each group
// dragged into its order, and one advisor open at a time with their full
// name, role on the page, Principal / Specialist, LinkedIn and email, the
// photo, and End advising; Add advisor adds one at the end. The page redraws
// as the editor types; Done keeps the list in the editor, and the edit bar's
// Save draft or Publish sends it.

/** A panel row: an advisor and the key the panel tracks them by while they have no id. */
export type KeyedAdvisorRow = AdvisorRow & { readonly key: number };

const GROUP_LABEL: Readonly<Record<AdvisorStanding, string>> = { principal: "Principal advisors", specialist: "Specialists" };
const STANDING_LABEL: Readonly<Record<AdvisorStanding, string>> = { principal: "Principal advisor", specialist: "Specialist" };

const LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`;

export function TeamAdvisorsPanel({
  rows,
  photoChoices,
  onChange,
  onDone,
  onCancel,
  onEnd,
}: {
  /** In page order. */
  rows: readonly KeyedAdvisorRow[];
  photoChoices: readonly PhotoChoice[];
  onChange: (rows: KeyedAdvisorRow[]) => void;
  onDone: () => void;
  onCancel: () => void;
  /** End advising a stored advisor: the editor confirms the years first. */
  onEnd: (id: number) => void;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const setRow = (key: number, fields: AdvisorFields) => onChange(inPageOrder(rows.map((r) => (r.key === key ? { ...r, fields } : r))));
  const add = () => {
    const key = rows.reduce((last, r) => Math.max(last, r.key), 0) + 1;
    onChange([...rows, { id: null, key, fields: NEW_ADVISOR }]);
    setOpen(key);
  };

  return (
    <TeamPanel
      label="Advisors"
      title="Advisors"
      onClose={onCancel}
      footer={
        <>
          <span />
          <button type="button" onClick={onDone} className={PANEL_PRIMARY_BUTTON}>
            Done
          </button>
        </>
      }
    >
      <div role="note" className="flex gap-3 rounded-xl border border-hairline bg-ground/40 px-4 py-3.5">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
        <p className="text-[13px] leading-relaxed text-text-2">Advisors are added by hand: faculty and specialists outside the student team.</p>
      </div>

      {ADVISOR_STANDINGS.map((standing) => (
        <AdvisorGroup
          key={standing}
          standing={standing}
          rows={rows}
          open={open}
          photoChoices={photoChoices}
          onToggle={(key) => setOpen((current) => (current === key ? null : key))}
          onRow={setRow}
          onReorder={(group) => onChange(inPageOrder([...rows.filter((r) => r.fields.standing !== standing), ...group]))}
          onEnd={onEnd}
          onRemove={(key) => onChange(rows.filter((r) => r.key !== key))}
        />
      ))}

      <button type="button" onClick={add} className={LINK}>
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Add advisor
      </button>
    </TeamPanel>
  );
}

/** One standing's advisors under its label, dragged into order among themselves. */
function AdvisorGroup({
  standing,
  rows,
  open,
  photoChoices,
  onToggle,
  onRow,
  onReorder,
  onEnd,
  onRemove,
}: {
  standing: AdvisorStanding;
  rows: readonly KeyedAdvisorRow[];
  open: number | null;
  photoChoices: readonly PhotoChoice[];
  onToggle: (key: number) => void;
  onRow: (key: number, fields: AdvisorFields) => void;
  /** The group's rows in their new order. */
  onReorder: (group: KeyedAdvisorRow[]) => void;
  onEnd: (id: number) => void;
  onRemove: (key: number) => void;
}) {
  const group = rows.filter((r) => r.fields.standing === standing);
  const drag = useDragOrder(
    group.map((r) => r.key),
    (order) => onReorder(order.map((key) => group.find((r) => r.key === key)!)),
  );
  const shown = drag.order.map((key) => group.find((r) => r.key === key)!).filter(Boolean);
  const labelId = useId();
  if (group.length === 0) return null;
  return (
    <div>
      <p id={labelId} className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-dim">
        {GROUP_LABEL[standing]} · {group.length}
      </p>
      <ul aria-labelledby={labelId} className="space-y-2" {...drag.list}>
        {shown.map((row, index) => (
          <AdvisorRowItem
            key={row.key}
            row={row}
            open={open === row.key}
            photoChoices={photoChoices}
            drag={shown.length > 1 ? drag.row(row.key, index) : null}
            onToggle={() => onToggle(row.key)}
            onChange={(fields) => onRow(row.key, fields)}
            onEnd={row.id === null ? null : () => onEnd(row.id!)}
            onRemove={() => onRemove(row.key)}
          />
        ))}
      </ul>
    </div>
  );
}

/** One advisor: handle, photo, name and role, and a chevron; open, their fields, photo and End advising. */
function AdvisorRowItem({
  row,
  open,
  photoChoices,
  drag,
  onToggle,
  onChange,
  onEnd,
  onRemove,
}: {
  row: KeyedAdvisorRow;
  open: boolean;
  photoChoices: readonly PhotoChoice[];
  drag: DragRow | null;
  onToggle: () => void;
  onChange: (fields: AdvisorFields) => void;
  /** End advising; null for an advisor added in this panel, who is removed instead. */
  onEnd: (() => void) | null;
  onRemove: () => void;
}) {
  const { fields } = row;
  const errors = advisorFieldErrors(fields);
  const refused = Object.keys(errors).length > 0;
  const name = fields.name.trim();
  const role = fields.role.trim();
  const set = <K extends keyof AdvisorFields>(key: K, value: AdvisorFields[K]) => onChange({ ...fields, [key]: value });
  const person = { name: name || "New advisor", photo: fields.photo ?? undefined };
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <li
      draggable={drag !== null && !open}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDragEnd={drag?.onDragEnd}
      className={`rounded-[10px] border bg-white-5 transition-colors duration-300 ease-out ${
        open ? "border-accent" : refused ? "border-danger" : "border-white-10"
      } ${drag?.dragged ? "opacity-50" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left ${CONTENT_FOCUS}`}
      >
        <GripVertical aria-hidden className={`h-4 w-4 shrink-0 ${drag === null ? "text-white-10" : "cursor-grab text-dim"}`} strokeWidth={1.75} />
        <Avatar photo={person.photo} sizeClass="h-7 w-7" sizes="28px" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[13px] font-semibold leading-tight ${name === "" ? "text-dim" : "text-prt-text"}`}>{name || "New advisor"}</span>
          {!open && <span className="mt-0.5 block truncate text-[12px] leading-tight text-prt-muted">{role || "No role yet"}</span>}
        </span>
        <Chevron aria-hidden className="h-4 w-4 shrink-0 text-prt-muted" strokeWidth={1.75} />
      </button>

      {open && (
        <div className="space-y-4 px-3 pb-3 pt-1">
          <Field label="Full name" error={errors.name}>
            {(id, describedBy) => (
              <input
                id={id}
                value={fields.name}
                autoFocus={row.id === null}
                aria-describedby={describedBy}
                aria-invalid={errors.name !== undefined}
                onChange={(e) => set("name", e.target.value)}
                className={inputClass(errors.name)}
              />
            )}
          </Field>
          <Field label="Role on the page" error={errors.role}>
            {(id, describedBy) => (
              <input
                id={id}
                value={fields.role}
                aria-describedby={describedBy}
                aria-invalid={errors.role !== undefined}
                onChange={(e) => set("role", e.target.value)}
                className={inputClass(errors.role)}
              />
            )}
          </Field>
          <StandingSwitch value={fields.standing} onChange={(standing) => set("standing", standing)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="LinkedIn" error={errors.linkedin}>
              {(id, describedBy) => (
                <div className="relative">
                  <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-dim">
                    in/
                  </span>
                  <input
                    id={id}
                    value={fields.linkedin}
                    aria-describedby={describedBy}
                    aria-invalid={errors.linkedin !== undefined}
                    onChange={(e) => set("linkedin", e.target.value)}
                    className={`${inputClass(errors.linkedin)} pl-10`}
                  />
                </div>
              )}
            </Field>
            <Field label="Email" error={errors.email}>
              {(id, describedBy) => (
                <input
                  id={id}
                  type="email"
                  value={fields.email}
                  placeholder="Not shown"
                  aria-describedby={describedBy}
                  aria-invalid={errors.email !== undefined}
                  onChange={(e) => set("email", e.target.value)}
                  className={inputClass(errors.email)}
                />
              )}
            </Field>
          </div>
          <AdvisorPhoto name={person.name} photo={fields.photo} choices={photoChoices} onChange={(photo) => set("photo", photo)}>
            {onEnd === null ? (
              <button type="button" onClick={onRemove} className={LINK}>
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                Remove
              </button>
            ) : (
              <button type="button" onClick={onEnd} className={LINK}>
                <LogOut aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                End advising
              </button>
            )}
          </AdvisorPhoto>
          {onEnd !== null && <p className={PANEL_HINT}>End advising moves them to the Advisors group on the Alumni page, with their years.</p>}
        </div>
      )}
    </li>
  );
}

/** Principal advisor or Specialist, as two halves of one switch (board 80d). */
function StandingSwitch({ value, onChange }: { value: AdvisorStanding; onChange: (standing: AdvisorStanding) => void }) {
  return (
    <div role="group" aria-label="Standing" className="flex rounded-[10px] border border-white-10 bg-white-5 p-1">
      {ADVISOR_STANDINGS.map((standing) => {
        const on = standing === value;
        return (
          <button
            key={standing}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(standing)}
            className={`h-8 flex-1 rounded-md text-[13px] transition-colors duration-300 ease-out ${CONTENT_FOCUS} ${
              on ? "bg-white-10 font-semibold text-prt-text" : "text-text-2 hover:text-prt-text"
            }`}
          >
            {STANDING_LABEL[standing]}
          </button>
        );
      })}
    </div>
  );
}

/** "Replace photo" with the photos the site already holds or an upload, and the row's own action beside it. */
function AdvisorPhoto({
  name,
  photo,
  choices,
  onChange,
  children,
}: {
  name: string;
  photo: AdvisorFields["photo"];
  choices: readonly PhotoChoice[];
  onChange: (photo: AdvisorFields["photo"]) => void;
  children: ReactNode;
}) {
  const [choosing, setChoosing] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-4">
          <button type="button" aria-expanded={choosing} onClick={() => setChoosing((on) => !on)} className={LINK}>
            <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Replace photo
          </button>
          {photo !== null && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className={`rounded-md text-[13px] text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${CONTENT_FOCUS}`}
            >
              Remove photo
            </button>
          )}
        </span>
        {children}
      </div>
      {choosing && (
        <PhotoChoices
          choices={choices}
          selected={photo}
          label={`Photos on the site for ${name}`}
          onPick={(src) => {
            onChange(src);
            setChoosing(false);
          }}
        />
      )}
    </div>
  );
}
