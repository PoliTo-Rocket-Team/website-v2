import assert from "node:assert/strict";
import { test } from "node:test";
import {
  centredCrop,
  centredFrameCrop,
  FREE_HANDLES,
  FREE_MIN_SIDE,
  freeSourceRect,
  moveCrop,
  moveFrameCrop,
  moveFreeCrop,
  resizeFreeCrop,
  sourceRect,
  sourceSquare,
  wholeFreeCrop,
  zoomCrop,
  zoomFrameCrop,
  ZOOM_MAX,
  type Crop,
} from "./photo-crop";

// A free frame (issue #971): a partner logo's frame resizes by any edge or
// corner and moves, and whatever the editor does it stays inside the logo.

test("a free frame opens round the whole photo, and its source rectangle is all of it", () => {
  assert.deepEqual(freeSourceRect(wholeFreeCrop(1200, 400)), { sx: 0, sy: 0, sw: 1200, sh: 400 });
});

test("a handle moves only the edges it holds, and stops at the photo's edge and at the smallest side", () => {
  const crop = wholeFreeCrop(1000, 500);
  // The left edge in by 100; a sideways handle leaves the top alone.
  assert.deepEqual(freeSourceRect(resizeFreeCrop(crop, "w", 100, 80)), { sx: 100, sy: 0, sw: 900, sh: 500 });
  // A corner moves both its edges; the opposite corner stays put.
  assert.deepEqual(freeSourceRect(resizeFreeCrop(crop, "se", -300, -100)), { sx: 0, sy: 0, sw: 700, sh: 400 });
  // Pulled past the photo, the edge stops on it.
  assert.deepEqual(freeSourceRect(resizeFreeCrop(resizeFreeCrop(crop, "n", 0, 200), "n", 0, -9999)), { sx: 0, sy: 0, sw: 1000, sh: 500 });
  // Pulled past the opposite edge, the frame keeps its smallest side.
  assert.deepEqual(freeSourceRect(resizeFreeCrop(crop, "e", -9999, 0)), { sx: 0, sy: 0, sw: FREE_MIN_SIDE, sh: 500 });
  // A photo smaller than the smallest side keeps its own.
  assert.deepEqual(freeSourceRect(resizeFreeCrop(wholeFreeCrop(10, 10), "nw", 50, 50)), { sx: 0, sy: 0, sw: 10, sh: 10 });
});

test("a free frame stays inside the photo, in whole pixels, through any resize and move", () => {
  let crop = wholeFreeCrop(640, 480);
  for (const [i, [dx, dy]] of [[120, 90], [-9999, 30], [9999, -9999], [-45, 9999], [33.3, -12.7], [7, 7], [-500, 500], [0.4, 0.6]].entries()) {
    crop = moveFreeCrop(resizeFreeCrop(crop, FREE_HANDLES[i], dx, dy), -dy, dx);
    const { sx, sy, sw, sh } = freeSourceRect(crop);
    const label = `${FREE_HANDLES[i]} by ${dx},${dy}`;
    assert.ok(sw >= FREE_MIN_SIDE && sh >= FREE_MIN_SIDE, label);
    assert.ok(sx >= 0 && sy >= 0 && sx + sw <= 640 && sy + sh <= 480, label);
    assert.ok([sx, sy, sw, sh].every(Number.isInteger), label);
  }
  // A move keeps the frame's size and stops at the edge.
  const small = resizeFreeCrop(wholeFreeCrop(640, 480), "se", -440, -380);
  assert.deepEqual(freeSourceRect(moveFreeCrop(small, 9999, 9999)), { sx: 440, sy: 380, sw: 200, sh: 100 });
});

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
