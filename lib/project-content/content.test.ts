import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { contentEditor } from "@/lib/content/editor";
import { memoryContentStore } from "@/lib/content/memory";
import { editorVersion, publicItems } from "@/lib/content/versioned";
import type { ViewerStanding } from "@/lib/dashboard/viewer";
import { launchCounts } from "@/lib/projects";
import before from "./before.json";
import { isProjectRecord, storedProjectRecord } from "./check";
import {
  cavourSitePhotos,
  efestoEngineModel,
  efestoSiteContent,
  firstImport,
  importedProjects,
  importedRecords,
  legacyRecords,
  projectImportSql,
  vesGreyTexture,
  vesMarkOneRocket,
  vesSitePhotos,
} from "./import";
import { blocksRecordOf, type LegacyProjectRecord } from "./legacy";
import { listPhotos } from "./list-fields";
import {
  homeCardOf,
  listingOf,
  listingsNewestFirst,
  newestFirst,
  pageRecordOf,
  type LaunchesBlock,
  type ProjectRecord,
  type StoredLaunch,
  type VehicleRecord,
} from "./record";
import { revise, revisionSql } from "./revision";
import { sectionBlockOf, sectionContentOf, withSectionBlock } from "./sections";
import { withSubscriptDigits } from "./subscript";
import type { PageBlock, ProjectPageRecord, TextBlock } from "@/lib/project-pages/types";

// The projects content store (issue #295). ./before.json is what the code
// drew before the switch: each page record of lib/project-pages/<slug>.ts,
// the /projects entries of lib/projects.ts with its header figures, and the
// home cards of components/landing/projects.tsx (each card's text as the
// HTML it rendered). The imported records must draw exactly that, read
// through migration 0050's page blocks (./legacy.ts).

/** A page's block with this id, without its id, kind and hidden flag: what its section held before blocks. */
function sectionOf(blocks: readonly PageBlock[], id: string): Record<string, unknown> | undefined {
  const block = blocks.find((b) => b.id === id);
  if (block === undefined) return undefined;
  const { id: _id, kind: _kind, hidden: _hidden, ...section } = block;
  return section;
}

/** A story's text block as the story section it was before blocks. */
function storyOf(blocks: readonly PageBlock[], id: "name" | "design") {
  const block = blocks.find((b): b is TextBlock => b.id === id && b.kind === "text")!;
  return { title: block.heading?.title, body: block.body, ...(block.parts && { parts: block.parts }) };
}

/** The page record in the shape the code drew before blocks, its top's visual left out (it is checked on its own). */
function sectionsPage(page: ProjectPageRecord) {
  const { visual: _visual, ...hero } = page.hero;
  return plain({
    description: page.description,
    hero,
    name: storyOf(page.blocks, "name"),
    design: storyOf(page.blocks, "design"),
    versions: sectionOf(page.blocks, "versions"),
    launches: sectionOf(page.blocks, "launches"),
    plan: sectionOf(page.blocks, "plan"),
    reasons: sectionOf(page.blocks, "reasons"),
    gallery: sectionOf(page.blocks, "gallery"),
  });
}

const launchHistory = (record: ProjectRecord) => sectionBlockOf(record, "launches");

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** A value as a page receives it once rendered: no undefined keys. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

const html = (node: unknown) => renderToStaticMarkup(createElement(Fragment, null, node as never));

/** The home card's pill, by the classes components/landing/projects.tsx gave it before the switch. */
const PILL_TONE: Record<string, ProjectRecord["card"]["statusTone"]> = {
  "bg-ground/70 text-prt-text": "dark",
  "bg-prt-text text-ground": "light",
};

/** The import as the switch carried it, before any later revision, read as migration 0050 turns it. */
const firstImportRecords = firstImport.map(({ teaser: _retired, ...record }) => blocksRecordOf(record as LegacyProjectRecord));
const published = () => publicItems(importedProjects(firstImportRecords));

const migrationFile = (name: string) => readFileSync(join(__dirname, "..", "..", "drizzle", name), "utf8");

