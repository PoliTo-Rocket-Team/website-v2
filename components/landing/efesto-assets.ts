// The stills that stand in for Efesto's engine canvas (engine-efesto.tsx).
// The model loads no file: it is drawn in code. This module imports no
// three.js, so pages can name the stills in their first bundle.

/**
 * A project card's Efesto engine as a still: the card canvas's finished
 * frame, as CAVOUR_CARD_POSTER is for Cavour (same box, camera and scene).
 * Re-render it with `node scripts/render-card-poster.mjs efesto` whenever the
 * card scene or the engine changes.
 */
export const EFESTO_CARD_POSTER = "/design/efesto/card-poster.png";

/**
 * The /projects/efesto hero panel's engine as a still, as CAVOUR_STAGE_POSTER
 * is for Cavour. Re-render it with `node scripts/render-cavour-stage.mjs efesto`.
 */
export const EFESTO_STAGE_POSTER = "/design/efesto/stage-poster.webp";
