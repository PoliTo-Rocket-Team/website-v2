import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

test("the shell's files import nothing of a content type: pages, blocks and switch targets arrive as props", () => {
  const files = ["components/dashboard/edit-shell.tsx", "components/dashboard/edit-frame.tsx", "lib/content/edit-shell.ts"];
  for (const file of files) {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    const typed = imports.filter((path) => /outreach|project|team|partner/i.test(path));
    assert.deepEqual(typed, [], `${file} imports a content type`);
  }
});
