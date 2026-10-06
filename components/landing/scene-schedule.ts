// When the project card canvases may do their heavy setup.
//
// Each card is its own WebGL canvas: it creates a context, uploads the shared
// vehicle (rocket-cavour.tsx), turns the HDRI into an environment map and
// compiles its shaders. Done while the hero's rocket draws every frame, that
// work steals frames from it (issue #29). Done only once the hero's entrance
// has settled, nine seconds in, a reader who scrolls early finds the cards
// still loading (issues #45, #53).
//
// So the rule is about frames, not phases: a card starts its setup only while
// nothing holds the queue, and the hero holds it exactly while its rocket
// draws every frame (hero.tsx while the rocket loads, hero-rocket-3d.tsx
// while it warms up and while it moves on screen). On a normal load that
// opens the queue inside the entrance's opening hold, once the hero's own
// rocket is warm and before the drive-in, and again whenever the drive-in is
// off screen. Each card shows its poster until its canvas has drawn
// (rocket-card-stage.tsx), so a card that waits costs nothing visible.

/** Signals that one card's setup is over, so the next one may start. */
export type SetupDone = () => void;

/** One card's place in the queue. */
export type CardSetup = {
  /** The card is near the viewport: set it up before the cards further off. */
  hurry: () => void;
  /** The card unmounted: drop it from the queue. */
  cancel: () => void;
};

// A card that never reports back (a lost context, say) must not hold the
// others back for ever.
const SETUP_TIMEOUT_MS = 4000;

type Entry = { start: (done: SetupDone) => void; near: boolean };

const holds = new Set<symbol>();
const queue: Entry[] = [];
let running = false;
let waiting = false;

/**
 * Holds every card setup that has not started yet, until the returned
 * release is called. A setup already running finishes. A page with no hero
 * never holds the queue.
 */
export function holdCardSetup(): () => void {
  const hold = Symbol("hold");
  holds.add(hold);
  return () => {
    holds.delete(hold);
    pump();
  };
}

/**
 * Queues one card's setup. `start` runs in idle time while nothing holds the
 * queue, one card at a time: the next card starts only after this one calls
 * `done`. Cards near the viewport go first.
 */
export function queueCardSetup(start: (done: SetupDone) => void): CardSetup {
  const entry: Entry = { start, near: false };
  queue.push(entry);
  pump();
  return {
    hurry: () => {
      entry.near = true;
    },
    cancel: () => {
      const i = queue.indexOf(entry);
      if (i >= 0) queue.splice(i, 1);
    },
  };
}

function pump() {
  if (running || waiting || holds.size > 0 || queue.length === 0) return;
  waiting = true;
  idle(() => {
    waiting = false;
    // A hold may have landed while this waited for idle time.
    if (running || holds.size > 0) return;
    const [entry] = queue.splice(Math.max(queue.findIndex((e) => e.near), 0), 1);
    if (!entry) return;
    running = true;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      running = false;
      pump();
    };
    const timer = window.setTimeout(done, SETUP_TIMEOUT_MS);
    entry.start(done);
  });
}

// Safari has no requestIdleCallback; a timeout keeps the pacing.
function idle(cb: () => void) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => cb(), { timeout: 1000 });
  } else {
    window.setTimeout(cb, 200);
  }
}