test("migration 0037 holds exactly the import of Cavour, VES and Efesto, each a whole record", () => {
  const migration = migrationFile("0037_projects_audit_and_import.sql");
  assert.ok(migration.trimEnd().endsWith(projectImportSql()), "regenerate the migration's import from projectImportSql()");
  assert.equal(projectImportSql().split("--> statement-breakpoint").length, 3);
  assert.deepEqual(importedRecords.map((r) => r.slug), ["cavour", "ves", "efesto"]);
  for (const record of importedRecords) assert.ok(isProjectRecord(plain(record)), record.slug);
});

test("migration 0040 holds exactly the VES Mark I revision, and the revised records are whole", () => {
  assert.ok(
    migrationFile("0040_ves_mark_one_rocket.sql").trimEnd().endsWith(revisionSql(vesMarkOneRocket)),
    "regenerate the migration from revisionSql(vesMarkOneRocket)",
  );
  const ves = importedRecords[1];
  assert.equal(homeCardOf(ves, 1).rocket, "ves");
  const { visual } = pageRecordOf(ves).hero;
  assert.equal(visual.kind === "model" ? visual.own?.model : undefined, "ves");
  const markI = sectionContentOf(ves, "versions")?.after.find((v) => v.pill === "VES MARK I");
  assert.ok(markI, "VES has its Mark I version");
  const { diameter, length, wetMass, motor, maxSpeed, targetApogee } = markI.specs;
  assert.deepEqual(
    ves.hero.facts.map((f) => f.value),
    [diameter, length, wetMass, motor, maxSpeed, targetApogee],
    "the key facts under the Mark I caption are Mark I's",
  );
  assert.equal(firstImport[1].card.rocket, "cavour", "the import itself stays as 0037 carried it");
  assert.deepEqual(revise(firstImport[0], vesMarkOneRocket), firstImport[0], "a revision touches its own project only");
});

test("migration 0041 holds exactly the current-site photo revisions, and every photo they set is a file of the site", () => {
  const migration = migrationFile("0041_current_site_photos.sql");
  for (const revision of [cavourSitePhotos, vesSitePhotos])
    assert.ok(migration.includes(revisionSql(revision)), `regenerate the migration from revisionSql(${revision.slug} photos)`);
  for (const record of importedRecords.slice(0, 2)) {
    assert.ok(isProjectRecord(plain(record)), record.slug);
    assert.ok(launchHistory(record)?.entries.every((launch) => launch.cover !== undefined), `${record.slug}: every launch card has its cover`);
    assert.ok(sectionContentOf(record, "gallery")?.items.every((item) => "src" in item), `${record.slug}: the gallery holds no placeholder`);
    for (const src of listPhotos(record))
      assert.ok(existsSync(join(__dirname, "..", "..", "public", src)), `${src} is in public/`);
  }
});

test("migration 0042 holds exactly the VES grey texture revision, and the texture is a file of the site", () => {
  assert.ok(
    migrationFile("0042_ves_grey_texture.sql").trimEnd().endsWith(revisionSql(vesGreyTexture)),
    "regenerate the migration from revisionSql(vesGreyTexture)",
  );
  const [cavour, ves, efesto] = importedRecords;
  assert.deepEqual(ves.background, { kind: "texture", src: "/textures/project-ves-grey.webp" });
  assert.ok(existsSync(join(__dirname, "..", "..", "public", "textures", "project-ves-grey.webp")), "the grey texture is in public/");
  assert.equal(firstImport[1].texture, "/textures/project-ves.webp", "the import itself stays as 0037 carried it");
  assert.deepEqual(
    [cavour.background, efesto.background],
    [firstImport[0], firstImport[2]].map((r) => ({ kind: "texture", src: r.texture })),
    "no other project's texture changes",
  );
});

