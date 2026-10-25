import { cardLookFrom, type CardLook } from "@/lib/content/publish-hold";
import type { Versioned } from "@/lib/content/versioned";
import { backgroundSrc, visualModelOf, type ProjectRecord } from "./record";

// What the project editor's Publish hold checks (board 93e, issue #530, Owner
// decision on #522; the rule is lib/content/publish-hold.ts): a change to the
// top visual (3D model, photo or none, and its caption) or to the background
// changes how the project looks on its Home card and in the Projects list,
// and so does a project going on the site for the first time. Edits that
// touch neither publish as before.

/** The pages of the project editor's switch that show the project's card, checked before Publish. */
export type ProjectCheckedPage = "home" | "list";

export const PROJECT_CHECKED_PAGES: readonly ProjectCheckedPage[] = ["home", "list"];

/**
 * How a project looks on Home and the Projects list: its visual, caption and
 * background, as the files and model those surfaces draw.
 */
export function cardLookOf(record: ProjectRecord): CardLook {
  const { visual } = record.hero;
  const shown =
    visual.kind === "none"
      ? ["none"]
      : visual.kind === "photo"
        ? ["photo", visual.caption, visual.photo.src]
        : ["model", visual.caption, visualModelOf(record.hero) ?? ""];
  return cardLookFrom([...shown, backgroundSrc(record.background, "tall"), backgroundSrc(record.background, "wide")]);
}

/** The look the site shows now: the published version's, or none for a project never published. */
export function liveLookOf(version: Versioned<ProjectRecord>): CardLook | null {
  return version.state === "published" ? cardLookOf(version.published) : null;
}
