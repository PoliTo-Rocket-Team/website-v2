// The stills that stand in for VES Mark I's canvas (rocket-ves.tsx). The
// model itself loads no file: its livery is drawn in code and it shares
// Cavour's HDRI (cavour-assets.ts). This module imports no three.js, so pages
// can name the stills in their first bundle.

/**
 * A project card's VES rocket as a still: the card canvas's finished frame,
 * as CAVOUR_CARD_POSTER is for Cavour (same box, camera and scene).
 * Re-render it with `node scripts/render-card-poster.mjs ves` whenever the
 * card scene or the VES model changes.
 */
export const VES_CARD_POSTER = "/design/ves/card-poster.png";

/**
 * The /projects/ves hero panel's rocket as a still, as CAVOUR_STAGE_POSTER is
 * for Cavour. Re-render it with `node scripts/render-cavour-stage.mjs ves`.
 */
export const VES_STAGE_POSTER = "/design/ves/stage-poster.webp";
