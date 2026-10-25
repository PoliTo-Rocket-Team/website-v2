// How the stored interview times of one application read (issue #186). The
// applications list and panel (./database-recruitment.ts) and the division
// lead's Overview (./database.ts) both ask this module, so the two never read
// `interview_slots` differently.

import type { ApplicationState, SlotTime } from "./application-flow";
import { interviewOrder, type UpcomingInterview } from "./overview";

/** One `interview_slots` row as the database sources read it. */
export type SlotRow = {
  application_id: number;
  starts_at: string;
  ends_at: string;
  chosen: boolean;
  chosen_at: string | null;
  created_at: string;
};

/** A stored time as the database sources read it, with the name of who offered it (issue #652); null for a time stored before that was recorded. */
export type OfferedSlotRow = SlotRow & { offered_by: string | null };

/** What an application at status `interview` reads as. */
export type InterviewReading = Extract<ApplicationState, { status: "interview" }>;

function slotOf(row: SlotRow): SlotTime {
  return { start: new Date(row.starts_at).toISOString(), end: new Date(row.ends_at).toISOString() };
}

/**
 * An interview row with no times is an interview being arranged. With times,
 * the one marked chosen is the booking; with none chosen, the applicant has
 * yet to pick.
 */
export function interviewStateOf(slots: readonly SlotRow[]): InterviewReading {
  const sorted = [...slots].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const offered = sorted.map(slotOf);
  const chosen = sorted.find((s) => s.chosen);
  return {
    status: "interview",
    offered,
    booked: chosen ? { slot: slotOf(chosen), at: new Date(chosen.chosen_at ?? chosen.created_at).toISOString() } : null,
  };
}

/** An application at status `interview`, with who applied, for what, and its stored times. */
export type InterviewCandidate = {
  readonly applicant: string;
  readonly position: string;
  readonly slots: readonly OfferedSlotRow[];
};

/**
 * Board 56's upcoming interviews: those with times offered, booked first and
 * soonest first, each with who offered its times (board 99b). One offer
 * writes every time of an application at once, so any of them names the setter.
 */
export function upcomingInterviews(candidates: readonly InterviewCandidate[]): UpcomingInterview[] {
  return interviewOrder(
    candidates.flatMap(({ applicant, position, slots }): UpcomingInterview[] => {
      const state = interviewStateOf(slots);
      if (state.offered.length === 0) return [];
      const booked = state.booked;
      const setBy = slots.find((s) => s.offered_by !== null)?.offered_by ?? null;
      return [
        booked === null
          ? { applicant, position, setBy, state: "waiting" }
          : { applicant, position, setBy, state: "booked", start: new Date(booked.slot.start), end: new Date(booked.slot.end) },
      ];
    }),
  );
}
