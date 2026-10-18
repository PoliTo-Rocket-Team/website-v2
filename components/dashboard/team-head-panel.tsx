"use client";

import { useId, useState } from "react";
import { EyeOff, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { Avatar } from "@/components/about/person";
import type { HeadFieldErrors, HeadFields, LeadRow } from "@/lib/about/team-page-add";
import type { PhotoChoice } from "@/lib/about/team-page-edit";
import { personOf, type TeamPerson } from "@/lib/about/team-person";
import { CONTENT_FOCUS, useDragOrder, type DragRow } from "./content-parts";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON } from "./drawer";
import { Field, GroupLabel, inputClass } from "./field";
import { ContactFields, PANEL_HINT, PersonSelect, PhotoField, TeamPanel, VisualOnlyNote } from "./team-panel-parts";

// The Edit a head block panel (board 80g, issue #285), opened from a head
// block's Edit chip, its "+ Add division lead", or "+ Add department": the
// person in the spot, the role and department name on the page, the division
// leads the block shows (drag to reorder, edit, remove, add), the photo and
// the contacts. The page redraws as the editor types. It changes only what
// the Team page shows: real heads, leads and divisions are set in Team tree.

/** Which head block the panel edits: one the roles fill, one the editor added, or a department being added. */
export type HeadPanelKind = "roles" | "added" | "new";

const ICON_BUTTON = `inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${CONTENT_FOCUS}`;

