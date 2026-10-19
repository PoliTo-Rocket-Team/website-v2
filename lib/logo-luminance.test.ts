import assert from "node:assert/strict";
import { test } from "node:test";
import { deflateSync } from "node:zlib";
import { DARK_LOGO_THRESHOLD, measureLogo } from "./logo-luminance";

// The logo measurement (issues #107 and #394) over small PNGs built here:
// how bright the opaque pixels read, and whether the logo sits on a box.

type Rgba = readonly [number, number, number, number];

/** An 8-bit RGBA PNG whose pixel at (x, y) is `paint(x, y)`. */
function png(width: number, height: number, paint: (x: number, y: number) => Rgba): Uint8Array {
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, body, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const rows = Array.from({ length: height }, (_, y) =>
    Buffer.from([0, ...Array.from({ length: width }, (_, x) => paint(x, y)).flat()]),
  );
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(Buffer.concat(rows))),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const CLEAR: Rgba = [0, 0, 0, 0];
const WHITE: Rgba = [255, 255, 255, 255];
const NAVY: Rgba = [20, 20, 60, 255];

/** A navy square in the middle of a 12 x 8 image, on `ground` everywhere else. */
const markOn = (ground: Rgba) => png(12, 8, (x, y) => (x >= 3 && x < 9 && y >= 2 && y < 6 ? NAVY : ground));

test("a logo on transparency has no solid background, and its padding does not darken it", () => {
  const logo = measureLogo(markOn(CLEAR));
  assert.equal(logo.solidBackground, false);
  assert.equal(logo.dark, true);
  // Only the navy pixels count: the same as a logo that is navy all over.
  assert.ok(Math.abs(logo.luminance - measureLogo(png(4, 4, () => NAVY)).luminance) < 1e-12);
  assert.deepEqual([logo.width, logo.height], [12, 8]);
});

test("a logo exported on a white box has a solid background, and the box counts toward its luminance", () => {
  const logo = measureLogo(markOn(WHITE));
  assert.equal(logo.solidBackground, true);
  assert.equal(logo.dark, false);
  assert.ok(logo.luminance > DARK_LOGO_THRESHOLD);
});

test("a box with slight noise is still one colour; a border of two colours is not", () => {
  const noisy = png(12, 8, (x, y) => ((x + y) % 2 === 0 ? [250, 248, 252, 255] : [238, 240, 236, 255]));
  assert.equal(measureLogo(noisy).solidBackground, true);
  const split = png(12, 8, (x) => (x < 6 ? WHITE : NAVY));
  assert.equal(measureLogo(split).solidBackground, false);
});

test("a mark that touches the edge in one spot still reads its box", () => {
  const touching = png(12, 8, (x, y) => (x === 5 && y === 0 ? NAVY : WHITE));
  assert.equal(measureLogo(touching).solidBackground, true);
});

test("a fully transparent logo is refused by name", () => {
  assert.throws(() => measureLogo(png(4, 4, () => CLEAR)), /fully transparent/);
});
