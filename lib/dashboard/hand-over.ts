import { z } from "zod";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { SEAT_LABELS } from "./division-access";
import { holderAddRefusal } from "./seat-holders";
import type { FlaggedSeat, FullAccessSeat } from "./viewer";

// Handing over a role (issue #253, boards 77i, 77e and 68b4; Owner decision,
// 2026-10-16). Whoever holds a role (the team leader, a department head, a
// division lead) hands it over in one step: someone takes over, and the person
// stepping down either becomes an advisor in the team or leaves the team.
// No hand-over leaves them as a plain member. This module owns that rule;
// the Team Leader box, Change head and lead replace all read it, and both
// data sources write what it says.

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

/**
 * A role someone steps down from: one they hand over, or a team-level seat
 * whose holder the Edit team tree changes (issue #627). A seat is not a
 * `HandedRole`: My profile never hands one over.
 */
export type SteppedDownFrom = HandedRole | { readonly kind: "team-seat" };

/** Where an Advisor role sits: on the whole team (a former team leader or seat holder), a department (a former head) or a division (a former lead). */
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
 * leader and a team-level seat's holder. A lead, head or seat holder who
 * becomes an advisor loses their access; a former team leader keeps theirs.
 */
export function steppingDown(handed: SteppedDownFrom, outcome: HandOverOutcome): SteppingDown {
  return outcome === "leave" ? { kind: "leave" } : advising(handed);
}

/** What "Become an advisor" makes of whoever hands over `handed`: the advisor half of `steppingDown`. */
export type Advising = Extract<SteppingDown, { kind: "advisor" }>;

/** "Become an advisor" for whoever hands over `handed`: an Advisor role in the same unit (`steppingDown`). */
export function advising(handed: SteppedDownFrom): Advising {
  switch (handed.kind) {
    case "team-leader":
      return { kind: "advisor", place: { kind: "team" }, access: "keeps-full-access" };
    case "team-seat":
      return { kind: "advisor", place: { kind: "team" }, access: "ends" };
    case "head":
      return advisingIn({ kind: "department", departmentId: handed.departmentId });
    case "lead":
      return advisingIn({ kind: "division", divisionId: handed.divisionId });
  }
}

// Where a former lead, head or seat holder advises (issue #900; Owner
// decision, 2026-10-31). Removing or replacing a lead, a head or a team seat
// holder in the Team tree may keep them as an advisor at a place the editor
// picks: a lead in this division, its department or the whole team; a head in
// its department or the whole team; a team seat holder on the whole team. A
// scope a role has no unit for is not offered, and with no scope picked the
// place is the role's own unit (`advising`), as before.

/** Where an advisor sits, as the editor picks it: the role's division, its department, or the whole team. */
export const ADVISOR_SCOPES = ["division", "department", "team"] as const;
export type AdvisorScope = (typeof ADVISOR_SCOPES)[number];

/**
 * A role someone steps down from, placed in the team: a lead's division with
 * the department it sits in, which a "department" scope reads. Every other
 * role carries the units it has already.
 */
export type PlacedRole = Exclude<SteppedDownFrom, { kind: "lead" }> | { readonly kind: "lead"; readonly divisionId: number; readonly departmentId: number };

/** The kind of role stepped down from: all the scope rules read of it. */
export type SteppedDownKind = Pick<SteppedDownFrom, "kind">;

/** The scopes `from` offers, its default first: a lead division, department, team; a head department, team; a seat or the team leader the team. */
export function advisorScopes(from: SteppedDownKind): readonly [AdvisorScope, ...AdvisorScope[]] {
  switch (from.kind) {
    case "lead":
      return ["division", "department", "team"];
    case "head":
      return ["department", "team"];
    case "team-seat":
    case "team-leader":
      return ["team"];
  }
}

/** The scope `from` advises at when none is picked: the unit they held the role in (`advising`). */
export function defaultAdvisorScope(from: SteppedDownKind): AdvisorScope {
  return advisorScopes(from)[0];
}

/** The place `scope` names for someone stepping down from `role`, or null when `role` does not offer it. */
export function advisorPlace(role: PlacedRole, scope: AdvisorScope): AdvisorPlace | null {
  if (!advisorScopes(role).includes(scope)) return null;
  if (scope === "team") return { kind: "team" };
  if (scope === "division") return role.kind === "lead" ? { kind: "division", divisionId: role.divisionId } : null;
  return role.kind === "lead" || role.kind === "head" ? { kind: "department", departmentId: role.departmentId } : null;
}

export const SCOPE_NOT_OFFERED = "They cannot advise there. Pick where they advise again.";

/**
 * "Stays as an advisor" at `scope`, or `role`'s default with none picked: an
 * Advisor role at the place the scope names. A lead, head or seat holder
 * loses their access, as `advising` says; a former team leader keeps theirs.
 * A scope `role` does not offer is refused.
 */
export function advisingAt(role: PlacedRole, scope: AdvisorScope | null): Checked<Advising> {
  const place = advisorPlace(role, scope ?? defaultAdvisorScope(role));
  if (place === null) return { ok: false, error: SCOPE_NOT_OFFERED };
  return { ok: true, value: { kind: "advisor", place, access: role.kind === "team-leader" ? "keeps-full-access" : "ends" } };
}

