// When the project card canvases may do their heavy setup.
//
// Each card is its own WebGL canvas: it creates a context, uploads the shared
// vehicle (rocket-cavour.tsx), turns the HDRI into an environment map and
// compiles its shaders. Done while the hero's rocket moves, that work steals
// frames from it (issue #29). Done only once the hero's entrance has settled,
// nine seconds in, a reader who scrolls early finds the cards still loading
// (issues #45, #53).
//
// So a card starts its setup only while nothing holds the queue, and the hero
// holds it for every stretch in which its rocket must not lose a frame:
//  - hero.tsx, while the rocket loads, and from DRIVE_LEAD_MS before the
//    drive-in until it starts;
//  - hero-rocket-3d.tsx, while the rocket warms up, for the whole drive-in,
//    and while the plume eases to idle on screen after it.
// That leaves the entrance's opening hold, once the rocket is warm and waits
// parked off stage (see hero-rocket-3d.tsx), and everything after the plume
// has eased.
//
// A setup that has started is never stopped, so the hold before the drive-in
// lands early on purpose. A card loads its code first, and starts its canvas
// only after that, in idle time while the queue is still open. The canvas's
// heavy work (context, environment map, shader compile, first upload) then
// runs within a few frames of that start, so the lead puts it before the
// drive-in.
//
// Each card shows its poster until its canvas has drawn
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

/** What the queue runs for one card, in order. */
export type CardWork = {
  /** Fetches the card's code. Runs on the card's turn, while nothing holds. */
  load: () => Promise<unknown>;
  /** Starts the canvas. Runs once `load` is done and nothing holds the queue. */
  start: (done: SetupDone) => void;
};

/**
 * How long before the drive-in the hero closes the queue (hero.tsx). A card
 * that starts just before the hold lands has this long to do its heavy work.
 */
export const DRIVE_LEAD_MS = 500;

// A card that never reports back (a lost context, say) must not hold the
// others back for ever.
const SETUP_TIMEOUT_MS = 4000;

type Entry = CardWork & { near: boolean; cancelled: boolean };

const holds = new Set<symbol>();
const queue: Entry[] = [];
let running = false;
let waiting = false;
/** The running card's next step, waiting for idle time with no hold. */
let nextStep: (() => void) | null = null;

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
    flush();
  };
}

/**
 * Queues one card's setup, one card at a time: the next card loads only after
 * this one calls `done`. Cards near the viewport go first.
 */
export function queueCardSetup(work: CardWork): CardSetup {
  const entry: Entry = { ...work, near: false, cancelled: false };
  queue.push(entry);
  pump();
  return {
    hurry: () => {
      entry.near = true;
    },
    cancel: () => {
      entry.cancelled = true;
      const i = queue.indexOf(entry);
      if (i >= 0) queue.splice(i, 1);
    },
  };
}

function pump() {
  if (running || queue.length === 0) return;
  running = true;
  // Picked in idle time, so a card that came near meanwhile goes first.
  whenOpen(() => {
    const [entry] = queue.splice(Math.max(queue.findIndex((e) => e.near), 0), 1);
    if (entry) run(entry);
    else running = false;
  });
}

function run(entry: Entry) {
  let finished = false;
  let timer = 0;
  const done = () => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    running = false;
    pump();
  };
  const start = () => {
    if (entry.cancelled) return done();
    timer = window.setTimeout(done, SETUP_TIMEOUT_MS);
    entry.start(done);
  };
  // A failed load leaves the card on its poster; the queue moves on.
  entry.load().then(() => whenOpen(start), done);
}

/** Runs the running card's next step in idle time, once nothing holds. */
function whenOpen(step: () => void) {
  nextStep = step;
  flush();
}

function flush() {
  if (waiting || holds.size > 0 || !nextStep) return;
  waiting = true;
  idle(() => {
    waiting = false;
    // A hold may have landed while this waited for idle time.
    if (holds.size > 0 || !nextStep) return;
    const step = nextStep;
    nextStep = null;
    step();
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
