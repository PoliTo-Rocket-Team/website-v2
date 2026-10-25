"use client";

import { useState, type ReactNode } from "react";
import { Lock, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadTeamPagePhoto } from "@/app/dashboard/actions";
import { Avatar } from "@/components/about/person";
import type { PhotoChoice } from "@/lib/about/team-page-edit";
import { personOf, type TeamPerson } from "@/lib/about/team-person";
import type { PersonPhoto } from "@/lib/about/types";
import { CONTENT_FOCUS } from "./content-parts";
import { EditorPanel } from "./editor-panel";
import { Field, inputClass, LOCKED_INPUT } from "./field";
import { PersonCombobox } from "./person-combobox";
import { PhotoPicker } from "./photo-picker";

// The pieces the Team page editor's panels share (boards 80b, 80d, 80f and
// 80g, issues #285 and #736): the panel itself, drawn on the content editors'
// shared EditorPanel frame under a "TEAM PAGE · <section>" eyebrow, the amber
// visual-only note, a team member picker, the photo from their profile,
// another one the site holds or an uploaded one (issue #323), and LinkedIn
// beside the locked team email.

export const PANEL_HINT = "mt-1.5 text-[12px] leading-snug text-prt-muted";

/** A text action at the start of a panel's foot, shaped as the outreach editor's foot Remove: Back to the team record. */
export const PANEL_FOOT_LINK = `inline-flex h-11 items-center gap-2 rounded-full px-2 text-[14px] font-semibold text-prt-text transition-opacity duration-300 ease-out enabled:hover:opacity-80 disabled:cursor-default disabled:text-dim ${CONTENT_FOCUS}`;

/** The red text action at the start of a panel's foot, as the outreach editor's foot Remove: Remove from page, Hide from page. */
export const PANEL_FOOT_DANGER_LINK = `inline-flex h-11 items-center gap-2 rounded-full px-2 text-[14px] font-semibold text-danger transition-opacity duration-300 ease-out hover:opacity-80 ${CONTENT_FOCUS}`;

/**
 * A Team page panel beside the page, on the shared EditorPanel frame (issue
 * #736): the frame's header, body and foot, with the panel's own action at
 * the foot's start and its buttons at the end.
 */
export function TeamPanel({
  label,
  eyebrow,
  title,
  onClose,
  footStart,
  footEnd,
  children,
}: {
  label: string;
  /** The section after "Team page" in the eyebrow: "Org chart", "Departments"; none when the title names it (board 80d). */
  eyebrow?: string;
  title: string;
  onClose: () => void;
  /** The action at the foot's start: Remove from page, Back to the team record. */
  footStart?: ReactNode;
  /** The buttons at the foot's end: Cancel, then the main action. */
  footEnd: ReactNode;
  children: ReactNode;
}) {
  return (
    <EditorPanel
      label={label}
      eyebrow={`Team page${eyebrow === undefined ? "" : ` · ${eyebrow}`}`}
      title={title}
      onClose={onClose}
      foot={
        <div className="flex flex-1 items-center gap-3">
          {footStart}
          <span className="ml-auto flex gap-3">{footEnd}</span>
        </div>
      }
    >
      <div className="space-y-4">{children}</div>
    </EditorPanel>
  );
}

/** The amber note at the top of a panel (boards 80f, 80g): what it changes is only what the Team page shows. */
export function VisualOnlyNote({ children }: { children: ReactNode }) {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3.5">
      <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={1.75} />
      <p className="text-[13px] leading-relaxed text-text-2">{children}</p>
    </div>
  );
}

/**
 * A team member picker, the shared person field (issue #511), with their own
 * photo in the box. It reads empty until the editor picks someone (issue #618).
 */
