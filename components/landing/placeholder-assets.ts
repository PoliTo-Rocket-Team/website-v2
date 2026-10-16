// The stills that stand in for the placeholder rocket's canvas
// (rocket-placeholder.tsx). The model itself loads no file: its livery is
// drawn in code and it shares Cavour's HDRI (cavour-assets.ts). This module
// imports no three.js, so pages can name the stills in their first bundle.

/**
 * A project card's placeholder rocket as a still: the card canvas's finished
 * frame, as CAVOUR_CARD_POSTER is for Cavour (same box, camera and scene).
 * Re-render it with `node scripts/render-card-poster.mjs placeholder`
 * whenever the card scene or the placeholder changes.
 */
export const PLACEHOLDER_CARD_POSTER = "/design/placeholder/card-poster.png";

/**
 * A project page panel's placeholder rocket as a still, as
 * CAVOUR_STAGE_POSTER is for Cavour. Re-render it with
 * `node scripts/render-cavour-stage.mjs placeholder`.
 */
export const PLACEHOLDER_STAGE_POSTER = "/design/placeholder/stage-poster.webp";
