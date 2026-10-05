"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { RevealOnFirstFrame } from "./reveal-on-first-frame";

// The vehicle in a project card, seen from above and in front: the hero shows
// the whole rocket side-on, so the card is a close-up from an angle you cannot
// get out of a flat render. Same model, materials and HDRI as the hero
// (rocket-cavour.tsx, hero-rocket-3d.tsx) so the two read as one vehicle.
const HDRI = "/design/hdri/studio_small_03.hdr";
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
const VIEW_DISTANCE = 3.5;
const EYE = TARGET.clone().addScaledVector(VIEW_DIRECTION, VIEW_DISTANCE);
/** Vertical field of view, in degrees, over the whole hanging canvas. */
const FOV = 30;

// The vehicle holds still in the scene. The card's hover rise is a CSS
// transform on the canvas wrapper (projects.tsx), so its distance and timing
// are exact in px and ms. The parked pose shows the vehicle from the nose to
// mid-body above the card's info box.
const PARKED_Y = 3;
const PARKED_Z = -6; // pushed back from the camera, so it reads a little smaller
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

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  useFrame((state) => {
    if (!group.current) return;
    // Barely-there drift, same intent as the hero's: keeps it from reading as
    // a sticker without ever becoming a bounce.
    const drift = REDUCED ? 0 : Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
    group.current.rotation.x = drift;
    group.current.position.y = PARKED_Y;
    group.current.position.x = PARKED_X;
    group.current.position.z = PARKED_Z;
    // Pin the procedural wear to the hull through the lean, turn and climb.
    group.current.updateMatrixWorld();
    weather.uRocketInv.value.copy(frame.current.matrixWorld).invert();
  });

  // The model is built along X with the nose at +X; stand it up nose-first,
  // less 16° so it leans to the right.
  return (
    <group ref={group}>
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

function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function RocketCard3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);
  const [visible, setVisible] = useState(false);
  // Flips once, the first time the card comes within a screen of the viewport,
  // and the Canvas mounts then. Before this the four cards each built Cavour
  // and compiled its shaders on page load, under the hero's own entrance,
  // which is where the first-load stutter came from (issue #29).
  const [mounted, setMounted] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [readout, setReadout] = useState("");

  useEffect(() => {
    setSupported(webglSupported());
    setTuning(new URLSearchParams(window.location.search).has("cam"));
    const el = wrapRef.current;
    if (!el) return;

    // Only paint while the section is on screen: this is the page's second
    // canvas and the hero already owns a frame loop.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);

    // Mount a little early so the rocket is built by the time it scrolls in.
    // A full screen of margin was too generous: at 1440x900 the cards start
    // ~1800px down, inside that margin, so all four still mounted on load.
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setMounted(true);
          near.disconnect();
        }
      },
      { rootMargin: "30% 0px" },
    );
    near.observe(el);

    return () => {
      io.disconnect();
      near.disconnect();
    };
  }, []);

  return (
    // Fills the wrapper the card gives it, which hangs over the card's top
    // edge so the rocket has somewhere to rise into (projects.tsx).
    // The canvas starts invisible and RevealOnFirstFrame shows it once it has
    // actually drawn; see reveal-on-first-frame.tsx for why.
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 [&_canvas]:opacity-0">
      {supported && mounted && (
        <Canvas
          // "demand" rather than "never" while off screen: "never" leaves the
          // WebGL buffer undrawn, and on a real GPU that shows as white until
          // the first frame. "demand" still costs nothing between frames.
          frameloop={visible ? "always" : "demand"}
          dpr={[1, 1.5]}
          resize={{ offsetSize: true }}
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
          {tuning ? <CameraTuner onChange={setReadout} /> : <FixedCamera />}
          <RevealOnFirstFrame />
          {/* The environment shares the vehicle's Suspense on purpose: with it
              outside, the rocket drew for a few frames before the HDRI arrived
              and flashed blown-out white. Now neither appears until both are
              ready, and the card's texture shows through until then. */}
          <Suspense fallback={null}>
            <Environment
              files={HDRI}
              environmentIntensity={0.45}
              environmentRotation={[-Math.PI / 2, 0, 0]}
            />
            <Vehicle />
          </Suspense>
        </Canvas>
      )}
      {tuning && (
        <p className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-2 py-1 font-mono text-[10px] text-accent">
          {readout}
        </p>
      )}
    </div>
  );
}
