"use client";

import { Component, useEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Compiles every shader in the scene, then lets two frames draw, then calls
 * `onWarm`. Mount it inside the scene's Suspense, so it runs after the HDRI
 * and textures have resolved and the materials exist.
 *
 * compileAsync uses the GPU's parallel-compile path, so it does not block, and
 * it also turns the HDRI into the environment map. Without it each material
 * compiled on the first frame it was seen: on the hero that was the stutter
 * at the start of the drive-in (~330 ms, issue #29), on a card the blank
 * texture as it scrolled in (issue #45).
 *
 * The two frames are requested with `invalidate`, so this also works on the
 * card canvases, whose frame loop is "demand". (The hero's canvas ignores
 * `invalidate`: its own driver draws every frame until warm.) After them
 * the canvas has drawn the finished scene: the hero's RevealOnFirstFrame has
 * shown it, and a card's stage fades it in over its poster on `onWarm`.
 */
export function WarmUp({ onWarm }: { onWarm?: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const compiled = useRef(false);
  const frames = useRef(0);
  const warmed = useRef(false);
  const onWarmRef = useRef(onWarm);
  onWarmRef.current = onWarm;

  useEffect(() => {
    let live = true;
    // A rejected promise (lost context) just means the normal first-draw
    // compile happens instead, so it finishes the same way.
    const finish = () => {
      if (!live) return;
      compiled.current = true;
      invalidate(2);
    };
    gl.compileAsync(scene, camera).then(finish, finish);
    return () => {
      live = false;
    };
  }, [gl, scene, camera, invalidate]);

  useFrame(() => {
    if (!compiled.current || warmed.current) return;
    frames.current += 1;
    if (frames.current < 2) return;
    warmed.current = true;
    onWarmRef.current?.();
  });
  return null;
}

/**
 * Catches a scene that fails to load (a missing HDRI or texture, a lost
 * context), so it costs the canvas, not the page, and tells the owner.
 */
export class SceneErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Tells the owner when this canvas's WebGL context is lost. A lost canvas
 * paints white over everything under it, so the owner must drop it at once
 * (rocket-card-stage.tsx, hero-rocket-3d.tsx). Listens from the first frame,
 * and also reports a context that is already lost when the canvas mounts.
 */
export function WatchContext({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  const onLostRef = useRef(onLost);
  onLostRef.current = onLost;
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = () => onLostRef.current();
    if (gl.getContext().isContextLost()) lost();
    canvas.addEventListener("webglcontextlost", lost);
    return () => canvas.removeEventListener("webglcontextlost", lost);
  }, [gl]);
  return null;
}