test("migration 0043 holds exactly the Efesto engine revision, and only an engine record may name the engine", () => {
  assert.ok(
    migrationFile("0043_efesto_engine_model.sql").trimEnd().endsWith(revisionSql(efestoEngineModel)),
    "regenerate the migration from revisionSql(efestoEngineModel)",
  );
  const efesto = importedRecords[2];
  assert.ok(isProjectRecord(plain(efesto)));
  assert.equal(homeCardOf(efesto, 2).rocket, "efesto");
  const { visual } = pageRecordOf(efesto).hero;
  assert.equal(visual.kind === "model" ? visual.own?.model : undefined, "efesto");
  assert.equal(firstImport[2].card.rocket, "cavour", "the import itself stays as 0037 carried it");

  const cavour = plain(importedRecords[0]) as VehicleRecord;
  const engine = { kind: "model", caption: "CAVOUR", own: { model: "efesto", alt: "" } };
  assert.equal(isProjectRecord({ ...cavour, hero: { ...cavour.hero, visual: engine } }), false, "a rocket's page, card and panel draw a rocket");
  assert.ok(isProjectRecord({ ...(plain(efesto) as ProjectRecord), hero: { ...efesto.hero, visual: { ...engine, own: { model: "cavour", alt: "" } } } }), "an engine's may draw a rocket");
});

test("migration 0046 holds exactly the Efesto site content revision, and the revised Efesto is a whole record", () => {
  assert.ok(
    migrationFile("0046_efesto_site_content.sql").trimEnd().endsWith(revisionSql(efestoSiteContent)),
    "regenerate the migration from revisionSql(efestoSiteContent)",
  );
  const efesto = importedRecords[2];
  assert.ok(isProjectRecord(plain(efesto)));
  assert.equal(sectionContentOf(efesto, "gallery")?.items.length, 2, "the gallery holds the public site's two images");
  for (const src of listPhotos(efesto))
    assert.ok(existsSync(join(__dirname, "..", "..", "public", src)), `${src} is in public/`);
  assert.deepEqual(
    sectionContentOf(efesto, "reasons")?.items.map((r) => r.title),
    ["Reusability", "New materials", "New technologies", "Static fire qualification", "Simplicity"],
  );
  assert.equal(firstImport[2].gallery, undefined, "the import itself stays as 0037 carried it");
  assert.deepEqual(revise(firstImport[0], efestoSiteContent), firstImport[0], "a revision touches its own project only");
});

test("the imported records draw the same page records, /projects entries and home cards as the code did", () => {
  const records = published();
  assert.equal(records.length, 3);
  records.forEach((record, i) => {
    // The page no longer carries the next-project card's line (issue #377).
    const { teaser: _, ...page } = before.pages[record.slug as keyof typeof before.pages];
    // The sections are page blocks now, in the same order (migration 0050); the top's visual is checked below.
    const { visual: _visual, ...hero } = page.hero as typeof page.hero & { visual?: unknown };
    assert.deepEqual(sectionsPage(pageRecordOf(record)), plain({ ...page, hero }), `${record.slug} page`);
    assert.deepEqual(
      pageRecordOf(record).blocks.map((b) => b.id),
      Object.keys(page).filter((key) => !["description", "hero"].includes(key)),
      `${record.slug}: the blocks are in the page's order`,
    );
    // A rocket's panel model came after the switch (issue #381): it is the home card's.
    const listing = listingOf(record, i);
    assert.deepEqual(plain({ ...listing, rocket: undefined }), before.projects[i], `${record.slug} /projects entry`);
    if (listing.kind === "vehicle") assert.equal(listing.rocket, homeCardOf(record, i).rocket, `${record.slug} /projects rocket`);

    // The card's model is its top visual's now (migration 0050): checked on the revised records below.
    const card = homeCardOf(record, i);
    const was = before.homeCards[i];
    const { desc, statusStyle, rocket: _rocket, ...rest } = was;
    assert.deepEqual(plain({ ...card, desc: undefined, statusTone: undefined, rocket: undefined }), rest, `${record.slug} home card`);
    assert.equal(card.statusTone, PILL_TONE[statusStyle], `${record.slug} pill`);
    assert.equal(html(withSubscriptDigits(card.desc.text)), desc.text, `${record.slug} card text`);
    assert.equal(card.desc.phone && html(withSubscriptDigits(card.desc.phone)), "phone" in desc ? desc.phone : undefined, `${record.slug} card phone text`);
  });
  assert.deepEqual(plain(launchCounts(records.map(listingOf))), before.headerStats.slice(0, 3));
});

