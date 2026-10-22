import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import type { GalleryBlock, TextBlock } from "@/lib/project-pages/types";
import { storedProjectRecord as storedBeforeBlocks } from "./before-blocks/check";
import * as beforeBlocks from "./before-blocks/record";
import { isProjectRecord } from "./check";
import { firstImport, legacyRecords } from "./import";
import { blocksRecordOf, LAUNCH_PHOTOS_GALLERY_TITLE, type LegacyProjectRecord, type LegacyVehicleRecord } from "./legacy";
import type { LaunchesBlock, ProjectBlock, ProjectRecord } from "./record";
import { rowRecordOf } from "./row";

// Migration 0050 (issue #525): every stored project version, published and
// draft, gets a record of page blocks in the new `page` column. This runs the
// migration file itself on an in-memory Postgres (PGlite) holding the stored
// projects, and checks each record it writes against the record it was made
// from: the same sections as blocks, in today's page order, with the same
// content, the texture and the model kept. `blocksRecordOf` must give the
// same records, so the code that reads the import and the database agree.
// The migration is additive (Owner decision, 2026-10-22, on #522): each
// row's `content` is left byte for byte, and the code from before page blocks
// (./before-blocks/, as on huey/landing-page) reads every migrated row and
// draws the same page, home card and /projects entry as it did before.

const root = join(__dirname, "..", "..");
const migration = readFileSync(join(root, "drizzle", "0050_project_page_blocks.sql"), "utf8");

const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const [cavour, ves, efesto] = legacyRecords as [LegacyVehicleRecord, LegacyVehicleRecord, LegacyProjectRecord];

/** A draft as New project stored one before blocks: the placeholder's rocket slot, no model on its card, no optional section. */
function newProjectDraft(): LegacyProjectRecord {
  const { versions: _v, launches: _l, plan: _p, reasons: _r, gallery: _g, ...rest } = cavour;
  const { rocket: _model, ...card } = rest.card;
  return {
    ...rest,
    slug: "galileo",
    name: "Galileo",
    texture: "/textures/project-efesto.webp",
    card: { ...card, status: "IN DESIGN" },
    hero: { ...rest.hero, visual: { caption: "GALILEO · IN DESIGN", rocket: {} } },
  };
}

/** Cavour with no gallery of its own and one launch holding a single photo: the migration makes a gallery of the second photos. */
function cavourWithoutGallery(): LegacyVehicleRecord {
  const { gallery: _g, ...rest } = cavour;
  const [first, second, ...others] = rest.launches!.entries;
  return { ...rest, launches: { ...rest.launches!, entries: [first, { ...second, photos: [second.photos![0]] }, ...others] } };
}

/** Each stored version: [project id, version, content]. Efesto's draft still carries the retired teaser, as a version saved before issue #377 does. */
const STORED: readonly (readonly [number, "published" | "draft", LegacyProjectRecord])[] = [
  [1, "published", cavour],
  [1, "draft", cavourWithoutGallery()],
  [2, "published", ves],
  [2, "draft", { ...ves, hero: { ...ves.hero, intro: { text: "A draft intro." } } }],
  [3, "published", efesto],
  [3, "draft", { ...efesto, teaser: firstImport[2].teaser } as unknown as LegacyProjectRecord],
  [4, "draft", newProjectDraft()],
];

const withoutTeaser = (record: LegacyProjectRecord): LegacyProjectRecord => {
  const { teaser: _retired, ...rest } = record as LegacyProjectRecord & { teaser?: string };
  return rest as LegacyProjectRecord;
};

/** The table as huey/landing-page's schema has it before the migration (db/schema/public.ts). */
const TABLE = `CREATE TABLE "project_versions" (
  "id" serial PRIMARY KEY,
  "project_id" integer NOT NULL,
  "version" text NOT NULL,
  "content" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "project_versions_project_version_unique" UNIQUE ("project_id", "version"),
  CONSTRAINT "project_versions_content_is_record" CHECK (jsonb_typeof("content") = 'object')
)`;

