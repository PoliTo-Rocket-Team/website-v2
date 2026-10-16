"use client";

import { useState } from "react";
import { ChevronDown, Lock, TriangleAlert, Upload, X } from "lucide-react";
import { Avatar } from "@/components/about/person";
import type { PersonFieldErrors, PersonFields, PhotoChoice, SpotRecord } from "@/lib/about/team-page-edit";
import { personOf, type TeamPerson } from "@/lib/about/team-person";
import { CONTENT_FOCUS } from "./content-parts";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON } from "./drawer";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { Toggle } from "./controls";

// The Edit person panel (board 80b, issue #284): 480px beside the Team page
// under the edit shell, for the team leader or a leader on the arc. It
// changes only what the page shows in that spot, which the amber warning
// says in the board's words. Each field shows the team record under it, and
// the page redraws as the editor types; Save keeps the edit in the working
// layer, Cancel drops it, and Back to the team record removes the spot's
// edit. Save draft and Publish sit on the edit bar.

const HINT = "mt-1.5 text-[12px] leading-snug text-prt-muted";

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
    <aside
      aria-label="Edit person"
      className="flex flex-col border-l border-hairline bg-panel max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-[60px] max-md:z-50 md:w-[480px] md:shrink-0"
    >
      <header className="flex shrink-0 items-center gap-3.5 border-b border-hairline px-7 py-5">
        <Avatar person={{ name: fields.name || own.name, photo }} sizeClass="h-11 w-11" sizes="44px" fallback="initials" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[20px] font-bold leading-tight">{fields.name.trim() || own.name}</h2>
          <p className="mt-0.5 truncate text-[13px] text-prt-muted">
            {fields.role.trim() || record.role} · {place}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close the panel"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${CONTENT_FOCUS}`}
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 py-6">
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
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                  <Avatar person={{ name: own.name, photo: own.photo }} sizeClass="h-6 w-6" sizes="24px" fallback="initials" initialsClass="text-[8px]" />
                </span>
                <select
                  id={id}
                  value={fields.person}
                  onChange={(e) => onPerson(Number(e.target.value))}
                  className={`${inputClass()} cursor-pointer appearance-none pl-12 pr-10`}
                >
                  {sorted.map((p) => (
                    <option key={p.id} value={p.id} className="bg-panel">
                      {p.name}
                    </option>
                  ))}
                </select>
                <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
              </div>
              <p className={HINT}>Team record: {record.person.name}. Pick anyone on the team to show here instead.</p>
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
              <p className={HINT}>Team record: {own.name}.</p>
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
              <p className={HINT}>
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
            <Avatar person={{ name: own.name, photo }} sizeClass="h-12 w-12" sizes="48px" fallback="initials" initialsClass="text-[12px]" />
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
            <div role="group" aria-label="Photos on the site" className="mt-3 grid grid-cols-6 gap-2.5 rounded-xl border border-hairline p-3">
              {photoChoices.map((choice) => {
                const on = choice.src === fields.photo;
                return (
                  <button
                    key={choice.src}
                    type="button"
                    aria-pressed={on}
                    aria-label={`Photo of ${choice.label}`}
                    title={choice.label}
                    onClick={() => {
                      set("photo", choice.src);
                      setChoosing(false);
                    }}
                    className={`justify-self-center rounded-full ring-offset-2 ring-offset-panel transition-shadow duration-300 ease-out ${on ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-border-strong"} ${CONTENT_FOCUS}`}
                  >
                    <Avatar person={{ name: choice.label, photo: choice.src }} sizeClass="h-11 w-11" sizes="44px" fallback="initials" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
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
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-hairline px-7 py-4">
        <button
          type="button"
          disabled={onBack === null}
          onClick={() => onBack?.()}
          className={`rounded-md text-[14px] font-semibold text-prt-text transition-opacity duration-300 ease-out enabled:hover:opacity-80 disabled:cursor-default disabled:text-dim ${CONTENT_FOCUS}`}
        >
          Back to the team record
        </button>
        <span className="flex gap-3">
          <button type="button" onClick={onCancel} className={PANEL_GHOST_BUTTON}>
            Cancel
          </button>
          <button type="button" onClick={onSave} className={PANEL_PRIMARY_BUTTON}>
            Save
          </button>
        </span>
      </footer>
    </aside>
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
