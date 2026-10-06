"use client";

import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { SceneErrorBoundary, WarmUp } from "./scene-ready";
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
// moves. At rest the nozzle and lower hull are deliberately out of frame: the
// whole vehicle is already on the hero, so the card is a detail shot. The
// hover brings them in by shrinking the vehicle, not by moving the camera.
// The target follows the 16° lean. The canvas hangs well above and below the
// card, so the camera stands back along the same line of sight
// (VIEW_DISTANCE) to keep the vehicle at card scale.
const TARGET = new THREE.Vector3(2.3, 8, 0);
const VIEW_DIRECTION = new THREE.Vector3(2.8, 12.2, 28.4);
const VIEW_DISTANCE = 3.3;
const EYE = TARGET.clone().addScaledVector(VIEW_DIRECTION, VIEW_DISTANCE);
/** Vertical field of view, in degrees, over the whole hanging canvas. */
const FOV = 30;

// The parked pose shows the vehicle from the nose to mid-body above the
// card's info box.
const PARKED_Y = 1.05;
const PARKED_Z = -14; // pushed back from the camera, so it reads at the board 21 size
// How far off vertical the vehicle leans its nose to the right, in radians.
// The lean swings the tail left, so PARKED_X shifts the whole vehicle back
// right.
const LEAN = 0.2;
const PARKED_X = 1.2;
/** The nose tip in the scene: the point the hover shrinks the vehicle about. */
const NOSE = new THREE.Vector3(
  PARKED_X + HALF * Math.sin(LEAN),
  PARKED_Y + HALF * Math.cos(LEAN),
  PARKED_Z,
);

// Hover (issue #65): the whole vehicle, nose to fins. The card's rise is a CSS
// transform on the canvas box (projects.tsx), exact in px and ms; the vehicle
// shrinks about its nose tip in step with it, so the nose moves by the rise
// alone and the fins come up above the info box. The scale follows the rise
// as it plays, interruptions and all, so the two can never drift apart, and
// with no rise (reduced motion) there is no shrink either.
// From md the rise is 60px and the nose ends about 25px under the Projects
// heading; on phones the swipe row clips the card top, so the rise is 8px
// and the vehicle shrinks further to fit above the shorter info box.
const HOVER_SCALE_WIDE = 0.65;
const HOVER_SCALE_PHONE = 0.57;
/** Tailwind's md: where the card switches from the phone layout. */
const WIDE = "(min-width: 768px)";

// The card is a close-up, so the hero's wear noise is rescaled: finer grain
// and lower contrast, or it reads as dashes and static at this pixel size.
// See uWearScale / uWearAmount in hero-weathering.ts.
const WEAR_SCALE = 2.5;
const WEAR_AMOUNT = 0.45;

/**
 * How far the card's rise has gone, from 0 at rest to 1 fully raised, read
 * off the box's live transform: mid-transition this is the in-flight value.
 * The box names its full rise in `--rocket-rise` (projects.tsx).
 */
function readLift(box: HTMLElement): number {
  const style = getComputedStyle(box);
  const rise = parseFloat(style.getPropertyValue("--rocket-rise"));
  if (!(rise > 0) || style.transform === "none") return 0;
  const lift = -new DOMMatrixReadOnly(style.transform).m42 / rise;
  return Math.min(1, Math.max(0, lift));
}

function Vehicle({ liftBox }: { liftBox: RefObject<HTMLElement | null> }) {
  const invalidate = useThree((s) => s.invalidate);
  /** Sits on the nose tip and carries the hover scale. */
  const pivot = useRef<THREE.Group>(null!);
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

  // The canvas draws on demand only, so a card at rest draws no frames
  // (issue #48). The rise asks for frames while it plays and one more when it
  // ends or is cut short; nothing else moves the vehicle.
  const wide = useMemo(() => window.matchMedia(WIDE), []);
  useEffect(() => {
    const box = liftBox.current;
    if (!box) return;
    const kick = (e: TransitionEvent) => {
      if (e.target === box) invalidate();
    };
    const kinds = ["transitionrun", "transitionend", "transitioncancel"] as const;
    for (const k of kinds) box.addEventListener(k, kick);
    return () => {
      for (const k of kinds) box.removeEventListener(k, kick);
    };
  }, [liftBox, invalidate]);

  useFrame(() => {
    if (!pivot.current) return;
    const box = liftBox.current;
    const lift = box ? readLift(box) : 0;
    const hoverScale = wide.matches ? HOVER_SCALE_WIDE : HOVER_SCALE_PHONE;
    pivot.current.scale.setScalar(1 + (hoverScale - 1) * lift);
    // Pin the procedural wear to the hull through the lean and the scale.
    pivot.current.updateMatrixWorld();
    weather.uRocketInv.value.copy(frame.current.matrixWorld).invert();
    if (box && box.getAnimations().length > 0) invalidate();
  });

  // The model is built along X with the nose at +X; stand it up nose-first,
  // less 16° so it leans to the right.
  return (
    <group ref={pivot} position={NOSE}>
      <group position={[PARKED_X - NOSE.x, PARKED_Y - NOSE.y, PARKED_Z - NOSE.z]}>
        <group ref={frame} rotation={[0, 0, Math.PI / 2 - LEAN]}>
          <CavourBuilt weather={weather} length={LENGTH} />
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
  /** The box the card raises on hover, carrying `--rocket-rise` (projects.tsx). */
  liftBox: RefObject<HTMLElement | null>;
};

export default function RocketCard3D({ tuning, onReadout, onReady, onFailed, liftBox }: Props) {
  return (
    <Canvas
      // The canvas draws only when asked: the warm-up (scene-ready.tsx), a
      // resize, the hover shrink while the rise plays (Vehicle), and the ?cam
      // tuner's orbit controls. Under reduced motion there is no rise, so the
      // warm-up draws the finished vehicle, then nothing.
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
          <Vehicle liftBox={liftBox} />
          <WarmUp onWarm={onReady} />
        </Suspense>
      </SceneErrorBoundary>
    </Canvas>
  );
}
