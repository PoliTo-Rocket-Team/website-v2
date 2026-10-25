import type { EditBlocks } from "@/lib/content/edit-shell";
import type { BlockKind, ProjectPart, TopPart } from "@/lib/project-pages";
import { blockSection, type PageSection, type PanelSection } from "./fields";
import type { ProjectRecord } from "./record";

// The project page's parts as the editor outlines them (epic #614, ruling
// R2.1 on #720): the top of the page in three parts, the title and its
// details, the visual and the key facts, then each page block. Each part's
// Edit chip hands the part back; the panel opens the row that edits it, the
// one Top of the page row for all three top parts, and brings that part's
// fields into view.

/** What each kind of block is called, on its row in the panel and on its outline on the page. */
export const BLOCK_LABELS: Readonly<Record<BlockKind, string>> = {
  text: "Text",
  facts: "Key facts",
  photo: "Photo",
  gallery: "Gallery",
  versions: "Versions",
  launches: "Launch history",
  timeline: "Timeline",
  points: "Numbered points",
};

/** The top's parts in page order, each with the name its outline shows. */
const TOP_PARTS: readonly (readonly [TopPart, string])[] = [
  ["title", "Title and details"],
  ["visual", "Visual"],
  ["facts", "Key facts"],
];

/** The row that edits the part: the Top of the page for the top's three parts, else the block's own row. */
export function sectionOf(part: ProjectPart): PageSection {
  return part.startsWith("top:") ? "top" : blockSection(part.slice("block:".length));
}

/** The part of the top a part is, or null for a block. */
export function topPartOf(part: ProjectPart): TopPart | null {
  return part.startsWith("top:") ? (part.slice("top:".length) as TopPart) : null;
}

/**
 * Every part the page outlines, with its name. Each chip hands back its own
 * part, so the editor knows which of the top's three parts to bring into view
 * (`sectionOf`, `topPartOf`).
 */
export function editBlocksOf(record: Pick<ProjectRecord, "blocks">): EditBlocks<ProjectPart, ProjectPart> {
  const top = TOP_PARTS.map(([part, name]) => [`top:${part}`, { name, section: `top:${part}` }] as const);
  const blocks = record.blocks.map((block) => {
    const part = blockSection(block.id);
    return [part, { name: BLOCK_LABELS[block.kind], section: part }] as const;
  });
  return Object.fromEntries([...top, ...blocks]) as EditBlocks<ProjectPart, ProjectPart>;
}

/**
 * The part outlined strongest while `section` is the open row the page
 * outlines: a block's row outlines its block; the Top of the page row
 * outlines `chosen`, the top part whose chip opened it last (the editor
 * starts on the title).
 */
export function outlinedPart(section: PanelSection | null, chosen: TopPart): ProjectPart | null {
  if (section === null || section === "card") return null;
  return section === "top" ? `top:${chosen}` : section;
}
