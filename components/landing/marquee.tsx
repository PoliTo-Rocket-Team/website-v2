"use client";

import { useRef, type ReactNode } from "react";
import { useMotionGate } from "./motion-gate";

/**
 * The partners strip: its children loop right to left, 40s a lap (the list
 * is passed twice, so the -50% end meets the start). The gate watches the
 * strip, not the wider moving track. The track moves by transform only, runs
 * only while the gate allows it, stops on hover, and holds still under reduced
 * motion. It pauses where it stands, so it never jumps back.
 */
export function Marquee({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const run = useMotionGate(ref);
  return (
    <div
      ref={ref}
      className="group relative mt-6 flex h-14 items-center overflow-hidden md:mt-14 md:block md:h-auto [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
    >
      <div
        data-run={run ? "" : undefined}
        className="flex w-max animate-marquee items-center [animation-play-state:paused] data-[run]:[animation-play-state:running] group-hover:[animation-play-state:paused] motion-reduce:animate-none"
      >
        {children}
      </div>
    </div>
  );
}
