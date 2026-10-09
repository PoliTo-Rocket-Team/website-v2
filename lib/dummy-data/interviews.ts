// The Mission Analysis lead's interviews (board 56, issue #168): each one is an
// application in review, named by its position and its place among that
// position's applications in review, so the Overview names people the
// Applications page also lists. A null start is an interview the applicant has
// not picked a time for yet.

export type DummyInterview = {
  readonly positionId: number;
  /** Which of the position's applications in review, oldest first. */
  readonly nth: number;
  readonly slot: { readonly start: string; readonly end: string } | null;
};

export const interviews = [
  { positionId: 1, nth: 0, slot: { start: "2026-10-15T17:30:00+02:00", end: "2026-10-15T18:00:00+02:00" } },
  { positionId: 1, nth: 1, slot: { start: "2026-10-16T18:00:00+02:00", end: "2026-10-16T18:30:00+02:00" } },
  { positionId: 6, nth: 0, slot: null },
] as const satisfies readonly DummyInterview[];
