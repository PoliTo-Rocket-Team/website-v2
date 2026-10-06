"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { CAVOUR_HDRI } from "./cavour-assets";
import { SceneErrorBoundary, WarmUp } from "./scene-ready";

// The source of the /projects/cavour hero still (CAVOUR_STAGE_POSTER in
// cavour-assets.ts), not a page component: no page mounts this canvas.
// scripts/render-cavour-stage.mjs mounts it alone at the panel's desktop box
// and saves its finished frame. It shows the code-built Cavour side-on, nose
// right, parked (no drift, no idle plume). Same model, HDRI and lights as the
// homepage hero (hero-rocket-3d.tsx), so the two read as one vehicle; only
// the framing is this panel's own.
const LENGTH = 32;
const HALF = LENGTH / 2;

// Boards 23 and 23m draw the vehicle, fins to nose, across about 76% of the
// panel width, from 19% to 95%: right of centre, leaving room for the plume.
// The camera stands back far enough to hold that at the panel's aspect, on
// the hero's long lens, and a film offset slides the frame instead of the
// rocket.
const FOV = 14;
const WIDTH_SHARE = 0.76;
const RIGHT_SHIFT = 0.07; // share of the panel width

function Vehicle() {
  const group = useRef<THREE.Group>(null!);
  const weather = useMemo<WeatherUniforms>(
    () => ({
      uRocketInv: { value: new THREE.Matrix4() },
      uSootStart: { value: -HALF + 9 },
      uTail: { value: -HALF - 0.5 },
      // Fixed, as on the project cards: there is no climb to track here.
      uBelly: { value: 0.15 },
      uDown: { value: new THREE.Vector3(0, -1, 0) },
      uWearScale: { value: 1 },
      uWearAmount: { value: 1 },
    }),
    [],
  );

  useEffect(() => {
    if (!group.current) return;
    group.current.updateMatrixWorld();
    weather.uRocketInv.value.copy(group.current.matrixWorld).invert();
  }, [weather]);

  return (
    <group ref={group}>
      <CavourBuilt weather={weather} length={LENGTH} />
    </group>
  );
}

/** Keeps the rocket at the board's share of the panel width as the panel resizes. */
function FitCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    const visibleHeight = LENGTH / WIDTH_SHARE / aspect;
    const distance = visibleHeight / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.position.setLength(distance);
    // filmOffset moves the frame by filmOffset / filmWidth of the near plane's
    // width per unit of its tangent span; negative moves the subject right.
    const span = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * aspect;
    camera.filmOffset = -RIGHT_SHIFT * span * camera.getFilmWidth();
    camera.updateProjectionMatrix();
  }, [camera, aspect]);
  return null;
}

type Props = {
  /** The vehicle is loaded, compiled and drawn: the canvas holds the finished frame. */
  onReady: () => void;
  /** The scene failed to load. */
  onFailed: () => void;
};

export default function CavourStage3D({ onReady, onFailed }: Props) {
  return (
    <Canvas
      frameloop="demand"
      resize={{ offsetSize: true, scroll: false }}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: FOV, position: [0, 0, 100], near: 1, far: 400 }}
    >
      <ambientLight intensity={0.12} />
      <directionalLight position={[3, 4, 26]} intensity={2.1} />
      {/* Warm back light: a scene light, not a UI colour, and the same
          value the hero and the project cards use, so the vehicle reads
          the same on every page. */}
      <directionalLight position={[10, 3, -8]} intensity={0.6} color="#FFD2B0" />
      <FitCamera />
      <SceneErrorBoundary onError={onFailed}>
        <Suspense fallback={null}>
          <Environment files={CAVOUR_HDRI} environmentIntensity={0.45} environmentRotation={[-Math.PI / 2, 0, 0]} />
          <Vehicle />
          <WarmUp onWarm={onReady} />
        </Suspense>
      </SceneErrorBoundary>
    </Canvas>
  );
}
