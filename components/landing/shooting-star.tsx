"use client";

import { useRef } from "react";
import { useMotionGate } from "./motion-gate";

/**
 * The footer's one shooting star, about every 20s, from 70% across and 12%
 * down its sky. The gate watches a box around the whole flight (the streak
 * travels 420px left and 136px down, tilted 18deg), not the moving streak.
 * The box starts 440px left and 24px up of the streak's start, so the streak
 * sits exactly where it always did. It pauses where it stands when the gate
 * closes, and is gone under reduced motion: a still streak would read as a
 * scratch.
 */
export function ShootingStar() {
  const ref = useRef<HTMLDivElement>(null);
  const run = useMotionGate(ref);
  return (
    <div
      ref={ref}
      aria-hidden
      className="absolute left-[calc(70%-440px)] top-[calc(12%-24px)] h-[184px] w-[552px] motion-reduce:hidden"
    >
      <span
        data-run={run ? "" : undefined}
        className="absolute left-[440px] top-[24px] h-px w-28 animate-shooting-star bg-gradient-to-r from-white to-transparent [animation-play-state:paused] data-[run]:[animation-play-state:running]"
      />
    </div>
  );
}