export function PersonSelect({
  id,
  label,
  people,
  value,
  onChange,
  describedBy,
  invalid = false,
  autoFocus = false,
}: {
  id?: string;
  label?: string;
  /** Everyone on the team, by name. */
  people: readonly TeamPerson[];
  /** Who is picked; null while nobody is. */
  value: number | null;
  onChange: (id: number) => void;
  describedBy?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const chosen = value === null ? undefined : people.find((p) => p.id === value);
  const own = chosen === undefined ? undefined : personOf(chosen);
  return (
    <PersonCombobox
      id={id}
      label={label}
      people={people.map((p) => ({ id: p.id, name: p.name, photoUrl: p.photo }))}
      value={value}
      onChoose={onChange}
      placeholder="Choose a person"
      photo={own === undefined ? undefined : <Avatar photo={own.photo} sizeClass="h-6 w-6" sizes="24px" />}
      describedBy={describedBy}
      invalid={invalid}
      autoFocus={autoFocus}
    />
  );
}

/**
 * "Photo from their profile" (boards 80f, 80g): the person's own photo, or
 * another the site already holds or an uploaded one; "Use another photo" opens the choices and
 * "Use their own photo" goes back.
 */
export function PhotoField({
  person,
  photo,
  choices,
  onChange,
}: {
  person: TeamPerson | undefined;
  /** Another photo; null shows their own. */
  photo: PersonPhoto | null;
  choices: readonly PhotoChoice[];
  onChange: (photo: PersonPhoto | null) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const own = person === undefined ? undefined : personOf(person);
  const shown = photo ?? own?.photo;
  return (
    <div>
      <p className="mb-2 text-[13px] leading-snug text-prt-text">
        Photo
        <span className="ml-1.5 text-prt-muted">{photo === null ? "from their profile" : "another photo"}</span>
      </p>
      <div className="flex items-center gap-4">
        <Avatar photo={shown} sizeClass="h-10 w-10" sizes="40px" />
        <button
          type="button"
          aria-expanded={choosing}
          onClick={() => setChoosing((open) => !open)}
          className={`inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-accent transition-colors duration-300 ease-out hover:text-accent-hover ${CONTENT_FOCUS}`}
        >
          <Upload aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Use another photo
        </button>
        {photo !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`rounded-md text-[13px] text-prt-muted transition-colors duration-300 ease-out hover:text-prt-text ${CONTENT_FOCUS}`}
          >
            Use their own photo
          </button>
        )}
      </div>
      {choosing && (
        <PhotoChoices
          choices={choices}
          selected={photo}
          onPick={(src) => {
            onChange(src);
            setChoosing(false);
          }}
        />
      )}
    </div>
  );
}

/** The panels' small accent link, for the upload under the choices. */
const UPLOAD_LINK = `inline-flex items-center gap-1.5 rounded-md text-[13px] font-semibold text-accent transition-colors duration-300 ease-out hover:text-accent-hover disabled:cursor-wait disabled:opacity-60 ${CONTENT_FOCUS}`;

/**
 * What Replace photo opens: the photos the site already holds, and under them
 * "Upload a photo" (issue #323), which crops a new one square as the Alumni
 * panels do and stores it at once. The picked or uploaded src goes to
 * `onPick`; the panel's Save, then Save draft or Publish, keeps it.
 */
export function PhotoChoices({
  choices,
  selected,
  onPick,
  label = "Photos on the site",
}: {
  choices: readonly PhotoChoice[];
  selected: PersonPhoto | null;
  onPick: (src: PersonPhoto) => void;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const upload = async (square: File): Promise<boolean> => {
    setUploading(true);
    try {
      const form = new FormData();
      form.set("photo", square);
      const result = await uploadTeamPagePhoto(form);
      if (!result.ok) {
        toast.error("Could not upload the photo", { description: result.error });
        return false;
      }
      onPick(result.value);
      return true;
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-hairline p-3">
      <div role="group" aria-label={label} className="grid grid-cols-6 gap-2.5">
        {choices.map((choice) => {
          const on = choice.src === selected;
          return (
            <button
              key={choice.src}
              type="button"
              aria-pressed={on}
              aria-label={`Photo of ${choice.label}`}
              title={choice.label}
              onClick={() => onPick(choice.src)}
              className={`justify-self-center rounded-full ring-offset-2 ring-offset-panel transition-shadow duration-300 ease-out ${on ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-border-strong"} ${CONTENT_FOCUS}`}
            >
              <Avatar photo={choice.src} sizeClass="h-11 w-11" sizes="44px" />
            </button>
          );
        })}
      </div>
      <div className={choices.length > 0 ? "mt-3 border-t border-hairline pt-3" : undefined}>
        <PhotoPicker
          label={uploading ? "Uploading…" : "Upload a photo"}
          pending={uploading}
          onCropped={upload}
          buttonClass={UPLOAD_LINK}
          iconClass="h-3.5 w-3.5"
        />
      </div>
    </div>
  );
}

/** LinkedIn, as a handle after "in/", beside the team email, which is never edited here. */
export function ContactFields({ linkedin, error, onChange }: { linkedin: string; error?: string; onChange: (linkedin: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Field label="LinkedIn" error={error}>
        {(id, describedBy) => (
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[14px] text-dim">
              in/
            </span>
            <input
              id={id}
              value={linkedin}
              aria-describedby={describedBy}
              aria-invalid={error !== undefined}
              onChange={(e) => onChange(e.target.value)}
              className={`${inputClass(error)} pl-10`}
            />
          </div>
        )}
      </Field>
      <div className="min-w-0">
        <p className="mb-2 text-[13px] leading-snug text-prt-text">Email</p>
        <div className={LOCKED_INPUT}>
          <span className="min-w-0 flex-1 truncate">Team email</span>
          <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}
