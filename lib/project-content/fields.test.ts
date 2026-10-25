import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, publicItems, statusOf } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { pageRowsOf, type BlockKind } from "@/lib/project-pages";
import type { BlockFields } from "./block-fields";
import { addBlock, reorderBlocks, setBlockHidden } from "./block-list";
import { projectEditor } from "./editor";
import { fieldsAfterSave, fieldsOf, fieldProblems, outlinedSection, panelSections, projectViewOf, readProjectFields, type ProjectFields } from "./fields";
import { importedProjects, importedRecords } from "./import";
import { pageRecordOf, type ProjectBlock, type ProjectRecord } from "./record";

// The Edit <project> panel's fields (issue #298, epic #522): what the page
// draws as the editor types, a hidden block, and what Save draft and Publish
// store.

const [cavour, , efesto] = importedRecords;
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** The numbered headings the page shows, by block id. */
const numbers = (record: ProjectRecord) =>
  pageRowsOf(pageRecordOf(record))
    .flatMap((row) => (row.kind === "halves" ? row.blocks : [row.block]))
    .flatMap(({ num, block }) => (num === null ? [] : [`${num} ${block.id}`]));

const blocksOf = (record: ProjectRecord): readonly ProjectBlock[] => record.blocks;

/** The fields with the block `id` changed. */
const withBlock = (fields: ProjectFields, id: string, change: (block: BlockFields) => BlockFields): ProjectFields => ({
  ...fields,
  blocks: fields.blocks.map((b) => (b.id === id ? change(b) : b)),
});

test("opening the panel and changing nothing draws every project exactly as stored", () => {
  for (const record of importedRecords) assert.deepEqual(projectViewOf(fieldsOf(record), record), record, record.slug);
});

test("the page follows the fields as typed, desktop and phone copy apart", () => {
  const fields = fieldsOf(cavour);
  const typed = withBlock({ ...fields, hero: { ...fields.hero, intro: { text: "A new intro.", phone: "Short." } } }, "name", (b) =>
    b.kind === "text" ? { ...b, heading: "First line\nSecond line", paragraphs: ["One.", " ", "Two."], phone: "" } : b,
  );
  const view = projectViewOf(typed, cavour);
  assert.deepEqual(view.hero.intro, { text: "A new intro.", phone: "Short." });
  const name = blocksOf(view).find((b) => b.id === "name");
  assert.ok(name?.kind === "text");
  assert.deepEqual(name.heading, { label: "THE NAME", title: ["First line", "Second line"] });
  assert.deepEqual(name.body, { text: ["One.", "Two."], phone: "One. Two." }, "an empty paragraph is dropped; an empty phone field shows the paragraphs");
  assert.equal(name.width, "half", "the block keeps its width");
  const noPhone = projectViewOf({ ...typed, hero: { ...typed.hero, intro: { text: "Same everywhere.", phone: " " } } }, cavour);
  assert.deepEqual(noPhone.hero.intro, { text: "Same everywhere." }, "an empty phone field shows the desktop text");
});

test("hiding a block leaves it out of the page and closes up the numbers; it keeps its content and shows again as it was", () => {
  const fields = fieldsOf(efesto);
  assert.deepEqual(numbers(projectViewOf(fields, efesto)), ["01 name", "02 design", "03 plan", "04 reasons", "05 gallery"]);
  const off = { ...fields, blocks: setBlockHidden(fields.blocks, "reasons", true) };
  const hidden = projectViewOf(off, efesto);
  assert.deepEqual(numbers(hidden), ["01 name", "02 design", "03 plan", "04 gallery"]);
  const kept = blocksOf(hidden).find((b) => b.id === "reasons");
  assert.deepEqual(kept, { ...blocksOf(efesto).find((b) => b.id === "reasons"), hidden: true }, "the hidden block keeps its content and place");
  assert.deepEqual(projectViewOf({ ...off, blocks: setBlockHidden(off.blocks, "reasons", false) }, efesto), efesto);
});

test("a hidden block need not be filled in, but it keeps its shape's rule", () => {
  const off = { ...fieldsOf(efesto), blocks: setBlockHidden(fieldsOf(efesto).blocks, "reasons", true) };
  const blank = withBlock(off, "reasons", (b) => (b.kind === "points" ? { ...b, title: "" } : b));
  assert.deepEqual(fieldProblems(blank), [], "a blank in a hidden block does not stop a save");
  const short = withBlock(off, "reasons", (b) => (b.kind === "points" ? { ...b, items: b.items.slice(0, 2) } : b));
  assert.deepEqual(
    fieldProblems(short).map((p) => [p.section, p.field, p.error]),
    [["block:reasons", "blocks.reasons.points.items", "Keep 3 to 5 points."]],
    "a count out of bounds stops it, hidden or not, and names the block",
  );
});

