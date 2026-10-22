import assert from "node:assert/strict";
import { test } from "node:test";
import { blockOf, BLOCK_KINDS, type BlockFields } from "./block-fields";
import { addBlock, BLOCKS_MAX, duplicateBlock, moveBlock, newBlockId, removeBlock, reorderBlocks, setBlockHidden } from "./block-list";
import { fieldsOf } from "./fields";
import { importedRecords } from "./import";

// The Page blocks card's edits (board 93, epic #522): add, duplicate, hide,
// remove and reorder, each keeping every block's id so the open panel and the
// page's outline follow it.

const blocks = fieldsOf(importedRecords[2]).blocks;
const ids = (list: readonly BlockFields[]) => list.map((b) => b.id);

test("Add block puts a new, shown block of the kind at the end, under an id no block holds", () => {
  let list: readonly BlockFields[] = blocks;
  for (const kind of BLOCK_KINDS) list = addBlock(list, kind);
  const added = list.slice(blocks.length);
  assert.deepEqual(added.map((b) => b.kind), [...BLOCK_KINDS]);
  assert.ok(added.every((b) => !b.hidden));
  assert.equal(new Set(ids(list)).size, list.length, "every id is its own");
  assert.equal(addBlock(list, "text").at(-1)?.id, "text-2", "a second block of a kind takes the next number");
  assert.deepEqual(
    added.filter((b) => blockOf(b) === null).map((b) => b.kind),
    ["photo"],
    "every new block but a photo, which waits for its file, is whole from the start",
  );
  const full = Array.from({ length: BLOCKS_MAX - list.length }).reduce<readonly BlockFields[]>((l) => addBlock(l, "text"), list);
  assert.equal(addBlock(full, "text"), full, "a page holds fifty blocks at most");
});

test("Duplicate puts a copy right after the block, with the same content under a new id", () => {
  const list = duplicateBlock(blocks, "plan");
  const at = ids(list).indexOf("plan");
  const copy = list[at + 1];
  assert.equal(copy.id, newBlockId(blocks, "timeline"));
  assert.deepEqual({ ...copy, id: "plan" }, blocks.find((b) => b.id === "plan"));
  assert.deepEqual(ids(list).filter((id) => id !== copy.id), ids(blocks), "every other block keeps its place");
  assert.equal(duplicateBlock(blocks, "nowhere"), blocks);
});

test("Hide keeps the block in its place with its content; Show brings it back as it was", () => {
  const hidden = setBlockHidden(blocks, "reasons", true);
  assert.deepEqual(ids(hidden), ids(blocks));
  assert.deepEqual(hidden.find((b) => b.id === "reasons"), { ...blocks.find((b) => b.id === "reasons"), hidden: true });
  assert.deepEqual(setBlockHidden(hidden, "reasons", false), blocks);
});

test("Remove takes the block out and leaves the others in order", () => {
  const { blocks: left } = removeBlock(blocks, "design");
  assert.deepEqual(ids(left), ids(blocks).filter((id) => id !== "design"));
});

test("a drag reorders the blocks; Move up and Move down step one place; an order that is not the list's is refused", () => {
  const order = [...ids(blocks)].reverse();
  assert.deepEqual(ids(reorderBlocks(blocks, order)), order);
  assert.equal(reorderBlocks(blocks, order.slice(1)), blocks, "a block left out");
  assert.equal(reorderBlocks(blocks, [...order.slice(1), order[1]]), blocks, "a block twice");
  const [first, second] = ids(blocks);
  assert.deepEqual(ids(moveBlock(blocks, second, -1)).slice(0, 2), [second, first]);
  assert.deepEqual(ids(moveBlock(blocks, first, 1)).slice(0, 2), [second, first]);
  assert.equal(moveBlock(blocks, first, -1), blocks, "the first block goes no higher");
  assert.equal(moveBlock(blocks, ids(blocks).at(-1)!, 1), blocks, "the last goes no lower");
});
