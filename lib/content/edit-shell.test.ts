import assert from "node:assert/strict";
import { test } from "node:test";
import { editChips, type EditBlocks } from "./edit-shell";

// A page of its own, so nothing here leans on outreach: two blocks open one
// section, and one names its chip.
type Section = "details" | "photos";
const blocks: EditBlocks<"title" | "cover" | "grid", Section> = {
  title: { name: "Title and details", section: "details" },
  cover: { name: "Cover photo", section: "photos" },
  grid: { name: "Photos", section: "photos", chip: "Edit photos" },
};

test("an Edit chip opens its block's section, and only when clicked", () => {
  const opened: Section[] = [];
  const chipOf = editChips(blocks, (section) => opened.push(section));
  const cover = chipOf("cover");
  const title = chipOf("title");
  assert.deepEqual(opened, []);
  cover.edit();
  title.edit();
  chipOf("grid").edit();
  assert.deepEqual(opened, ["photos", "details", "photos"]);
});

test("a chip shows its block's name and says Edit unless the block names its words", () => {
  const chipOf = editChips(blocks, () => {});
  assert.deepEqual([chipOf("title").name, chipOf("title").label], ["Title and details", "Edit"]);
  assert.equal(chipOf("grid").label, "Edit photos");
});