/** `steppingDown` with the place an advisor picked (`advisingAt`): "leave" is Alumni, whatever the scope. */
export function steppingDownAt(role: PlacedRole, outcome: HandOverOutcome, scope: AdvisorScope | null): Checked<SteppingDown> {
  return outcome === "leave" ? { ok: true, value: { kind: "leave" } } : advisingAt(role, scope);
}

/** A role row as the advisor rule reads it: its type and the unit it is kept on. */
export type PlacedRow = { readonly type: string | null; readonly departmentId: number | null; readonly divisionId: number | null };

/**
 * Whether `row` is an Advisor role at `place`: someone who advises there
 * already gets no second Advisor role there, so they hold one active advisor
 * role at the picked place.
 */
export function isAdvisorRowAt(row: PlacedRow, place: AdvisorPlace): boolean {
  if (row.type !== "advisor") return false;
  switch (place.kind) {
    case "team":
      return row.departmentId === null && row.divisionId === null;
    case "department":
      return row.departmentId === place.departmentId && row.divisionId === null;
    case "division":
      return row.divisionId === place.divisionId;
  }
}

/** The names the wording gives each scope's place: the division and the department, null where the role has none. */
export type ScopeNames = { readonly division: string | null; readonly department: string | null };

/** "Mission Analysis", "Aerodynamics", "the whole team": the place `scope` names, in words. */
export function advisorScopeName(scope: AdvisorScope, names: ScopeNames): string {
  if (scope === "division") return names.division ?? "this division";
  if (scope === "department") return names.department ?? "this department";
  return "the whole team";
}

/** "Mission Analysis", "Aerodynamics", "Whole team": a scope as the advisor picker lists it. */
export function advisorScopeTitle(scope: AdvisorScope, names: ScopeNames): string {
  return scope === "team" ? "Whole team" : advisorScopeName(scope, names);
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
 * it. So the predecessor holds the seat no more and the successor holds it.
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
  return advisorWordsAt(step.access, step.place.kind === "team" || unit === null ? "the team" : unit, voice);
}

function advisorWordsAt(access: Advising["access"], where: string, voice: Voice): string {
  const stays = withAdvisorRole(where, voice === "you" ? "stay" : "stays");
  if (access === "ends") return `${stays}; ${voice === "you" ? "your" : "their"} access ends`;
  const keeps = voice === "you" ? "keep your access" : "keeps their access";
  return `${stays} and ${keeps}; the new Team Leader can change it in Access`;
}

/**
 * The detail under "Become an advisor" for whoever hands over `handed`:
 * "Stays in Aerodynamics with the Advisor role; their access ends". `unit`
 * names the division or department they hand over.
 */
export function advisorOptionDetail(handed: SteppedDownFrom, unit: string | null, voice: Voice): string {
  const words = advisorWords(advising(handed), unit, voice);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "stays in Aerodynamics with the Advisor role; their access ends": what a confirm says becomes of them. */
export function steppingDownLine(step: SteppingDown, unit: string | null): string {
  if (step.kind === "leave") return "leaves the team: every role they hold ends and they move to Alumni";
  return advisorWords(step, unit, "they");
}

/** The option's title where no advisor option was offered before (issue #900): Remove lead and Remove seat. */
export const STAYS_AS_AN_ADVISOR = "Stays as an advisor";

/**
 * "stays in the whole team with the Advisor role; their access ends": what a
 * confirm says of someone who advises at `scope` (issue #900), naming the
 * place picked. Only the access rule reads `from`: a lead, head or seat
 * holder's access ends, a former team leader keeps theirs.
 */
export function advisingLine(from: SteppedDownKind, scope: AdvisorScope, names: ScopeNames): string {
  return advisorWordsAt(from.kind === "team-leader" ? "keeps-full-access" : "ends", advisorScopeName(scope, names), "they");
}

/** The detail under the advisor option once a scope is picked: "Stays in Aerodynamics with the Advisor role; their access ends". */
export function advisingDetail(from: SteppedDownKind, scope: AdvisorScope, names: ScopeNames): string {
  const words = advisingLine(from, scope, names);
  return words.charAt(0).toUpperCase() + words.slice(1);
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
 * refused: only a current team leader, who hands over their own place;
 * `leaders` are every team leader now (epic #861). The one who takes over is
 * someone else on the team who is not a team leader already
 * (`holderAddRefusal`, issue #872). They become a team leader on save, with
 * its powers (deciding orders, giving "Approve orders", handing the role
 * over), and keep every role they already hold. Only the viewer's own team
 * leader row ends: every other team leader keeps the seat.
 */
export function planTeamLeaderHandOver(input: {
  readonly viewer: HandOverViewer;
  readonly leaders: readonly number[];
  readonly handOver: TeamLeaderHandOver;
  readonly team: readonly TeamPerson[];
}): Checked<TeamLeaderHandOverPlan> {
  const { viewer, leaders, handOver, team } = input;
  const from = viewer.selfId !== null && leaders.includes(viewer.selfId) ? viewer.selfId : null;
  if (from === null || !mayHandOverTeamLeader(viewer, from)) return { ok: false, error: ONLY_TEAM_LEADER };
  if (handOver.to === from) return { ok: false, error: "Pick who takes over from you." };
  const next = team.find((p) => p.id === handOver.to);
  if (next === undefined) return { ok: false, error: "They are not on the team." };
  const refusal = holderAddRefusal(next, leaders);
  if (refusal !== null) return { ok: false, error: refusal };
  return { ok: true, value: { from, to: next.id, steppingDown: steppingDown({ kind: "team-leader" }, handOver.outcome) } };
}
