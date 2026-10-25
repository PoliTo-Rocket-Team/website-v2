import { moveTo } from "@/lib/content/order";
import type { BlockKind } from "@/lib/project-pages/types";
import { blankBlock, blockPhotos, type BlockFields } from "./block-fields";

// The page blocks of the Edit <project> panel (board 93, epics #522 and #614):
// the page's blocks in order, each one added from the Add block menu (board
// 93b), duplicated, hidden or shown, removed, and dragged or moved into a new
// order. Each edit answers the new list; a block keeps its id through every
// one of them, so the page's outline and the block's open row follow it.

/** The most blocks a page holds. */
export const BLOCKS_MAX = 50;

/** An id no block of the list holds: the kind and the first free number ("gallery-2"). */
export function newBlockId(blocks: readonly BlockFields[], kind: BlockKind): string {
  const taken = new Set(blocks.map((b) => b.id));
  let n = 1;
  while (taken.has(`${kind}-${n}`)) n++;
  return `${kind}-${n}`;
}

/** The list with a new, empty block of `kind` at its end; the same list when it holds as many as a page may. */
export function addBlock(blocks: readonly BlockFields[], kind: BlockKind): readonly BlockFields[] {
  if (blocks.length >= BLOCKS_MAX) return blocks;
  return [...blocks, blankBlock(kind, newBlockId(blocks, kind))];
}

/** The id the block added last has: what the panel opens after Add block. */
export const lastBlockId = (blocks: readonly BlockFields[]): string | undefined => blocks.at(-1)?.id;

/** The list with a copy of the block right after it, under a new id; its photos are shared, not copied. */
export function duplicateBlock(blocks: readonly BlockFields[], id: string): readonly BlockFields[] {
  const at = blocks.findIndex((b) => b.id === id);
  if (at === -1 || blocks.length >= BLOCKS_MAX) return blocks;
  const copy = { ...structuredClone(blocks[at]), id: newBlockId(blocks, blocks[at].kind) };
  return [...blocks.slice(0, at + 1), copy, ...blocks.slice(at + 1)];
}

/** The list with the block hidden from the page, or shown again; it keeps its place and its content. */
export function setBlockHidden(blocks: readonly BlockFields[], id: string, hidden: boolean): readonly BlockFields[] {
  return blocks.map((b) => (b.id === id ? { ...b, hidden } : b));
}

/**
 * A removed block: the list without it, and the uploaded photos it held that
 * no other block holds. The panel lets those go: their files are deleted
 * unless a stored version of a project shows them.
 */
export type BlockRemoval = { readonly blocks: readonly BlockFields[]; readonly letGo: readonly string[] };

export function removeBlock(blocks: readonly BlockFields[], id: string): BlockRemoval {
  const left = blocks.filter((b) => b.id !== id);
  const removed = blocks.find((b) => b.id === id);
  const kept = new Set(left.flatMap(blockPhotos));
  return { blocks: left, letGo: removed === undefined ? [] : [...new Set(blockPhotos(removed))].filter((src) => !kept.has(src)) };
}

/** The list in the order of `ids`, as a drag dropped it; the same list when `ids` is not its ids in another order. */
export function reorderBlocks(blocks: readonly BlockFields[], ids: readonly string[]): readonly BlockFields[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  if (ids.length !== blocks.length || new Set(ids).size !== ids.length || !ids.every((id) => byId.has(id))) return blocks;
  return ids.map((id) => byId.get(id)!);
}

/** The list with the block one place up (-1) or down (1): the keyboard's way to reorder. */
export function moveBlock(blocks: readonly BlockFields[], id: string, by: -1 | 1): readonly BlockFields[] {
  const at = blocks.findIndex((b) => b.id === id);
  const to = at + by;
  if (at === -1 || to < 0 || to >= blocks.length) return blocks;
  return reorderBlocks(
    blocks,
    moveTo(
      blocks.map((b) => b.id),
      id,
      to,
    ),
  );
}
