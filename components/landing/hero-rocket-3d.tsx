"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import Plume from "./hero-plume";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { RevealOnFirstFrame } from "./reveal-on-first-frame";

// Three.js hero stage: the code-built Cavour (rocket-cavour.tsx) horizontal,
// nose right, matching the static render's framing (nose ~95% across, plume
// trailing to the left edge). The Blender GLB it was measured from lives in
// design/cavour.glb, out of public/ so it is never served.
// Idle: hover bob only (decision 0004: no shake); plume lives in hero-plume.tsx.
// Scroll fly-out stays on the CSS wrapper in hero.tsx.

// Canvas 2400x280, centred where the old 1480px stage was: ~750px of room
// behind the nozzle for the plume. World view: 8 units tall, ~68.6 wide.
const LENGTH = 32; // rocket length in world units (matches the static render)
const HALF = LENGTH / 2;
const X_OFF = 3.2; // shifts nose to ~95% of the canvas width

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// IBL: a real small-studio HDRI (Poly Haven, CC0). Real softboxes and
// falloff give the metals proper streaks and the orange paint a believable
// sheen — the previous hand-built strip environment read flat and cartoony.
const HDRI = "/design/hdri/studio_small_03.hdr";

// Belly light: the lit earth under the rocket, white. Two parts, both
// driven by how low the rocket sits on screen: the environment's light on
// down-facing surfaces (gated in the weathering shader, so nothing fixed
// sits under the hull) and a lamp from below for the punch. Off while the
// rocket waits off stage, strongest as it climbs in low near the horizon,
// easing to a faint trace once parked. Direction follows the CSS tilt of
// the stage (rotation lives on the wrapper in hero.tsx, not in the scene).
const EARTH_PEAK = 1.2; // lamp intensity at the lowest point of the climb
const EARTH_PARKED = 0.03; // lamp intensity once settled
const BELLY_PARKED = 0.15; // env gate once settled (0 = none, 1 = all)

function Rocket({ fullBurn }: { fullBurn: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const earth = useRef<THREE.DirectionalLight>(null!);
  const canvas = useThree((s) => s.gl.domElement);
  const weather = useMemo<WeatherUniforms>(
    () => ({
      uRocketInv: { value: new THREE.Matrix4().makeTranslation(-X_OFF, 0, 0) },
      uSootStart: { value: -HALF + 9 },
      uTail: { value: -HALF - 0.5 },
      uBelly: { value: BELLY_PARKED },
      uDown: { value: new THREE.Vector3(0, -1, 0) },
      // The wear was tuned at this framing; 1/1 is the reference look.
      uWearScale: { value: 1 },
      uWearAmount: { value: 1 },
    }),
    [],
  );

  useFrame((state) => {
    if (!group.current || REDUCED) return;
    const t = state.clock.elapsedTime;

    // Hover drift: barely-there, ±0.15 world units (~5px) over ~9s.
    // Enough to keep the rocket from reading as a sticker, never a bounce.
    group.current.position.y = Math.sin(t * 0.7) * 0.15;

    // Keep the procedural wear pinned to the hull while the group moves
    group.current.updateMatrixWorld();
    weather.uRocketInv.value.copy(group.current.matrixWorld).invert();

    const stage = canvas.closest<HTMLElement>("[data-rocket-stage]");
    if (!stage || !earth.current) return;
    const rect = stage.getBoundingClientRect();
    // 0 at the parked height, 1 at the entry height (36vh lower, see hero.tsx)
    const parkedY = stage.parentElement!.getBoundingClientRect().top + rect.height / 2;
    const lowness = THREE.MathUtils.clamp(
      ((rect.top + rect.bottom) / 2 - parkedY) / (0.36 * window.innerHeight),
      0,
      1,
    );
    const onStage = rect.right > 0 ? 1 : 0;
    earth.current.intensity = onStage * THREE.MathUtils.lerp(EARTH_PARKED, EARTH_PEAK, lowness);
    weather.uBelly.value = onStage * THREE.MathUtils.lerp(BELLY_PARKED, 1, lowness);
    // CSS rotate(θ): screen-down in the stage's own frame is (sinθ, -cosθ)
    const m = new DOMMatrixReadOnly(getComputedStyle(stage).transform);
    const theta = Math.atan2(m.b, m.a);
    weather.uDown.value.set(Math.sin(theta), -Math.cos(theta), 0);
    earth.current.position.set(Math.sin(theta) * 10, -Math.cos(theta) * 10, 3);
  });

  return (
    <group ref={group} position={[X_OFF, 0, 0]}>
      <directionalLight ref={earth} intensity={0} color="#ffffff" />
      <CavourBuilt weather={weather} length={LENGTH} />
      <group position={[-HALF, 0, 0]}>
        <Plume fullBurn={fullBurn} />
      </group>
    </group>
  );
}

// No static fallback by decision 0004: if WebGL is unavailable the hero is
// just the type — nothing renders here.
function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function HeroRocket3D({ fullBurn = false }: { fullBurn?: boolean }) {
  const [supported, setSupported] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupported(webglSupported());
    const el = wrapRef.current;
    if (!el) return;
    // Keep the canvas mounted; only pause the frame loop while offscreen so
    // scrolling back shows the last frame, not a fresh reload.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // The canvas starts invisible and RevealOnFirstFrame shows it once it has
    // actually drawn; see reveal-on-first-frame.tsx for why.
    <div ref={wrapRef} className="relative h-full w-full [&_canvas]:opacity-0">
      {supported && (
        <div className="absolute inset-0">
          <Canvas
            frameloop={visible ? "always" : "never"}
            dpr={[1, 1.5]}
            // The wrapper animates transforms (rotation!) — measure the layout
            // box, not the transformed bounding rect, or the canvas mis-sizes.
            resize={{ offsetSize: true }}
            gl={{ alpha: true, antialias: true }}
            shadows="soft"
            // Long lens: a 14° vertical fov from ~33 units back frames the same
            // 42x8 world window the orthographic setup did, but with the faint
            // foreshortening of a 200mm photo instead of a diagram's flatness.
            camera={{ fov: 14, position: [0, 0, 32.6], near: 1, far: 200 }}
          >
            <Environment files={HDRI} environmentIntensity={0.45} environmentRotation={[-Math.PI / 2, 0, 0]} />
            {/* Sun sits on the camera side, a little high: the screen-facing
                half is lit, shadows fall away behind the rocket, so no angle
                management. The HDRI adds the broad soft sheen. */}
            <ambientLight intensity={0.12} />
            <directionalLight
              position={[3, 4, 26]}
              intensity={2.1}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-bias={-0.0002}
              shadow-normalBias={0.02}
              shadow-camera-left={-24}
              shadow-camera-right={24}
              shadow-camera-top={8}
              shadow-camera-bottom={-8}
              shadow-camera-near={1}
              shadow-camera-far={80}
            />
            <directionalLight position={[10, 3, -8]} intensity={0.6} color="#FFD2B0" />
            <RevealOnFirstFrame />
            <Suspense fallback={null}>
              <Rocket fullBurn={fullBurn} />
            </Suspense>
          </Canvas>
        </div>
      )}
    </div>
  );
}
