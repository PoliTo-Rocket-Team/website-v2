"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { CAVOUR_CARD_POSTER } from "./cavour-assets";
import { queueCardSetup, type SetupDone } from "./scene-schedule";
import { webglSupported } from "./webgl";

// The card's 3D canvas (rocket-card-3d.tsx) is a separate chunk. Imported
// directly, it put three.js into the page's first bundle, and every visitor
// downloaded and ran it before the hero could start (issue #45).
const RocketCard3D = dynamic(() => import("./rocket-card-3d"), { ssr: false });
// The same chunk, fetched on the card's turn so the canvas can start as soon
// as it mounts (scene-schedule.ts).
const loadRocketCard3D = () => import("./rocket-card-3d");

/**
 * What the card shows. A canvas exists only while the stage names one, and
 * every new canvas gets a new id, so React builds a fresh <canvas> element
 * with a fresh WebGL context: a canvas whose context is gone is never shown
 * or reused.
 *  - "poster":  the poster alone, no canvas
 *  - "drawing": the poster, with the canvas setting up hidden behind it
 *  - "fading":  the drawn canvas fading in over the poster
 *  - "live":    the canvas alone
 */
type Stage = { kind: "poster" } | { kind: "drawing" | "fading" | "live"; canvas: number };

type StageEvent =
  /** The card's turn in scene-schedule.ts: mount a new canvas. */
  | { type: "start"; canvas: number }
  /** The canvas has drawn its finished frame: fade it in. */
  | { type: "drawn"; canvas: number }
  /** The fade is over: the poster may leave. */
  | { type: "faded"; canvas: number }
  /** The canvas can no longer draw (lost context, failed scene): drop it. */
  | { type: "dropped"; canvas: number }
  /** The stage left the screen or came back: start over from the poster. */
  | { type: "reset" };

const POSTER: Stage = { kind: "poster" };

// Each step moves only the canvas it names, so a late report from a canvas
// that is already gone changes nothing.
function step(stage: Stage, e: StageEvent): Stage {
  if (e.type === "reset") return POSTER;
  if (e.type === "start") return stage.kind === "poster" ? { kind: "drawing", canvas: e.canvas } : stage;
  if (stage.kind === "poster" || stage.canvas !== e.canvas) return stage;
  if (e.type === "dropped") return POSTER;
  if (e.type === "drawn" && stage.kind === "drawing") return { kind: "fading", canvas: e.canvas };
  if (e.type === "faded" && stage.kind === "fading") return { kind: "live", canvas: e.canvas };
  return stage;
}

// The canvas fades in over an opaque poster, so the rocket never thins out
// mid-swap; the poster leaves once the fade is over. Under reduced motion
// there is no fade and the canvas appears at once over the same picture.
// The same 300ms as the duration-300 on the canvas below.
const FADE_MS = 300;

// The poster's drawn width: it fills the canvas box's height (1048px from md,
// 593px below) at its own 480 x 1048 shape. See CAVOUR_CARD_POSTER.
const POSTER_SIZES = "(min-width: 768px) 480px, 272px";

/**
 * Where a project card's rocket mounts, and when.
 *
 * From the first paint the card shows a poster: a still of the canvas's
 * finished frame, so a reader who scrolls down early never meets an empty
 * card. The canvas mounts on its turn in scene-schedule.ts, which runs only
 * while the hero's rocket can spare the frames, nearest cards first; a card
 * coming within a screen of the viewport moves to the front. Once the canvas
 * has drawn, it fades in over the poster.
 *
 * A canvas that loses its WebGL context paints white, so the stage drops it
 * and shows the poster again. Leaving a page does the same: Next keeps the
 * page it left mounted but hidden (cacheComponents), and R3F loses the
 * hidden canvas's context on purpose. Coming back starts from the poster and
 * queues a new canvas (issue #75).
 */
export function RocketCardStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [stage, dispatch] = useReducer(step, POSTER);
  const [tuning, setTuning] = useState(false);
  const [readout, setReadout] = useState("");
  // The scheduler's "next card" callback, held until this card's setup ends.
  const pendingDone = useRef<SetupDone | null>(null);
  const canvasIds = useRef(0);

  // Before the first paint of every return to the screen, so the card never
  // shows a canvas from its last visit, even for one frame.
  useLayoutEffect(() => {
    dispatch({ type: "reset" });
    return () => dispatch({ type: "reset" });
  }, []);

  useEffect(() => {
    const ok = webglSupported();
    setTuning(new URLSearchParams(window.location.search).has("cam"));
    // Without WebGL the poster is the card's rocket; nothing to queue.
    if (!ok) return;

    const setup = queueCardSetup({
      load: loadRocketCard3D,
      start: (done) => {
        pendingDone.current = done;
        dispatch({ type: "start", canvas: ++canvasIds.current });
      },
    });

    // A screen of margin: a fast scroll still finds the nearest card set up.
    // It only reorders the queue, so it never mounts a card while the hero
    // holds the queue.
    const el = wrapRef.current;
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setup.hurry();
          near.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    if (el) near.observe(el);

    return () => {
      near.disconnect();
      setup.cancel();
      pendingDone.current?.();
      pendingDone.current = null;
    };
  }, []);

  const fadingCanvas = stage.kind === "fading" ? stage.canvas : null;
  useEffect(() => {
    if (fadingCanvas === null) return;
    const t = window.setTimeout(() => dispatch({ type: "faded", canvas: fadingCanvas }), FADE_MS);
    return () => window.clearTimeout(t);
  }, [fadingCanvas]);

  const setupOver = () => {
    pendingDone.current?.();
    pendingDone.current = null;
  };
  const drop = (canvas: number) => {
    dispatch({ type: "dropped", canvas });
    setupOver();
  };
  const canvas = stage.kind === "poster" ? null : stage.canvas;
  const canvasHidden = stage.kind === "poster" || stage.kind === "drawing";

  return (
    // Fills the wrapper the card gives it, which hangs over the card's top
    // edge so the rocket has somewhere to rise into (projects.tsx).
    // The canvas is hidden from the first paint by CSS, not by an effect, so
    // its undrawn buffer (white on macOS GPUs) can never show; see
    // reveal-on-first-frame.tsx. It is shown only once it has drawn.
    <div
      ref={wrapRef}
      className={`pointer-events-none absolute inset-0 ${
        canvasHidden
          ? "[&_canvas]:opacity-0"
          : "motion-safe:[&_canvas]:transition-opacity motion-safe:[&_canvas]:duration-300 motion-safe:[&_canvas]:ease-out"
      }`}
    >
      {stage.kind !== "live" && (
        <Image src={CAVOUR_CARD_POSTER} alt="" fill sizes={POSTER_SIZES} className="object-cover" />
      )}
      {canvas !== null && (
        <RocketCard3D
          key={canvas}
          tuning={tuning}
          onReadout={setReadout}
          onReady={() => {
            dispatch({ type: "drawn", canvas });
            setupOver();
          }}
          onFailed={() => drop(canvas)}
          onLost={() => drop(canvas)}
        />
      )}
      {tuning && (
        <p className="pointer-events-none absolute bottom-1 left-1 rounded bg-ground/70 px-2 py-1 font-mono text-[10px] text-accent">
          {readout}
        </p>
      )}
    </div>
  );
}
