"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Reveals a Canvas only once it has drawn a frame.
 *
 * Between the WebGL context being created and the first render, the canvas's
 * backing buffer is uninitialised. On macOS GPUs that reads as solid white, so
 * every canvas on the page flashed on refresh.
 *
 * The canvas must start hidden from its very first paint, so the hiding is
 * CSS on the wrapper (`[&_canvas]:opacity-0`), not something set after mount:
 * anything set from JS lands a frame or two late, and that gap is the flash.
 * This component then writes an inline `opacity: 1`, which beats the class.
 * It waits for the second frame on purpose, so the reveal never lands ahead
 * of the paint.
 */
export function RevealOnFirstFrame() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current > 1) return;
    frames.current += 1;
    if (frames.current === 2) gl.domElement.style.opacity = "1";
  });
  return null;
}
