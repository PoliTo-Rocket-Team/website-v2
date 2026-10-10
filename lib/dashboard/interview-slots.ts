// How the stored interview times of one application read (issue #186). The
// applications list and panel (./database-recruitment.ts) and the division
// lead's Overview (./database.ts) both ask this module, so the two never read
// `interview_slots` differently.

import type { ApplicationState, OfferedSlots, SlotTime } from "./application-flow";
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

/** What an application at status `interview` reads as: In review until times are offered. */
export type InterviewReading = Extract<ApplicationState, { stage: "in-review" | "interview" }>;

function slotOf(row: SlotRow): SlotTime {
  return { start: new Date(row.starts_at).toISOString(), end: new Date(row.ends_at).toISOString() };
}

/**
 * An interview row with no times left reads as In review, the step before
 * times are offered. With times, the one marked chosen is the booking; with
 * none chosen, the applicant has yet to pick.
 */
export function interviewStateOf(slots: readonly SlotRow[]): InterviewReading {
  if (slots.length === 0) return { stage: "in-review" };
  const sorted = [...slots].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const offered = sorted.map(slotOf) as unknown as OfferedSlots;
  const chosen = sorted.find((s) => s.chosen);
  return {
    stage: "interview",
    offered,
    booked: chosen ? { slot: slotOf(chosen), at: new Date(chosen.chosen_at ?? chosen.created_at).toISOString() } : null,
  };
}

/** An application at status `interview`, with who applied, for what, and its stored times. */
export type InterviewCandidate = {
  readonly applicant: string;
  readonly position: string;
  readonly slots: readonly SlotRow[];
};

/** Board 56's upcoming interviews: those with times offered, booked first and soonest first. */
export function upcomingInterviews(candidates: readonly InterviewCandidate[]): UpcomingInterview[] {
  return interviewOrder(
    candidates.flatMap(({ applicant, position, slots }): UpcomingInterview[] => {
      const state = interviewStateOf(slots);
      if (state.stage !== "interview") return [];
      const booked = state.booked;
      return [
        booked === null
          ? { applicant, position, state: "waiting" }
          : { applicant, position, state: "booked", start: new Date(booked.slot.start), end: new Date(booked.slot.end) },
      ];
    }),
  );
}