test("a hidden block survives Save draft and Publish, and shows again as it was", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const fields = fieldsOf(efesto);
  const off = { ...fields, blocks: setBlockHidden(fields.blocks, "reasons", true) };
  for (const step of ["save-draft", "publish"] as const) {
    const saved = await editor.saveFields(3, step, off);
    assert.ok(saved.ok, step);
    const stored = editorVersion(saved.value.version);
    assert.equal(blocksOf(stored).find((b) => b.id === "reasons")?.hidden, true, "the stored page leaves the block out");
    const after = fieldsAfterSave(stored, off);
    assert.deepEqual(after.blocks, off.blocks, step);
    assert.deepEqual(projectViewOf({ ...after, blocks: setBlockHidden(after.blocks, "reasons", false) }, stored), efesto, step);
  }
});

/** A photo the site ships: a save takes it without an upload. */
const PHOTO = "/project-photos/cavour/euroc-2023-team.webp";

/** A block of each kind a rocket's page takes, filled in, as an editor adds them. */
function filledBlock(block: BlockFields): BlockFields {
  switch (block.kind) {
    case "text":
      return { ...block, heading: "A new text", label: "MORE", paragraphs: ["First.", "Second."] };
    case "facts":
      return { ...block, facts: block.facts.map((f, i) => ({ value: `${i + 1} km`, label: { text: `FACT ${i + 1}`, phone: "" } })) };
    case "photo":
      return { ...block, photo: { src: PHOTO, alt: "The team" }, caption: "The team" };
    case "gallery":
      return { ...block, title: "More photos", items: [{ src: PHOTO, alt: "", caption: "" }] };
    case "versions":
      return { ...block, title: "Versions", note: { text: "One version.", phone: "" }, items: block.items.map((v) => ({ ...v, pill: "MK I", tab: "Mk I", role: { text: "The first.", phone: "" } })) };
    case "launches":
      return {
        ...block,
        title: "Flights",
        items: block.items.map((l) => ({
          ...l,
          title: "Test flight",
          date: "1 Jun 2026",
          place: { text: "Somewhere", phone: "" },
          version: "MK I",
          motor: "Solid",
          summary: { text: "It flew.", phone: "It flew." },
          numbers: [
            { ...l.numbers[0], value: "1 000 m" },
            { ...l.numbers[1], value: "100 m/s" },
            { value: "5 G", label: "BOOST", phoneLabel: "" },
            { value: "1st", label: "RANK", phoneLabel: "" },
          ] as const,
          where: "Somewhere · Mk I",
          result: "Nominal.",
          country: "Italy",
        })),
      };
    case "timeline":
      return { ...block, title: "Next", intro: { text: "What comes next.", phone: "" }, steps: block.steps.map((s) => ({ ...s, title: "Build", text: { text: "Build it.", phone: "" } })) };
    case "points":
      return { ...block, eyebrow: "WHY", title: "Three reasons", items: block.items.map((_, i) => ({ title: `Reason ${i + 1}`, text: "Because." })) };
  }
}

const KINDS: readonly BlockKind[] = ["text", "facts", "photo", "gallery", "versions", "launches", "timeline", "points"];

test("a saved draft and a publish keep the block order and content; the public page shows the published blocks in order", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const opened = fieldsOf(cavour);
  const added = KINDS.reduce((blocks, kind) => addBlock(blocks, kind), opened.blocks).map((b) => (opened.blocks.includes(b) ? b : filledBlock(b)));
  // The new blocks first, in reverse, then the page's own.
  const ids = added.map((b) => b.id);
  const order = [...ids.slice(opened.blocks.length).reverse(), ...ids.slice(0, opened.blocks.length)];
  const fields: ProjectFields = { ...opened, blocks: reorderBlocks(added, order) };
  assert.deepEqual(fieldProblems(fields), []);

  const draft = await editor.saveFields(1, "save-draft", fields);
  assert.ok(draft.ok);
  assert.deepEqual(blocksOf(editorVersion(draft.value.version)).map((b) => b.id), order, "the draft keeps the order");
  assert.deepEqual(blocksOf(publicItems((await editor.list())!)[0]), blocksOf(cavour), "a draft leaves the public page as it was");
  assert.deepEqual(fieldsAfterSave(editorVersion(draft.value.version), fields).blocks, fields.blocks, "the panel reopens on what it sent");

  assert.ok((await editor.saveFields(1, "publish", fields)).ok);
  const published = publicItems((await editor.list())!)[0];
  assert.deepEqual(blocksOf(published), blocksOf(projectViewOf(fields, cavour)), "publish stores the blocks as typed");
  const drawn = pageRowsOf(pageRecordOf(published)).flatMap((row) => (row.kind === "halves" ? row.blocks : [row.block]).map((b) => b.block.id));
  assert.deepEqual(drawn, order, "the public page draws every published block in order");
});

