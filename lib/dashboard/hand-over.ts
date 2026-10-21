import { z } from "zod";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { SEAT_LABELS } from "./division-access";
import type { FlaggedSeat, FullAccessSeat } from "./viewer";

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
  return outcome === "leave" ? { kind: "leave" } : advising(handed);
}

/** What "Become an advisor" makes of whoever hands over `handed`: the advisor half of `steppingDown`. */
export type Advising = Extract<SteppingDown, { kind: "advisor" }>;

/** "Become an advisor" for whoever hands over `handed`: an Advisor role in the same unit (`steppingDown`). */
export function advising(handed: HandedRole): Advising {
  switch (handed.kind) {
    case "team-leader":
      return { kind: "advisor", place: { kind: "team" }, access: "keeps-full-access" };
    case "head":
      return advisingIn({ kind: "department", departmentId: handed.departmentId });
    case "lead":
      return advisingIn({ kind: "division", divisionId: handed.divisionId });
  }
}

// Full access follows the role (issue #501; Owner decision, 2026-10-21)

/** A role row as the seat rule reads it: the full-access seat it is flagged as (`roles.full_access`), or null. */
export type SeatRow = { readonly fullAccess: FlaggedSeat | null };

/** Where a hand-over sends a flagged seat: the seat, and the person whose role row carries it from now on. */
export type SeatMove = { readonly seat: FlaggedSeat; readonly to: number };

export const ONE_SUCCESSOR_FOR_SEAT = "This lead holds a full-access seat. Name one new lead to take it over.";

/**
 * The one rule for a full-access seat on a hand-over or a replacement: the
 * seat follows the role. `outgoing` are the role rows the hand-over ends;
 * when one of them carries a seat, the successor's role row carries the same
 * seat, written in the same batch that ends the outgoing rows, which end with
 * it. So the predecessor holds the seat no more and one active row holds it.
 * `successors` are the people who take the role over: a seat goes to exactly
 * one, so a hand-over with more than one (a division save naming two new
 * leads) is refused rather than guessing, and one with none would drop the
 * seat. With no seat on the outgoing rows the answer is null: the hand-over
 * writes what it always wrote.
 */
export function seatHandOver(outgoing: readonly SeatRow[], successors: readonly number[]): Checked<SeatMove | null> {
  const seat = outgoing.find((r) => r.fullAccess !== null)?.fullAccess ?? null;
  if (seat === null) return { ok: true, value: null };
  const [to, ...others] = successors;
  if (to === undefined || others.length > 0) return { ok: false, error: ONE_SUCCESSOR_FOR_SEAT };
  return { ok: true, value: { seat, to } };
}

/** A role handed over from a unit: a division's lead or a department's head. The team leader's role is the team-leader seat itself. */
export type UnitRole = Exclude<HandedRole, { readonly kind: "team-leader" }>;

/** A full-access seat as it sits on the team: the person whose role row carries it, and the role it is handed over with. */
export type HeldSeat = { readonly seat: FlaggedSeat; readonly personId: number; readonly role: UnitRole };

function sameUnitRole(a: UnitRole, b: UnitRole): boolean {
  return a.kind === "lead" ? b.kind === "lead" && a.divisionId === b.divisionId : b.kind === "head" && a.departmentId === b.departmentId;
}

/**
 * The full-access seat `personId` hands over with `handed`: the team
 * leader's role is the team-leader seat, and a lead or head role carries the
 * seat its row is flagged as (`seats`, read off the roles), or none.
 */
export function seatOfHandedRole(seats: readonly HeldSeat[], personId: number, handed: HandedRole): FullAccessSeat | null {
  if (handed.kind === "team-leader") return "team-leader";
  return seats.find((s) => s.personId === personId && sameUnitRole(s.role, handed))?.seat ?? null;
}

// One wording for "full access moves" (issue #501; Owner decision,
// 2026-10-21). Every hand-over and replacement screen that can reach a
// full-access role reads it here, before the confirm.

/** The role a seat names in the wording: "Team Leader", "Operations lead". */
function seatRoleName(seat: FullAccessSeat): string {
  return seat === "team-leader" ? "Team Leader" : SEAT_LABELS[seat];
}

/**
 * "Pietro Ricci becomes Operations lead and gets full access. You lose full
 * access.": what a hand-over of a full-access role does to full access, or
 * null for a role with no seat. `successor` is who takes over, null until
 * they are picked; `from` is who hands it over, null for the viewer ("you");
 * `step` is what they do next, null until it is picked. A former team leader
 * who becomes an advisor keeps their access (`advising`), so only they keep
 * it, and until that choice is made the line says nothing of them.
 */
