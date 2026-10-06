"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CAVOUR_CARD_POSTER } from "./cavour-assets";
import { queueCardSetup, type SetupDone } from "./scene-schedule";

// The card's 3D canvas (rocket-card-3d.tsx) is a separate chunk. Imported
// directly, it put three.js into the page's first bundle, and every visitor
// downloaded and ran it before the hero could start (issue #45).
const RocketCard3D = dynamic(() => import("./rocket-card-3d"), { ssr: false });
// The same chunk, fetched on the card's turn so the canvas can start as soon
// as it mounts (scene-schedule.ts).
const loadRocketCard3D = () => import("./rocket-card-3d");

function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * What the card shows:
 *  - "poster": the poster, with the canvas (if any) hidden behind it
 *  - "fading": the drawn canvas fading in over the poster
 *  - "live":   the canvas alone
 */
type Shown = "poster" | "fading" | "live";

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
 * `className` places the box; by default it fills its parent. The landing
 * card also gives it a hover rise (projects.tsx), and the 3D scene reads that
 * rise as it plays and shrinks the vehicle in step (rocket-card-3d.tsx). A
 * box with no rise (the /projects page) keeps the vehicle at rest.
 */
export function RocketCardStage({ className = "absolute inset-0" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState<Shown>("poster");
  const [tuning, setTuning] = useState(false);
  const [readout, setReadout] = useState("");
  // The scheduler's "next card" callback, held until this card's setup ends.
  const pendingDone = useRef<SetupDone | null>(null);

  useEffect(() => {
    const ok = webglSupported();
    setSupported(ok);
    setTuning(new URLSearchParams(window.location.search).has("cam"));
    // Without WebGL the poster is the card's rocket; nothing to queue.
    if (!ok) return;

    const setup = queueCardSetup({
      load: loadRocketCard3D,
      start: (done) => {
        pendingDone.current = done;
        setMounted(true);
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
    };
  }, []);

  useEffect(() => {
    if (shown !== "fading") return;
    const t = window.setTimeout(() => setShown("live"), FADE_MS);
    return () => window.clearTimeout(t);
  }, [shown]);

  const setupOver = () => {
    pendingDone.current?.();
    pendingDone.current = null;
  };
  const onReady = () => {
    setShown("fading");
    setupOver();
  };

  return (
    // On a landing card this box hangs over the card's top edge, so the
    // rocket has somewhere to rise into (projects.tsx).
    // The canvas is hidden from the first paint by CSS, not by an effect, so
    // its undrawn buffer (white on macOS GPUs) can never show; see
    // reveal-on-first-frame.tsx. It is shown only once it has drawn.
    <div
      ref={wrapRef}
      className={`pointer-events-none ${className} ${
        shown === "poster"
          ? "[&_canvas]:opacity-0"
          : "motion-safe:[&_canvas]:transition-opacity motion-safe:[&_canvas]:duration-300 motion-safe:[&_canvas]:ease-out"
      }`}
    >
      {shown !== "live" && (
        <Image src={CAVOUR_CARD_POSTER} alt="" fill sizes={POSTER_SIZES} className="object-cover" />
      )}
      {supported && mounted && (
        <RocketCard3D
          tuning={tuning}
          onReadout={setReadout}
          onReady={onReady}
          onFailed={setupOver}
          liftBox={wrapRef}
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
