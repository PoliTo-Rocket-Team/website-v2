"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { RevealOnFirstFrame } from "./reveal-on-first-frame";

// The /projects/cavour hero panel (boards 23 and 23m): the code-built Cavour
// side-on, nose right, parked (no drift, no idle plume, like the homepage
// hero once it has parked), and the visitor can drag to orbit it. The canvas
// draws only on demand: on load, on resize and while a drag or its damping
// moves the camera, so the idle page draws nothing (#71). Same model, HDRI, lights and plume as the homepage hero
// (hero-rocket-3d.tsx), so the two read as one vehicle; only the framing and
// the orbit are this panel's own.
const HDRI = "/design/hdri/studio_small_03.hdr";
const LENGTH = 32;
const HALF = LENGTH / 2;

// Boards 23 and 23m draw the vehicle, fins to nose, across about 76% of the
// panel width, from 19% to 95%: right of centre, leaving room for the plume.
// The camera stands back far enough to hold that at any panel aspect, on the
// hero's long lens, and a film offset slides the frame instead of the rocket,
// so a drag still orbits the vehicle's own centre.
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

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!group.current) return;
    group.current.updateMatrixWorld();
    weather.uRocketInv.value.copy(group.current.matrixWorld).invert();
    // Draw once the vehicle (and the HDRI above it) has mounted.
    invalidate();
  }, [weather, invalidate]);

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

/**
 * OrbitControls sets touch-action: none on the canvas, which would trap a
 * phone's vertical swipe over the panel. Give vertical pans back to the page;
 * a sideways drag still orbits. Runs after the controls have connected.
 */
function KeepPageScroll() {
  const el = useThree((s) => s.gl.domElement);
  useEffect(() => {
    el.style.touchAction = "pan-y";
  }, [el]);
  return null;
}

function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function CavourStage3D() {
  const [supported, setSupported] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(webglSupported());
  }, []);

  return (
    // Hidden until RevealOnFirstFrame has seen a drawn frame: no white flash.
    // Without WebGL the panel is the texture and its caption only.
    <div ref={wrapRef} className="absolute inset-0 [&_canvas]:opacity-0">
      {supported && (
        <Canvas
          frameloop="demand"
          dpr={[1, 1.5]}
          resize={{ offsetSize: true }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: FOV, position: [0, 0, 100], near: 1, far: 400 }}
          className="cursor-grab active:cursor-grabbing"
        >
          <ambientLight intensity={0.12} />
          <directionalLight position={[3, 4, 26]} intensity={2.1} />
          {/* Warm back light: a scene light, not a UI colour, and the same
              value the hero and the project cards use, so the vehicle reads
              the same on every page. */}
          <directionalLight position={[10, 3, -8]} intensity={0.6} color="#FFD2B0" />
          <FitCamera />
          {/* Drag to orbit only: zoom and pan would let the page scroll wheel
              and a stray swipe lose the rocket. */}
          <OrbitControls enableZoom={false} enablePan={false} enableDamping />
          <KeepPageScroll />
          <RevealOnFirstFrame />
          <Suspense fallback={null}>
            <Environment files={HDRI} environmentIntensity={0.45} environmentRotation={[-Math.PI / 2, 0, 0]} />
            <Vehicle />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