export function fullAccessMovesLine(input: {
  readonly seat: FullAccessSeat | null;
  readonly successor: string | null;
  readonly from: string | null;
  readonly step: SteppingDown | null;
}): string | null {
  const { seat, successor, from, step } = input;
  if (seat === null) return null;
  const gains = `${successor ?? "Whoever takes over"} becomes ${seatRoleName(seat)} and gets full access.`;
  if (step?.kind === "advisor" && step.access === "keeps-full-access") {
    return `${gains} ${from === null ? "You keep" : `${from} keeps`} full access until the new Team Leader changes it in Access.`;
  }
  if (seat === "team-leader" && step === null) return gains;
  return `${gains} ${from === null ? "You lose" : `${from} loses`} full access.`;
}

/** A department or a division: where a lead or head holds their role, and where Close department sends each person. */
export type Unit = Exclude<AdvisorPlace, { kind: "team" }>;

/**
 * "Become an advisor" in `unit`: the lead or head role ends, an Advisor role
 * starts there, and their access ends. A hand-over keeps them in the unit
 * they held the role in (`advising`); Close department, whose units all
 * close, puts them in the unit the closer picked (Owner decision, 2026-10-19).
 */
export function advisingIn(unit: Unit): Advising & { readonly place: Unit; readonly access: "ends" } {
  return { kind: "advisor", place: unit, access: "ends" };
}

/**
 * Where an Advisor role kept on a division goes when the division closes
 * (Owner decision, 2026-10-19): the advisor stays in the division's
 * department, still with the Advisor role.
 */
export function advisorAfterDivisionCloses(departmentId: number): AdvisorPlace {
  return { kind: "department", departmentId };
}

// One wording for "Become an advisor" (issue #441). Every drawer and dialog
// that offers it, and every confirm that says what it does, reads it here.

/** The option's title, in every drawer and dialog that offers it. */
export const BECOME_AN_ADVISOR = "Become an advisor";

/** Who the wording speaks to: the person stepping down ("you"), or the editor about them ("they"). */
export type Voice = "you" | "they";

/** "stays in Aerodynamics with the Advisor role", "moves to Structures with the Advisor role": the one phrase every wording below is built on. */
function withAdvisorRole(where: string, verb: "stay" | "stays" | "move" | "moves"): string {
  const into = verb === "stay" || verb === "stays" ? "in" : "to";
  return `${verb} ${into} ${where} with the Advisor role`;
}

/**
 * "Marco Bianchi stays in Aerodynamics with the Advisor role.": what Close
 * division says of the advisors in it, who stay in its department
 * (`advisorAfterDivisionCloses`).
 */
export function advisorsStayLine(names: readonly string[], department: string): string {
  const who = names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${who} ${withAdvisorRole(department, names.length === 1 ? "stays" : "stay")}.`;
}

/**
 * "moves to Structures with the Advisor role; their access ends": what Close
 * department says of someone who holds the Advisor role in their destination.
 * Their access ends when they become an advisor there (`advisingIn`); an
 * advisor who moves keeps the access they hold.
 */
export function movesWithAdvisorRoleLine(destination: string, accessEnds: boolean): string {
  const moves = withAdvisorRole(destination, "moves");
  return accessEnds ? `${moves}; their access ends` : moves;
}

/** The detail under "Become an advisor" on Close department, for a former head or lead going to `destination`: "Moves to Structures with the Advisor role; their access ends". */
export function advisorInDestinationDetail(destination: string): string {
  const words = movesWithAdvisorRoleLine(destination, true);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function advisorWords(step: Advising, unit: string | null, voice: Voice): string {
  const where = step.place.kind === "team" || unit === null ? "the team" : unit;
  const stays = withAdvisorRole(where, voice === "you" ? "stay" : "stays");
  if (step.access === "ends") return `${stays}; ${voice === "you" ? "your" : "their"} access ends`;
  const keeps = voice === "you" ? "keep your access" : "keeps their access";
  return `${stays} and ${keeps}; the new Team Leader can change it in Access`;
}

/**
 * The detail under "Become an advisor" for whoever hands over `handed`:
 * "Stays in Aerodynamics with the Advisor role; their access ends". `unit`
 * names the division or department they hand over.
 */
export function advisorOptionDetail(handed: HandedRole, unit: string | null, voice: Voice): string {
  const words = advisorWords(advising(handed), unit, voice);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "stays in Aerodynamics with the Advisor role; their access ends": what a confirm says becomes of them. */
export function steppingDownLine(step: SteppingDown, unit: string | null): string {
  if (step.kind === "leave") return "leaves the team: every role they hold ends and they move to Alumni";
  return advisorWords(step, unit, "they");
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
