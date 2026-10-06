import { preload } from "react-dom";

// The files every Cavour canvas loads: the hero's and each project card's.
// This module imports no three.js, so the hero can name them in the HTML
// without pulling the 3D code into the first bundle.
// Poly Haven's studio_small_03 (CC0), halved to 512x256. Every Cavour
// surface is rough (0.6 to 0.72), and three's environment map serves
// roughness above 0.4 from its small blurred levels only, which come out the
// same from either size: the card renders differ by at most 5/255 in any
// pixel (issue #45). The file is 0.52 MB of flat RGBE; the host serves it
// Brotli-compressed at 0.39 MB (measured on the preview, issue #53). Run-length
// encoding it would not help: Brotli at its best packs the flat and the
// run-length file to the same 0.31 MB.
export const CAVOUR_HDRI = "/design/hdri/studio_small_03.hdr";
export const CAVOUR_LIVERY = "/design/cavour/livery.png";
export const CAVOUR_DECAL = "/design/cavour/decal-strip.png";

/**
 * A project card's rocket as a still: the card canvas's finished frame
 * (rocket-card-3d.tsx: same camera, pose, livery, lights and HDRI), rendered
 * at 720 x 1572 for a 480 x 1048 box, with a transparent background. The
 * camera's field of view is vertical and centred, so on any box no wider
 * than 480 x 1048 (every card box is), `object-fit: cover` crops it exactly
 * as the canvas crops the scene. Re-render it with
 * `node scripts/render-card-poster.mjs` whenever the card scene changes.
 */
export const CAVOUR_CARD_POSTER = "/design/cavour/card-poster.png";

/**
 * Starts the downloads from the HTML head, while the page is still parsing,
 * instead of after the 3D chunk has loaded and run. Low priority, so the
 * text, fonts and layout always go first; the canvases pick the files up
 * from the browser's cache when they ask for them.
 *
 * The request modes match the loaders exactly, or the browser fetches twice:
 * three's FileLoader uses `fetch` (CORS mode, same-origin credentials), and
 * its TextureLoader sets `crossOrigin = "anonymous"` on the image.
 */
export function preloadCavourAssets() {
  preload(CAVOUR_HDRI, { as: "fetch", crossOrigin: "anonymous", fetchPriority: "low" });
  for (const src of [CAVOUR_LIVERY, CAVOUR_DECAL]) {
    preload(src, { as: "image", crossOrigin: "anonymous", fetchPriority: "low" });
  }
}
