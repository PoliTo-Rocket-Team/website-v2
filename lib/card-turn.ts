// The motion of a card rocket's hover turn (issue #385), apart from three.js
// so it can be tested. The card canvas (components/landing/rocket-card-3d.tsx)
// calls stepCardTurn once per drawn frame and asks for the next frame only
// while it answers true, so a rocket at rest draws nothing.

/**
 * One turn in 20 s: twice the 40 s first tried, because a hover lasts
 * seconds, and at 40 s a two-second hover moved the vehicle too little to
 * read.
 */
export const TURN_PER_S = (2 * Math.PI) / 20;
/** How fast the turn eases in to full speed: a time constant. */
export const EASE_IN_S = 0.35;
/**
 * How fast the vehicle eases back to rest. It returns as a critically damped
 * spring, so it keeps the speed it had when the pointer left and slows into
 * the tuned pose, with no jerk.
 */
export const EASE_BACK_S = 0.5;
/** Closer to rest than this (radians, about 0.2°) and slower than this a second, it is at rest. */
export const REST_EPSILON = 0.003;

/**
 * Where the turn stands: the angle about the long axis, in (-π, π] so the
 * way back to rest is the short way, and the speed in radians a second.
 * Kept by the canvas and changed in place, so a frame allocates nothing.
 */
export type CardTurnMotion = { angle: number; speed: number };

/** What the vehicle is asked to do this frame: turn (its card is hovered) or go back to rest. */
export type CardTurnAim = "turn" | "rest";

/** The angle, wrapped into (-π, π]. */
export function wrapAngle(a: number): number {
  const turn = 2 * Math.PI;
  return a - turn * Math.ceil((a - Math.PI) / turn);
}

/**
 * Moves `m` on by `dt` seconds toward `aim`. True while the vehicle is still
 * moving, so the canvas must draw another frame; false once it is at rest,
 * where the angle is exactly 0, the tuned pose.
 */
export function stepCardTurn(m: CardTurnMotion, aim: CardTurnAim, dt: number): boolean {
  if (aim === "turn") {
    m.speed += (TURN_PER_S - m.speed) * (1 - Math.exp(-dt / EASE_IN_S));
    m.angle = wrapAngle(m.angle + m.speed * dt);
    return true;
  }
  if (Math.abs(m.angle) < REST_EPSILON && Math.abs(m.speed) < REST_EPSILON) {
    m.angle = 0;
    m.speed = 0;
    return false;
  }
  // Semi-implicit Euler: stable at every frame gap the canvas allows (100 ms at most).
  const w = 1 / EASE_BACK_S;
  m.speed += (-w * w * m.angle - 2 * w * m.speed) * dt;
  m.angle = wrapAngle(m.angle + m.speed * dt);
  return true;
}
