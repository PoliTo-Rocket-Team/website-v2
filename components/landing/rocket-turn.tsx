"use client";

import { createContext, useContext, useEffect, useState, type ComponentPropsWithoutRef } from "react";

// A card rocket turns about its own long axis while its card is hovered on a
// pointer device, then eases back to its tuned pose (issue #385). The turn is
// opt-in: the home Projects row and the /projects list wrap each card in a
// RocketTurnCard; every other card (the dashboard, the edit shell, the
// preview pages) has none, so its rocket holds still.
//
// A touch never turns a rocket: a tap is not a hover. Under reduced motion no
// rocket turns. At rest the card canvas draws nothing (rocket-card-3d.tsx).

/**
 * What a card's rocket is asked to do now. One value, so no mix of flags can
 * ask it to turn and rest at once.
 *  - "turn": its card is hovered; it turns about its long axis
 *  - "rest": it eases back to its tuned pose, then draws nothing
 *  - "hold": the tab is hidden; it stays where it stands and draws nothing
 */
export type RocketTurn = "turn" | "rest" | "hold";

/** No RocketTurnCard round the stage: the rocket rests. */
const RocketTurnContext = createContext<RocketTurn>("rest");

/** Read by the card stage (rocket-card-stage.tsx). */
export function useRocketTurn(): RocketTurn {
  return useContext(RocketTurnContext);
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

function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const read = () => setHidden(document.hidden);
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);
  return hidden;
}

/**
 * The card's own <article>, taking the same props. Hovering it with a mouse
 * or a pen turns the rocket inside; leaving it sends the rocket back to rest.
 */
export function RocketTurnCard({ children, ...article }: ComponentPropsWithoutRef<"article">) {
  const [hovered, setHovered] = useState(false);
  const reduced = useReducedMotion();
  const hidden = usePageHidden();
  const turn: RocketTurn = hidden ? "hold" : hovered && !reduced ? "turn" : "rest";
  return (
    <article
      {...article}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <RocketTurnContext.Provider value={turn}>{children}</RocketTurnContext.Provider>
    </article>
  );
}
