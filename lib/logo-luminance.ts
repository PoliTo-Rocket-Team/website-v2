import { inflateSync } from "node:zlib";
import { brand } from "./brand-colors";

// How bright a partner logo reads on the dark page, measured from its PNG.
// `pnpm logos:check` (scripts/logos-check.ts) runs it over every logo in
// lib/partners.ts; the dashboard can run the same check on upload. It reads
// the file with Node's own zlib, so it needs no image package (issue #107:
// no new library).
//
// The measure is the alpha-weighted mean of each pixel's relative luminance
// (sRGB decoded to linear light, Rec. 709 weights), 0 for black and 1 for
// white. Transparent pixels count for nothing, so a logo's padding does not
// pull it toward black.

/** The contrast a logo needs against the page: WCAG 2.2's 3:1 for graphics (SC 1.4.11). */
const MIN_CONTRAST = 3;

/**
 * Under this luminance a logo's contrast against `ground` falls below 3:1, so
 * it is too dark to read and is drawn white (`darkLogo`). About 0.109 for
 * #0A0A0A. WCAG contrast is (L1 + 0.05) / (L2 + 0.05).
 */
export const DARK_LOGO_THRESHOLD = MIN_CONTRAST * (hexLuminance(brand.ground) + 0.05) - 0.05;

export type LogoLuminance = { luminance: number; dark: boolean };

export function measureLogo(png: Uint8Array): LogoLuminance {
  const luminance = alphaWeightedLuminance(decodePng(png));
  return { luminance, dark: luminance < DARK_LOGO_THRESHOLD };
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function hexLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return relativeLuminance((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

/** RGBA, 8 bits a channel, row after row. */
type Pixels = { width: number; height: number; rgba: Uint8Array };

function alphaWeightedLuminance({ rgba }: Pixels): number {
  let weighted = 0;
  let alpha = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3] / 255;
    if (a === 0) continue;
    weighted += a * relativeLuminance(rgba[i], rgba[i + 1], rgba[i + 2]);
    alpha += a;
  }
  if (alpha === 0) throw new Error("the logo is fully transparent");
  return weighted / alpha;
}

function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Channels per pixel for each PNG colour type. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/**
 * Decodes an 8-bit, non-interlaced PNG of any colour type to RGBA. Anything
 * else (16-bit, low bit depths, Adam7) is refused by name rather than misread:
 * re-export the logo as an 8-bit PNG.
 */
export function decodePng(png: Uint8Array): Pixels {
  const buf = Buffer.from(png.buffer, png.byteOffset, png.byteLength);
  if (!SIGNATURE.every((b, i) => buf[i] === b)) throw new Error("not a PNG file");

  let width = 0;
  let height = 0;
  let colorType = -1;
  let palette: Buffer | undefined;
  let transparency: Buffer | undefined;
  const data: Buffer[] = [];

  for (let at = 8; at < buf.length; ) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const bitDepth = body[8];
      colorType = body[9];
      if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} is not supported; re-export as 8-bit`);
      if (body[12] !== 0) throw new Error("interlaced PNGs are not supported; re-export without interlacing");
      if (CHANNELS[colorType] === undefined) throw new Error(`unknown PNG colour type ${colorType}`);
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") transparency = body;
    else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
    at += 12 + length;
  }

  const channels = CHANNELS[colorType];
  const stride = width * channels;
  const raw = unfilter(inflateSync(Buffer.concat(data)), stride, height, channels);
  const rgba = new Uint8Array(width * height * 4);

  for (let p = 0; p < width * height; p++) {
    const s = p * channels;
    const d = p * 4;
    switch (colorType) {
      case 0: // grey
        rgba.set([raw[s], raw[s], raw[s], 255], d);
        break;
      case 2: // RGB
        rgba.set([raw[s], raw[s + 1], raw[s + 2], 255], d);
        break;
      case 3: {
        // palette
        if (palette === undefined) throw new Error("palette PNG has no PLTE chunk");
        const i = raw[s];
        rgba.set([palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2], transparency?.[i] ?? 255], d);
        break;
      }
      case 4: // grey and alpha
        rgba.set([raw[s], raw[s], raw[s], raw[s + 1]], d);
        break;
      case 6: // RGBA
        rgba.set(raw.subarray(s, s + 4), d);
        break;
    }
  }
  return { width, height, rgba };
}

/** Undoes the PNG per-row filters (PNG spec, section 9). */
function unfilter(data: Buffer, stride: number, height: number, bpp: number): Uint8Array {
  const out = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = data[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[row + x - bpp] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= bpp && y > 0 ? out[prev + x - bpp] : 0;
      const v = data[src + x];
      switch (filter) {
        case 0:
          out[row + x] = v;
          break;
        case 1:
          out[row + x] = v + a;
          break;
        case 2:
          out[row + x] = v + b;
          break;
        case 3:
          out[row + x] = v + ((a + b) >> 1);
          break;
        case 4: {
          const pa = Math.abs(b - c);
          const pb = Math.abs(a - c);
          const pc = Math.abs(a + b - 2 * c);
          out[row + x] = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
    }
  }
  return out;
}
