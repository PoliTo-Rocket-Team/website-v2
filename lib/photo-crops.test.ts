import assert from "node:assert/strict";
import { test } from "node:test";
import { GALLERY_PHOTO, placedRect, placementOf, POST_PHOTO, readShapeCrops, type ShapeCrop } from "./photo-crops";

// A photo stored once with a crop per shape (epic #964, issue #969): how a
// stored `crops` key reads back, and where the photo sits in a box of the
// crop's shape, in a box whose shape moves with the page, and with no crop.

/** A 3000 x 2000 photo's right half, framed for the post page's 9:5 laptop shape: 1500 x 833⅓ pixels. */
const rightHalf: ShapeCrop = { x: 0.5, y: 0.25, width: 0.5, height: 1250 / 3000 };

test("a stored photo's crops read back when well formed, as none when absent, and refuse it when malformed", () => {
  assert.equal(readShapeCrops(undefined, POST_PHOTO), undefined);
  assert.deepEqual(readShapeCrops({}, POST_PHOTO), {});
  assert.deepEqual(readShapeCrops({ desktop: rightHalf }, POST_PHOTO), { desktop: rightHalf });
  for (const malformed of [
    null,
    "centre",
    [rightHalf],
    { wide: rightHalf },
    { desktop: { ...rightHalf, x: -0.1 } },
    { desktop: { ...rightHalf, width: 0 } },
    { desktop: { ...rightHalf, x: 0.6 } },
    { desktop: { ...rightHalf, height: "0.4" } },
    { desktop: null },
  ]) {
    assert.equal(readShapeCrops(malformed, POST_PHOTO), null, JSON.stringify(malformed));
  }
  // Each place reads its own shapes' names.
  assert.deepEqual(readShapeCrops({ phone: rightHalf }, GALLERY_PHOTO), { phone: rightHalf });
});

test("a box of the crop's shape shows exactly the crop", () => {
  const placement = placementOf(POST_PHOTO, { desktop: rightHalf }, { shape: "desktop", box: "exact" });
  assert.deepEqual(placement, { kind: "crop", crop: rightHalf });
  // A 900 x 500 box: the photo is drawn twice its width, its right half from the box's left edge.
  const rect = placedRect(placement!, { width: 900, height: 500 });
  assert.equal(rect.width, 1800);
  assert.ok(Math.abs(rect.height - 1200) < 1e-9);
  assert.equal(rect.left, -900);
  assert.ok(Math.abs(rect.top + 300) < 1e-9);
});

test("a box whose shape moves with the page keeps the crop's centre, the photo still covering it", () => {
  const placement = placementOf(POST_PHOTO, { desktop: rightHalf }, { shape: "desktop", box: "fluid" });
  assert.ok(placement !== null && placement.kind === "centre");
  assert.ok(Math.abs(placement.aspect - 1.5) < 1e-9, "the photo's own 3:2");
  assert.equal(placement.x, 0.75);
  // A 600 x 200 box: the photo covers it at 600 x 400, moved up so the crop's centre sits at the box's middle.
  const wide = placedRect(placement, { width: 600, height: 200 });
  assert.deepEqual({ ...wide, top: Math.round(wide.top * 1000) / 1000 }, { left: 0, top: -83.333, width: 600, height: 400 });
  // A square box: the photo covers it at 450 x 300, slid left only as far as its right edge allows.
  assert.deepEqual(placedRect(placement, { width: 300, height: 300 }), { left: -150, top: 0, width: 450, height: 300 });
});

test("a photo with no crop is today's centred cover, and a shape left unset is centred", () => {
  assert.equal(placementOf(POST_PHOTO, undefined, { shape: "phone", box: "exact" }), null);
  assert.equal(placementOf(POST_PHOTO, {}, { shape: "phone", box: "exact" }), null);
  const unset = placementOf(POST_PHOTO, { desktop: rightHalf }, { shape: "phone", box: "exact" });
  assert.ok(unset !== null && unset.kind === "centre");
  assert.deepEqual([unset.x, unset.y], [0.5, 0.5]);
  assert.deepEqual(placedRect(unset, { width: 300, height: 200 }), { left: 0, top: 0, width: 300, height: 200 });
});
