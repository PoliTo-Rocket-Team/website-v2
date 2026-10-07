// The desktop org chart's arc, placed by count (boards 26 and 26b). All
// lengths are px, measured from the centre of an invisible circle around the
// team leader's photo, name and icons; y grows downward.
//
// Every leader's photo centre sits on one circle round that centre, the
// leaders spread evenly from the left of the circle, through the bottom, to
// the right. Each dashed line points at the centre: it starts on the
// invisible circle's edge and stops just short of the leader's photo. With
// more leaders the photos shrink and the arc widens. The numbers are fitted to
// the two boards: 4 leaders (photo 148, radius 419, spread from 25 degrees
// below the horizontal) and 8 (photo 128, radius 559, from 6 degrees).

/** The team leader's photo, and how far the circle's centre sits below the photo's centre. */
export const LEADER_PHOTO = 176;
export const CENTRE_BELOW_PHOTO = 55;
/** The invisible circle round the team leader, where every line starts. */
const LEADER_CIRCLE = 176;
/** The gap between a line's end and the leader's photo. */
const LINE_GAP = 14;

export type ArcNode = {
  /** The photo's centre. */
  x: number;
  y: number;
  photo: number;
  line: { x1: number; y1: number; x2: number; y2: number };
};

/** Where each leader sits, in the order given: the first half left of the centre, the rest right, each from the centre outward. */
export function arcLayout(count: number): readonly ArcNode[] {
  // 0 at 4 leaders, 1 at 8; fewer than 4 keep the 4-leader size.
  const t = Math.min(1, Math.max(0, (count - 4) / 4));
  const photo = Math.round(148 - 20 * t);
  const radius = 419 + 140 * t;
  const from = 25 - 19 * t;

  // Slots left to right. The angle runs from the left (180 degrees, less
  // `from`) through straight down (90) to the right (`from`).
  const angles =
    count === 1
      ? [90]
      : Array.from({ length: count }, (_, k) => 180 - from - (k * (180 - 2 * from)) / (count - 1));

  const left = Math.ceil(count / 2);
  const slotOf = (i: number) => (i < left ? left - 1 - i : i);

  return Array.from({ length: count }, (_, i) => {
    const a = (angles[slotOf(i)] * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const end = radius - photo / 2 - LINE_GAP;
    return {
      x: radius * ux,
      y: radius * uy,
      photo,
      line: { x1: LEADER_CIRCLE * ux, y1: LEADER_CIRCLE * uy, x2: end * ux, y2: end * uy },
    };
  });
}
