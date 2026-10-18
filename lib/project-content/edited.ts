import type { ContentItem, Versioned } from "@/lib/content/versioned";
import { updatedLabel } from "@/lib/faq/faq";
import { PROJECT_SECTIONS, type ProjectRecord, type ProjectSection } from "./record";

// The "edited by" line over each card on the dashboard Projects page (board
// 75, issue #297): when a project's versions were last written and by whom,
// and, while it holds draft changes in one part of the page only, which part
// ("Launch history edited today by Marco Bianchi"). Moving a card is not an
// edit: it changes the site order, not the project.

/** The last write to a project's versions. `by` is null when no one is named (the import, an anonymized account). */
export type EditStamp = { readonly at: string; readonly by: string | null };

/** The panel's name for each part of the page an editor changes (board 75c); the rest have none. */
const PART_NAMES: Readonly<Partial<Record<ProjectSection, string>>> = {
  hero: "Top of the page",
  nameStory: "Name story",
  design: "Design story",
  versions: "Versions",
  launches: "Launch history",
  plan: "Plan",
  reasons: "Why",
  gallery: "Gallery",
  card: "Home card",
};

/**
 * The one part of the page a project's draft changes, named as the panel
 * names it; null when it has no draft changes, or changes more than one
 * part, or a part the panel has no name for.
 */
export function draftedPart(version: Versioned<ProjectRecord>): string | null {
  if (version.state !== "published" || version.draft === null) return null;
  const published = version.published as Record<string, unknown>;
  const draft = version.draft as Record<string, unknown>;
  const changed = PROJECT_SECTIONS.filter((section) => JSON.stringify(published[section]) !== JSON.stringify(draft[section]));
  return changed.length === 1 ? (PART_NAMES[changed[0]] ?? null) : null;
}

/** "Edited 12 Sep by Giulia Rossi", "Launch history edited today by Marco Bianchi"; null with no stamp. */
export function editedLine(item: ContentItem<ProjectRecord>, stamp: EditStamp | undefined, now: string): string | null {
  if (stamp === undefined) return null;
  const label = updatedLabel(stamp.at, now);
  const when = label === "Today" ? "today" : label;
  const part = draftedPart(item.version);
  const what = part === null ? "Edited" : `${part} edited`;
  return `${what} ${when}${stamp.by === null ? "" : ` by ${stamp.by}`}`;
}
