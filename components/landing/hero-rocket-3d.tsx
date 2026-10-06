"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import Plume from "./hero-plume";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { RevealOnFirstFrame } from "./reveal-on-first-frame";
import { SceneErrorBoundary, WarmUp } from "./scene-ready";
import { CAVOUR_HDRI } from "./cavour-assets";
import { holdCardSetup } from "./scene-schedule";

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

// IBL: a real small-studio HDRI (Poly Haven, CC0), CAVOUR_HDRI. Real
// softboxes and falloff give the metals proper streaks and the orange paint a
// believable sheen — the previous hand-built strip environment read flat and
// cartoony.

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

// The belly-light readings below force the browser to re-run layout and
// style (getBoundingClientRect, getComputedStyle) while the drive-in CSS
// animation is running, and doing that every frame was the biggest single
// cost on first load (issue #29). The light eases over seconds, so reading
// every few frames is invisible.
const DOM_READ_EVERY = 4;

function Rocket({
  fullBurn,
  onPlumeIdleChange,
}: {
  fullBurn: boolean;
  onPlumeIdleChange: (idle: boolean) => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const earth = useRef<THREE.DirectionalLight>(null!);
  const canvas = useThree((s) => s.gl.domElement);
  const stage = useRef<HTMLElement | null>(null);
  const frame = useRef(0);
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

    if (frame.current++ % DOM_READ_EVERY !== 0) return;
    stage.current ??= canvas.closest<HTMLElement>("[data-rocket-stage]");
    const el = stage.current;
    if (!el || !earth.current) return;
    const rect = el.getBoundingClientRect();
    // 0 at the parked height, 1 at the entry height (36vh lower, see hero.tsx)
    const parkedY = el.parentElement!.getBoundingClientRect().top + rect.height / 2;
    const lowness = THREE.MathUtils.clamp(
      ((rect.top + rect.bottom) / 2 - parkedY) / (0.36 * window.innerHeight),
      0,
      1,
    );
    const onStage = rect.right > 0 ? 1 : 0;
    earth.current.intensity = onStage * THREE.MathUtils.lerp(EARTH_PARKED, EARTH_PEAK, lowness);
    weather.uBelly.value = onStage * THREE.MathUtils.lerp(BELLY_PARKED, 1, lowness);
    // CSS rotate(θ): screen-down in the stage's own frame is (sinθ, -cosθ).
    // θ adds the wrapper's own tilt, which only the phone frame sets
    // (hero-phone.tsx); on the 1440 board the wrapper is untransformed.
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const w = new DOMMatrixReadOnly(getComputedStyle(el.parentElement!).transform);
    const theta = Math.atan2(m.b, m.a) + Math.atan2(w.b, w.a);
    weather.uDown.value.set(Math.sin(theta), -Math.cos(theta), 0);
    earth.current.position.set(Math.sin(theta) * 10, -Math.cos(theta) * 10, 3);
  });

  return (
    <group ref={group} position={[X_OFF, 0, 0]}>
      <directionalLight ref={earth} intensity={0} color="#ffffff" />
      <CavourBuilt weather={weather} length={LENGTH} />
      <group position={[-HALF, 0, 0]}>
        <Plume fullBurn={fullBurn} onIdleChange={onPlumeIdleChange} />
      </group>
    </group>
  );
}

/** The hero's entrance, as hero.tsx runs it (decision 0004). */
type Phase = "enter" | "drive" | "settled";

// Render budget (issue #48): the site must stay light. The canvas draws every
// display frame only while the rocket really moves — the hold, the drive-in,
// and the plume easing down to idle after it. Parked, only the slow bob (one
// lap in 9s) and the idle plume's faint flicker move, and they read the same
// at 15 fps, so it draws at most that (issue #59; 30 before). Off screen it
// draws nothing.
const PARKED_FPS = 15;
// Display frames land a little either side of their slot. Without this slack
// a 60 Hz screen would miss a 15 fps slot by a hair and wait a frame more.
const FRAME_SLACK_MS = 2;

/**
 * How often the canvas draws. One value, so no mix of flags can ask for two
 * rates at once.
 *  - "every-frame": warming up, or the rocket is on the move
 *  - "capped":      parked; the bob and idle plume at PARKED_FPS
 *  - "on-resize":   reduced motion; the finished scene, redrawn only when a
 *                   resize clears the canvas
 *  - "none":        off screen; the last frame stays up
 */
type DrawRate = "every-frame" | "capped" | "on-resize" | "none";

function drawRate(ready: boolean, visible: boolean, moving: boolean): DrawRate {
  // Warm-up draws even off screen (on phones the stage waits fully outside
  // the viewport during the hold), so the rocket has drawn before the
  // drive-in starts.
  if (!ready) return "every-frame";
  if (!visible) return "none";
  if (REDUCED) return "on-resize";
  return moving ? "every-frame" : "capped";
}

