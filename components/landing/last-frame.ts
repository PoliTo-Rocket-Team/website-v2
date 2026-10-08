import type { Camera, Scene, WebGLRenderer } from "three";

/** Poses the live scene as the parked rocket, plume off, for one copy. */
export type AtRest = { putAtRest(): void };

/**
 * The hero rocket's last drawn frame, kept on a plain 2D canvas while the
 * home page is hidden (issue #111).
 *
 * Next keeps the page mounted but hidden (cacheComponents), and every
 * showing needs a new WebGL context (issue #77), which must upload and
 * compile the scene before it can draw. The held frame fills that gap: it
 * shows at once on a return, and the new canvas takes its place once drawn.
 * It is a copy of the live scene taken as the page hides, never a stored
 * asset, so decision 0004's "no static fallback" still holds: no live canvas
 * ever drew, no frame is held.
 *
 * A frame is held only while it is the newest one the rocket drew: a canvas
 * that draws again makes it stale (`drop`).
 */
export class LastFrame {
  private target: HTMLCanvasElement | null = null;
  private held = false;

  /**
   * Ref callback for the 2D canvas the frame is painted on. React detaches
   * refs while the page is hidden, but the element and its pixels stay, so
   * a detach keeps it.
   */
  readonly attach = (el: HTMLCanvasElement | null) => {
    if (!el || el === this.target) return;
    this.target = el;
    this.held = false;
    // Chrome may drop a 2D canvas's pixels in a background tab; a blank
    // copy is no frame.
    el.addEventListener("contextlost", () => {
      if (this.target === el) this.drop();
    });
  };

  /** True while a frame is held for the next showing. */
  get isHeld(): boolean {
    return this.held;
  }

  /**
   * Poses the live scene at rest, draws it once more and copies it, so a
   * page left mid-entrance still holds the parked rocket with its plume off.
   * The canvas is dropped right after, so nobody sees the pose change. The
   * copy runs in the same task as the draw, while the drawing buffer still
   * holds it, so the canvas needs no `preserveDrawingBuffer`. A lost context
   * holds nothing.
   */
  capture(gl: WebGLRenderer, scene: Scene, camera: Camera, rocket: AtRest): void {
    this.held = false;
    const out = this.target;
    const src = gl.domElement;
    if (!out || gl.getContext().isContextLost() || src.width === 0 || src.height === 0) return;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    rocket.putAtRest();
    gl.render(scene, camera);
    // Setting the size also clears the old frame.
    out.width = src.width;
    out.height = src.height;
    ctx.drawImage(src, 0, 0);
    this.held = true;
  }

  /** A newer frame exists: this one is no longer the rocket's last. */
  drop(): void {
    this.held = false;
  }
}
