/**
 * Which canvas the hero rocket shows, and how it comes into view
 * (`components/landing/hero-rocket-3d.tsx`). Pure, so the rules are tested
 * without React or WebGL.
 */

/**
 * How a new canvas comes into view (issue #111).
 *  - "at-once":         RevealOnFirstFrame shows it as it draws: the first
 *                       load, or a showing with no frame held
 *  - "fade":            it replaces a lost canvas after the rocket has drawn,
 *                       so it fades in once drawn, never a pop
 *  - "over-last-frame": the rocket's last frame is held: the frame shows at
 *                       once, and the canvas takes its place in one paint
 *                       once drawn, with no transition. Both show the parked
 *                       rocket, plume off, so the swap is not seen.
 */
export type Reveal = "at-once" | "fade" | "over-last-frame";

/**
 * Which canvas the hero shows. A canvas exists only while the stage names
 * one, and every new canvas gets a new id used as its React key, so React
 * builds a fresh <canvas> element with a fresh WebGL context: a canvas whose
 * context is gone is never shown again (issue #77; the cards do the same,
 * rocket-card-stage.tsx).
 *  - "hidden":      the page is hidden, or not shown yet: no canvas
 *  - "unavailable": no rocket for this page load: no WebGL, or the scene
 *                   failed to load
 *  - "warming":     the canvas loads and compiles its scene, still invisible
 *  - "ready":       the canvas has drawn the scene
 */
export type Stage =
  | { kind: "hidden" }
  | { kind: "unavailable" }
  | { kind: "warming" | "ready"; canvas: number; reveal: Reveal };

export type StageEvent =
  /** The page is shown (first load, or shown again): mount a new canvas. */
  | { type: "shown"; canvas: number; reveal: Reveal }
  /** The page is shown, and this browser cannot draw WebGL. */
  | { type: "unsupported" }
  /** Next hid the page (cacheComponents): drop the canvas. */
  | { type: "hidden" }
  /** The canvas has compiled and drawn its scene. */
  | { type: "warm"; canvas: number }
  /**
   * The canvas's context is lost: drop it and mount `next` in its place. A
   * lost context draws nothing, so it holds no frame of its own; a frame
   * held from before still stands (`revealAfterLost`).
   */
  | { type: "lost"; canvas: number; next: number; reveal: Reveal }
  /** The scene failed to load: no rocket for this page load. */
  | { type: "failed"; canvas: number };

export const HIDDEN: Stage = { kind: "hidden" };

/** How a canvas mounted as the page is shown comes into view. */
export function revealOnShow(frameHeld: boolean): Reveal {
  return frameHeld ? "over-last-frame" : "at-once";
}

/**
 * How the canvas that replaces a lost one comes into view (issue #113).
 * A frame is held only until a canvas has drawn (`LastFrame.drop`), so a
 * held frame means the lost canvas was still warming: the frame stays up
 * over the replacement until that one has drawn, as on any return. With no
 * frame held, it fades in once the rocket has drawn before, and otherwise
 * shows as it draws, like the first load.
 */
export function revealAfterLost(frameHeld: boolean, drawnBefore: boolean): Reveal {
  if (frameHeld) return "over-last-frame";
  return drawnBefore ? "fade" : "at-once";
}

/** True while the held frame shows: a canvas warms over it. */
export function heldFrameShown(stage: Stage): boolean {
  return stage.kind === "warming" && stage.reveal === "over-last-frame";
}

// Each canvas event moves only the canvas it names, so a late report from a
// canvas that is already gone changes nothing.
export function step(stage: Stage, e: StageEvent): Stage {
  if (stage.kind === "unavailable") return stage;
  if (e.type === "hidden") return HIDDEN;
  if (e.type === "shown") {
    return stage.kind === "hidden" ? { kind: "warming", canvas: e.canvas, reveal: e.reveal } : stage;
  }
  if (e.type === "unsupported") return stage.kind === "hidden" ? { kind: "unavailable" } : stage;
  if (stage.kind === "hidden" || stage.canvas !== e.canvas) return stage;
  if (e.type === "lost") return { kind: "warming", canvas: e.next, reveal: e.reveal };
  if (e.type === "failed") return { kind: "unavailable" };
  return stage.kind === "warming" ? { ...stage, kind: "ready" } : stage;
}
