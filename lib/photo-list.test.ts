import assert from "node:assert/strict";
import { test } from "node:test";
import { describePhoto, movePhoto, neighbourOf, pickedPhoto, removePhoto, reorderPhotos } from "./photo-list";

// The description box of a panel's photo list (issue #430): each photo keeps
// the description typed for it, whichever photo the arrows pick next, and a
// move or a drag takes the description along with its photo.

const a = { src: "/outreach/a.webp", alt: "" };
const b = { src: "/outreach/b.webp", alt: "" };
const c = { src: "/outreach/c.webp", alt: "" };

test("switching photos with the arrows keeps each photo's own description", () => {
  let photos = [a, b, c];
  let picked: string | null = a.src;

  photos = describePhoto(photos, picked, "The team at the stand");
  picked = neighbourOf(photos, picked, 1);
  assert.equal(picked, b.src);
  assert.equal(pickedPhoto(photos, picked)?.photo.alt, "", "the next photo shows its own, still empty, description");

  photos = describePhoto(photos, picked!, "A rocket on the rail");
  picked = neighbourOf(photos, picked, -1);
  assert.deepEqual(pickedPhoto(photos, picked), { photo: { ...a, alt: "The team at the stand" }, index: 0 });
  assert.deepEqual(
    photos.map((p) => p.alt),
    ["The team at the stand", "A rocket on the rail", ""],
    "no text moved to another photo and none was lost",
  );

  // The arrows stop at either end.
  assert.equal(neighbourOf(photos, a.src, -1), null);
  assert.equal(neighbourOf(photos, c.src, 1), null);
});

test("moving, dragging and removing a photo take its description with it", () => {
  const described = [
    { ...a, alt: "first" },
    { ...b, alt: "second" },
    { ...c, alt: "third" },
  ];
  const moved = movePhoto(described, a.src, 1);
  assert.deepEqual(moved.map((p) => [p.src, p.alt]), [[b.src, "second"], [a.src, "first"], [c.src, "third"]]);
  assert.deepEqual(pickedPhoto(moved, a.src)?.index, 1, "the picked photo stays picked at its new place");

  // A photo that landed while another was dragged keeps its place after them.
  const landed = { src: "/outreach/d.webp", alt: "fourth" };
  const dragged = reorderPhotos([...described, landed], [c.src, a.src, b.src]);
  assert.deepEqual(dragged.map((p) => p.alt), ["third", "first", "second", "fourth"]);

  const left = removePhoto(described, b.src);
  assert.deepEqual(left.map((p) => p.alt), ["first", "third"]);
  assert.equal(pickedPhoto(left, b.src), null, "a removed photo is no longer picked");
});
