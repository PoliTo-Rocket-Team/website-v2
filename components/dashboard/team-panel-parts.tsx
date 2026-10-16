"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Lock, TriangleAlert, Upload, X } from "lucide-react";
import { Avatar } from "@/components/about/person";
import type { PhotoChoice } from "@/lib/about/team-page-edit";
import { personOf, type TeamPerson } from "@/lib/about/team-person";
import type { PersonPhoto } from "@/lib/about/types";
import { CONTENT_FOCUS } from "./content-parts";
import { Field, inputClass, LOCKED_INPUT } from "./field";

// The pieces the Team page editor's Add leader and Edit a head block panels
// share (boards 80f and 80g, issue #285): the 480px panel beside the page, its
// "TEAM PAGE · <section>" header, the amber visual-only note, a team member
// picker, the photo from their profile or another one the site holds, and
// LinkedIn beside the locked team email.

export const PANEL_HINT = "mt-1.5 text-[12px] leading-snug text-prt-muted";

/** The panel beside the page: a header, a scrolling body and the actions pinned at its foot. */
export function TeamPanel({
  label,
  eyebrow,
  title,
  onClose,
  footer,
  children,
}: {
  label: string;
  /** The section after "Team page" in the eyebrow: "Org chart", "Departments"; none when the title names it (board 80d). */
  eyebrow?: string;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside
      aria-label={label}
      className="flex flex-col border-l border-hairline bg-panel max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-[60px] max-md:z-50 md:w-[480px] md:shrink-0"
    >
      <header className="flex shrink-0 items-start gap-3.5 border-b border-hairline px-7 py-5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Team page{eyebrow === undefined ? "" : ` · ${eyebrow}`}</p>
          <h2 className="mt-1.5 truncate text-[20px] font-bold leading-tight">{title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the panel"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-prt-muted transition-colors duration-300 ease-out hover:bg-white-5 hover:text-prt-text ${CONTENT_FOCUS}`}
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 py-6">{children}</div>
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-hairline px-7 py-4">{footer}</footer>
    </aside>
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

/** A team member picker with their photo in the box, by name. */
export function PersonSelect({
  id,
  label,
  people,
  value,
  onChange,
  className = "",
}: {
  id?: string;
  label?: string;
  /** Everyone on the team, by name. */
  people: readonly TeamPerson[];
  value: number;
  onChange: (id: number) => void;
  className?: string;
}) {
  const chosen = people.find((p) => p.id === value);
  const own = chosen === undefined ? undefined : personOf(chosen);
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
        <Avatar person={{ name: own?.name ?? "", photo: own?.photo }} sizeClass="h-6 w-6" sizes="24px" fallback="initials" initialsClass="text-[8px]" />
      </span>
      <select
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputClass()} cursor-pointer appearance-none pl-12 pr-10`}
      >
        {people.map((p) => (
          <option key={p.id} value={p.id} className="bg-panel">
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-prt-muted" strokeWidth={1.75} />
    </div>
  );
}

/**
 * "Photo from their profile" (boards 80f, 80g): the person's own photo, or
 * another the site already holds; "Use another photo" opens the choices and
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
        <Avatar person={{ name: own?.name ?? "", photo: shown }} sizeClass="h-10 w-10" sizes="40px" fallback="initials" initialsClass="text-[11px]" />
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
        <div role="group" aria-label="Photos on the site" className="mt-3 grid grid-cols-6 gap-2.5 rounded-xl border border-hairline p-3">
          {choices.map((choice) => {
            const on = choice.src === photo;
            return (
              <button
                key={choice.src}
                type="button"
                aria-pressed={on}
                aria-label={`Photo of ${choice.label}`}
                title={choice.label}
                onClick={() => {
                  onChange(choice.src);
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
  );
}

/** LinkedIn, as a handle after "in/", beside the team email, which is never edited here. */
export function ContactFields({ linkedin, error, onChange }: { linkedin: string; error?: string; onChange: (linkedin: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
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