type Row = { id: number; project_id: number; version: string; content: unknown; content_text: string; updated_at: string; page: unknown };

let db: PGlite;
let columnsBefore: string[];
let rowsBefore: Map<number, Omit<Row, "page">>;
let rowsAfter: Map<number, Row>;
let migrated: Map<string, ProjectRecord>;

const key = (id: number, version: string) => `${id}:${version}`;

async function columns(): Promise<string[]> {
  const { rows } = await db.query<{ column_name: string }>(
    `SELECT "column_name" FROM information_schema.columns WHERE "table_name" = 'project_versions' ORDER BY "ordinal_position"`,
  );
  return rows.map((r) => r.column_name);
}

async function readRows(select: string): Promise<Map<number, Row>> {
  const { rows } = await db.query<Row>(`SELECT ${select}, "content"::text AS "content_text", "updated_at"::text AS "updated_at" FROM "project_versions" ORDER BY "id"`);
  return new Map(rows.map((r) => [r.id, r]));
}

before(async () => {
  db = new PGlite();
  await db.exec(TABLE);
  for (const [id, version, content] of STORED) {
    await db.query(`INSERT INTO "project_versions" ("project_id", "version", "content") VALUES ($1, $2, $3::jsonb)`, [id, version, JSON.stringify(content)]);
  }
  columnsBefore = await columns();
  rowsBefore = await readRows(`"id", "project_id", "version", "content"`);
  await db.exec(migration);
  rowsAfter = await readRows(`"id", "project_id", "version", "content", "page"`);
  migrated = new Map([...rowsAfter.values()].map((r) => [key(r.project_id, r.version), r.page as ProjectRecord]));
});

after(async () => {
  await db.close();
});

test("migration 0050 is journaled, so the migrator runs it", () => {
  const journal = JSON.parse(readFileSync(join(root, "drizzle", "meta", "_journal.json"), "utf8")) as { entries: { idx: number; tag: string }[] };
  const entry = journal.entries.find((e) => e.tag === "0050_project_page_blocks");
  assert.deepEqual(entry, { ...entry, idx: 50, tag: "0050_project_page_blocks" });
});

test("migration 0050 only adds the page column: every row keeps its content byte for byte", async () => {
  assert.deepEqual(await columns(), [...columnsBefore, "page"], "one column added, none dropped or renamed");
  assert.equal(rowsAfter.size, rowsBefore.size, "no row added or removed");
  for (const [id, was] of rowsBefore) {
    const now = rowsAfter.get(id)!;
    assert.equal(now.content_text, was.content_text, `row ${id}: content unchanged`);
    assert.deepEqual([now.project_id, now.version, now.updated_at], [was.project_id, was.version, was.updated_at], `row ${id}: its other columns unchanged`);
  }
});

test("migration 0050 gives every stored version a whole page record, as blocksRecordOf does, and this code reads it", () => {
  assert.equal(migrated.size, STORED.length);
  for (const [id, version, content] of STORED) {
    const record = migrated.get(key(id, version))!;
    assert.ok(isProjectRecord(record), `${content.slug} ${version} is a record`);
    assert.deepEqual(record, plain(blocksRecordOf(withoutTeaser(content))), `${content.slug} ${version}`);
  }
  for (const row of rowsAfter.values()) assert.deepEqual(rowRecordOf(row), row.page, `row ${row.id} reads its page`);
});