/**
 * Drives a `frameloop="never"` canvas at its draw rate. One clock for every
 * rate: scene time is seconds since mount, so switching rate never restarts
 * the bob or the plume (setFrameloop would reset R3F's clock to zero).
 * A hidden tab gets no animation frames, so it draws nothing there either.
 */
function FrameDriver({ rate }: { rate: DrawRate }) {
  const advance = useThree((s) => s.advance);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);
  const origin = useMemo(() => performance.now(), []);

  useEffect(() => {
    if (rate !== "every-frame" && rate !== "capped") return;
    const gap = rate === "capped" ? 1000 / PARKED_FPS : 0;
    let due = 0;
    let id = requestAnimationFrame(function tick(now) {
      id = requestAnimationFrame(tick);
      if (now < due - FRAME_SLACK_MS) return;
      // Keep the cadence, so the average never passes the cap; restart it
      // after a stall rather than drawing a burst to catch up.
      due = now - due > gap ? now + gap : due + gap;
      advance((now - origin) / 1000);
    });
    return () => cancelAnimationFrame(id);
  }, [rate, advance, origin]);

  // A resize clears the canvas; redraw the still scene once it lands.
  useEffect(() => {
    if (rate === "on-resize") advance((performance.now() - origin) / 1000);
  }, [rate, width, height, dpr, advance, origin]);

  return null;
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

/** What the hero's phase clock waits for before the drive-in may start. */
export type RocketStatus = "ready" | "unavailable";

type Props = {
  /** Where the entrance is: the plume burns full during "drive". */
  phase: Phase;
  /**
   * "ready" once the rocket is loaded, compiled and drawn (off stage), so the
   * drive-in never starts on a blank canvas. "unavailable" when there will be
   * no rocket: no WebGL, or the scene failed to load. Called once.
   */
  onStatus?: (status: RocketStatus) => void;
};

export default function HeroRocket3D({ phase, onStatus }: Props) {
  const [supported, setSupported] = useState(false);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [plumeIdle, setPlumeIdle] = useState(false);
  const rate = drawRate(ready, visible, phase !== "settled" || !plumeIdle);
  // The project cards set up their canvases only while this one is not
  // drawing every frame, so they never take a frame from the warm-up or the
  // drive-in (scene-schedule.ts).
  // A scene that failed to load never warms up, so it holds nothing.
  const drawingEveryFrame = supported && !failed && rate === "every-frame";
  useEffect(() => (drawingEveryFrame ? holdCardSetup() : undefined), [drawingEveryFrame]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;

  useEffect(() => {
    const ok = webglSupported();
    setSupported(ok);
    if (!ok) onStatusRef.current?.("unavailable");
    const el = wrapRef.current;
    if (!el) return;
    // Keep the canvas mounted; only pause the frame loop while offscreen so
    // scrolling back shows the last frame, not a fresh reload.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onWarm = () => {
    setReady(true);
    onStatusRef.current?.("ready");
  };

  return (
    // The canvas starts invisible and RevealOnFirstFrame shows it once it has
    // actually drawn; see reveal-on-first-frame.tsx for why.
    <div ref={wrapRef} className="relative h-full w-full [&_canvas]:opacity-0">
      {supported && (
        <div className="absolute inset-0">
          <Canvas
            // R3F never draws on its own: FrameDriver below draws at the rate
            // drawRate picks.
            frameloop="never"
            dpr={[1, 1.5]}
            // The wrapper animates transforms (rotation!) — measure the layout
            // box, not the transformed bounding rect, or the canvas mis-sizes.
            // No scroll tracking: the canvas takes no pointer events, so its
            // page position is never used.
            resize={{ offsetSize: true, scroll: false }}
            gl={{ alpha: true, antialias: true }}
            // "soft" asks for PCFSoftShadowMap, which three now silently swaps
            // for PCFShadowMap and warns. Ask for the real one: same picture.
            shadows="percentage"
            // Long lens: a 14° vertical fov from ~33 units back frames the same
            // 42x8 world window the orthographic setup did, but with the faint
            // foreshortening of a 200mm photo instead of a diagram's flatness.
            camera={{ fov: 14, position: [0, 0, 32.6], near: 1, far: 200 }}
          >
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
            <FrameDriver rate={rate} />
            <RevealOnFirstFrame />
            <SceneErrorBoundary
              onError={() => {
                setFailed(true);
                onStatusRef.current?.("unavailable");
              }}
            >
              {/* The environment, the rocket and the warm-up share one
                  Suspense: the rocket is ready only when all of it is. */}
              <Suspense fallback={null}>
                <Environment
                  files={CAVOUR_HDRI}
                  environmentIntensity={0.45}
                  environmentRotation={[-Math.PI / 2, 0, 0]}
                />
                <Rocket fullBurn={phase === "drive"} onPlumeIdleChange={setPlumeIdle} />
                <WarmUp onWarm={onWarm} />
              </Suspense>
            </SceneErrorBoundary>
          </Canvas>
        </div>
      )}
    </div>
  );
}
