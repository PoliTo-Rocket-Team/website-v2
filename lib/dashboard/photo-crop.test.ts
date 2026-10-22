import assert from "node:assert/strict";
import { test } from "node:test";
import { centredCrop, centredFrameCrop, moveCrop, moveFrameCrop, sourceRect, sourceSquare, zoomCrop, zoomFrameCrop, ZOOM_MAX, type Crop } from "./photo-crop";

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

test("a background's Tall and Wide cuts keep their frame's shape and stay inside the photo through any drag and zoom (board 93f)", () => {
  for (const [frameWidth, frameHeight] of [[232, 412], [624, 312]]) {
    for (const [width, height] of [[4000, 3000], [1080, 1920], [800, 800]]) {
      let crop = centredFrameCrop(width, height, frameWidth, frameHeight);
      for (const [dx, dy, zoom] of [[0, 0, 1], [-9999, 0, 1], [9999, 9999, ZOOM_MAX], [-50, 30, 1.7], [0, -9999, 9], [120, -40, 0.2]]) {
        crop = zoomFrameCrop(moveFrameCrop(crop, dx, dy), zoom);
        const { sx, sy, sw, sh } = sourceRect(crop);
        const label = `${frameWidth}x${frameHeight} frame over ${width}x${height} after ${dx},${dy} at ${zoom}`;
        assert.ok(Math.abs(sw / sh - frameWidth / frameHeight) < 1e-6, label);
        assert.ok(sx >= 0 && sy >= 0 && sx + sw <= width + 1e-9 && sy + sh <= height + 1e-9, label);
      }
    }
  }
});

test("at zoom 1 the square is the photo's short side, centred; zooming in cuts a smaller square", () => {
  const crop = centredCrop(4000, 3000, 280);
  const { sx, sy, side } = sourceSquare(crop);
  assert.deepEqual([Math.round(sx), Math.round(sy), Math.round(side)], [500, 0, 3000]);
  assert.ok(sourceSquare(zoomCrop(crop, 2)).side < 3000);
});
