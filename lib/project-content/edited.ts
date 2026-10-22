import type { ContentItem, Versioned } from "@/lib/content/versioned";
import { updatedLabel } from "@/lib/faq/faq";
import { PROJECT_KEYS, type ProjectBlock, type ProjectKey, type ProjectRecord } from "./record";
import { isSectionBlock, type SectionBlockId } from "./sections";

// The "edited by" line over each card on the dashboard Projects page (board
// 75, issue #297): when a project's versions were last written and by whom,
// and, while it holds draft changes in one part of the page only, which part
// ("Launch history edited today by Marco Bianchi"). Moving a card is not an
// edit: it changes the site order, not the project.

/** The last write to a project's versions. `by` is null when no one is named (the import, an anonymized account). */
export type EditStamp = { readonly at: string; readonly by: string | null };

/** The panel's name for each part of the page an editor changes (board 75c): the top, the card, and each section's block. */
const PART_NAMES: Readonly<Partial<Record<ProjectKey | SectionBlockId, string>>> = {
  hero: "Top of the page",
  name: "Name story",
  design: "Design story",
  versions: "Versions",
  launches: "Launch history",
  plan: "Plan",
  reasons: "Why",
  gallery: "Gallery",
  card: "Home card",
};

/**
 * The parts a draft changes: each top-level key but the blocks, and each
 * block by its id. Blocks that only moved change the block list as a whole,
 * which has no name.
 */
function changedParts(published: ProjectRecord, draft: ProjectRecord): string[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const top = PROJECT_KEYS.filter((key) => key !== "blocks" && !same(published[key], draft[key]));
  const was: readonly ProjectBlock[] = published.blocks;
  const now: readonly ProjectBlock[] = draft.blocks;
  const ids = [...new Set([...was, ...now].map((b) => b.id))];
  const blocks = ids.filter((id) => !same(was.find((b) => b.id === id), now.find((b) => b.id === id)));
  const moved = blocks.length === 0 && !same(was.map((b) => b.id), now.map((b) => b.id)) ? ["blocks"] : [];
  return [...top, ...blocks.map((id) => `block:${id}`), ...moved];
}

/** The panel's name for a changed part; a block a panel section edits is named by its section. */
function partName(part: string, version: { published: ProjectRecord; draft: ProjectRecord }): string | null {
  if (!part.startsWith("block:")) return PART_NAMES[part as ProjectKey] ?? null;
  const blocks: readonly ProjectBlock[] = [...version.draft.blocks, ...version.published.blocks];
  const block = blocks.find((b) => `block:${b.id}` === part);
  return block !== undefined && isSectionBlock(block) ? (PART_NAMES[block.id] ?? null) : null;
}

/**
 * The one part of the page a project's draft changes, named as the panel
 * names it; null when it has no draft changes, or changes more than one
 * part, or a part the panel has no name for.
 */
export function draftedPart(version: Versioned<ProjectRecord>): string | null {
  if (version.state !== "published" || version.draft === null) return null;
  const changed = changedParts(version.published, version.draft);
  return changed.length === 1 ? partName(changed[0], { published: version.published, draft: version.draft }) : null;
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
