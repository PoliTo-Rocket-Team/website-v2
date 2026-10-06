// When the project card canvases may do their heavy setup.
//
// Each card is its own WebGL canvas: it builds its materials, turns the HDRI
// into an environment map and compiles its shaders. Done while the hero's
// entrance runs, that work steals frames from it (issue #29). Done only when
// the card scrolls near, the card shows its bare texture for a while
// (issue #45). So the cards wait for the hero to settle, then set up one at a
// time in idle time, well before anyone scrolls down to them.

/** Signals that one card's setup is over, so the next one may start. */
export type SetupDone = () => void;

// A card that never reports back (a lost context, say) must not hold the
// others back for ever.
const SETUP_TIMEOUT_MS = 4000;

let heroSettled = false;
const queue: Array<(done: SetupDone) => void> = [];

/** Called by the hero once its entrance is over, or will not run. */
export function markHeroSettled() {
  if (heroSettled) return;
  heroSettled = true;
  drain();
}

/**
 * Queues one card's setup: `start` runs in idle time once the hero has
 * settled, and the next card starts only after this one calls `done`.
 * Returns a cancel function for unmount.
 */
export function whenSceneIdle(start: (done: SetupDone) => void): () => void {
  const entry = (done: SetupDone) => start(done);
  queue.push(entry);
  if (heroSettled) drain();
  return () => {
    const i = queue.indexOf(entry);
    if (i >= 0) queue.splice(i, 1);
  };
}

let draining = false;
function drain() {
  if (draining) return;
  draining = true;
  const next = () => {
    const entry = queue.shift();
    if (!entry) {
      draining = false;
      return;
    }
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      idle(next);
    };
    const timer = window.setTimeout(done, SETUP_TIMEOUT_MS);
    entry(done);
  };
  idle(next);
}

// Safari has no requestIdleCallback; a timeout keeps the pacing.
function idle(cb: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => cb(), { timeout: 1000 });
  } else {
    window.setTimeout(cb, 200);
  }
}