test("once migrated, each project's home card, /projects entry and page keep the texture and the model they had", () => {
  legacyRecords.forEach((legacy, i) => {
    const record = importedRecords[i];
    const card = homeCardOf(record, i);
    const listing = listingOf(record, i);
    assert.equal(card.texture, legacy.texture, `${legacy.slug} card texture`);
    assert.equal(listing.texture, legacy.texture, `${legacy.slug} /projects texture`);
    assert.equal(card.rocket, legacy.card.rocket, `${legacy.slug} card model`);
    assert.equal(listing.kind === "vehicle" ? listing.rocket : listing.engine, legacy.card.rocket, `${legacy.slug} /projects model`);
    const { visual } = pageRecordOf(record).hero;
    assert.deepEqual(visual, { kind: "model", caption: legacy.hero.visual?.caption, own: legacy.hero.visual?.rocket?.own }, `${legacy.slug} page visual`);
  });
});

test("a stored record that breaks a shape rule is not a record", () => {
  const cavour = plain(importedRecords[0]) as VehicleRecord;
  const history = launchHistory(cavour)!;
  assert.equal(isProjectRecord({ ...cavour, hero: { ...cavour.hero, facts: [] } }), false, "one key fact at least");
  assert.equal(isProjectRecord(withSectionBlock(cavour, "launches", { ...history, entries: [] as never })), false, "a launch history has a launch");
  assert.equal(isProjectRecord({ ...cavour, kind: "engine" }), false, "an engine's listing has work lines");
  assert.equal(isProjectRecord({ ...cavour, slug: "Not a slug" }), false);
  assert.equal(isProjectRecord({ ...cavour, extra: 1 }), false);
  const { description: _, ...noDescription } = cavour;
  assert.equal(isProjectRecord(noDescription), false);
  assert.equal(isProjectRecord({ ...cavour, blocks: [...cavour.blocks, cavour.blocks[0]] }), false, "no two blocks share an id");
  assert.equal(isProjectRecord({ ...cavour, background: { kind: "texture", src: "/../secret" } }), false, "a kept texture is a site file");
  assert.equal(isProjectRecord({ ...cavour, background: { kind: "preset", preset: "blue" } }), false, "a preset is one of the 18");
  const efesto = plain(importedRecords[2]) as ProjectRecord;
  assert.equal(isProjectRecord({ ...efesto, blocks: [...efesto.blocks, { ...history, id: "flights" }] }), false, "an engine has no launch history");
});

test("a record stored before issue #377 still reads, without the retired next-project line", () => {
  const cavour = plain(importedRecords[0]) as VehicleRecord;
  assert.equal(isProjectRecord({ ...cavour, teaser: "A line." }), false, "the retired key is not the record's");
  assert.deepEqual(storedProjectRecord({ ...cavour, teaser: "A line." }), cavour);
  assert.equal(storedProjectRecord({ ...cavour, extra: 1 }), null, "only a retired key is let through");
});

test("a record stored with a retired preset reads the Dark stripes preset that replaced it (Owner decision on #522)", () => {
  const cavour = plain(importedRecords[0]) as VehicleRecord;
  const darkStripes = { ...cavour, background: { kind: "preset", preset: "dark-stripes" } };
  for (const retired of ["projects-page", "cavour-page"]) {
    const stored = { ...cavour, background: { kind: "preset", preset: retired } };
    assert.equal(isProjectRecord(stored), false, `${retired} is no preset now`);
    assert.deepEqual(storedProjectRecord(stored), darkStripes, retired);
  }
  assert.equal(storedProjectRecord({ ...cavour, background: { kind: "preset", preset: "toString" } }), null, "a name that never was a preset still refuses");
});