test("Save draft changes only the draft; Publish changes what the public pages show", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const fields = fieldsOf(cavour);
  const edited = { ...fields, hero: { ...fields.hero, dates: "Edited dates" } };

  assert.ok((await editor.saveFields(1, "save-draft", edited)).ok);
  let items = (await editor.list())!;
  assert.equal(publicItems(items)[0].hero.dates, cavour.hero.dates);
  assert.equal(editorVersion(items[0].version).hero.dates, "Edited dates");
  assert.equal(statusOf(items[0].version), "draft-changes");

  assert.ok((await editor.saveFields(1, "publish", edited)).ok);
  items = (await editor.list())!;
  assert.equal(publicItems(items)[0].hero.dates, "Edited dates");
  assert.equal(statusOf(items[0].version), "published");
});

test("only the full admins and holders of site-content access save; a blank field is refused; nothing changes on a refusal", async () => {
  const fields = { ...fieldsOf(cavour), hero: { ...fieldsOf(cavour).hero, dates: "Edited dates" } };
  const outsiders: ViewerStanding[] = [
    { kind: "division-lead", siteContent: false, approveOrders: false },
    { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false },
    { kind: "alumni", siteContent: false, approveOrders: false },
  ];
  for (const viewer of outsiders) {
    const store = memoryContentStore(importedProjects());
    const result = await projectEditor(viewer, store).saveFields(1, "publish", fields);
    assert.deepEqual(result, { ok: false, error: SITE_CONTENT_REFUSAL }, viewer.kind);
    assert.deepEqual(publicItems(await store.list()), importedRecords);
  }
  const holder: ViewerStanding = { kind: "member", grantedAreas: [], siteContent: true, approveOrders: false };
  assert.ok((await projectEditor(holder, memoryContentStore(importedProjects())).saveFields(1, "publish", fields)).ok);

  const store = memoryContentStore(importedProjects());
  const blank = await projectEditor(admin, store).saveFields(1, "save-draft", { ...fields, hero: { ...fields.hero, dates: " " } });
  assert.deepEqual(blank, { ok: false, error: "Fill in the dates." });
  assert.deepEqual(await store.list(), importedProjects());
});

test("an engine's page takes no launch history, whatever a request carries", async () => {
  const fields = fieldsOf(efesto);
  const sent = { ...fields, blocks: addBlock(fields.blocks, "launches").map(filledBlock) };
  const store = memoryContentStore(importedProjects());
  assert.deepEqual(await projectEditor(admin, store).saveFields(3, "publish", sent), { ok: false, error: "Reload the page and try again." });
  assert.deepEqual(await store.list(), importedProjects());
});

test("a request is read as fields only in their shape, and nothing it carries beyond them is kept", () => {
  const fields = fieldsOf(efesto);
  const [first] = fields.blocks;
  assert.deepEqual(readProjectFields(JSON.parse(JSON.stringify({ ...fields, slug: "elsewhere", blocks: fields.blocks.map((b) => ({ ...b, extra: 1 })) }))), fields);
  for (const broken of [
    null,
    "fields",
    { ...fields, hero: { ...fields.hero, dates: 1 } },
    { ...fields, hero: { ...fields.hero, facts: "6" } },
    { ...fields, blocks: [{ ...first, hidden: "yes" }] },
    { ...fields, blocks: [first, first] },
    { ...fields, blocks: [{ ...first, kind: "video" }] },
    { ...fields, blocks: [{ ...first, id: "../x" }] },
  ]) {
    assert.equal(readProjectFields(broken), null);
  }
});

test("the panel lists the top of the page, each block in page order, then the card; a refused field opens the row that holds it", () => {
  const fields = fieldsOf(efesto);
  assert.deepEqual(panelSections(fields), ["top", "block:name", "block:design", "block:plan", "block:reasons", "block:gallery", "card"]);
  const moved = { ...fields, blocks: reorderBlocks(fields.blocks, ["gallery", "name", "design", "plan", "reasons"]) };
  assert.deepEqual(panelSections(moved), ["top", "block:gallery", "block:name", "block:design", "block:plan", "block:reasons", "card"], "the rows follow the page");

  const top = { ...fields, hero: { ...fields.hero, dates: " " } };
  assert.equal(fieldProblems(top)[0]?.section, "top", "a refused top-of-page field opens the Top of the page row");
  const block = withBlock(fields, "reasons", (b) => (b.kind === "points" ? { ...b, title: "" } : b));
  assert.equal(fieldProblems(block)[0]?.section, "block:reasons", "a refused block field opens its block's row");
});

test("of the open rows, the page outlines the part whose row opened last; the card outlines nothing there", () => {
  assert.equal(outlinedSection([]), null);
  assert.equal(outlinedSection(["top", "block:plan"]), "block:plan");
  assert.equal(outlinedSection(["block:plan", "top", "card"]), "top");
  assert.equal(outlinedSection(["card"]), null);
});
