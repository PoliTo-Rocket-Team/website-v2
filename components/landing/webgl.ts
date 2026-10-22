/**
 * Whether this browser can draw WebGL. The probe context is released at
 * once: left to the garbage collector, every mount kept one more live
 * context, and Chrome drops the oldest live context once a page holds too
 * many (issue #75).
 */
export function webglSupported(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
