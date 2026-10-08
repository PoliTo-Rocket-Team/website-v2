"use client";

import {
  Suspense,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import Plume, { type Burn, type PlumeHandle } from "./hero-plume";
import CavourBuilt from "./rocket-cavour";
import type { WeatherUniforms } from "./hero-weathering";
import { RevealOnFirstFrame } from "./reveal-on-first-frame";
import { LastFrame, type AtRest } from "./last-frame";
import { SceneErrorBoundary, WarmUp, WatchContext } from "./scene-ready";
import { CAVOUR_HDRI } from "./cavour-assets";
import { holdCardSetup } from "./scene-schedule";
import { useClearGlassBarOver } from "./glass-bar";
import { webglSupported } from "./webgl";

// Three.js hero stage: the code-built Cavour (rocket-cavour.tsx) horizontal,
// nose right, matching the static render's framing (nose ~95% across, plume
// trailing to the left edge). The Blender GLB it was measured from lives in
// design/cavour.glb, out of public/ so it is never served.
// Idle: hover bob only (decision 0004: no shake); the plume fades out once
// parked (hero-plume.tsx).
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
  burn,
  onPlumeGoneChange,
  ref,
}: {
  burn: Burn;
  onPlumeGoneChange: (gone: boolean) => void;
  ref?: Ref<AtRest>;
}) {
  const group = useRef<THREE.Group>(null!);
  const earth = useRef<THREE.DirectionalLight>(null!);
  const plume = useRef<PlumeHandle>(null);
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

  // The held frame of a return shows the rocket at rest whenever the page was
  // left (issue #111): plume off and belly light at its parked trace, as
  // hero.tsx shows the stage parked. The light keeps the direction it last
  // read; at the parked trace that is not visible.
  useImperativeHandle(
    ref,
    () => ({
      putAtRest() {
        plume.current?.putOut();
        if (earth.current) earth.current.intensity = EARTH_PARKED;
        weather.uBelly.value = BELLY_PARKED;
      },
    }),
    [weather],
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
        <Plume ref={plume} burn={burn} onGoneChange={onPlumeGoneChange} />
      </group>
    </group>
  );
}

/** The hero's entrance, as hero.tsx runs it (decision 0004). */
type Phase = "enter" | "drive" | "settled";

/** The engine through the entrance: full burn on the drive-in, out once parked. */
const BURN: Record<Phase, Burn> = { enter: "idle", drive: "full", settled: "out" };

// Render budget (issue #48): the site must stay light. The canvas draws every
// display frame only while something really moves — the hold, the drive-in,
// and the plume fading out after it. Parked there is no plume, only the slow
// bob (one lap in 9s, at most ~4px a second). It reads the same at 10 fps, so
// it draws at most that (issue #63; 15 in #59, 30 before). Once nobody has scrolled, pointed or typed for
// PARKED_STILL_MS, it holds a still frame, and the next input wakes it where
// it stopped (SceneClock). Off screen it draws nothing.
const PARKED_FPS = 10;
const PARKED_GAP_MS = 1000 / PARKED_FPS;
const PARKED_STILL_MS = 5000;
// What counts as someone at the page. Scroll covers the keyboard and the
// scrollbar too.
const WAKE_EVENTS = ["pointermove", "pointerdown", "wheel", "scroll", "keydown", "touchstart"] as const;

/**
 * How often the canvas draws. One value, so no mix of flags can ask for two
 * rates at once.
 *  - "every-frame": warming up, or the rocket is on the move
 *  - "parked":      the bob at PARKED_FPS, then a still
 *                   frame while nobody is at the page
 *  - "on-resize":   reduced motion; the finished scene, redrawn only when a
 *                   resize clears the canvas
 *  - "none":        off screen; the last frame stays up
 */
type DrawRate = "every-frame" | "parked" | "on-resize" | "none";

function drawRate(ready: boolean, visible: boolean, moving: boolean): DrawRate {
  // Warm-up draws even off screen (on phones the stage waits fully outside
  // the viewport during the hold), so the rocket has drawn before the
  // drive-in starts.
  if (!ready) return "every-frame";
  if (!visible) return "none";
  if (REDUCED) return "on-resize";
  return moving ? "every-frame" : "parked";
}

/**
 * Scene time for a canvas that does not draw all the time. While it draws,
 * scene time is wall-clock time: each draw moves it on by the real time since
 * the one before, so the bob and the plume move at full speed however few
 * frames are drawn, never in slow motion. While it does not draw (a
 * still frame, a hidden tab, off screen) the clock is paused, so the next
 * draw carries on from where the last one stopped instead of jumping ahead.
 * (R3F's own clock would restart at zero on every setFrameloop.)
 */
