"use client";

import { useRef, type CSSProperties } from "react";
import { useMotionGate } from "./motion-gate";

/**
 * One twinkling star. It holds still, at full brightness, until the motion
 * gate lets it run, and pauses where it stands when the gate closes, so it
 * never jumps. Off under reduced motion.
 */
export function TwinkleStar({ style }: { style: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  const run = useMotionGate(ref);
  return (
    <span
      ref={ref}
      data-run={run ? "" : undefined}
      className="absolute rounded-full bg-white animate-twinkle [animation-play-state:paused] data-[run]:[animation-play-state:running] motion-reduce:animate-none"
      style={style}
    />
  );
}
