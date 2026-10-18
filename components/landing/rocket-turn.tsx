"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useMotionGate } from "./motion-gate";

// The home card rocket's slow turn (issue #385): each rocket on the home
// Projects row turns about its own long axis, as the Efesto engine does
// (engine-efesto.tsx, issue #382). The turn is opt-in. The home card wraps
// its rocket in a RocketTurnBox; every other stage (the /projects panels,
// the dashboard and the edit shell's cards) has none, so its rocket holds
// still as before.
//
// The gate watches the top half of the card, not the canvas: the canvas hangs
// far above and below the card, so it reaches under the navbar while the
// whole card is still on screen, and the rocket would stop just as it came
// into view. The rocket's nose sits about 20px under the card's top edge, so
// that half is where a reader sees it. It is the top half, not the whole card,
// because the gate also stops when a blurring surface covers the watched
// box's centre: the card's centre sits only 13px above its glass info box on
// a phone, so one more line of description would stop the rocket for good.
// The top half's centre clears the info box at every width.

/** Whether the rocket in this box may turn now. No box: it holds still. */
const RocketTurn = createContext(false);

/** Read by the card stage (rocket-card-stage.tsx). */
export function useRocketTurn(): boolean {
  return useContext(RocketTurn);
}

/** True until read otherwise, so the first paint never starts a turn it must undo. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return reduced;
}

/**
 * The box a home card's rocket shows in. Its rocket turns while the motion
 * gate (motion-gate.ts) lets the box's top half move and the reader has not
 * asked for reduced motion; otherwise it holds where it stands.
 */
export function RocketTurnBox({ className, children }: { className: string; children: ReactNode }) {
  const topHalf = useRef<HTMLDivElement>(null);
  const open = useMotionGate(topHalf);
  const reduced = useReducedMotion();
  return (
    <div className={className}>
      <div ref={topHalf} aria-hidden className="absolute inset-x-0 top-0 h-1/2" />
      <RocketTurn.Provider value={open && !reduced}>{children}</RocketTurn.Provider>
    </div>
  );
}