test("each published project keeps its sections as blocks, in today's page order, with the same content", () => {
  const kinds = (id: number) => migrated.get(key(id, "published"))!.blocks.map((b) => `${b.id}:${b.kind}`);
  assert.deepEqual(kinds(1), ["name:text", "design:text", "versions:versions", "launches:launches", "gallery:gallery"]);
  assert.deepEqual(kinds(2), ["name:text", "design:text", "versions:versions", "launches:launches", "gallery:gallery"]);
  assert.deepEqual(kinds(3), ["name:text", "design:text", "plan:timeline", "reasons:points", "gallery:gallery"]);

  for (const [id, legacy] of [[1, cavour], [2, ves], [3, efesto]] as const) {
    const record = migrated.get(key(id, "published"))!;
    const block = <B>(blockId: string) => record.blocks.find((b) => b.id === blockId) as B;
    assert.ok(record.blocks.every((b) => !b.hidden), `${legacy.slug}: every block shows`);
    const [name, design] = [block<TextBlock>("name"), block<TextBlock>("design")];
    assert.deepEqual([name.width, name.heading, name.body], ["half", { label: "THE NAME", title: legacy.nameStory.title }, legacy.nameStory.body]);
    assert.deepEqual([design.width, design.heading, design.body, design.parts], [
      "half",
      { label: "THE DESIGN", title: legacy.design.title },
      legacy.design.body,
      legacy.design.parts,
    ]);
    const strip = (b: object | undefined) => {
      if (b === undefined) return undefined;
      const { id: _id, kind: _kind, hidden: _hidden, ...section } = b as Record<string, unknown>;
      return section;
    };
    assert.deepEqual(strip(block("versions")), legacy.versions, `${legacy.slug} versions`);
    assert.deepEqual(strip(block("plan")), legacy.plan, `${legacy.slug} plan`);
    assert.deepEqual(strip(block("reasons")), legacy.reasons, `${legacy.slug} reasons`);
    const launches = block<LaunchesBlock | undefined>("launches");
    const legacyLaunches = legacy.kind === "vehicle" ? legacy.launches : undefined;
    assert.deepEqual(
      launches?.entries.map(({ cover: _c, ...launch }) => launch),
      legacyLaunches?.entries.map(({ photos: _p, ...launch }) => launch),
      `${legacy.slug} launches`,
    );
    assert.equal(launches?.title, legacyLaunches?.title);
    assert.equal(block<GalleryBlock>("gallery").title, legacy.gallery?.title);
  }
});

test("each launch keeps its first photo as cover, and every second photo ends the gallery at the end of the page", () => {
  for (const [id, legacy] of [[1, cavour], [2, ves]] as const) {
    const record = migrated.get(key(id, "published"))!;
    const launches = (record.blocks as readonly ProjectBlock[]).find((b): b is LaunchesBlock => b.kind === "launches")!;
    const entries = legacy.launches!.entries;
    assert.deepEqual(launches.entries.map((l) => l.cover), entries.map((l) => l.photos?.[0]));
    const gallery = record.blocks.at(-1) as GalleryBlock;
    assert.equal(gallery.kind, "gallery", `${legacy.slug}: the gallery is the last block`);
    const seconds = entries.flatMap((l) => (l.photos?.[1] ? [l.photos[1]] : []));
    assert.ok(seconds.length > 0);
    assert.deepEqual(gallery.items, [...legacy.gallery!.items, ...seconds], `${legacy.slug}: its gallery, then the second photos in launch order`);
  }

  const made = migrated.get(key(1, "draft"))!;
  const gallery = made.blocks.at(-1) as GalleryBlock;
  const entries = cavourWithoutGallery().launches!.entries;
  assert.deepEqual(gallery, {
    id: "gallery",
    kind: "gallery",
    hidden: false,
    title: LAUNCH_PHOTOS_GALLERY_TITLE,
    items: [entries[0].photos![1], entries[2].photos![1]],
  }, "a project with no gallery gets one at the end, holding the second photos");
  assert.equal(migrated.get(key(4, "draft"))!.blocks.some((b) => b.kind === "gallery"), false, "no photos, no gallery");
});

