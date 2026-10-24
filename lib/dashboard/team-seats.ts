import { z } from "zod";
import { mayManageDepartments, type Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { HAND_OVER_OUTCOMES, steppingDown, type HandOverOutcome, type SteppingDown } from "./hand-over";
import { beyondTitle, type BoardFlag, type BoardRole, type OrgChart, type TeamActor } from "./team";

// The seat row of Edit team tree (issue #627): who holds a team-level seat,
// a new seat, and removing one (issue #643). Only the team leader and full access change them, as they
// manage departments (`mayManageDepartments`). A seat box changes who holds
// the seat; its title is changed on Members (Edit details, issue #626). Both
// sides of the data interface run these checks: the panel runs them first,
// and the server runs them again on every save.

/**
 * Change holder on a seat box: who holds the seat from now on, and what the
 * holder they replace does next. The outcome is null only when nothing was
 * picked; the rules refuse that.
 */
export type SeatHolderChange = { readonly to: number; readonly outcome: HandOverOutcome | null };

/** Add seat: who holds the new seat, and its title. */
export type NewSeat = { readonly personId: number; readonly title: string };

const MAX_SEAT_TITLE = 80;

export const ONLY_TEAM_SEATS = "Only the team leader can change a team-level seat.";

const id = z.number().int().positive();
const changeSchema = z.object({ to: id, outcome: z.enum(HAND_OVER_OUTCOMES).nullable().default(null) });
const newSchema = z.object({ personId: id, title: z.string().max(200) });

function parsed<T>(result: z.ZodSafeParseResult<T>): Checked<T> {
  return result.success ? { ok: true, value: result.data } : { ok: false, error: result.error.issues[0]?.message ?? "Check the form." };
}

function no<T>(error: string): Checked<T> {
  return { ok: false, error };
}

/** Change holder as sent, in its shape; the rules are `planSeatHolderChange`'s. */
export function checkSeatHolderChange(input: unknown): Checked<SeatHolderChange> {
  return parsed(changeSchema.safeParse(input));
}

/** Add seat as sent, in its shape; the rules are `planNewSeat`'s. */
export function checkNewSeat(input: unknown): Checked<NewSeat> {
  return parsed(newSchema.safeParse(input));
}

/** The title as stored: trimmed, inner spaces folded. */
export function storedSeatTitle(typed: string): string {
  return typed.trim().replace(/\s+/g, " ");
}

/** Why the title as typed cannot be a new seat's, or null. */
export function seatTitleError(typed: string): string | null {
  const title = storedSeatTitle(typed);
  if (title === "") return "Write the seat's title.";
  return title.length > MAX_SEAT_TITLE ? "Too long." : null;
}

/** A seat someone holds, as the team reads it: the role row and its holder. */
export type HeldTeamSeat = { readonly seat: BoardRole; readonly holder: TeamPerson };

/** The team-level seat `roleId` and who holds it; null when no active team-level seat is that row. */
export function heldTeamSeat(team: readonly TeamPerson[], roleId: number): HeldTeamSeat | null {
  for (const holder of team) {
    for (const role of holder.beyond) if (role.kind === "board" && role.seat.roleId === roleId) return { seat: role.seat, holder };
  }
  return null;
}

/** Why `person` cannot take a seat, or null: on the team and holding no seat yet (as Change head's rule). */
function takerError(person: TeamPerson | undefined, org: OrgChart): string | null {
  if (person === undefined) return "They are not on the team.";
  const [seat] = person.beyond;
  return seat === undefined ? null : `${person.name} is already ${beyondTitle(seat, org)}.`;
}

/**
 * A checked Change holder: the seat's row, who holds it now, who takes it,
 * and what becomes of the holder. The successor's row carries the seat's
 * title and its full-access flag (`seat`).
 */
export type SeatHolderPlan = { readonly seat: BoardRole; readonly from: number; readonly to: number; readonly steppingDown: SteppingDown };

/**
 * Change holder as the rules allow it, or the first reason it is refused:
 * only the team leader or full access; an active team-level seat; a successor
 * on the team who is not its holder and holds no seat yet, and keeps their
 * divisions; the holder becomes an advisor to the team or leaves the team, as
 * the editor picked, and nothing is picked for them (`steppingDown`).
 */
export function planSeatHolderChange(input: {
  readonly actor: TeamActor | null;
  readonly org: OrgChart;
  readonly roleId: number;
  readonly change: SeatHolderChange;
  readonly team: readonly TeamPerson[];
}): Checked<SeatHolderPlan> {
  const { actor, org, roleId, change, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const held = heldTeamSeat(team, roleId);
  if (held === null) return no("That seat is no longer held.");
  const next = team.find((p) => p.id === change.to);
  if (next?.id === held.holder.id) return no(`${next.name} holds this seat now.`);
  const refusal = takerError(next, org);
  if (refusal !== null || next === undefined) return no(refusal ?? "They are not on the team.");
  if (change.outcome === null) return no(`Choose what happens to ${held.holder.name}: Become an advisor or Leave the team.`);
  return { ok: true, value: { seat: held.seat, from: held.holder.id, to: next.id, steppingDown: steppingDown({ kind: "team-seat" }, change.outcome) } };
}

/**
 * What keeps a removed seat's holder on the team (issue #643; Owner
 * decision: they stay on the team): the other roles they hold, or, when the
 * seat was their only one, an Advisor role on the whole team, as "Become an
 * advisor" gives a seat's holder. Either way they keep every access row.
 */
export type StayingOnTeam = "keeps-other-roles" | "advisor-to-the-team";

/** How the holder stays on the team, from how many active roles they hold beside the seat. */
export function stayingOnTeam(otherActiveRoles: number): StayingOnTeam {
  return otherActiveRoles > 0 ? "keeps-other-roles" : "advisor-to-the-team";
}

/** A checked Remove seat: the seat's row and who holds it. */
export type SeatRemovalPlan = { readonly seat: BoardRole; readonly holder: number };

/**
 * Remove seat as the rules allow it, or the first reason it is refused: only
 * the team leader or full access; an active team-level seat, the Project
 * Manager's and the Chief Engineer's included (Owner decision). Its row ends
 * and no successor's starts, so a seat's full access ends with it.
 */
export function planSeatRemoval(input: { readonly actor: TeamActor | null; readonly roleId: number; readonly team: readonly TeamPerson[] }): Checked<SeatRemovalPlan> {
  const { actor, roleId, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const held = heldTeamSeat(team, roleId);
  if (held === null) return no("That seat is no longer held.");
  return { ok: true, value: { seat: held.seat, holder: held.holder.id } };
}

/** What the Remove seat confirm says: the seat's title and its holder by name, and what happens to them. */
export function seatRemovalLines(seat: { readonly title: string; readonly flag: BoardFlag | null }, holder: string): readonly string[] {
  return [
    `${holder} no longer holds ${seat.title}. The seat leaves the Team tree and the Team page.`,
    ...(seat.flag === null ? [] : [`${holder} loses the full access ${seat.title} gives.`]),
    `${holder} stays on the team and keeps their other roles and access. With no other role, they become an advisor to the team.`,
  ];
}

/** A checked Add seat: who holds the new seat, and its title as stored. */
export type NewSeatPlan = { readonly personId: number; readonly title: string };

/**
 * Add seat as the rules allow it, or the first reason it is refused: only the
 * team leader or full access; a title; one person on the team who holds no
 * seat yet, and keeps their divisions. The seat carries no full-access flag:
 * only the Project Manager's and the Chief Engineer's do.
 */
export function planNewSeat(input: {
  readonly actor: TeamActor | null;
  readonly org: OrgChart;
  readonly add: NewSeat;
  readonly team: readonly TeamPerson[];
}): Checked<NewSeatPlan> {
  const { actor, org, add, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const titleError = seatTitleError(add.title);
  if (titleError !== null) return no(titleError);
  const person = team.find((p) => p.id === add.personId);
  const refusal = takerError(person, org);
  if (refusal !== null || person === undefined) return no(refusal ?? "They are not on the team.");
  return { ok: true, value: { personId: person.id, title: storedSeatTitle(add.title) } };
}
