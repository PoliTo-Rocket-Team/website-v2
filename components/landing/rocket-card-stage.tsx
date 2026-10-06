"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { whenSceneIdle, type SetupDone } from "./scene-schedule";

// The card's 3D canvas (rocket-card-3d.tsx) is a separate chunk. Imported
// directly, it put three.js into the page's first bundle, and every visitor
// downloaded and ran it before the hero could start (issue #45).
const RocketCard3D = dynamic(() => import("./rocket-card-3d"), { ssr: false });

function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Where a project card's rocket mounts, and when.
 *
 * The canvas mounts at whichever comes first:
 *  - its turn in scene-schedule.ts: after the hero has settled, one card at a
 *    time in idle time, so the vehicle is loaded, compiled and drawn long
 *    before anyone scrolls down to it;
 *  - the card coming near the viewport, for a reader who scrolls down while
 *    the hero is still playing.
 */
export function RocketCardStage() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [supported, setSupported] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [tuning, setTuning] = useState(false);
  const [readout, setReadout] = useState("");
  // The scheduler's "next card" callback, held until this card's setup ends.
  const pendingDone = useRef<SetupDone | null>(null);
  const setupOver = useRef(false);

  useEffect(() => {
    const ok = webglSupported();
    setSupported(ok);
    setTuning(new URLSearchParams(window.location.search).has("cam"));
    const el = wrapRef.current;
    if (!el) return;

    // A card scrolled near before its turn mounts at once. The margin is
    // kept small: at 1440x900 the cards start ~1800px down, and a full
    // screen of margin would mount all of them under the hero's entrance.
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

    const cancel = whenSceneIdle((done) => {
      if (!ok || setupOver.current) return done();
      pendingDone.current = done;
      setMounted(true);
    });

    return () => {
      near.disconnect();
      cancel();
      pendingDone.current?.();
    };
  }, []);

  const onSetupDone = () => {
    setupOver.current = true;
    pendingDone.current?.();
    pendingDone.current = null;
  };

  return (
    // Fills the wrapper the card gives it, which hangs over the card's top
    // edge so the rocket has somewhere to rise into (projects.tsx).
    // The canvas starts invisible and RevealOnFirstFrame shows it once it has
    // actually drawn; see reveal-on-first-frame.tsx for why.
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 [&_canvas]:opacity-0">
      {supported && mounted && (
        <RocketCard3D tuning={tuning} onReadout={setReadout} onSetupDone={onSetupDone} />
      )}
      {tuning && (
        <p className="pointer-events-none absolute bottom-1 left-1 rounded bg-ground/70 px-2 py-1 font-mono text-[10px] text-accent">
          {readout}
        </p>
      )}
    </div>
  );
}
