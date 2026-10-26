import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { publicItems } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { projectEditor } from "./editor";
import { MODEL_ALTS } from "@/lib/rocket-model";
import { checkProjectFields, fieldProblems, fieldsOf, heldPhotos, pickableModelsOf, projectModelOf, projectViewOf, readProjectFields, type ProjectFields } from "./fields";
import { importedProjects, importedRecords } from "./import";
import { backgroundSrc, homeCardOf, landingCardOf, listingOf, pageRecordOf } from "./record";

// The Top of the page card's visual, caption and background (board 93d,
// epic #522): what each choice draws, what a request may carry, and which
// file each surface reads.

const [cavour, ves, efesto] = importedRecords;
const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** A photo the site ships: a save takes it without an upload. */
const PHOTO = "/project-photos/cavour/euroc-2023-team.webp";

const withTop = (fields: ProjectFields, hero: Partial<ProjectFields["hero"]>, rest: Partial<ProjectFields> = {}): ProjectFields => ({
  ...fields,
  ...rest,
  hero: { ...fields.hero, ...hero },
});

test("a project that never picked a preset keeps its brand texture on its page, Home card and Projects list", () => {
  importedRecords.forEach((record, position) => {
    const fields = fieldsOf(record);
    assert.deepEqual(fields.background, { kind: "kept" }, record.slug);
    const view = projectViewOf(fields, record);
    assert.equal(record.background.kind, "texture");
    const kept = record.background.kind === "texture" ? record.background.src : "";
    assert.equal(homeCardOf(view, position).texture, kept, `${record.slug}: Home card`);
    assert.equal(listingOf(view, position).texture, kept, `${record.slug}: Projects list and page`);
  });
});

test("a picked preset is drawn tall on the Home card and wide on the page and the Projects list", () => {
  const view = projectViewOf({ ...fieldsOf(ves), background: { kind: "preset", preset: "nozzle-grey" } }, ves);
  assert.deepEqual(view.background, { kind: "preset", preset: "nozzle-grey" });
  assert.equal(homeCardOf(view, 1).texture, "/backgrounds/nozzle-grey-tall.webp");
  assert.equal(landingCardOf(view, 1).texture, "/backgrounds/nozzle-grey-tall.webp");
  assert.equal(listingOf(view, 1).texture, "/backgrounds/nozzle-grey-wide.webp");
  assert.equal(backgroundSrc({ kind: "upload", tall: PHOTO as never, wide: "/w.webp" as never }, "wide"), "/w.webp", "an upload has a file per shape");
});

test("publishing a preset changes the public page, Home card and Projects list; a draft changes none of them", async () => {
  const editor = projectEditor(admin, memoryContentStore(importedProjects()));
  const fields = { ...fieldsOf(efesto), background: { kind: "preset", preset: "ember" } } as const;
  assert.ok((await editor.saveFields(3, "save-draft", fields)).ok);
  assert.deepEqual(publicItems((await editor.list())!)[2].background, efesto.background, "a draft leaves the public background as it was");
  assert.ok((await editor.saveFields(3, "publish", fields)).ok);
  const published = publicItems((await editor.list())!)[2];
  assert.equal(homeCardOf(published, 2).texture, "/backgrounds/ember-tall.webp");
  assert.equal(listingOf(published, 2).texture, "/backgrounds/ember-wide.webp");
  assert.deepEqual(fieldsOf(published).background, { kind: "preset", preset: "ember" }, "the panel reopens on the preset");
});

test("the visual is a model, a photo or none; the caption is optional", () => {
  const fields = fieldsOf(ves);
  assert.deepEqual(fields.hero.visual, { kind: "model", model: "ves" });

  const placeholder = projectViewOf(withTop(fields, { visual: { kind: "model", model: "placeholder" }, caption: "" }), ves);
  assert.deepEqual(placeholder.hero.visual, { kind: "model", caption: "" }, "the placeholder carries no model of its own");
  assert.deepEqual(fieldProblems(withTop(fields, { caption: " " })), [], "an empty caption saves");

  const cav = projectViewOf(withTop(fields, { visual: { kind: "model", model: "cavour" } }), ves).hero.visual;
  assert.ok(cav.kind === "model" && cav.own?.model === "cavour" && cav.own.alt !== "", "a newly picked model carries its alt text");
  const back = projectViewOf(withTop(fields, { visual: { kind: "model", model: "ves" } }), ves).hero.visual;
  assert.deepEqual(back, ves.hero.visual, "the project's own model keeps its own alt text");

  const none = projectViewOf(withTop(fields, { visual: { kind: "none" } }), ves);
  assert.deepEqual(none.hero.visual, { kind: "none" });
  assert.equal(homeCardOf(none, 1).rocket, undefined, "with no visual the card draws the placeholder");

  const empty = withTop(fields, { visual: { kind: "photo", photo: null } });
  assert.deepEqual(
    fieldProblems(empty).map((p) => [p.section, p.field, p.error]),
    [["top", "hero.visual", "Add the photo."]],
  );
  const photo = withTop(fields, { visual: { kind: "photo", photo: { src: PHOTO as never, alt: " The team " } }, caption: "EUROC" });
  assert.deepEqual(pageRecordOf(projectViewOf(photo, ves)).hero.visual, { kind: "photo", caption: "EUROC", photo: { src: PHOTO, alt: "The team" } });
  assert.deepEqual(heldPhotos(photo).includes(PHOTO), true, "no save deletes the visual's photo while the panel holds it");
});

