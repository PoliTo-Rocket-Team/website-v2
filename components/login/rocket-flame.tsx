import type { CSSProperties } from "react";
import Image from "next/image";
import { brand } from "@/lib/brand-colors";

// The upright Cavour and its flame on /login, drawn from board 36's layers
// (issue #159). Every number is the board's, in the 720-wide left panel, so
// the stage is laid out in board px and scaled as one piece on phones.
//
// Colour exception (design-system-manifest.md, Colour): the flame's warm
// stops #FF7A2E, #FFD2A6, #FFE6CC and pure white are board 36's flame ramp,
// not brand tokens. The glow and the outer streaks are the accent.

/** Stage origin in board px: the glow's left edge and the rocket's top. */
const STAGE_X = 315;
const STAGE_Y = 160;
/** Glow width and the longest streak's end (548 + 330) set the stage size. */
const STAGE_W = 90;
const STAGE_H = 878 - STAGE_Y;

/** The rocket box; the render is 70:480 with the nozzle at y 548. */
const ROCKET = { x: 325, y: 160, w: 70, h: 480 } as const;
const NOZZLE_Y = 548;

const WHITE = "#FFFFFF";

type Glow = { x: number; y: number; w: number; h: number; color: string; opacity: number; blur: number };

// Four ellipses, back to front: glow, plume, hot, core.
const ELLIPSES: readonly Glow[] = [
  { x: 315, y: 498.8, w: 90, h: 360, color: brand.accent, opacity: 0.55, blur: 28 },
  { x: 338, y: 506, w: 44, h: 300, color: "#FF7A2E", opacity: 0.85, blur: 12 },
  { x: 349, y: 518, w: 22, h: 200, color: "#FFD2A6", opacity: 0.95, blur: 6 },
  { x: 355, y: 528.8, w: 10, h: 110, color: WHITE, opacity: 1, blur: 3 },
];

type Streak = { x: number; w: number; h: number; color: string; opacity: number };

// Nine thin rounded streaks from the nozzle, left to right.
const STREAKS: readonly Streak[] = [
  { x: 323.5, w: 3, h: 190, color: brand.accent, opacity: 0.4 },
  { x: 332, w: 4, h: 250, color: "#FF7A2E", opacity: 0.5 },
  { x: 341.5, w: 3, h: 300, color: "#FFD2A6", opacity: 0.55 },
  { x: 348.5, w: 5, h: 330, color: WHITE, opacity: 0.5 },
  { x: 356.5, w: 3, h: 260, color: "#FFE6CC", opacity: 0.7 },
  { x: 364, w: 4, h: 320, color: WHITE, opacity: 0.45 },
  { x: 372.5, w: 3, h: 290, color: "#FFD2A6", opacity: 0.55 },
  { x: 379.5, w: 5, h: 240, color: "#FF7A2E", opacity: 0.5 },
  { x: 389.5, w: 3, h: 200, color: brand.accent, opacity: 0.4 },
];
const STREAK_BLUR = 2.5;

function layer(x: number, y: number, w: number, h: number, color: string, opacity: number, blur: number): CSSProperties {
  return {
    left: x - STAGE_X,
    top: y - STAGE_Y,
    width: w,
    height: h,
    opacity,
    filter: `blur(${blur}px)`,
    background: `linear-gradient(to bottom, ${color}, transparent)`,
  };
}

/**
 * The rocket and flame stage, `STAGE_W` x `STAGE_H` board px. The parent
 * places it; `className` carries the scale on phones. Board 36m draws the
 * same stage at 0.43, except the rocket, which sits 33.7 phone px (78 board
 * px) higher than the scaled flame: `rocketClassName` carries that lift.
 */
export function RocketFlame({ className = "", rocketClassName = "" }: { className?: string; rocketClassName?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none relative ${className}`}
      style={{ width: STAGE_W, height: STAGE_H }}
    >
      {ELLIPSES.map((e) => (
        <div
          key={`${e.x}-${e.y}`}
          className="absolute rounded-[50%]"
          style={layer(e.x, e.y, e.w, e.h, e.color, e.opacity, e.blur)}
        />
      ))}
      {STREAKS.map((s) => (
        <div
          key={s.x}
          className="absolute rounded-full"
          style={layer(s.x, NOZZLE_Y, s.w, s.h, s.color, s.opacity, STREAK_BLUR)}
        />
      ))}
      <Image
        src="/login/cavour-render-vert.webp"
        alt=""
        width={210}
        height={1440}
        priority
        className={`absolute max-w-none ${rocketClassName}`}
        style={{ left: ROCKET.x - STAGE_X, top: ROCKET.y - STAGE_Y, width: ROCKET.w, height: ROCKET.h }}
      />
    </div>
  );
}
