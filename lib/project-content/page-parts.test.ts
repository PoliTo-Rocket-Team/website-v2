import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProjectPart } from "@/lib/project-pages";
import { blockSection } from "./fields";
import { importedRecords } from "./import";
import { editBlocksOf, outlinedPart, sectionOf, topPartOf } from "./page-parts";

// Epic #614 (ruling R2.1 on #720): the project editor outlines the top of the
// page in three parts, and every page block on its own. Each part's Edit chip
// opens the panel row that edits it: the one Top of the page row for the
// top's three parts, and each block's own row.

const [cavour] = importedRecords;

test("the top's three parts open the Top of the page row, each bringing its own fields into view", () => {
  const blocks = editBlocksOf(cavour);
  for (const top of ["title", "visual", "facts"] as const) {
    const handed = blocks[`top:${top}`].section;
    assert.equal(sectionOf(handed), "top");
    assert.equal(topPartOf(handed), top);
  }
});

test("each block's part opens that block's own row", () => {
  assert.ok(cavour.blocks.length > 0, "Cavour's page has blocks");
  const blocks = editBlocksOf(cavour);
  for (const block of cavour.blocks) {
    const handed = blocks[blockSection(block.id)].section;
    assert.equal(sectionOf(handed), blockSection(block.id));
    assert.equal(topPartOf(handed), null);
  }
  const parts = Object.keys(blocks) as ProjectPart[];
  assert.equal(parts.length, 3 + cavour.blocks.length, "one outline per top part and per block, none other");
});

test("the open row's part is outlined strongest: the top part chosen last, or the block", () => {
  const [first] = cavour.blocks;
  assert.equal(outlinedPart("top", "visual"), "top:visual");
  assert.equal(outlinedPart(blockSection(first.id), "visual"), blockSection(first.id));
  assert.equal(outlinedPart("card", "title"), null, "the card is not on the project page");
  assert.equal(outlinedPart(null, "title"), null);
});