test("3D model draws the project's own model after a switch to Photo or None, from the opened or the published version", () => {
  const asPhoto = projectViewOf(withTop(fieldsOf(ves), { visual: { kind: "photo", photo: { src: PHOTO as never, alt: "" } } }), ves);
  assert.equal(projectModelOf({ state: "published", published: ves, draft: null }), "ves");
  assert.equal(projectModelOf({ state: "published", published: ves, draft: asPhoto }), "ves", "a draft on a photo keeps the published model");
  assert.equal(projectModelOf({ state: "draft", draft: asPhoto }), "placeholder", "a project with no model of its own draws the outline rocket");
});

test("a visual photo is one the panel uploaded or the site ships; a save cannot point it at a file elsewhere", async () => {
  const store = memoryContentStore(importedProjects());
  const foreign = withTop(fieldsOf(ves), { visual: { kind: "photo", photo: { src: "https://example.com/x.webp" as never, alt: "" } } });
  assert.deepEqual(await projectEditor(admin, store).saveFields(2, "publish", foreign), { ok: false, error: "A photo was not uploaded. Add it again." });
  const shipped = withTop(fieldsOf(ves), { visual: { kind: "photo", photo: { src: PHOTO as never, alt: "The team" } } });
  assert.ok((await projectEditor(admin, store).saveFields(2, "publish", shipped)).ok);
});

test("a rocket's visual names a rocket only; an engine's may name any model", async () => {
  const store = memoryContentStore(importedProjects());
  const vehicle = withTop(fieldsOf(cavour), { visual: { kind: "model", model: "efesto" } });
  assert.deepEqual(await projectEditor(admin, store).saveFields(1, "publish", vehicle), { ok: false, error: "Reload the page and try again." });
  assert.deepEqual(await store.list(), importedProjects());
  const engine = withTop(fieldsOf(efesto), { visual: { kind: "model", model: "cavour" } });
  assert.ok((await projectEditor(admin, memoryContentStore(importedProjects())).saveFields(3, "publish", engine)).ok);
});

test("the Rocket field offers every model the project's record may name, and each one it offers saves", () => {
  assert.deepEqual(pickableModelsOf("vehicle"), ["cavour", "ves", "placeholder"]);
  assert.deepEqual(pickableModelsOf("engine"), ["cavour", "ves", "efesto", "placeholder"]);

  for (const record of [cavour, efesto]) {
    for (const model of pickableModelsOf(record.kind)) {
      const saved = checkProjectFields(withTop(fieldsOf(record), { visual: { kind: "model", model } }), record);
      assert.ok(saved.ok, `${record.slug}: ${model} saves`);
      const visual = saved.value.hero.visual;
      assert.equal(visual.kind, "model");
      if (visual.kind !== "model") continue;
      if (model === "placeholder") assert.equal(visual.own, undefined, `${record.slug}: the outline rocket carries no model of its own`);
      else if (record.hero.visual.kind !== "model" || record.hero.visual.own?.model !== model)
        assert.deepEqual(visual.own, { model, alt: MODEL_ALTS[model] }, `${record.slug}: a newly picked ${model} carries its alt text`);
    }
  }

  const efestoOnRocket = checkProjectFields(withTop(fieldsOf(cavour), { visual: { kind: "model", model: "efesto" } }), cavour);
  assert.deepEqual(efestoOnRocket, { ok: false, error: "Reload the page and try again." }, "a rocket never draws an engine");
});

test("a request names a preset or keeps the opened background, never a file the site ships; it names a model the site has and an uploaded photo", () => {
  const fields = fieldsOf(cavour);
  const sent = (v: unknown) => readProjectFields(JSON.parse(JSON.stringify(v)));
  assert.deepEqual(sent({ ...fields, background: { kind: "preset", preset: "flare" } })?.background, { kind: "preset", preset: "flare" });
  assert.deepEqual(sent({ ...fields, background: { kind: "kept", src: "/elsewhere.webp" } })?.background, { kind: "kept" });
  assert.deepEqual(sent({ ...fields, background: { kind: "preset", preset: "cavour-page" } })?.background, { kind: "preset", preset: "dark-stripes" }, "a retired preset reads its successor");
  for (const broken of [
    { ...fields, background: { kind: "preset", preset: "blue" } },
    { ...fields, background: { kind: "texture", src: "/textures/project-cavour.webp" } },
    { ...fields, background: { kind: "upload", tall: PHOTO, wide: PHOTO } },
    { ...fields, background: undefined },
    withTop(fields, { visual: { kind: "model", model: "saturn-v" as never } }),
    withTop(fields, { visual: { kind: "photo", photo: { src: "/textures/../x.webp" as never, alt: "" } } }),
    withTop(fields, { visual: { kind: "video" } as never }),
    withTop(fields, { caption: null as never }),
  ]) {
    assert.equal(sent(broken), null);
  }
  const kept = projectViewOf(sent({ ...fields, background: { kind: "kept" } })!, cavour);
  assert.deepEqual(kept.background, cavour.background, "a kept background is the opened version's");
});
