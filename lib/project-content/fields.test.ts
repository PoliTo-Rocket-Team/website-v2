import assert from "node:assert/strict";
import { test } from "node:test";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, publicItems, statusOf } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { sectionsOf } from "@/lib/project-pages";
import { projectEditor } from "./editor";
import { fieldsAfterSave, fieldsOf, fieldProblems, projectViewOf, readProjectFields, type ProjectFields } from "./fields";
import { importedProjects, importedRecords } from "./import";
import { pageRecordOf } from "./record";

// The Edit <project> panel's fields (issue #298): what the page draws as the
// editor types, the show-on-page switch, and what Save draft and Publish store.

const [cavour, , efesto] = importedRecords;

const numbers = (fields: ProjectFields, opened = efesto) =>
  sectionsOf(pageRecordOf(projectViewOf(fields, opened))).map((s) => `${s.num} ${s.kind}`);

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
  assert.deepEqual(view.nameStory.title, ["First line", "Second line"]);
  assert.deepEqual(view.nameStory.body.text, ["One.", "Two."]);
  const noPhone = projectViewOf({ ...typed, hero: { ...typed.hero, intro: { text: "Same everywhere.", phone: " " } } }, cavour);
  assert.deepEqual(noPhone.hero.intro, { text: "Same everywhere." }, "an empty phone field shows the desktop text");
});

test("switching an optional section off drops it and closes up the numbers; switching it on brings the same text back", () => {
  const fields = fieldsOf(efesto);
  assert.deepEqual(numbers(fields), ["03 plan", "04 reasons"]);
  const off = { ...fields, reasons: { ...fields.reasons, shown: false } };
  assert.equal(projectViewOf(off, efesto).reasons, undefined);
  assert.deepEqual(numbers(off), ["03 plan"]);
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
    assert.equal(stored.reasons, undefined, "the stored page leaves the section out");
    const after = fieldsAfterSave(stored, off);
    assert.deepEqual(after.reasons, off.reasons, step);
    assert.deepEqual(projectViewOf({ ...after, reasons: { ...after.reasons, shown: true } }, stored).reasons, efesto.reasons, step);
  }
});

test("Save draft changes only the draft; Publish changes what the public pages show", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const fields = fieldsOf(cavour);
  const edited = { ...fields, teaser: "Edited line." };

  assert.ok((await editor.saveFields(1, "save-draft", edited)).ok);
  let items = (await editor.list())!;
  assert.equal(publicItems(items)[0].teaser, cavour.teaser);
  assert.equal(editorVersion(items[0].version).teaser, "Edited line.");
  assert.equal(statusOf(items[0].version), "draft-changes");

  assert.ok((await editor.saveFields(1, "publish", edited)).ok);
  items = (await editor.list())!;
  assert.equal(publicItems(items)[0].teaser, "Edited line.");
  assert.equal(statusOf(items[0].version), "published");
});

test("only the full admins and holders of site-content access save; a blank field is refused; nothing changes on a refusal", async () => {
  const fields = { ...fieldsOf(cavour), teaser: "Edited line." };
  const outsiders: ViewerStanding[] = [
    { kind: "division-lead", siteContent: false, approveOrders: false },
    { kind: "member", siteContent: false, approveOrders: false },
    { kind: "alumni", siteContent: false, approveOrders: false },
  ];
  for (const viewer of outsiders) {
    const store = memoryContentStore(importedProjects());
    const result = await projectEditor(viewer, store).saveFields(1, "publish", fields);
    assert.deepEqual(result, { ok: false, error: SITE_CONTENT_REFUSAL }, viewer.kind);
    assert.deepEqual(publicItems(await store.list()), importedRecords);
  }
  const holder: ViewerStanding = { kind: "member", siteContent: true, approveOrders: false };
  assert.ok((await projectEditor(holder, memoryContentStore(importedProjects())).saveFields(1, "publish", fields)).ok);

  const store = memoryContentStore(importedProjects());
  const blank = await projectEditor(admin, store).saveFields(1, "save-draft", { ...fields, hero: { ...fields.hero, dates: " " } });
  assert.deepEqual(blank, { ok: false, error: "Fill in the dates." });
  assert.deepEqual(await store.list(), importedProjects());
});

test("a request is read as fields only in their shape, and nothing it carries beyond them is kept", () => {
  const fields = fieldsOf(efesto);
  assert.deepEqual(readProjectFields(JSON.parse(JSON.stringify({ ...fields, slug: "elsewhere" }))), fields);
  for (const broken of [null, "fields", { ...fields, teaser: 1 }, { ...fields, hero: { ...fields.hero, facts: "6" } }, { ...fields, reasons: { ...fields.reasons, shown: "yes" } }]) {
    assert.equal(readProjectFields(broken), null);
  }
});
