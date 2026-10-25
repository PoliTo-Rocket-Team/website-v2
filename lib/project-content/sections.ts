import type { ProjectBlock, ProjectRecord } from "./record";

// The blocks the fixed sections became: migration 0050 gave each section it
// made a block the section's name as its id ("name", "versions", ...), and
// New project does the same (./new-project.ts). The Edit <project> panel
// edits every block alike through its own row (./block-fields.ts, epics #522
// and #614); these reads find a block by the section it was, as the
// dashboard's "edited by" line names it (./edited.ts).

/** Each section's block id, with the kind of block it is, in page order. */
export const SECTION_BLOCKS = {
  name: "text",
  design: "text",
  versions: "versions",
  launches: "launches",
  plan: "timeline",
  reasons: "points",
  gallery: "gallery",
} as const satisfies Readonly<Record<string, ProjectBlock["kind"]>>;

export type SectionBlockId = keyof typeof SECTION_BLOCKS;

/** The section ids in page order: where a section's block goes when the page has none yet. */
export const SECTION_BLOCK_IDS = Object.keys(SECTION_BLOCKS) as readonly SectionBlockId[];

/** The block a section edits. */
export type SectionBlock<S extends SectionBlockId> = Extract<ProjectBlock, { kind: (typeof SECTION_BLOCKS)[S] }>;

/** Whether a block is one a panel section edits: its id names the section, and it is the section's kind. */
export function isSectionBlock<B extends { readonly id: string; readonly kind: string }>(block: B): block is B & { readonly id: SectionBlockId } {
  return Object.hasOwn(SECTION_BLOCKS, block.id) && SECTION_BLOCKS[block.id as SectionBlockId] === block.kind;
}

/** The block the section edits; none when the page has no such block. */
export function sectionBlockOf<S extends SectionBlockId>(record: ProjectRecord, id: S): SectionBlock<S> | undefined {
  const blocks: readonly ProjectBlock[] = record.blocks;
  return blocks.find((block) => block.id === id && isSectionBlock(block)) as SectionBlock<S> | undefined;
}

/**
 * The record with the section's block put in: in the place of the block with
 * its id, else after the blocks of the sections before it in page order (at
 * the top when there are none). With null, the section's block is taken out.
 * An engine's page never gets a launch history: the panel never shows one.
 */
export function withSectionBlock<S extends SectionBlockId>(record: ProjectRecord, id: S, block: SectionBlock<S> | null): ProjectRecord {
  const blocks: readonly ProjectBlock[] = record.blocks;
  const at = blocks.findIndex((b) => b.id === id);
  let next: readonly ProjectBlock[];
  if (block === null) next = blocks.filter((_, i) => i !== at);
  else if (at !== -1) next = blocks.map((b, i) => (i === at ? block : b));
  else {
    const earlier = new Set(SECTION_BLOCK_IDS.slice(0, SECTION_BLOCK_IDS.indexOf(id)));
    const after = blocks.reduce((last, b, i) => (earlier.has(b.id as SectionBlockId) ? i : last), -1);
    next = [...blocks.slice(0, after + 1), block, ...blocks.slice(after + 1)];
  }
  if (record.kind === "engine") return { ...record, blocks: next.filter((b) => b.kind !== "launches") as typeof record.blocks };
  return { ...record, blocks: next };
}

type WithoutMeta<B> = B extends unknown ? Omit<B, "id" | "kind" | "hidden"> : never;

/** What a section's block holds besides its id, its kind and its hidden flag. */
export type SectionContent<S extends SectionBlockId> = WithoutMeta<SectionBlock<S>>;

/** Whether the section's block is on the page: there, and not hidden. */
export function sectionShown(record: ProjectRecord, id: SectionBlockId): boolean {
  const block = sectionBlockOf(record, id);
  return block !== undefined && !block.hidden;
}

/** The section's block without its id, kind and hidden flag. */
export function sectionContentOf<S extends SectionBlockId>(record: ProjectRecord, id: S): SectionContent<S> | undefined {
  const block: ProjectBlock | undefined = sectionBlockOf(record, id);
  if (block === undefined) return undefined;
  const { id: _id, kind: _kind, hidden: _hidden, ...content } = block;
  return content as unknown as SectionContent<S>;
}
