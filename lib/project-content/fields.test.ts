import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, publicItems, statusOf } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { pageRowsOf } from "@/lib/project-pages";
import { projectEditor } from "./editor";
import { fieldsAfterSave, fieldsOf, fieldProblems, projectViewOf, readProjectFields, type ProjectFields } from "./fields";
import { importedProjects, importedRecords } from "./import";
import { pageRecordOf, type ProjectRecord } from "./record";
import { sectionBlockOf, sectionContentOf, sectionShown } from "./sections";

// The Edit <project> panel's fields (issue #298): what the page draws as the
// editor types, the show-on-page switch, and what Save draft and Publish store.

const [cavour, , efesto] = importedRecords;

/** The numbered headings the page shows, after the two stories (01 and 02), by block id. */
const numbers =(fields: ProjectFields, opened: ProjectRecord = efesto) =>
  pageRowsOf(pageRecordOf(projectViewOf(fields, opened)))
    .flatMap((row) => (row.kind === "halves" ? row.blocks : [row.block]))
    .flatMap(({ num, block }) => (num === null || ["01", "02"].includes(num) ? [] : [`${num} ${block.id}`]));

test("opening the panel and changing nothing draws every project exactly as stored", () => {
  for (const record of importedRecords) assert.deepEqual(projectViewOf(fieldsOf(record), record), record, record.slug);
});

test("the page follows the fields as typed, desktop and phone copy apart", () => {
  const fields = fieldsOf(cavour);
  const typed: ProjectFields = {
    ...fields,
    hero: { ...fields.hero, intro: { text: "A new intro.", phone: "Short." } },
    nameStory: { ...fields.nameStory, title: "First line\nSecond line", body: "One.\n\nTwo." },
  };
  const view = projectViewOf(typed, cavour);
  assert.deepEqual(view.hero.intro, { text: "A new intro.", phone: "Short." });
  const name = sectionBlockOf(view, "name")!;
  assert.deepEqual(name.heading, { label: "THE NAME", title: ["First line", "Second line"] });
  assert.deepEqual(name.body.text, ["One.", "Two."]);
  assert.equal(name.width, "half", "the block keeps its width");
  const noPhone = projectViewOf({ ...typed, hero: { ...typed.hero, intro: { text: "Same everywhere.", phone: " " } } }, cavour);
  assert.deepEqual(noPhone.hero.intro, { text: "Same everywhere." }, "an empty phone field shows the desktop text");
});

test("switching an optional section off hides its block and closes up the numbers; switching it on brings the same text back", () => {
  const fields = fieldsOf(efesto);
  assert.deepEqual(numbers(fields), ["03 plan", "04 reasons", "05 gallery"]);
  const off = { ...fields, reasons: { ...fields.reasons, shown: false } };
  const hidden = projectViewOf(off, efesto);
  assert.equal(sectionShown(hidden, "reasons"), false);
  assert.deepEqual(sectionContentOf(hidden, "reasons"), sectionContentOf(efesto, "reasons"), "the hidden block keeps its content");
  assert.deepEqual(fieldsOf(hidden).reasons, off.reasons, "the panel opens on it switched off, its text there");
  assert.deepEqual(numbers(off), ["03 plan", "04 gallery"]);
  assert.deepEqual(fieldProblems({ ...off, reasons: { ...off.reasons, title: "" } }), [], "a section off the page does not stop a save");
  assert.deepEqual(projectViewOf({ ...off, reasons: { ...off.reasons, shown: true } }, efesto), efesto);

  // Cavour has no Why: it opens switched off, and switched on it takes its place before the gallery.
  const cavourFields = fieldsOf(cavour);
  assert.equal(cavourFields.reasons.shown, false);
  assert.deepEqual(numbers(cavourFields, cavour), ["03 versions", "04 launches", "05 gallery"]);
  const on = { ...cavourFields, reasons: { shown: true, eyebrow: "WHY", title: "Why", items: [{ title: "A", text: "B" }] } };
  assert.deepEqual(numbers(on, cavour), ["03 versions", "04 launches", "05 reasons", "06 gallery"]);
});

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

test("a section switched off keeps its text through Save draft and Publish, so switching it back on brings it back", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const fields = fieldsOf(efesto);
  const off = { ...fields, reasons: { ...fields.reasons, shown: false } };
  for (const step of ["save-draft", "publish"] as const) {
    const saved = await editor.saveFields(3, step, off);
    assert.ok(saved.ok, step);
    const stored = editorVersion(saved.value.version);
    assert.equal(sectionShown(stored, "reasons"), false, "the stored page leaves the section out");
    const after = fieldsAfterSave(stored, off);
    assert.deepEqual(after.reasons, off.reasons, step);
    const back = projectViewOf({ ...after, reasons: { ...after.reasons, shown: true } }, stored);
    assert.deepEqual(sectionBlockOf(back, "reasons"), sectionBlockOf(efesto, "reasons"), step);
  }
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

test("a request is read as fields only in their shape, and nothing it carries beyond them is kept", () => {
  const fields = fieldsOf(efesto);
  assert.deepEqual(readProjectFields(JSON.parse(JSON.stringify({ ...fields, slug: "elsewhere" }))), fields);
  for (const broken of [null, "fields", { ...fields, hero: { ...fields.hero, dates: 1 } }, { ...fields, hero: { ...fields.hero, facts: "6" } }, { ...fields, reasons: { ...fields.reasons, shown: "yes" } }]) {
    assert.equal(readProjectFields(broken), null);
  }
});
