"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { SceneErrorBoundary, WarmUp, WatchContext } from "./scene-ready";
import { CAVOUR_HDRI } from "./cavour-assets";

// The vehicle in a project card, seen from above and in front: the hero shows
// the whole rocket side-on, so the card is a close-up from an angle you cannot
// get out of a flat render. Same model, materials and HDRI as the hero
// (rocket-cavour.tsx, hero-rocket-3d.tsx) so the two read as one vehicle.
//
// This file is the card's canvas and its tuning. It loads as its own chunk:
// rocket-card-stage.tsx decides when to mount it (see scene-schedule.ts).
const LENGTH = 32;
const HALF = LENGTH / 2;

// Camera sits high and in front, tipped down at the upper body, and never
// moves. The nozzle and lower hull are deliberately out of frame: the whole
// vehicle is already on the hero, so the card is a detail shot. The target
// follows the 16° lean. The canvas hangs well above and below the card, so
// the camera stands back along the same line of sight (VIEW_DISTANCE) to keep
// the vehicle at card scale.
const TARGET = new THREE.Vector3(2.3, 8, 0);
const VIEW_DIRECTION = new THREE.Vector3(2.8, 12.2, 28.4);
const VIEW_DISTANCE = 3.3;
const EYE = TARGET.clone().addScaledVector(VIEW_DIRECTION, VIEW_DISTANCE);
/** Vertical field of view, in degrees, over the whole hanging canvas. */
const FOV = 30;

// The vehicle holds still in the scene, and the card has no hover rise. The
// parked pose shows the vehicle from the nose to
// mid-body above the card's info box.
const PARKED_Y = 1.05;
const PARKED_Z = -14; // pushed back from the camera, so it reads at the board 21 size
// How far off vertical the vehicle leans its nose to the right, in radians.
// The lean swings the tail left, so PARKED_X shifts the whole vehicle back
// right.
const LEAN = 0.2;
const PARKED_X = 1.2;

// The card is a close-up, so the hero's wear noise is rescaled: finer grain
// and lower contrast, or it reads as dashes and static at this pixel size.
// See uWearScale / uWearAmount in hero-weathering.ts.
const WEAR_SCALE = 2.5;
const WEAR_AMOUNT = 0.45;

function Vehicle() {
  const group = useRef<THREE.Group>(null!);
  /** The group the vehicle sits in directly: its frame IS rocket space. */
  const frame = useRef<THREE.Group>(null!);
  const weather = useMemo<WeatherUniforms>(
    () => ({
      uRocketInv: { value: new THREE.Matrix4() },
      uSootStart: { value: -HALF + 9 },
      uTail: { value: -HALF - 0.5 },
      // Fixed here: the hero drives this off the rocket's height on screen, but
      // a card has no climb to track.
      uBelly: { value: 0.35 },
      uDown: { value: new THREE.Vector3(0, -1, 0) },
      uWearScale: { value: WEAR_SCALE },
      uWearAmount: { value: WEAR_AMOUNT },
    }),
    [],
  );

  // The vehicle never moves, and the canvas only draws on demand (warm-up,
  // resize), so there is no idle drift: a card at rest draws no frames
  // (issue #48). This runs on those few frames only.
  useFrame(() => {
    if (!group.current) return;
    // Pin the procedural wear to the hull through the lean.
    group.current.updateMatrixWorld();
    weather.uRocketInv.value.copy(frame.current.matrixWorld).invert();
  });

  // The model is built along X with the nose at +X; stand it up nose-first,
  // less 16° so it leans to the right.
  return (
    <group ref={group} position={[PARKED_X, PARKED_Y, PARKED_Z]}>
      <group ref={frame} rotation={[0, 0, Math.PI / 2 - LEAN]}>
        <CavourBuilt weather={weather} length={LENGTH} />
      </group>
    </group>
  );
}

/**
 * Dev only, via `?cam` on the URL: drag to find an angle and read the numbers
 * off the overlay, then paste them into EYE_IDLE / TARGET above. Beats guessing.
 */
function CameraTuner({ onChange }: { onChange: (s: string) => void }) {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    const p = camera.position;
    onChange(`EYE  ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}`);
  });
  return <OrbitControls target={TARGET} />;
}

/**
 * Aims the camera. Its position comes from the Canvas prop instead, so the very
 * first frame is already framed correctly — setting it here drew one giant
 * rocket from the default (0, 0, 5) before the effect ran.
 */
function FixedCamera() {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(TARGET);
  }, [camera]);
  return null;
}

type Props = {
  /** `?cam` on the URL: orbit controls and a live camera readout. */
  tuning: boolean;
  onReadout: (s: string) => void;
  /**
   * The vehicle is loaded, compiled and drawn: the canvas holds the finished
   * picture and may be shown. Until then it stays hidden over the poster
   * (rocket-card-stage.tsx).
   */
  onReady: () => void;
  /** The scene failed to load. The canvas stays hidden; the poster stays. */
  onFailed: () => void;
  /**
   * The canvas's WebGL context is lost, so it can only paint white. The
   * owner unmounts it and shows the poster again.
   */
  onLost: () => void;
};

export default function RocketCard3D({ tuning, onReadout, onReady, onFailed, onLost }: Props) {
  return (
    <Canvas
      // Nothing in the scene moves, so the canvas draws only when asked: the
      // warm-up (scene-ready.tsx), a resize, and the ?cam tuner's orbit
      // controls. Under reduced motion this is the
      // same: the warm-up draws the finished vehicle, then nothing.
      // Not "never": that leaves the WebGL buffer undrawn, which shows white
      // on a real GPU, and ignores the warm-up's invalidate.
      frameloop="demand"
      dpr={[1, 1.5]}
      // No scroll tracking: the canvas takes no pointer events, so its page
      // position is never used, and tracking it would draw a frame on every
      // scroll.
      resize={{ offsetSize: true, scroll: false }}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: FOV, near: 1, far: 200, position: [EYE.x, EYE.y, EYE.z] }}
      // The canvas is taller than the card and hangs over its top edge, so
      // it must never take pointer events: hover belongs to the card, and
      // the part of the rocket sticking out above it is not a hover target.
      style={{ pointerEvents: "none" }}
      eventSource={undefined}
    >
      <WatchContext onLost={onLost} />
      <ambientLight intensity={0.12} />
      {/* Sun on the camera side, as on the hero: no shadow angles to manage,
          and no shadow map, because a card has nothing to cast onto. */}
      <directionalLight position={[6, 16, 20]} intensity={2.1} />
      <directionalLight position={[-10, 4, -8]} intensity={0.6} color="#FFD2B0" />
      {tuning ? <CameraTuner onChange={onReadout} /> : <FixedCamera />}
      {/* The environment shares the vehicle's Suspense on purpose: with it
          outside, the rocket drew for a few frames before the HDRI arrived
          and flashed blown-out white. Now neither appears until both are
          ready, and the card's poster shows until then. */}
      <SceneErrorBoundary onError={onFailed}>
        <Suspense fallback={null}>
          <Environment
            files={CAVOUR_HDRI}
            environmentIntensity={0.45}
            environmentRotation={[-Math.PI / 2, 0, 0]}
          />
          <Vehicle />
          <WarmUp onWarm={onReady} />
        </Suspense>
      </SceneErrorBoundary>
    </Canvas>
  );
}