test("the public pages read only the published version: a draft-only change and a draft-only project are not shown", async () => {
  const store = memoryContentStore(importedProjects());
  const editor = contentEditor(admin, store);
  const ves = importedRecords[1];
  const drafted: ProjectRecord = { ...ves, name: "VES Mark III", description: "Draft description." };

  assert.ok((await editor.save(2, "save-draft", async () => ({ ok: true, value: drafted }))).ok);
  assert.ok((await editor.save(null, "save-draft", async () => ({ ok: true, value: { ...ves, slug: "next", name: "Next" } }))).ok);

  const shown = publicItems(await store.list());
  assert.deepEqual(shown.map((r) => r.name), ["Cavour", "VES", "Efesto"]);
  assert.equal(pageRecordOf(shown[1]).description, ves.description);
  assert.equal(listingOf(shown[1], 1).name, "VES");
  assert.equal(homeCardOf(shown[1], 1).name, "VES");
  assert.equal(editorVersion((await store.list())[1].version).name, "VES Mark III", "the editor opens on the draft");

  assert.ok((await editor.save(2, "publish", async () => ({ ok: true, value: drafted }))).ok);
  assert.equal(publicItems(await store.list())[1].name, "VES Mark III");
});

test("the /projects header counts follow the stored launches: a launch added and published changes them", async () => {
  const counts = async (store: ReturnType<typeof memoryContentStore<ProjectRecord>>) =>
    launchCounts(publicItems(await store.list()).map(listingOf)).map((s) => `${s.value} ${s.label}`);
  const store = memoryContentStore(importedProjects());
  assert.deepEqual(await counts(store), ["4 FLIGHTS", "3 COUNTRIES", "3 AWARDS"]);

  const ves = importedRecords[1] as VehicleRecord;
  const launch: StoredLaunch = {
    date: "10 Oct 2026",
    where: "Launch site, Italy",
    result: "Nominal.",
    award: { name: "BEST NEW ROCKET" },
    title: "A new campaign",
    place: { text: "Italy" },
    version: "VES MARK II",
    motor: "Aerotech O5500X",
    summary: { text: "It flew.", phone: "It flew." },
    outcome: "nominal",
    flight: { apogee: "5 000 m", maxSpeed: "400 m/s", country: "Italy" },
    stats: [
      { value: "10 G", label: "BOOST ACCEL" },
      { value: "1 / 20", label: "OVERALL RANK" },
    ],
    phoneStat: 0,
  };
  const history = launchHistory(ves)!;
  const withLaunch = withSectionBlock(ves, "launches", { ...history, entries: [...history.entries, launch] });
  const editor = contentEditor(admin, store);
  assert.ok((await editor.save(2, "save-draft", async () => ({ ok: true, value: withLaunch }))).ok);
  assert.deepEqual(await counts(store), ["4 FLIGHTS", "3 COUNTRIES", "3 AWARDS"], "a draft launch counts for nothing");

  assert.ok((await editor.save(2, "publish", async () => ({ ok: true, value: withLaunch }))).ok);
  assert.deepEqual(await counts(store), ["5 FLIGHTS", "4 COUNTRIES", "4 AWARDS"]);
  const page = pageRecordOf(publicItems(await store.list())[1]);
  const shown = page.blocks.find((b): b is LaunchesBlock & PageBlock => b.kind === "launches");
  assert.equal(shown?.entries.at(-1)?.title, "A new campaign", "the page's launch history shows it too");
});

test("a home card draws a formula's subscript digits lowered, and leaves other text alone", () => {
  assert.equal(html(withSubscriptDigits("N₂O and C₂H₅OH")), "N<sub>2</sub>O and C<sub>2</sub>H<sub>5</sub>OH");
  assert.equal(withSubscriptDigits("Mk I · II"), "Mk I · II");
});

test("the home Projects row shows the newest project first, by year then by number, each card keeping its number", () => {
  const cards = published().map(homeCardOf);
  // VES "2024–25", then Efesto "2023–" and Cavour "2023": the same year, so the higher number first.
  assert.deepEqual(newestFirst(cards).map((c) => [c.num, c.name]), [["02", "VES"], ["03", "Efesto"], ["01", "Cavour"]]);
  const unnamed = { ...cards[0], num: "04", name: "No year", year: { text: "" } };
  assert.equal(newestFirst([unnamed, ...cards]).at(-1)?.name, "No year", "a card naming no year goes last");
});

test("/projects lists the projects in the home row's order, each entry keeping its number", () => {
  const records = published();
  const row = newestFirst(records.map(homeCardOf)).map((c) => [c.num, c.name]);
  assert.deepEqual(listingsNewestFirst(records).map((p) => [p.index, p.name]), row);
});
