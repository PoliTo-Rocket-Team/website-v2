// The ordering logic of `OrgChart.leaders` (./types.ts) on the desktop arc
// (components/about/arc-layout.ts): the first half of the leaders sits left of
// the centre and the rest right of it, each half from the centre outward. The
// Team page editor's add affordances (issue #285) number the places between
// and around the leaders as gaps, left to right, and map each to a place in
// reading order.

/** The leaders' left-to-right order on the arc, as indexes into reading order. */
export function arcVisualOrder(count: number): number[] {
  const left = Math.ceil(count / 2);
  return [...Array.from({ length: left }, (_, i) => left - 1 - i), ...Array.from({ length: count - left }, (_, i) => left + i)];
}

/**
 * Where a leader added at gap `gap` goes in reading order, on an arc of
 * `count` leaders. Gap 0 is the left end, gap `count` the right end, and gap
 * p sits between the leaders at visual places p - 1 and p. The arc keeps its
 * ordering logic, so the new leader is drawn in that gap; with the halves
 * rebalanced by the extra leader, the one at the inner edge of a half may
 * move to the other half.
 */
export function readingIndexOfGap(gap: number, count: number): number {
  const left = Math.ceil((count + 1) / 2);
  return gap < left ? left - 1 - gap : gap;
}

/** The gap a leader at `index` in reading order fills on an arc of `count` leaders, them included. */
export function gapOfReadingIndex(index: number, count: number): number {
  const left = Math.ceil(count / 2);
  return index < left ? left - 1 - index : index;
}
