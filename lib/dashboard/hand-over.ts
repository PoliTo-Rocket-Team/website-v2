import { z } from "zod";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import type { FullAccessSeat } from "./viewer";

// Handing over a role (issue #253, boards 77i, 77e and 68b4; Owner decision,
// 2026-10-16). Whoever holds a role (the team leader, a department head, a
// division lead) hands it over in one step: someone takes over, and the person
// stepping down either becomes an advisor in the team or leaves the team.
// No hand-over leaves them as a plain member. This module owns that rule;
// the Team Leader box, Change head, lead replace and Promote's "hand over the
// division" all read it, and both data sources write what it says.

/** What the person who hands over a role does next: "Become an advisor" or "Leave the team". */
export const HAND_OVER_OUTCOMES = ["advisor", "leave"] as const;
export type HandOverOutcome = (typeof HAND_OVER_OUTCOMES)[number];

export function isHandOverOutcome(value: unknown): value is HandOverOutcome {
  return typeof value === "string" && (HAND_OVER_OUTCOMES as readonly string[]).includes(value);
}

/** The title an Advisor role carries. */
export const ADVISOR_TITLE = "Advisor";

/** The role someone hands over. */
export type HandedRole =
  | { readonly kind: "team-leader" }
  | { readonly kind: "head"; readonly departmentId: number }
  | { readonly kind: "lead"; readonly divisionId: number };

/** Where an Advisor role sits: on the whole team (a former team leader), a department (a former head) or a division (a former lead). */
export type AdvisorPlace =
  | { readonly kind: "team" }
  | { readonly kind: "department"; readonly departmentId: number }
  | { readonly kind: "division"; readonly divisionId: number };

/**
 * What becomes of the person who handed over a role. An advisor's access rows
 * are removed ("ends"), except a former team leader's: they keep every access
 * row they hold, and the full access their role gave them stays with them as
 * an access row, until the new team leader changes it in Access
 * ("keeps-full-access", Owner decision, 2026-10-16).
 */
export type SteppingDown =
  | { readonly kind: "advisor"; readonly place: AdvisorPlace; readonly access: "ends" | "keeps-full-access" }
  | { readonly kind: "leave" };

/**
 * The one rule for every hand-over: "leave" ends every role and access and
 * moves them to Alumni; "advisor" ends the role handed over and starts one
 * Advisor role in the unit they held it in, the whole team for the team
 * leader. A lead or head who becomes an advisor loses their access; a former
 * team leader keeps theirs.
 */
export function steppingDown(handed: HandedRole, outcome: HandOverOutcome): SteppingDown {
  if (outcome === "leave") return { kind: "leave" };
  switch (handed.kind) {
    case "team-leader":
      return { kind: "advisor", place: { kind: "team" }, access: "keeps-full-access" };
    case "head":
      return { kind: "advisor", place: { kind: "department", departmentId: handed.departmentId }, access: "ends" };
    case "lead":
      return { kind: "advisor", place: { kind: "division", divisionId: handed.divisionId }, access: "ends" };
  }
}

/** "stays in the team as an Advisor in Aerodynamics; their access ends": what a confirm says becomes of them. */
export function steppingDownLine(step: SteppingDown, unit: string | null): string {
  if (step.kind === "leave") return "leaves the team: every role they hold ends and they move to Alumni";
  const where = step.place.kind === "team" || unit === null ? "" : ` in ${unit}`;
  return step.access === "ends" ? `stays in the team as an Advisor${where}; their access ends` : `stays in the team as an Advisor${where} and keeps their access`;
}

// The Team Leader box (board 77i)

/** What "Hand over the role" sends: who takes over, and what the team leader does next. */
export type TeamLeaderHandOver = { readonly to: number; readonly outcome: HandOverOutcome };

const handOverSchema = z.object({ to: z.number().int().positive(), outcome: z.enum(HAND_OVER_OUTCOMES) });

/** "Hand over the role" as sent, in its shape; the rules are `planTeamLeaderHandOver`'s. */
export function checkTeamLeaderHandOver(input: unknown): Checked<TeamLeaderHandOver> {
  const result = handOverSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: result.error.issues[0]?.message ?? "Check the form." };
}

/**
 * Who is asking, as the hand-over rule reads them: the full-access seat they
 * hold, and who they are on the team. Only the seat is not enough: the
 * operations lead and the IT lead hold full access too.
 */
export type HandOverViewer = { readonly seat: FullAccessSeat | null; readonly selfId: number | null };

export const ONLY_TEAM_LEADER = "Only the team leader can hand over this role.";

/**
 * Whether the viewer may hand over the team leader role (board 77i): only the
 * current team leader. The Team Leader box is locked for everyone else, the
 * operations lead and the IT lead included, and the server refuses them.
 */
export function mayHandOverTeamLeader(viewer: HandOverViewer, leaderId: number | null): boolean {
  return viewer.seat === "team-leader" && viewer.selfId !== null && viewer.selfId === leaderId;
}

/** A checked team leader hand-over: who steps down, who becomes the team leader, and what becomes of the one stepping down. */
export type TeamLeaderHandOverPlan = { readonly from: number; readonly to: number; readonly steppingDown: SteppingDown };

/**
 * "Hand over the role" as the rules allow it, or the first reason it is
 * refused: only the current team leader; the one who takes over is someone
 * else on the team. They become the team leader on save, with its powers
 * (deciding orders, giving "Approve orders", handing the role over), and keep
 * every role they already hold.
 */
export function planTeamLeaderHandOver(input: {
  readonly viewer: HandOverViewer;
  readonly leaderId: number | null;
  readonly handOver: TeamLeaderHandOver;
  readonly team: readonly TeamPerson[];
}): Checked<TeamLeaderHandOverPlan> {
  const { viewer, leaderId, handOver, team } = input;
  if (!mayHandOverTeamLeader(viewer, leaderId) || leaderId === null) return { ok: false, error: ONLY_TEAM_LEADER };
  if (handOver.to === leaderId) return { ok: false, error: "Pick who takes over from you." };
  if (!team.some((p) => p.id === handOver.to)) return { ok: false, error: "They are not on the team." };
  return { ok: true, value: { from: leaderId, to: handOver.to, steppingDown: steppingDown({ kind: "team-leader" }, handOver.outcome) } };
}

// Promote (board 59e)

/**
 * Promote: the person leads the division beside the lead ("together"), or
 * takes it over ("hand-over"), and the lead then becomes an advisor in the
 * division or leaves the team, never a member.
 */
export type Promotion = { readonly mode: "together" } | { readonly mode: "hand-over"; readonly outcome: HandOverOutcome };

const promotionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("together") }),
  z.object({ mode: z.literal("hand-over"), outcome: z.enum(HAND_OVER_OUTCOMES) }),
]);

/** Promote as sent; a hand-over without what the lead does next is refused. */
export function checkPromotion(input: unknown): Checked<Promotion> {
  const result = promotionSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: "Choose what you do next: Become an advisor or Leave the team." };
}

/** What becomes of the lead who promotes: nothing for "together"; for a hand-over, the stepping down the rule gives. */
export function promotingLead(promotion: Promotion, divisionId: number): SteppingDown | null {
  return promotion.mode === "together" ? null : steppingDown({ kind: "lead", divisionId }, promotion.outcome);
}