class SceneClock {
  private seconds = 0;
  private last: number | null = null;

  /** Scene seconds for a draw at `now` (ms, performance.now() time). */
  at(now: number): number {
    if (this.last !== null) this.seconds += Math.max(now - this.last, 0) / 1000;
    this.last = now;
    return this.seconds;
  }

  /** Drawing stopped: the time until the next draw does not count. */
  pause(): void {
    this.last = null;
  }
}

/**
 * Draws parked: one frame every PARKED_GAP_MS while someone is at the page,
 * then none once they have been away PARKED_STILL_MS; any input wakes it.
 * It waits on a timer, not on every display frame, so a parked hero does not
 * wake the page 60 times a second to draw 10. A hidden tab gets no animation
 * frames, so it draws nothing there. `still` runs when it stops drawing.
 * Returns the stop.
 */
function driveParked(draw: (now: number) => void, still: () => void): () => void {
  let lastInput = performance.now();
  let drawing = false;
  let timer = 0;
  let frame = 0;
  const next = () => {
    frame = requestAnimationFrame((now) => {
      draw(now);
      if (now - lastInput > PARKED_STILL_MS) {
        drawing = false;
        still();
        return;
      }
      timer = window.setTimeout(next, PARKED_GAP_MS);
    });
  };
  const wake = () => {
    lastInput = performance.now();
    if (drawing) return;
    drawing = true;
    next();
  };
  wake();
  for (const type of WAKE_EVENTS) window.addEventListener(type, wake, { passive: true });
  return () => {
    for (const type of WAKE_EVENTS) window.removeEventListener(type, wake);
    window.clearTimeout(timer);
    cancelAnimationFrame(frame);
  };
}

/**
 * Drives a `frameloop="never"` canvas at its draw rate, on one SceneClock for
 * every rate, so switching rate never restarts or jumps the bob or the plume.
 * The clock outlives the canvas, so a new canvas carries on the bob where the
 * last one stopped and matches its held frame (issue #111).
 * A hidden tab gets no animation frames, so it draws nothing there either.
 */
function FrameDriver({ rate, clock }: { rate: DrawRate; clock: SceneClock }) {
  const advance = useThree((s) => s.advance);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const dpr = useThree((s) => s.viewport.dpr);

  // A hidden tab gets no animation frames: the time it stays hidden does not
  // count.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) clock.pause();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [clock]);

  useEffect(() => {
    const draw = (now: number) => advance(clock.at(now));
    if (rate === "parked") return driveParked(draw, () => clock.pause());
    if (rate !== "every-frame") {
      clock.pause();
      return;
    }
    let id = requestAnimationFrame(function tick(now) {
      id = requestAnimationFrame(tick);
      draw(now);
    });
    return () => cancelAnimationFrame(id);
  }, [rate, advance, clock]);

  // A resize clears the canvas; redraw the still scene once it lands.
  useEffect(() => {
    if (rate !== "on-resize") return;
    advance(clock.at(performance.now()));
    clock.pause();
  }, [rate, width, height, dpr, advance, clock]);

  return null;
}


/** What the hero's phase clock waits for before the drive-in may start. */
export type RocketStatus = "ready" | "unavailable";

/**
 * Which canvas the hero shows. A canvas exists only while the stage names
 * one, and every new canvas gets a new id used as its React key, so React
 * builds a fresh <canvas> element with a fresh WebGL context: a canvas whose
 * context is gone is never shown again (issue #77; the cards do the same,
 * rocket-card-stage.tsx).
 *  - "hidden":      the page is hidden, or not shown yet: no canvas
 *  - "unavailable": no rocket for this page load: no WebGL, or the scene
 *                   failed to load
 *  - "warming":     the canvas loads and compiles its scene, still invisible
 *  - "ready":       the canvas has drawn the scene
 */
type Stage =
  | { kind: "hidden" }
  | { kind: "unavailable" }
  | { kind: "warming" | "ready"; canvas: number; reveal: Reveal };

/**
 * How a new canvas comes into view (issue #111).
 *  - "at-once":         no canvas of this page has drawn yet (first load):
 *                       RevealOnFirstFrame shows it as it draws, as before
 *  - "fade":            a later canvas fades in once it has drawn, never a pop
 *  - "over-last-frame": a return with the rocket's last frame held: the
 *                       frame shows at once, the canvas fades in over it
 */
type Reveal = "at-once" | "fade" | "over-last-frame";

function revealFor(drawnBefore: boolean, frameHeld: boolean): Reveal {
  if (!drawnBefore) return "at-once";
  return frameHeld ? "over-last-frame" : "fade";
}

