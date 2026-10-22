import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectPageView } from "@/components/project-page/view";
import { importedRecords, legacyRecords } from "@/lib/project-content/import";
import type { LegacyProjectRecord } from "@/lib/project-content/legacy";
import { listingOf, pageRecordOf } from "@/lib/project-content/record";
import { pageRowsOf, type PageBlock, type ProjectPageRecord, type TextBlock } from ".";

// The project page draws its blocks (issue #525): in order, a hidden one left
// out, two half-width text blocks in a row side by side, and the projects
// stored before blocks draw the sections they had, in the order they had them.

const text = (id: string, width: TextBlock["width"], hidden = false, heading = true): TextBlock => ({
  id,
  kind: "text",
  hidden,
  width,
  ...(heading && { heading: { label: id.toUpperCase(), title: `Title ${id}` } }),
  body: { text: [`Body ${id}`], phone: `Phone ${id}` },
});

const page = (blocks: readonly PageBlock[]): ProjectPageRecord => ({ ...pageRecordOf(importedRecords[0]), blocks });

/** The page's markup with React's text-node separators taken out. */
const markupOf = (record: ProjectPageRecord, position = 0) => {
  const project = listingOf(importedRecords[position], position);
  return renderToStaticMarkup(createElement(ProjectPageView, { project, record, chrome: "none" })).replaceAll("<!-- -->", "");
};

/** Each `<section>` of the markup, in order. */
const sectionsOf = (markup: string) => markup.split("<section").slice(1);

test("a hidden block is left out and takes no number; the numbers run on over what shows", () => {
  const rows = pageRowsOf(page([text("a", "full"), text("b", "full", true), text("c", "full"), text("d", "full", false, false)]));
  assert.deepEqual(
    rows.map((row) => (row.kind === "block" ? [row.block.block.id, row.block.num] : null)),
    [["a", "01"], ["c", "02"], ["d", null]],
  );
  const markup = markupOf(page([text("a", "full"), text("b", "full", true), text("c", "full")]));
  assert.match(markup, /Body a/);
  assert.doesNotMatch(markup, /Body b|Title b/, "the hidden block is not on the page");
  assert.match(markup, /02 – C/);
});

test("two half-width text blocks in a row sit side by side; a lone half or a full block sits on its own", () => {
  const rows = pageRowsOf(page([text("a", "half"), text("b", "half"), text("c", "half"), text("d", "full"), text("e", "half")]));
  assert.deepEqual(
    rows.map((row) => (row.kind === "halves" ? row.blocks.map((b) => b.block.id) : [row.block.block.id])),
    [["a", "b"], ["c"], ["d"], ["e"]],
  );
  // Hidden blocks are not neighbours: the halves around one pair up.
  const around = pageRowsOf(page([text("a", "half"), text("b", "full", true), text("c", "half")]));
  assert.deepEqual(around.map((row) => row.kind), ["halves"]);

  const sections = sectionsOf(markupOf(page([text("a", "half"), text("b", "half"), text("c", "half"), text("d", "full")])));
  const holding = (id: string) => sections.findIndex((s) => s.includes(`Body ${id}`));
  assert.equal(holding("a"), holding("b"), "the pair shares one row");
  assert.notEqual(holding("b"), holding("c"));
  assert.notEqual(holding("c"), holding("d"));
});

/** The heading eyebrow each section drew before blocks, in page order. */
function legacyEyebrows(legacy: LegacyProjectRecord): string[] {
  const labels = [
    "THE NAME",
    "THE DESIGN",
    legacy.versions && "VERSIONS",
    legacy.kind === "vehicle" && legacy.launches && "LAUNCH HISTORY",
    legacy.plan && "THE PLAN",
    legacy.reasons?.eyebrow,
    legacy.gallery && "GALLERY",
  ].filter((label): label is string => typeof label === "string");
  return labels.map((label, i) => `${String(i + 1).padStart(2, "0")} – ${label}`);
}

test("each stored project's page draws its sections as blocks, numbered and in the order it drew them", () => {
  legacyRecords.forEach((legacy, i) => {
    const markup = markupOf(pageRecordOf(importedRecords[i]), i);
    const at = legacyEyebrows(legacy).map((eyebrow) => markup.indexOf(eyebrow));
    assert.ok(at.every((index) => index !== -1), `${legacy.slug}: every heading is drawn`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, `${legacy.slug}: in the same order`);
    // The two stories still share one row.
    const sections = sectionsOf(markup);
    assert.equal(
      sections.findIndex((s) => s.includes("01 – THE NAME")),
      sections.findIndex((s) => s.includes("02 – THE DESIGN")),
      `${legacy.slug}: the name and the design side by side`,
    );
  });
});
