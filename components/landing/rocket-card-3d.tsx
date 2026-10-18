"use client";

import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { RocketModel } from "@/lib/rocket-model";
import { builtRockets } from "./rocket-built";
import type { WeatherUniforms } from "./hero-weathering";
import { SceneErrorBoundary, WarmUp, WatchContext } from "./scene-ready";
import { CAVOUR_HDRI } from "./cavour-assets";

// The vehicle in a project card, seen from above and in front: the hero shows
// the whole rocket side-on, so the card is a close-up from an angle you cannot
// get out of a flat render. Same model, materials and HDRI as the hero
// (rocket-cavour.tsx, hero-rocket-3d.tsx) so the two read as one vehicle.
// A project with no model of its own draws the placeholder
// (rocket-placeholder.tsx) in the same pose and light.
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

// The vehicle stays parked in the scene, and the card has no hover rise. The
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

// A home card's rocket turns about its own long axis (issue #385), at the
// Efesto engine's speed (TURN_PER_S in engine-efesto.tsx, PR #384, not yet on
// trunk, so the same value is named here). Only the spin moves: the pose,
// lean, parked position and camera above stay as tuned.
/** One turn in 40 s. */
const TURN_PER_S = (2 * Math.PI) / 40;
/** A frame after a long gap moves the turn no further than this. */
const MAX_STEP_MS = 100;
/** The turn asks for a frame this often: about 30 fps, plenty for one turn in 40 s. */
const TURN_FRAME_MS = 1000 / 30;

/**
 * Turns the group about the vehicle's long axis (its X) while `turning`, by
 * real elapsed time. The canvas draws on demand, so while turning a timer
 * asks for a frame about 30 times a second; once `turning` drops, the timer
 * stops, no frame is asked for and the vehicle holds where it stands.
 */
function useSlowTurn(spin: RefObject<THREE.Group | null>, turning: boolean) {
  const invalidate = useThree((s) => s.invalidate);
  const last = useRef<number | null>(null);
  useEffect(() => {
    last.current = null;
    if (!turning) return;
    invalidate();
    const timer = window.setInterval(() => invalidate(), TURN_FRAME_MS);
    return () => window.clearInterval(timer);
  }, [turning, invalidate]);
  useFrame(() => {
    if (!turning || !spin.current) return;
    const now = performance.now();
    if (last.current !== null) spin.current.rotation.x += (Math.min(now - last.current, MAX_STEP_MS) / 1000) * TURN_PER_S;
    last.current = now;
  });
}

function Vehicle({ model, turning }: { model: RocketModel; turning: boolean }) {
  const Built = builtRockets[model];
  const group = useRef<THREE.Group>(null!);
  /**
   * The group the vehicle sits in directly: its frame IS rocket space. It
   * turns about the vehicle's long axis on a home card, and holds still
   * everywhere else.
   */
  const spin = useRef<THREE.Group>(null!);
  useSlowTurn(spin, turning);
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

  // The vehicle stays in its parked pose, and the canvas only draws on demand
  // (warm-up, resize, and each frame of a home card's turn), so there is no
  // idle drift: a still card draws no frames (issue #48).
  useFrame(() => {
    if (!group.current) return;
    // Pin the procedural wear to the hull through the lean and the turn.
    group.current.updateMatrixWorld();
    weather.uRocketInv.value.copy(spin.current.matrixWorld).invert();
  });

  // The model is built along X with the nose at +X; stand it up nose-first,
  // less 16° so it leans to the right. The spin group turns it about that X.
  return (
    <group ref={group} position={[PARKED_X, PARKED_Y, PARKED_Z]}>
      <group rotation={[0, 0, Math.PI / 2 - LEAN]}>
        <group ref={spin}>
          <Built weather={weather} length={LENGTH} />
        </group>
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
  /** The vehicle to draw. */
  model: RocketModel;
  /**
   * The vehicle turns slowly about its long axis now. Only a home card ever
   * sets it, through its motion gate (rocket-turn.tsx).
   */
  turning: boolean;
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

export default function RocketCard3D({ model, turning, tuning, onReadout, onReady, onFailed, onLost }: Props) {
  return (
    <Canvas
      // Nothing in the scene moves but a home card's slow turn, so the canvas
      // draws only when asked: the warm-up (scene-ready.tsx), a resize, the
      // ?cam tuner's orbit controls, and each frame of the turn while its gate
      // is open. Under reduced motion there is no turn: the warm-up draws the
      // finished vehicle, then nothing.
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
          <Vehicle model={model} turning={turning} />
          <WarmUp onWarm={onReady} />
        </Suspense>
      </SceneErrorBoundary>
    </Canvas>
  );
}
