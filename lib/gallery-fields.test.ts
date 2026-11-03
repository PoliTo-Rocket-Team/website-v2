import assert from "node:assert/strict";
import { test } from "node:test";
import { readGalleryFields, type GalleryFields } from "./gallery-fields";

// A gallery as the panel sends it (issue #969): a photo's crops for the
// carousel's shapes come back as sent, a photo with none reads as before,
// and a malformed crop, or a crop on a slot with no photo, refuses the gallery.

const photo = { src: "/project-photos/one.webp", alt: "", caption: "" };
const crops = { phone: { x: 0.1, y: 0, width: 0.8, height: 1 }, desktop: { x: 0, y: 0.05, width: 1, height: 0.9 } };

test("a gallery's crops read back as sent, and a photo with none reads as before", () => {
  const gallery: GalleryFields = { title: "Launch day", items: [{ ...photo, crops }, photo, { src: null, alt: "", caption: "" }] };
  assert.deepEqual(readGalleryFields(JSON.parse(JSON.stringify(gallery))), gallery);
});

test("a malformed crop, or a crop on an empty slot, refuses the gallery", () => {
  for (const item of [
    { ...photo, crops: { phone: { x: 0.5, y: 0, width: 0.8, height: 1 } } },
    { ...photo, crops: { square: crops.phone } },
    { ...photo, crops: [crops.phone] },
    { src: null, alt: "", caption: "", crops },
  ]) {
    assert.equal(readGalleryFields({ title: "", items: [item] }), null, JSON.stringify(item));
  }
});
