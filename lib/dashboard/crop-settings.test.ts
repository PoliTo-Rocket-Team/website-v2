import assert from "node:assert/strict";
import { test } from "node:test";
import { BACKGROUND_CROP_MAX_BYTES, BACKGROUND_FRAMES } from "@/lib/project-content/record";
import { PHOTO_MAX_BYTES } from "@/lib/outreach-photos";
import {
  CROP_SETTINGS,
  cutOf,
  shapeCropsOf,
  type CropResult,
  type CropsEntry,
  type CutEntry,
  type CutShape,
  type FixedShape,
  type FreeShape,
} from "./crop-settings";
import { MAX_MEMBER_PHOTO_BYTES } from "./division-members";
import { centredFrameCrop, frameIn, moveFrameCrop, zoomFrameCrop } from "./photo-crop";
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "./self";

// The crop settings (epic #964, issue #968): each place's entry keeps the
// output the place had before the shared dialog, and the dialog's maths cut
// one frame or several from inside the photo at each shape's aspect.

test("every square photo place is one 800 px square JPEG at 0.9, under its own server limit", () => {
  const limits = {
    profilePhoto: MAX_PHOTO_BYTES,
    memberPhoto: MAX_MEMBER_PHOTO_BYTES,
    alumniPhoto: MAX_PHOTO_BYTES,
    teamMemberPhoto: PHOTO_MAX_BYTES,
  } as const;
  for (const [place, maxBytes] of Object.entries(limits)) {
    const entry = CROP_SETTINGS[place as keyof typeof limits];
    assert.equal(entry.kind, "cut", place);
    assert.deepEqual(entry.output, { type: "image/jpeg", quality: 0.9 }, place);
    assert.equal(entry.maxBytes, maxBytes, place);
    assert.deepEqual(entry.accept, PHOTO_TYPES, place);
    assert.equal(entry.shapes.length, 1, place);
    assert.deepEqual([entry.shapes[0].aspect, entry.shapes[0].size], [{ width: 1, height: 1 }, { width: 800, height: 800 }], place);
  }
});

test("a project background is Tall 9:16 and Wide 2:1 JPEG files at the presets' sizes, under the crop limit", () => {
  const entry = CROP_SETTINGS.projectBackground;
  assert.equal(entry.kind, "cut");
  assert.deepEqual(entry.output, { type: "image/jpeg", quality: 0.86 });
  assert.equal(entry.maxBytes, BACKGROUND_CROP_MAX_BYTES);
  assert.deepEqual(
    entry.shapes.map((s) => [s.name, s.size]),
    [["tall", BACKGROUND_FRAMES.tall], ["wide", BACKGROUND_FRAMES.wide]],
  );
  for (const shape of entry.shapes) assert.equal(shape.aspect.width / shape.aspect.height, shape.size.width / shape.size.height, shape.name);
});

test("one shape: a square photo cuts to at most 800 px, smaller only when the photo gives fewer pixels", () => {
  const [shape] = CROP_SETTINGS.profilePhoto.shapes;
  const frame = frameIn(shape.aspect, { width: 280, height: 280 });
  assert.deepEqual(frame, { width: 280, height: 280 });
  const big = cutOf(shape, centredFrameCrop(4000, 3000, frame.width, frame.height));
  assert.deepEqual([big.sx, big.sy, big.sw, big.sh, big.width, big.height].map(Math.round), [500, 0, 3000, 3000, 800, 800]);
  const zoomed = cutOf(shape, zoomFrameCrop(centredFrameCrop(1000, 600, 280, 280), 3));
  assert.deepEqual([zoomed.width, zoomed.height], [200, 200]);
});

test("two shapes: each background frame cuts inside the photo at its own aspect, through any drag and zoom", () => {
  for (const [width, height] of [[4000, 3000], [1080, 1920], [800, 800]]) {
    for (const shape of CROP_SETTINGS.projectBackground.shapes) {
      const frame = frameIn(shape.aspect, { width: 624, height: 412 });
      let crop = centredFrameCrop(width, height, frame.width, frame.height);
      for (const [dx, dy, zoom] of [[0, 0, 1], [-9999, 0, 1], [9999, 9999, 3], [-50, 30, 1.7]]) {
        crop = zoomFrameCrop(moveFrameCrop(crop, dx, dy), zoom);
        const cut = cutOf(shape, crop);
        const label = `${shape.name} over ${width}x${height} after ${dx},${dy} at ${zoom}`;
        assert.ok(Math.abs(cut.sw / cut.sh - shape.aspect.width / shape.aspect.height) < 0.02, label);
        assert.ok(cut.sx >= 0 && cut.sy >= 0 && cut.sx + cut.sw <= width + 1e-9 && cut.sy + cut.sh <= height + 1e-9, label);
        assert.ok(cut.width <= shape.size.width && Math.abs(cut.width / cut.height - shape.size.width / shape.size.height) < 0.01, label);
      }
    }
  }
});

test("two shapes kept as crops: only the shapes the editor set carry a crop, in fractions of the photo", () => {
  const card: FixedShape<"card"> = { kind: "fixed", name: "card", label: "Card", use: "Home", aspect: { width: 3, height: 2 } };
  // The card frame is 3:2 (300x200); the page frame is 9:5 (360x200) and is left centred.
  const frames = {
    card: moveFrameCrop(zoomFrameCrop(centredFrameCrop(4000, 2000, 300, 200), 2), -9999, -9999),
    page: centredFrameCrop(4000, 2000, 360, 200),
  };
  const crops = shapeCropsOf<"card" | "page">(frames, new Set(["card"]));
  assert.deepEqual(Object.keys(crops), ["card"]);
  const { x, y, width, height } = crops.card!;
  assert.ok(Math.abs(x + width - 1) < 1e-9 && Math.abs(y + height - 1) < 1e-9, "dragged to the bottom right corner");
  assert.ok(Math.abs((width * 4000) / (height * 2000) - card.aspect.width / card.aspect.height) < 1e-9);
});

// The types refuse the three entries the settings model rules out, and the
// dialog's result names each frame's file. `tsc` checks these lines; a line
// that stopped failing would fail its `@ts-expect-error`.
const square: CutShape<"square"> = { kind: "fixed", name: "square", label: "Square", use: "Photo", aspect: { width: 1, height: 1 }, size: { width: 800, height: 800 } };
const free: FreeShape<"logo"> = { kind: "free", name: "logo", label: "Logo", use: "Partners", maxSide: 1200 };
const base = { words: { title: "Crop", confirm: "Save" }, accept: ["image/png"], maxBytes: 1 } as const;
export const typeChecks = [
  // @ts-expect-error an entry needs at least one shape
  { ...base, kind: "cut", output: { type: "image/jpeg", quality: 0.9 }, shapes: [] } satisfies CutEntry,
  // @ts-expect-error a free frame is never cut to a JPEG
  { ...base, kind: "cut", output: { type: "image/jpeg", quality: 0.9 }, shapes: [free] } satisfies CutEntry,
  // @ts-expect-error a crop-per-shape entry has no free shape
  { ...base, kind: "crops", output: { type: "image/png" }, shapes: [free] } satisfies CropsEntry,
  { ...base, kind: "cut", output: { type: "image/png" }, shapes: [free, square] } satisfies CutEntry,
];
export const resultChecks = (background: CropResult<typeof CROP_SETTINGS.projectBackground>, photo: CropResult<typeof CROP_SETTINGS.memberPhoto>): File[] => [
  background.files.tall,
  background.files.wide,
  photo.files.square,
  // @ts-expect-error a background has no square file
  background.files.square,
];
