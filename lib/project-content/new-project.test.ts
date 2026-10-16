import assert from "node:assert/strict";
import { test } from "node:test";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, publicItems } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { dummyProjectStore, parseProjectEdits, serializeProjectEdits, type DummyProjectEdits, type DummyProjectEditsStore } from "@/lib/dummy-data/projects";
import { DUMMY_STATE_COOKIE_BYTES } from "@/lib/dummy-data/state";
import { cardPosterOf, rocketModelOf, stageStillOf } from "@/lib/rocket-model";
import { isProjectRecord } from "./check";
import { projectEditor } from "./editor";
import { fieldProblems, fieldsOf } from "./fields";
import { importedProjects } from "./import";
import { newProjectProblems, newProjectRecord, slugFrom, takenSlugs, type NewProject } from "./new-project";
import { homeCardOf, listingOf, pageRecordOf, publishedPageOf, type ProjectRecord } from "./record";

// New project and the one project route (issue #301). New project stores a
// draft that no public page shows until it is published; /projects/<slug>
// serves every published project, Cavour, VES and Efesto at the addresses
// they had, and nothing else; the next-project loop follows the site order;
// a new project draws the shared placeholder rocket on its card and page.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };
const member: ViewerStanding = { kind: "member", siteContent: false, approveOrders: false } as ViewerStanding;

const mark3: NewProject = { name: "VES Mark III", slug: "ves-mark-iii", kind: "vehicle" };

/** A value as stored and read back: no undefined keys. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

/** What Home, /projects and /projects/<slug> draw: the published records in site order. */
const publicSite = async (store: ReturnType<typeof memoryContentStore<ProjectRecord>>) => publicItems(await store.list());

test("New project stores a draft and opens it in the editor, and no public page shows it until it is published", async () => {
  const store = memoryContentStore(importedProjects());
  const editor = projectEditor(admin, store);
  const created = await editor.create(mark3);
  assert.ok(created.ok);
  assert.equal(created.value.version.state, "draft");

  // The editor opens it at its address, as app/dashboard/projects/[slug] finds it.
  const items = await store.list();
  assert.equal(items.find((i) => editorVersion(i.version).slug === "ves-mark-iii")?.id, created.value.id);

  // Home, /projects and its own address show the three published projects and not the draft.
  const shown = await publicSite(store);
  assert.deepEqual(shown.map((r, i) => homeCardOf(r, i).name), ["Cavour", "VES", "Efesto"]);
  assert.deepEqual(shown.map((r, i) => listingOf(r, i).slug), ["cavour", "ves", "efesto"]);
  assert.equal(publishedPageOf(shown, "ves-mark-iii"), null);

  // Published, it is last in the site order and served at its address.
  const record = editorVersion(created.value.version);
  assert.ok((await editor.save(created.value.id, "publish", async () => ({ ok: true, value: record }))).ok);
  const after = await publicSite(store);
  assert.deepEqual(after.map((r) => r.slug), ["cavour", "ves", "efesto", "ves-mark-iii"]);
  const page = publishedPageOf(after, "ves-mark-iii");
  assert.equal(page?.record.name, "VES Mark III");
  assert.equal(listingOf(page!.record, page!.position).href, "/projects/ves-mark-iii");
});

test("New project refuses an address another project holds, a malformed one and a viewer without site-content access", async () => {
  const store = memoryContentStore(importedProjects());
  const editor = projectEditor(admin, store);
  assert.equal((await editor.create({ ...mark3, slug: "ves" })).ok, false);
  assert.equal((await editor.create({ ...mark3, slug: "VES Mark III" })).ok, false);
  assert.equal((await editor.create({ ...mark3, name: "  " })).ok, false);
  assert.equal((await projectEditor(member, store).create(mark3)).ok, false);
  assert.equal((await store.list()).length, 3);

  // A draft's address is taken too, so a second New project cannot reuse it.
  assert.ok((await editor.create(mark3)).ok);
  assert.deepEqual(
    newProjectProblems(mark3, takenSlugs(await store.list())).map((p) => p.field),
    ["slug"],
  );
  assert.equal(slugFrom("Èfesto  Mk. II"), "efesto-mk-ii");
});

test("one route serves Cavour, VES and Efesto at their addresses, and an unknown or draft-only address is not found", () => {
  const published = publicItems(importedProjects());
  for (const slug of ["cavour", "ves", "efesto"]) {
    const page = publishedPageOf(published, slug);
    assert.equal(page?.record.slug, slug);
    assert.equal(listingOf(page!.record, page!.position).href, `/projects/${slug}`);
  }
  assert.equal(publishedPageOf(published, "mark-iii"), null);
  assert.equal(publishedPageOf([], "cavour"), null);
});

test("the next-project loop follows the site order and takes in a published new project", async () => {
  const store = memoryContentStore(importedProjects());
  const editor = projectEditor(admin, store);
  const created = await editor.create(mark3);
  assert.ok(created.ok);
  const record = editorVersion(created.value.version);
  assert.ok((await editor.save(created.value.id, "publish", async () => ({ ok: true, value: record }))).ok);
  assert.ok((await editor.setSiteOrder([3, created.value.id, 1, 2])).ok);

  const shown = await publicSite(store);
  const nextOf = (slug: string) => publishedPageOf(shown, slug)?.next.record.slug;
  assert.deepEqual(
    shown.map((r) => r.slug),
    ["efesto", "ves-mark-iii", "cavour", "ves"],
  );
  assert.equal(nextOf("efesto"), "ves-mark-iii");
  assert.equal(nextOf("ves-mark-iii"), "cavour");
  assert.equal(nextOf("ves"), "efesto");
  assert.equal(publishedPageOf(shown, "ves")?.next.position, 0);
});

test("a new project's card and page draw the placeholder rocket, and its draft is whole and saves as it opens", () => {
  for (const kind of ["vehicle", "engine"] as const) {
    const record = newProjectRecord({ ...mark3, kind }, 2026);
    assert.ok(isProjectRecord(plain(record)), kind);
    assert.equal(rocketModelOf(homeCardOf(record, 0).rocket), "placeholder");
    const rocket = pageRecordOf(record).hero.visual?.rocket;
    assert.ok(rocket !== undefined, "the page's panel has a rocket slot");
    assert.deepEqual(stageStillOf(rocket.own), { src: stageStillOf(undefined).src, alt: "" });
    assert.notEqual(cardPosterOf("placeholder"), cardPosterOf("cavour"));
    assert.deepEqual(fieldProblems(fieldsOf(record)), [], `${kind}: Save draft works on the draft as it opens`);
  }
});

test("a test developer's new project is kept in their cookie across a reload and stays off the public site", async () => {
  const jar = {
    value: undefined as string | undefined,
    get current(): DummyProjectEdits {
      return parseProjectEdits(jar.value);
    },
    save: async (next: DummyProjectEdits) => {
      jar.value = serializeProjectEdits(next);
    },
  };
  const store: DummyProjectEditsStore = jar;
  const created = await projectEditor(admin, dummyProjectStore(store)).create(mark3);
  assert.ok(created.ok);
  assert.ok((jar.value ?? "").length <= DUMMY_STATE_COOKIE_BYTES);

  const reloaded = await projectEditor(admin, dummyProjectStore(store)).list();
  const item = reloaded?.find((i) => i.id === created.value.id);
  assert.equal(item?.version.state, "draft");
  assert.equal(publicItems(reloaded ?? []).some((r) => r.slug === "ves-mark-iii"), false);
});
