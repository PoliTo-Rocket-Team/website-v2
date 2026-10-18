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
import { cavourSitePhotos, firstImport, importedProjects, importedRecords, projectImportSql, vesMarkOneRocket, vesSitePhotos } from "./import";
import { listPhotos } from "./list-fields";
import { homeCardOf, listingOf, newestFirst, pageRecordOf, type ProjectRecord, type StoredLaunch, type VehicleRecord } from "./record";
import { revise, revisionSql } from "./revision";
import { withSubscriptDigits } from "./subscript";

// The projects content store (issue #295). ./before.json is what the code
// drew before the switch: each page record of lib/project-pages/<slug>.ts,
// the /projects entries of lib/projects.ts with its header figures, and the
// home cards of components/landing/projects.tsx (each card's text as the
// HTML it rendered). The imported records must draw exactly that.

const admin: ViewerStanding = { kind: "operations-lead", seat: "team-leader", siteContent: false, approveOrders: false };

/** A value as a page receives it once rendered: no undefined keys. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;

const html = (node: unknown) => renderToStaticMarkup(createElement(Fragment, null, node as never));

/** The home card's pill, by the classes components/landing/projects.tsx gave it before the switch. */
const PILL_TONE: Record<string, ProjectRecord["card"]["statusTone"]> = {
  "bg-ground/70 text-prt-text": "dark",
  "bg-prt-text text-ground": "light",
};

/** The import as the switch carried it, before any later revision. */
const published = () => publicItems(importedProjects(firstImport));

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
  assert.equal(ves.card.rocket, "ves");
  assert.deepEqual(pageRecordOf(ves).hero.visual?.rocket?.own?.model, "ves");
  const markI = ves.kind === "vehicle" ? ves.versions?.after.find((v) => v.pill === "VES MARK I") : undefined;
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
    const page = pageRecordOf(record);
    assert.ok(page.launches?.entries.every((launch) => launch.photos?.length === 2), `${record.slug}: every launch card has its two photos`);
    assert.ok(page.gallery?.items.every((item) => "src" in item), `${record.slug}: the gallery holds no placeholder`);
    for (const src of listPhotos(record))
      assert.ok(existsSync(join(__dirname, "..", "..", "public", src)), `${src} is in public/`);
  }
});

test("the imported records draw the same page records, /projects entries and home cards as the code did", () => {
  const records = published();
  assert.equal(records.length, 3);
  records.forEach((record, i) => {
    // The page no longer carries the next-project card's line (issue #377).
    const { teaser: _, ...page } = before.pages[record.slug as keyof typeof before.pages];
    assert.deepEqual(plain(pageRecordOf(record)), page, `${record.slug} page`);
    assert.deepEqual(plain(listingOf(record, i)), before.projects[i], `${record.slug} /projects entry`);

    const card = homeCardOf(record, i);
    const was = before.homeCards[i];
    const { desc, statusStyle, ...rest } = was;
    assert.deepEqual(plain({ ...card, desc: undefined, statusTone: undefined }), rest, `${record.slug} home card`);
    assert.equal(card.statusTone, PILL_TONE[statusStyle], `${record.slug} pill`);
    assert.equal(html(withSubscriptDigits(card.desc.text)), desc.text, `${record.slug} card text`);
    assert.equal(card.desc.phone && html(withSubscriptDigits(card.desc.phone)), "phone" in desc ? desc.phone : undefined, `${record.slug} card phone text`);
  });
  assert.deepEqual(plain(launchCounts(records.map(listingOf))), before.headerStats.slice(0, 3));
});

test("a stored record that breaks a shape rule is not a record", () => {
  const cavour = plain(importedRecords[0]) as VehicleRecord;
  assert.equal(isProjectRecord({ ...cavour, hero: { ...cavour.hero, facts: [] } }), false, "one key fact at least");
  assert.equal(isProjectRecord({ ...cavour, launches: { ...cavour.launches, entries: [] } }), false, "a launch history has a launch");
  assert.equal(isProjectRecord({ ...cavour, kind: "engine" }), false, "an engine's listing has work lines");
  assert.equal(isProjectRecord({ ...cavour, slug: "Not a slug" }), false);
  assert.equal(isProjectRecord({ ...cavour, extra: 1 }), false);
  const { description: _, ...noDescription } = cavour;
  assert.equal(isProjectRecord(noDescription), false);
});

test("a record stored before issue #377 still reads, without the retired next-project line", () => {
  const cavour = plain(importedRecords[0]) as VehicleRecord;
  const stored = plain(firstImport[0]) as VehicleRecord & { teaser: string };
  const { teaser: _, ...unrevised } = stored;
  assert.equal(isProjectRecord(stored), false, "the import carries the retired key");
  assert.deepEqual(storedProjectRecord(stored), unrevised);
  assert.deepEqual(storedProjectRecord({ ...cavour, teaser: "A line." }), cavour);
  assert.equal(storedProjectRecord({ ...cavour, extra: 1 }), null, "only a retired key is let through");
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
  const withLaunch: VehicleRecord = { ...ves, launches: { ...ves.launches!, entries: [...ves.launches!.entries, launch] } };
  const editor = contentEditor(admin, store);
  assert.ok((await editor.save(2, "save-draft", async () => ({ ok: true, value: withLaunch }))).ok);
  assert.deepEqual(await counts(store), ["4 FLIGHTS", "3 COUNTRIES", "3 AWARDS"], "a draft launch counts for nothing");

  assert.ok((await editor.save(2, "publish", async () => ({ ok: true, value: withLaunch }))).ok);
  assert.deepEqual(await counts(store), ["5 FLIGHTS", "4 COUNTRIES", "4 AWARDS"]);
  const page = pageRecordOf(publicItems(await store.list())[1]);
  assert.equal(page.launches?.entries.at(-1)?.title, "A new campaign", "the page's launch history shows it too");
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