export function TeamHeadPanel({
  kind,
  fields,
  record,
  people,
  errors,
  photoChoices,
  onChange,
  onPerson,
  onAddLead,
  onDone,
  onCancel,
  onHide,
  onBack,
}: {
  kind: HeadPanelKind;
  fields: HeadFields;
  /** Who the roles put in the spot, for the "Team record" line; null for an added department. */
  record: TeamPerson | null;
  /** Everyone on the team, by name. */
  people: readonly TeamPerson[];
  errors: HeadFieldErrors;
  photoChoices: readonly PhotoChoice[];
  onChange: (fields: HeadFields) => void;
  /** Another head: the fields take their own photo and LinkedIn. */
  onPerson: (id: number) => void;
  /** A new lead row at the end; it opens for editing. */
  onAddLead: () => void;
  onDone: () => void;
  onCancel: () => void;
  /** Hide from page, or Remove from page for an added department; null while it is being added. */
  onHide: (() => void) | null;
  /** Back to the team record; null when the block shows the record already or the roles do not fill it. */
  onBack: (() => void) | null;
}) {
  // Rows added in the panel open for editing at once.
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set(fields.leads.filter((l) => l.at === null).map((l) => l.key)));
  const set = <K extends keyof HeadFields>(key: K, value: HeadFields[K]) => onChange({ ...fields, [key]: value });
  const setRow = (key: number, row: Partial<LeadRow>) => set("leads", fields.leads.map((l) => (l.key === key ? { ...l, ...row } : l)));
  const toggle = (key: number) =>
    setOpen((keys) => {
      const next = new Set(keys);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const drag = useDragOrder(
    fields.leads.map((l) => l.key),
    (order) => set("leads", order.map((key) => fields.leads.find((l) => l.key === key)!)),
  );
  const rows = drag.order.map((key) => fields.leads.find((l) => l.key === key)!).filter(Boolean);
  const head = people.find((p) => p.id === fields.person);
  const department = fields.department.trim();
  const added = kind !== "roles";
  const leadsLabel = useId();

  return (
    <TeamPanel
      label={kind === "new" ? "Add department" : "Edit head block"}
      eyebrow="Departments"
      title={kind === "new" ? "Add department" : (head?.name ?? "Head")}
      onClose={onCancel}
      footer={
        <>
          {onHide === null ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onHide}
              className={`inline-flex items-center gap-2 rounded-md text-[14px] font-semibold text-danger transition-opacity duration-300 ease-out hover:opacity-80 ${CONTENT_FOCUS}`}
            >
              {added ? <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> : <EyeOff aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
              {added ? "Remove from page" : "Hide from page"}
            </button>
          )}
          <span className="flex gap-3">
            {kind === "roles" ? (
              <button type="button" disabled={onBack === null} onClick={() => onBack?.()} className={`${PANEL_GHOST_BUTTON} disabled:cursor-default disabled:text-dim`}>
                Back to the team record
              </button>
            ) : (
              <button type="button" onClick={onCancel} className={PANEL_GHOST_BUTTON}>
                Cancel
              </button>
            )}
            <button type="button" onClick={onDone} className={PANEL_PRIMARY_BUTTON}>
              {kind === "new" ? "Add to page" : "Done"}
            </button>
          </span>
        </>
      }
    >
      <VisualOnlyNote>
        {added
          ? "Visual only. This adds a department on the Team page. It creates no department, division or role in the team."
          : "Visual only. Changes here change the Team page, not the team. Real heads, leads and divisions are set in Team tree."}
      </VisualOnlyNote>

      <Field label="Person in this spot" hint={department === "" ? "Head" : `Head, ${department}`}>
        {(id) => (
          <>
            <PersonSelect id={id} people={people} value={fields.person} onChange={onPerson} />
            <p className={PANEL_HINT}>
              {record === null ? "Their photo, LinkedIn and email come from their profile." : `Team record: ${record.name}.`}
            </p>
          </>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Role on the page" error={errors.role}>
          {(id, describedBy) => (
            <input
              id={id}
              value={fields.role}
              placeholder={department === "" ? "Head of ..." : `Head of ${department}`}
              aria-describedby={describedBy}
              aria-invalid={errors.role !== undefined}
              onChange={(e) => set("role", e.target.value)}
              className={inputClass(errors.role)}
            />
          )}
        </Field>
        <Field label="Department on the page" error={errors.department}>
          {(id, describedBy) => (
            <input
              id={id}
              value={fields.department}
              autoFocus={kind === "new"}
              aria-describedby={describedBy}
              aria-invalid={errors.department !== undefined}
              onChange={(e) => set("department", e.target.value)}
              className={inputClass(errors.department)}
            />
          )}
        </Field>
      </div>

      <div>
        <GroupLabel id={leadsLabel} label="Division leads shown" hint={rows.length > 1 ? "drag to reorder" : undefined} />
        {rows.length > 0 && (
          <ul aria-labelledby={leadsLabel} className="space-y-2" {...drag.list}>
            {rows.map((row, index) => (
              <LeadRowItem
                key={row.key}
                row={row}
                people={people}
                open={open.has(row.key)}
                error={errors.leads?.[row.key]}
                drag={rows.length > 1 ? drag.row(row.key, index) : null}
                onToggle={() => toggle(row.key)}
                onChange={(change) => setRow(row.key, change)}
                onRemove={() => set("leads", fields.leads.filter((l) => l.key !== row.key))}
              />
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen((keys) => new Set([...keys, fields.leads.reduce((last, l) => Math.max(last, l.key), -1) + 1]));
            onAddLead();
          }}
          className={`mt-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Add division lead
        </button>
      </div>

      <PhotoField person={head} photo={fields.photo} choices={photoChoices} onChange={(photo) => set("photo", photo)} />

      <ContactFields linkedin={fields.linkedin} error={errors.linkedin} onChange={(linkedin) => set("linkedin", linkedin)} />
    </TeamPanel>
  );
}

/** One division lead row: drag handle, who and which division, edit and remove; open, the person and division to change. */
function LeadRowItem({
  row,
  people,
  open,
  error,
  drag,
  onToggle,
  onChange,
  onRemove,
}: {
  row: LeadRow;
  people: readonly TeamPerson[];
  open: boolean;
  error: string | undefined;
  drag: DragRow | null;
  onToggle: () => void;
  onChange: (change: Partial<LeadRow>) => void;
  onRemove: () => void;
}) {
  const member = people.find((p) => p.id === row.person);
  const person = member === undefined ? { name: "" } : personOf(member);
  const division = row.division.trim();
  return (
    <li
      draggable={drag !== null}
      onDragStart={drag?.onDragStart}
      onDragOver={drag?.onDragOver}
      onDragEnd={drag?.onDragEnd}
      className={`rounded-[10px] border bg-white-5 ${error === undefined ? "border-white-10" : "border-danger"} ${drag?.dragged ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <GripVertical aria-hidden className={`h-4 w-4 shrink-0 ${drag === null ? "text-white-10" : "cursor-grab text-dim"}`} strokeWidth={1.75} />
        <Avatar photo={person.photo} sizeClass="h-7 w-7" sizes="28px" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-prt-text">{person.name}</p>
          <p className={`mt-0.5 truncate text-[12px] leading-tight ${division === "" ? "text-dim" : "text-prt-muted"}`}>
            {division === "" ? "No division yet" : division}
          </p>
        </div>
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`Edit ${person.name}`} className={ICON_BUTTON}>
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
        <button type="button" onClick={onRemove} aria-label={`Remove ${person.name}`} className={ICON_BUTTON}>
          <X aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-2 gap-3 border-t border-white-10 px-3 py-3">
          <PersonSelect label="Division lead" people={people} value={row.person} onChange={(id) => onChange({ person: id })} />
          <input
            aria-label="Division"
            value={row.division}
            placeholder="Division"
            autoFocus={row.at === null}
            aria-invalid={error !== undefined}
            onChange={(e) => onChange({ division: e.target.value })}
            className={inputClass(error)}
          />
          {error !== undefined && <p className="col-span-2 text-[12px] text-danger">{error}</p>}
        </div>
      )}
    </li>
  );
}
