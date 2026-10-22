import type { Versioned } from "@/lib/content/versioned";
import { backgroundSrc, visualModelOf, type ProjectRecord } from "./record";

// Publish is held until Home and the Projects list are checked (board 93e,
// issue #530, Owner decision on #522): a change to the top visual (3D model,
// photo or none, and its caption) or to the background changes how the
// project looks on its Home card and in the Projects list, and so does a
// project going on the site for the first time. Until the editor has opened
// both tabs of the page switch and confirmed "Looks right" on each, Publish
// stays off. Edits that touch neither publish as before.

/**
 * How a project looks on Home and the Projects list: its visual, caption and
 * background, as the files and model those surfaces draw. Two records that
 * look the same there have the same look, whatever else differs.
 */
export type CardLook = string & { readonly __brand: "CardLook" };

export function cardLookOf(record: ProjectRecord): CardLook {
  const { visual } = record.hero;
  const shown =
    visual.kind === "none"
      ? ["none"]
      : visual.kind === "photo"
        ? ["photo", visual.caption, visual.photo.src]
        : ["model", visual.caption, visualModelOf(record.hero) ?? ""];
  return JSON.stringify([...shown, backgroundSrc(record.background, "tall"), backgroundSrc(record.background, "wide")]) as CardLook;
}

/** The look the site shows now: the published version's, or none for a project never published. */
export function liveLookOf(version: Versioned<ProjectRecord>): CardLook | null {
  return version.state === "published" ? cardLookOf(version.published) : null;
}

/** The two tabs of the page switch the editor checks the card on. */
export type CheckedTab = "home" | "list";

/**
 * Which tabs the editor confirmed "Looks right" on, for the look in the
 * editor when they did. A change to that look clears both.
 */
export type CardChecks = { readonly look: CardLook; readonly home: boolean; readonly list: boolean };

/** Nothing checked yet, for the look the editor opens on. */
export function uncheckedFor(look: CardLook): CardChecks {
  return { look, home: false, list: false };
}

/** The checks after an edit: kept while the look stays the same, cleared when it changes. */
export function checksAfterEdit(checks: CardChecks, look: CardLook): CardChecks {
  return checks.look === look ? checks : uncheckedFor(look);
}

/** The editor confirmed "Looks right" on one tab. */
export function confirmTab(checks: CardChecks, tab: CheckedTab): CardChecks {
  return { ...checks, [tab]: true };
}

/**
 * Whether the card has to be checked before Publish: `free` when the look in
 * the editor is the one the site shows, else `checking` with each tab's tick.
 */
export type PublishHold = { readonly kind: "free" } | { readonly kind: "checking"; readonly home: boolean; readonly list: boolean };

export function publishHoldOf(checks: CardChecks, live: CardLook | null): PublishHold {
  if (live === checks.look) return { kind: "free" };
  return { kind: "checking", home: checks.home, list: checks.list };
}

/** Publish is off while a tab still has its cross. */
export function holdsPublish(hold: PublishHold): boolean {
  return hold.kind === "checking" && !(hold.home && hold.list);
}
