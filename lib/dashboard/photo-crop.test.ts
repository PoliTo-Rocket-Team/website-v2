import assert from "node:assert/strict";
import { test } from "node:test";
import { centredCrop, moveCrop, sourceSquare, zoomCrop, ZOOM_MAX, type Crop } from "./photo-crop";

// The crop dialog (board 55a, issue #169): whatever the person does, the saved
// photo is a square cut from inside the photo.

function assertSquareInside(crop: Crop, label: string) {
  const { sx, sy, side } = sourceSquare(crop);
  assert.ok(side > 0, label);
  assert.ok(sx >= 0 && sy >= 0, label);
  assert.ok(sx + side <= crop.width + 1e-9 && sy + side <= crop.height + 1e-9, label);
}

test("the saved square stays inside the photo through any drag and zoom", () => {
  for (const [width, height] of [[4000, 3000], [1080, 1920], [800, 800]]) {
    let crop = centredCrop(width, height, 280);
    assertSquareInside(crop, `centred ${width}x${height}`);
    for (const [dx, dy, zoom] of [[-9999, 0, 1], [9999, 9999, ZOOM_MAX], [-50, 30, 1.7], [0, -9999, 9], [120, -40, 0.2]]) {
      crop = zoomCrop(moveCrop(crop, dx, dy), zoom);
      assertSquareInside(crop, `${width}x${height} after ${dx},${dy} at ${zoom}`);
    }
  }
});

test("at zoom 1 the square is the photo's short side, centred; zooming in cuts a smaller square", () => {
  const crop = centredCrop(4000, 3000, 280);
  const { sx, sy, side } = sourceSquare(crop);
  assert.deepEqual([Math.round(sx), Math.round(sy), Math.round(side)], [500, 0, 3000]);
  assert.ok(sourceSquare(zoomCrop(crop, 2)).side < 3000);
});