test("each project keeps its texture as its background and its model as its visual", () => {
  for (const [id, version, legacy] of STORED) {
    const record = migrated.get(key(id, version))!;
    assert.deepEqual(record.background, { kind: "texture", src: legacy.texture }, `${legacy.slug} ${version}`);
    const own = legacy.hero.visual?.rocket?.own;
    assert.equal(record.hero.visual.kind, legacy.hero.visual?.rocket ? "model" : "none");
    if (record.hero.visual.kind === "model") {
      assert.deepEqual(record.hero.visual.own, own);
      assert.equal(record.hero.visual.caption, legacy.hero.visual?.caption);
    }
    assert.equal(record.hero.visual.kind === "model" ? record.hero.visual.own?.model : undefined, legacy.card.rocket, `${legacy.slug} ${version}: the card's model`);
    assert.equal("rocket" in record.card, false);
    assert.equal("texture" in record, false);
  }
  assert.equal("teaser" in migrated.get(key(3, "draft"))!, false, "the page record leaves the retired key out");
});

test("the code from before page blocks reads every migrated row and draws the same page, home card and /projects entry", async () => {
  // Read as huey/landing-page reads it: its Drizzle table names only these columns.
  const trunkRows = await readRows(`"id", "project_id", "version", "content"`);
  const published: { was: beforeBlocks.ProjectRecord; now: beforeBlocks.ProjectRecord }[] = [];
  for (const [id, version, stored] of STORED) {
    const row = [...trunkRows.values()].find((r) => r.project_id === id && r.version === version)!;
    assert.equal("page" in row, false);
    const was = storedBeforeBlocks(plain(stored));
    const now = storedBeforeBlocks(row.content);
    assert.ok(was !== null, `${stored.slug} ${version}: a record before the migration`);
    assert.ok(now !== null, `${stored.slug} ${version}: still a record after it`);
    assert.deepEqual(now, was, `${stored.slug} ${version}: the same record`);
    assert.deepEqual(beforeBlocks.pageRecordOf(now), beforeBlocks.pageRecordOf(was), `${stored.slug} ${version}: its page`);
    assert.deepEqual(beforeBlocks.homeCardOf(now, id - 1), beforeBlocks.homeCardOf(was, id - 1), `${stored.slug} ${version}: its home card`);
    assert.deepEqual(beforeBlocks.landingCardOf(now, id - 1), beforeBlocks.landingCardOf(was, id - 1), `${stored.slug} ${version}: its Home card`);
    assert.deepEqual(beforeBlocks.listingOf(now, id - 1), beforeBlocks.listingOf(was, id - 1), `${stored.slug} ${version}: its /projects entry`);
    if (version === "published") published.push({ was, now });
  }
  assert.equal(published.length, 3);
  assert.deepEqual(
    beforeBlocks.listingsNewestFirst(published.map((p) => p.now)),
    beforeBlocks.listingsNewestFirst(published.map((p) => p.was)),
    "the /projects list, in its order",
  );
});

test("a row the code from before page blocks writes after the migration is read from its content, as the migration reads it", async () => {
  const written = { ...ves, hero: { ...ves.hero, intro: { text: "Saved by a deployment built before page blocks." } } };
  await db.query(`INSERT INTO "project_versions" ("project_id", "version", "content") VALUES ($1, $2, $3::jsonb)`, [5, "draft", JSON.stringify(written)]);
  const { rows } = await db.query<{ content: unknown; page: unknown }>(`SELECT "content", "page" FROM "project_versions" WHERE "project_id" = 5`);
  assert.equal(rows[0].page, null);
  assert.deepEqual(rowRecordOf(rows[0]), plain(blocksRecordOf(written)));
  await db.query(`DELETE FROM "project_versions" WHERE "project_id" = 5`);
});

test("migration 0050 run again changes nothing", async () => {
  const was = await readRows(`"id", "content", "page"`);
  await db.exec(migration);
  assert.deepEqual(await readRows(`"id", "content", "page"`), was);
});