/** The crossfade from the held frame to the new canvas. */
const FADE_IN = "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out";
const FADE_OUT = "motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-in";

type StageEvent =
  /** The page is shown (first load, or shown again): mount a new canvas. */
  | { type: "shown"; canvas: number; reveal: Reveal }
  /** The page is shown, and this browser cannot draw WebGL. */
  | { type: "unsupported" }
  /** Next hid the page (cacheComponents): drop the canvas. */
  | { type: "hidden" }
  /** The canvas has compiled and drawn its scene. */
  | { type: "warm"; canvas: number }
  /**
   * The canvas's context is lost: drop it and mount `next` in its place. A
   * lost context draws nothing, so no frame is held for it.
   */
  | { type: "lost"; canvas: number; next: number; reveal: Exclude<Reveal, "over-last-frame"> }
  /** The scene failed to load: no rocket for this page load. */
  | { type: "failed"; canvas: number };

const HIDDEN: Stage = { kind: "hidden" };

// Each canvas event moves only the canvas it names, so a late report from a
// canvas that is already gone changes nothing.
function step(stage: Stage, e: StageEvent): Stage {
  if (stage.kind === "unavailable") return stage;
  if (e.type === "hidden") return HIDDEN;
  if (e.type === "shown") {
    return stage.kind === "hidden" ? { kind: "warming", canvas: e.canvas, reveal: e.reveal } : stage;
  }
  if (e.type === "unsupported") return stage.kind === "hidden" ? { kind: "unavailable" } : stage;
  if (stage.kind === "hidden" || stage.canvas !== e.canvas) return stage;
  if (e.type === "lost") return { kind: "warming", canvas: e.next, reveal: e.reveal };
  if (e.type === "failed") return { kind: "unavailable" };
  return stage.kind === "warming" ? { ...stage, kind: "ready" } : stage;
}

type Props = {
  /** Where the entrance is: the plume burns full during "drive". */
  phase: Phase;
  /**
   * "ready" once the rocket is loaded, compiled and drawn (off stage), so the
   * drive-in never starts on a blank canvas. "unavailable" when there will be
   * no rocket: no WebGL, or the scene failed to load. Called at most once
   * per mounted canvas, and never for a canvas already dropped.
   */
  onStatus?: (status: RocketStatus) => void;
};

/**
 * The hero's rocket canvas, and when it exists.
 *
 * Next keeps the home page mounted but hidden when you leave it
 * (cacheComponents), and R3F loses the hidden canvas's WebGL context on
 * purpose; a lost canvas paints white or blank. So hiding the page drops the
 * canvas, and every showing mounts a new one, as does a lost context. A new
 * canvas opens straight into the scene hero.tsx names, which on a return is
 * the settled one, and stays invisible until it has drawn.
 *
 * A new context must upload and compile the scene before it draws, so a
 * return would show no rocket for a moment, then a pop (issue #111). As the
 * page hides, the live canvas draws the rocket at rest once more and that
 * frame is copied (LastFrame), so a page left mid-entrance holds no plume; on
 * a return that copy shows at once and the new canvas fades in over it once
 * drawn.
 * The copy is the rocket's own frame, not a poster or a static asset, so
 * decision 0004 holds: a page that never drew the rocket shows none.
 */
