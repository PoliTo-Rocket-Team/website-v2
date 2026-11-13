import assert from "node:assert/strict";
import { test } from "node:test";
import type { ShapeCrop } from "@/lib/photo-crops";
import type { Photo } from "@/lib/project-pages/types";
import { blankBlock, type BlockFields } from "./block-fields";
import { isProjectRecord } from "./check";
import { fieldsOf, projectViewOf, readProjectFields, type ProjectFields } from "./fields";
import { importedRecords } from "./import";
import { pageRecordOf, type ProjectRecord } from "./record";

// A project's photos with a crop per shape (issue #970): the top's photo
// panel, a Photo block, a launch's cover and a gallery photo go from the
// panel through a save into the page record with their crops, and a photo
// with none goes as it did before crops. A malformed crop refuses the request
// and the stored record alike.

const [cavour] = importedRecords;
const PHOTO = "/project-photos/cavour/euroc-2023-team.webp" as Photo["src"];
const LEFT: ShapeCrop = { x: 0, y: 0.1, width: 0.5, height: 0.6 };
const RIGHT: ShapeCrop = { x: 0.4, y: 0, width: 0.6, height: 0.9 };
const CROPS = { phone: LEFT, desktop: RIGHT };
/** The phone shape framed, the laptop one left centred. */
const PHONE_ONLY = { phone: LEFT };

type Crops = { phone?: ShapeCrop; desktop?: ShapeCrop } | undefined;

/** Cavour's fields with a photo on top, a Photo block, and `crops` (none when undefined) on every project photo. */
function withPhotos(crops: Crops): ProjectFields {
  const fields = fieldsOf(cavour);
  const photo = { src: PHOTO, alt: " The team ", ...(crops && { crops }) };
  const blocks = fields.blocks.map((block): BlockFields => {
    if (block.kind === "launches") return { ...block, items: block.items.map((launch) => ({ ...launch, photos: [photo] })) };
    if (block.kind === "gallery") return { ...block, items: block.items.map((item) => ({ ...item, src: PHOTO, ...(crops && { crops }) })) };
    return block;
  });
  return {
    ...fields,
    hero: { ...fields.hero, visual: { kind: "photo", photo }, caption: "EUROC" },
    blocks: [...blocks, { ...blankBlock("photo", "photo-1"), photo, caption: "On the pad" }],
  };
}

/** Every project photo of a stored record, in page order: the top's, each launch's cover, each gallery photo, each Photo block's. */
type AnyPhoto = { readonly src: string; readonly crops?: unknown };

function photosOf(record: ProjectRecord): AnyPhoto[] {
  const top: AnyPhoto[] = record.hero.visual.kind === "photo" ? [record.hero.visual.photo] : [];
  return [
    ...top,
    ...(record.blocks as readonly ProjectRecord["blocks"][number][]).flatMap((block): AnyPhoto[] => {
      if (block.kind === "launches") return block.entries.flatMap((launch) => (launch.cover ? [launch.cover] : []));
      if (block.kind === "gallery") return block.items.flatMap((item) => ("src" in item ? [item] : []));
      if (block.kind === "photo") return [block.photo];
      return [];
    }),
  ];
}

/** The fields as the browser sends them, read back, and the record a save stores. */
const saved = (fields: ProjectFields) => {
  const sent = readProjectFields(JSON.parse(JSON.stringify(fields)));
  assert.ok(sent !== null, "the request reads");
  return projectViewOf(sent, cavour);
};

test("a project photo's crops go from the panel through a save into the page record, and open again in the panel", () => {
  for (const crops of [CROPS, PHONE_ONLY]) {
    const record = saved(withPhotos(crops));
    const photos = photosOf(record);
    assert.ok(photos.length >= 4, "the top's photo, launch covers, gallery photos and the Photo block");
    for (const photo of photos) assert.deepEqual(photo.crops, crops);
    assert.ok(isProjectRecord(record), "the stored record passes its check");
    assert.deepEqual(photosOf(saved(fieldsOf(record))), photos, "reopened and saved again, every crop is kept");
    const page = pageRecordOf(record);
    assert.ok(page.hero.visual.kind === "photo");
    assert.deepEqual(page.hero.visual.photo.crops, crops, "the page draws with them");
  }
});

test("a project photo with no crops is stored as before crops: no crops key, and the page record unchanged", () => {
  const record = saved(withPhotos(undefined));
  for (const photo of photosOf(record)) assert.ok(!("crops" in photo), photo.src);
  assert.ok(isProjectRecord(record));
  // A project saved before crops opens and saves back as it was.
  assert.deepEqual(saved(fieldsOf(cavour)), cavour);
});

test("a malformed crop refuses the request and the stored record", () => {
  const malformed: unknown[] = [{ square: LEFT }, { phone: { ...LEFT, x: 0.8 } }, { desktop: { ...RIGHT, width: 0 } }, [LEFT], "centre"];
  for (const crops of malformed) {
    const fields = withPhotos(undefined);
    const bad = { ...fields, hero: { ...fields.hero, visual: { kind: "photo" as const, photo: { src: PHOTO, alt: "", crops } } } };
    assert.equal(readProjectFields(JSON.parse(JSON.stringify(bad))), null, `top: ${JSON.stringify(crops)}`);
    const block = { ...fields, blocks: [{ ...blankBlock("photo", "photo-1"), photo: { src: PHOTO, alt: "", crops }, caption: "" }] };
    assert.equal(readProjectFields(JSON.parse(JSON.stringify(block))), null, `Photo block: ${JSON.stringify(crops)}`);
  }
  const good = saved(withPhotos(CROPS));
  for (const crops of malformed) {
    const record = JSON.parse(JSON.stringify(good)) as { blocks: { kind: string; photo?: { crops?: unknown } }[] };
    for (const block of record.blocks) if (block.kind === "photo" && block.photo) block.photo.crops = crops;
    assert.equal(isProjectRecord(record), false, JSON.stringify(crops));
  }
});
