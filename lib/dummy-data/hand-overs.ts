import type { TeamPerson } from "@/lib/dashboard/division-edit";
import { lapsedBy, type HandOverRequest } from "@/lib/dashboard/hand-over-request";
import type { HandOverAnswered } from "@/lib/dashboard/notices";
import type { TeamEdits, TeamEditsStore } from "./edits";

// The dummy team's hand-overs sent from My profile (issue #262), as
// `hand_over_requests` rows would hold them: one waiting for Chiara Rinaldi,
// the head of Aerodynamics the test developer signs in as, so a preview shows
// board 62c's row; and those the test developer sent or answered, kept in the
// Team pages' edits cookie (./edits.ts).

/**
 * A request and how it closed: answered by the next level up, and by whom, or
 * lapsed when its sender's roles changed first (`lapsedBy`); null while it waits.
 */
export type DummyHandOver = HandOverRequest & {
  readonly answered: { readonly answer: HandOverAnswered; readonly by: number } | { readonly answer: "lapsed" } | null;
};

const seeded: readonly DummyHandOver[] = [
  {
    id: 1,
    fromId: 20, // Paolo Conti, the Optimization and Analysis lead
    role: { kind: "lead", divisionId: 2 },
    toId: 32, // Sara Fontana, a member of Optimization and Analysis
    outcome: "advisor",
    sentAt: "2026-10-09T09:30:00+02:00",
    answered: null,
  },
];

/** Every hand-over: the seeded ones as the test developer left them, then those they sent. */
export function dummyHandOversOf(edits: Pick<TeamEdits, "handOvers">): DummyHandOver[] {
  const changed = new Map(edits.handOvers.map((h) => [h.id, h]));
  const seededIds = new Set(seeded.map((h) => h.id));
  return [...seeded.map((h) => changed.get(h.id) ?? h), ...edits.handOvers.filter((h) => !seededIds.has(h.id))];
}

/** The requests still waiting for an answer. */
export function waitingHandOvers(all: readonly DummyHandOver[]): HandOverRequest[] {
  return all.filter((h) => h.answered === null);
}

/** The edits with `handOver` kept: a new one added, or one already there replaced. */
export function withDummyHandOver(edits: TeamEdits, handOver: DummyHandOver): TeamEdits {
  const others = edits.handOvers.filter((h) => h.id !== handOver.id);
  return { ...edits, handOvers: [...others, handOver] };
}

/** The edits with each waiting request in `ids` closed as lapsed. */
export function withLapsedHandOvers(edits: TeamEdits, ids: readonly number[]): TeamEdits {
  return waitingHandOvers(dummyHandOversOf(edits))
    .filter((h) => ids.includes(h.id))
    .reduce((next, h) => withDummyHandOver(next, { ...h, answered: { answer: "lapsed" } }), edits);
}

/**
 * The Team pages' edits store, closing on every save the waiting requests
 * whose sender's roles that save changed (`lapsedBy`), as the database's
 * trigger on `roles` closes them. `teamOf` reads the team the edits make.
 */
export function closingLapsedHandOvers(store: TeamEditsStore, teamOf: (edits: TeamEdits) => readonly TeamPerson[]): TeamEditsStore {
  return {
    current: store.current,
    save: (next) => {
      const lapsed = lapsedBy(waitingHandOvers(dummyHandOversOf(next)), teamOf(store.current), teamOf(next));
      return store.save(withLapsedHandOvers(next, lapsed));
    },
  };
}

/** The id the next request takes. */
export function nextHandOverId(all: readonly DummyHandOver[]): number {
  return Math.max(0, ...all.map((h) => h.id)) + 1;
}
