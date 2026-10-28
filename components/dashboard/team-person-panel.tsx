"use client";

import { useState } from "react";
import { Lock, TriangleAlert, Upload } from "lucide-react";
import { Avatar } from "@/components/about/person";
import type { PersonFieldErrors, PersonFields, PhotoChoice, SpotRecord } from "@/lib/about/team-page-edit";
import { personOf, type TeamPerson } from "@/lib/about/team-person";
import { CONTENT_FOCUS } from "./content-parts";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON } from "./drawer";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { Toggle } from "./controls";
import { PANEL_FOOT_LINK, PANEL_HINT, PersonSelect, PhotoChoices, TeamPanel } from "./team-panel-parts";

// The Edit person panel (board 80b, issue #284): beside the Team page under
// the edit shell, on the shared TeamPanel frame (issue #736), for the team
// leader or a leader on the arc. It
// changes only what the page shows in that spot, which the amber warning
// says in the board's words. Each field shows the team record under it, and
// the page redraws as the editor types; Save keeps the edit in the working
// layer, Cancel drops it, and Back to the team record removes the spot's
// edit. Save draft and Publish sit on the edit bar.


export function TeamPersonPanel({
  leader,
  place,
  record,
  people,
  fields,
  onChange,
  onPerson,
  errors,
  photoChoices,
  onSave,
  onCancel,
  onBack,
}: {
  /** The team leader's spot: always on the page. */
  leader: boolean;
  /** Where the spot is, for the header and the "Person in this spot" hint: "Org chart". */
  place: string;
  record: SpotRecord;
  /** Everyone on the team, who the spot may show. */
  people: readonly TeamPerson[];
  fields: PersonFields;
  onChange: (fields: PersonFields) => void;
  /** Another person in the spot: the fields take their own name, photo and LinkedIn. */
  onPerson: (id: number) => void;
  errors: PersonFieldErrors;
  photoChoices: readonly PhotoChoice[];
  onSave: () => void;
  onCancel: () => void;
  /** Back to the team record; null when the spot shows the record already. */
  onBack: (() => void) | null;
}) {
  const [choosing, setChoosing] = useState(false);
  const chosen = people.find((p) => p.id === fields.person) ?? record.person;
  const own = personOf(chosen);
  const photo = fields.photo ?? own.photo;
  const set = <K extends keyof PersonFields>(key: K, value: PersonFields[K]) => onChange({ ...fields, [key]: value });
  const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name, "en"));

  return (
    <TeamPanel
      label="Edit person"
      eyebrow={place}
      title={fields.name.trim() || own.name}
      onClose={onCancel}
      footStart={
        <button type="button" disabled={onBack === null} onClick={() => onBack?.()} className={PANEL_FOOT_LINK}>
          Back to the team record
        </button>
      }
      footEnd={
        <>
          <button type="button" onClick={onCancel} className={PANEL_GHOST_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className={PANEL_PRIMARY_BUTTON}>
            Save
          </button>
        </>
      }
    >
      <VisualOnlyWarning />

      <div className="flex items-center justify-between gap-4 rounded-xl border border-hairline px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] leading-snug text-prt-text">On the Team page</p>
          <p className="mt-0.5 text-[12px] leading-snug text-prt-muted">
            {leader ? "The Team Leader always shows on the page." : "Hide someone who asks not to be shown."}
          </p>
        </div>
        <Toggle checked={fields.shown} onCheckedChange={(on) => set("shown", on)} label="On the Team page" disabled={leader} />
      </div>

      <Field label="Person in this spot" hint={`${record.role}, ${place.toLowerCase()}`}>
        {(id) => (
          <>
            <PersonSelect id={id} people={sorted} value={fields.person} onChange={onPerson} />
            <p className={PANEL_HINT}>Team record: {record.person.name}. Pick anyone on the team to show here instead.</p>
          </>
        )}
      </Field>

      <Field label="Name on the page" error={errors.name}>
        {(id, describedBy) => (
          <>
            <input
              id={id}
              value={fields.name}
              aria-describedby={describedBy}
              aria-invalid={errors.name !== undefined}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass(errors.name)}
            />
            <p className={PANEL_HINT}>Team record: {own.name}.</p>
          </>
        )}
      </Field>

      <Field label="Role on the page" error={errors.role}>
        {(id, describedBy) => (
          <>
            <input
              id={id}
              value={fields.role}
              aria-describedby={describedBy}
              aria-invalid={errors.role !== undefined}
              onChange={(e) => set("role", e.target.value)}
              className={inputClass(errors.role)}
            />
            <p className={PANEL_HINT}>
              Team record: {record.role}. Section comes from the role: {place}.
            </p>
          </>
        )}
      </Field>

      <div>
        <p className="mb-2 text-[13px] leading-snug text-prt-text">
          Photo
          {fields.photo !== null && <span className="ml-1.5 text-prt-muted">replaced here</span>}
        </p>
        <div className="flex items-center gap-4">
          <Avatar photo={photo} sizeClass="h-12 w-12" sizes="48px" />
          <button
            type="button"
            aria-expanded={choosing}
            onClick={() => setChoosing((open) => !open)}
            className={`inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
          >
            <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Replace photo
          </button>
          <button
            type="button"
            disabled={fields.photo === null}
            onClick={() => set("photo", null)}
            className={`rounded-md text-[13px] text-prt-muted transition-colors duration-300 ease-out enabled:hover:text-prt-text disabled:cursor-default ${CONTENT_FOCUS}`}
          >
            Use their own photo
          </button>
        </div>
        {choosing && (
          <PhotoChoices
            choices={photoChoices}
            selected={fields.photo}
            onPick={(src) => {
              set("photo", src);
              setChoosing(false);
            }}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="LinkedIn" hint="optional" error={errors.linkedin}>
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
        <div className="min-w-0">
          <p className="mb-2 text-[13px] leading-snug text-prt-text">Email on the page</p>
          <div className={LOCKED_INPUT} title={own.email}>
            <span className="min-w-0 flex-1 truncate">Team email</span>
            <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          </div>
        </div>
      </div>
    </TeamPanel>
  );
}

/** Board 80b's amber note, in its words: an edit here changes only what the Team page shows. */
function VisualOnlyWarning() {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3.5">
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
      <div>
        <p className="text-[13px] font-semibold leading-snug text-prt-text">Changes here are visual only</p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-2">
          They change what the Team page shows, not the team itself. Showing someone else as Team Leader here does not make them team
          leader in the dashboard, and does not change anyone&apos;s role or access. To change the real team, use Members or Team tree.
        </p>
      </div>
    </div>
  );
}
