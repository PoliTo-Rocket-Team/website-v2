// A trackpad's sideways two-finger scroll, read as one carousel step per
// gesture. A trackpad sends a burst of wheel events, then an inertia tail;
// the gesture steps once its sideways travel passes WHEEL_STEP_PX, and spends
// itself until the events stop for WHEEL_IDLE_MS, so the tail never steps
// again. Mostly vertical scrolling is left to the page.

export const WHEEL_STEP_PX = 40;
export const WHEEL_IDLE_MS = 200;

/** Where one sideways gesture stands. */
export type WheelGesture = {
  /** Sideways travel since the gesture began, in pixels. */
  readonly travel: number;
  /** True once this gesture has stepped. */
  readonly spent: boolean;
  /** When its last event came, in ms. */
  readonly at: number;
};

export const NO_GESTURE: WheelGesture = { travel: 0, spent: false, at: -Infinity };

export type WheelRead = {
  readonly gesture: WheelGesture;
  /** -1 back, 1 forward, 0 no step. */
  readonly step: -1 | 0 | 1;
  /** The event is sideways: the carousel takes it, so the page must not (no back-swipe). */
  readonly sideways: boolean;
};

export function readWheel(gesture: WheelGesture, dx: number, dy: number, now: number): WheelRead {
  const fresh = now - gesture.at > WHEEL_IDLE_MS ? NO_GESTURE : gesture;
  const sideways = Math.abs(dx) > Math.abs(dy);
  if (!sideways) return { gesture: { ...fresh, at: now }, step: 0, sideways };
  const travel = fresh.travel + dx;
  const steps = !fresh.spent && Math.abs(travel) >= WHEEL_STEP_PX;
  return {
    gesture: { travel, spent: fresh.spent || steps, at: now },
    step: steps ? (travel > 0 ? 1 : -1) : 0,
    sideways,
  };
}
