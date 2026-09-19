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
// follows the 16° lean, or the body drifts out of frame as it rises.
const EYE = new THREE.Vector3(5.1, 20.2, 28.4);
const TARGET = new THREE.Vector3(2.3, 8, 0);

// Hover pivots the vehicle itself: a turn about X swings the nose off vertical
// and round to face the viewer. The camera holds still — dollying the whole
// rocket forward instead only makes it bigger, which is not the same thing.
// It also rises far enough that the nose clears the top of the card; the canvas
// is taller than the card and the card does not clip its top, so there is room.
const TURN = 0.62; // radians, ~35° of nose-toward-camera
const PARKED_Y = -5; // sits the nose clear of the card's top edge at rest
const PARKED_Z = -6; // pushed back from the camera, so it reads a little smaller
const RISE = 8; // climbs clear of the card's top edge and over the heading
// How far off vertical the vehicle leans its nose to the right, in radians.
// The lean swings the tail left, so PARKED_X shifts the whole vehicle back
// right; without it the near fins leave the frame once the rocket rises.
const LEAN = 0.2;
const PARKED_X = 1.2;
const EASE = 1.4; // lower is slower; this settles over roughly two seconds

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Vehicle({ hovered }: { hovered: boolean }) {
  const group = useRef<THREE.Group>(null!);
  /** 0 parked, 1 fully hovered. Eased every frame. */
  const t = useRef(0);
  const weather = useMemo<WeatherUniforms>(
    () => ({
      uRocketPos: { value: new THREE.Vector3(0, 0, 0) },
      uSootStart: { value: -HALF + 9 },
      uTail: { value: -HALF - 0.5 },
      // Fixed here: the hero drives this off the rocket's height on screen, but
      // a card has no climb to track.
      uBelly: { value: 0.35 },
      uDown: { value: new THREE.Vector3(0, -1, 0) },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!group.current) return;
    // One eased value drives both the turn and the climb, so they arrive
    // together. Frame-rate independent, and slow enough to read as heavy
    // machinery rather than a UI flick.
    const want = hovered && !REDUCED ? 1 : 0;
    t.current += (want - t.current) * (1 - Math.exp(-EASE * delta));
    // Barely-there drift on top, same intent as the hero's: keeps it from
    // reading as a sticker without ever becoming a bounce.
    const drift = REDUCED ? 0 : Math.sin(state.clock.elapsedTime * 0.5) * 0.04;
    group.current.rotation.x = t.current * TURN + drift;
    group.current.position.y = PARKED_Y + t.current * RISE;
    group.current.position.x = PARKED_X;
    group.current.position.z = PARKED_Z;
  });

  // The model is built along X with the nose at +X; stand it up nose-first,
  // less 16° so it leans to the right.
  return (
    <group ref={group}>
      <group rotation={[0, 0, Math.PI / 2 - LEAN]}>
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
  const [hovered, setHovered] = useState(false);
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

    // Hover is read off the card rather than passed in, so the card itself can
    // stay a server component.
    const card = el.closest("article");
    const enter = () => setHovered(true);
    const leave = () => setHovered(false);
    card?.addEventListener("pointerenter", enter);
    card?.addEventListener("pointerleave", leave);

    return () => {
      io.disconnect();
      card?.removeEventListener("pointerenter", enter);
      card?.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    // Taller than the card and hanging over its top edge, so the rocket has
    // somewhere to climb into. The card's render zone does not clip its top.
    // The canvas starts invisible and RevealOnFirstFrame shows it once it has
    // actually drawn; see reveal-on-first-frame.tsx for why.
    <div ref={wrapRef} className="pointer-events-none absolute inset-x-0 -top-64 bottom-0 [&_canvas]:opacity-0">
      {supported && (
        <Canvas
          // "demand" rather than "never" while off screen: "never" leaves the
          // WebGL buffer undrawn, and on a real GPU that shows as white until
          // the first frame. "demand" still costs nothing between frames.
          frameloop={visible ? "always" : "demand"}
          dpr={[1, 1.5]}
          resize={{ offsetSize: true }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 30, near: 1, far: 200, position: [EYE.x, EYE.y, EYE.z] }}
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
            <Vehicle hovered={hovered} />
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
