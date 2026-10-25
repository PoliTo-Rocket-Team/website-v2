"use client";

import { Trash2 } from "lucide-react";
import { ARC_LEADERS } from "@/lib/about/team-layer";
import type { ArcGap, LeaderFieldErrors, LeaderFields } from "@/lib/about/team-page-add";
import type { PhotoChoice } from "@/lib/about/team-page-edit";
import type { TeamPerson } from "@/lib/about/team-person";
import { CONTENT_FOCUS } from "./content-parts";
import { PANEL_GHOST_BUTTON, PANEL_PRIMARY_BUTTON } from "./drawer";
import { Field, inputClass } from "./field";
import { ContactFields, PANEL_HINT, PersonSelect, PhotoField, TeamPanel, VisualOnlyNote } from "./team-panel-parts";

// The Add leader panel (board 80f, issue #285): opened by a "+" on the arc,
// it puts a team member on the page at that place, drawn inline like every
// other leader while the editor fills it in. It adds a spot on the Team page
// only. Place lists every gap on the arc, so the editor moves the leader by
// picking another one. Opened from a leader the editor added, it edits them,
// and Remove from page takes them off.

export function TeamLeaderPanel({
  adding,
  fields,
  gaps,
  people,
  errors,
  photoChoices,
  onChange,
  onPerson,
  onSubmit,
  onCancel,
  onRemove,
}: {
  /** A new leader (Add to page), or one the editor added before (Save). */
  adding: boolean;
  fields: LeaderFields;
  /** Every place on the arc, with this leader off it. */
  gaps: readonly ArcGap[];
  /** Everyone on the team, by name. */
  people: readonly TeamPerson[];
  errors: LeaderFieldErrors;
  photoChoices: readonly PhotoChoice[];
  onChange: (fields: LeaderFields) => void;
  /** Another person: the fields take their own photo and LinkedIn. */
  onPerson: (id: number) => void;
  onSubmit: () => void;
  onCancel: () => void;
  /** Remove from page; null for a leader not added yet. */
  onRemove: (() => void) | null;
}) {
  const set = <K extends keyof LeaderFields>(key: K, value: LeaderFields[K]) => onChange({ ...fields, [key]: value });
  const person = people.find((p) => p.id === fields.person);
  return (
    <TeamPanel
      label={adding ? "Add leader" : "Edit leader"}
      eyebrow="Org chart"
      title={adding ? "Add leader" : (person?.name ?? "Leader")}
      onClose={onCancel}
      footer={
        <>
          {onRemove === null ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onRemove}
              className={`inline-flex items-center gap-2 rounded-md text-[14px] font-semibold text-danger transition-opacity duration-300 ease-out hover:opacity-80 ${CONTENT_FOCUS}`}
            >
              <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Remove from page
            </button>
          )}
          <span className="flex gap-3">
            <button type="button" onClick={onCancel} className={PANEL_GHOST_BUTTON}>
              Cancel
            </button>
            <button type="button" onClick={onSubmit} className={PANEL_PRIMARY_BUTTON}>
              {adding ? "Add to page" : "Save"}
            </button>
          </span>
        </>
      }
    >
      <VisualOnlyNote>Visual only. This adds a spot on the Team page. It does not give anyone a role or access in the team.</VisualOnlyNote>

      <Field label="Person" hint="from the team" error={errors.person}>
        {(id, describedBy) => (
          <>
            <PersonSelect id={id} people={people} value={fields.person} onChange={onPerson} describedBy={describedBy} invalid={errors.person !== undefined} />
            <p className={PANEL_HINT}>Their photo, LinkedIn and email come from their profile.</p>
          </>
        )}
      </Field>

      <Field label="Role on the page" error={errors.role}>
        {(id, describedBy) => (
          <input
            id={id}
            value={fields.role}
            autoFocus
            aria-describedby={describedBy}
            aria-invalid={errors.role !== undefined}
            onChange={(e) => set("role", e.target.value)}
            className={inputClass(errors.role)}
          />
        )}
      </Field>

      <Field label="Place" hint={adding ? "where you clicked +" : "on the arc"}>
        {(id) => (
          <select id={id} value={fields.gap} onChange={(e) => set("gap", Number(e.target.value))} className={`${inputClass()} cursor-pointer`}>
            {gaps.map((gap, i) => (
              <option key={i} value={i} className="bg-panel">
                {gap.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <PhotoField person={person} photo={fields.photo} choices={photoChoices} onChange={(photo) => set("photo", photo)} />

      <ContactFields linkedin={fields.linkedin} error={errors.linkedin} onChange={(linkedin) => set("linkedin", linkedin)} />

      <p className={`text-[12px] leading-snug ${errors.arc === undefined ? "text-prt-muted" : "text-danger"}`}>
        {errors.arc ?? `Up to ${ARC_LEADERS} leaders. The arc keeps equal spacing.`}
      </p>
    </TeamPanel>
  );
}