export default function HeroRocket3D({ phase, onStatus }: Props) {
  const [stage, setStage] = useState<Stage>(HIDDEN);
  // The stage as of the last event, ahead of React's render, so a callback
  // can tell at once whether its canvas is still the one shown.
  const stageNow = useRef(stage);
  const canvasIds = useRef(0);
  // The live canvas's R3F state, so the hide can copy its last frame.
  const three = useRef<RootState | null>(null);
  const rocket = useRef<AtRest>(null);
  const lastFrame = useMemo(() => new LastFrame(), []);
  const clock = useMemo(() => new SceneClock(), []);
  // Whether any canvas of this page has drawn the scene: until one has,
  // a new canvas is the first load's and shows as it always did.
  const drawnBefore = useRef(false);
  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  /** Applies one event; true when it changed the stage. */
  const send = (e: StageEvent): boolean => {
    const next = step(stageNow.current, e);
    if (next === stageNow.current) return false;
    stageNow.current = next;
    setStage(next);
    return true;
  };
  const report = (e: StageEvent, status: RocketStatus) => {
    if (send(e)) onStatusRef.current?.(status);
  };
  const warm = (canvas: number) => {
    if (!send({ type: "warm", canvas })) return;
    // The new canvas draws newer frames than the held one.
    drawnBefore.current = true;
    lastFrame.drop();
    onStatusRef.current?.("ready");
  };

  const [visible, setVisible] = useState(false);
  const [plumeGone, setPlumeGone] = useState(false);
  const live = stage.kind === "warming" || stage.kind === "ready";
  const ready = stage.kind === "ready";
  const rate = drawRate(ready, visible, phase !== "settled" || !plumeGone);
  // The project cards set up their canvases only while this one can spare
  // the frames (scene-schedule.ts): it holds them while it warms up, for the
  // whole drive-in (on screen or not, so none starts just before the rocket
  // comes into view), and while the plume fades out on screen. In the
  // opening hold the rocket waits parked off stage (on some screen sizes its
  // nose shows, moving less than a pixel a frame), so a frame lost there
  // shows nothing: it holds nothing then, and hero.tsx closes the queue
  // shortly before the drive-in. A new canvas warms up again, so a return to
  // the page holds the queue again until it is ready.
  // No canvas (hidden, no WebGL, a failed scene) holds nothing.
  const holdCards =
    stage.kind === "warming" ||
    (ready && (phase === "drive" || (phase === "settled" && visible && !plumeGone)));
  useEffect(() => (holdCards ? holdCardSetup() : undefined), [holdCards]);
  const wrapRef = useRef<HTMLDivElement>(null);
  // The canvas may draw under the navbar; the bar drops its blur there
  // instead, so the bob keeps going and no frame costs a re-blur (#61).
  useClearGlassBarOver(wrapRef, live);

  // Before the first paint of every showing, so the page never shows a
  // canvas from its last visit, even for one frame.
  useLayoutEffect(() => {
    // No static fallback by decision 0004: if WebGL is unavailable the hero
    // is just the type; nothing renders here.
    if (stageNow.current.kind === "hidden") {
      if (webglSupported()) {
        const reveal = revealFor(drawnBefore.current, lastFrame.isHeld);
        send({ type: "shown", canvas: ++canvasIds.current, reveal });
      } else report({ type: "unsupported" }, "unavailable");
    }
    return () => {
      // React runs this before the canvas's own cleanup, so its context is
      // still live here. A canvas still warming has drawn nothing newer, so
      // a frame held from before stays held.
      const s = three.current;
      const r = rocket.current;
      if (stageNow.current.kind === "ready" && s && r) lastFrame.capture(s.gl, s.scene, s.camera, r);
      clock.pause();
      send({ type: "hidden" });
    };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Keep the canvas mounted; only pause the frame loop while offscreen so
    // scrolling back shows the last frame, not a fresh reload.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const canvas = live ? stage.canvas : null;
  const reveal = live ? stage.reveal : null;
  // The held frame shows from the first paint of a return until the new
  // canvas has drawn, then fades out under it. It appears at once: only its
  // fade out has a transition.
  const frameShown = stage.kind === "warming" && reveal === "over-last-frame";
  // A canvas after the first load's fades in once drawn, never a pop.
  const canvasFade =
    reveal === null || reveal === "at-once" ? "" : `${FADE_IN} ${ready ? "opacity-100" : "opacity-0"}`;

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <canvas
        ref={lastFrame.attach}
        aria-hidden
        className={`absolute inset-0 h-full w-full ${frameShown ? "opacity-100" : `opacity-0 ${FADE_OUT}`}`}
      />
      {canvas !== null && (
        // The canvas starts invisible and RevealOnFirstFrame shows it once it
        // has actually drawn; see reveal-on-first-frame.tsx for why.
        <div key={canvas} className={`absolute inset-0 [&_canvas]:opacity-0 ${canvasFade}`}>
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
            onCreated={(state) => {
              three.current = state;
            }}
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
            <WatchContext
              onLost={() =>
                send({
                  type: "lost",
                  canvas,
                  next: ++canvasIds.current,
                  reveal: drawnBefore.current ? "fade" : "at-once",
                })
              }
            />
            <FrameDriver rate={rate} clock={clock} />
            <RevealOnFirstFrame />
            <SceneErrorBoundary onError={() => report({ type: "failed", canvas }, "unavailable")}>
              {/* The environment, the rocket and the warm-up share one
                  Suspense: the rocket is ready only when all of it is. */}
              <Suspense fallback={null}>
                <Environment
                  files={CAVOUR_HDRI}
                  environmentIntensity={0.45}
                  environmentRotation={[-Math.PI / 2, 0, 0]}
                />
                <Rocket ref={rocket} burn={BURN[phase]} onPlumeGoneChange={setPlumeGone} />
                <WarmUp onWarm={() => warm(canvas)} />
              </Suspense>
            </SceneErrorBoundary>
          </Canvas>
        </div>
      )}
    </div>
  );
}
