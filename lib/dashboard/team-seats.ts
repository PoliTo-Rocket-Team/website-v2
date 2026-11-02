import { z } from "zod";
import { mayManageDepartments, type Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import {
  ADVISOR_SCOPES,
  advisingAt,
  advisingLine,
  defaultAdvisorScope,
  HAND_OVER_OUTCOMES,
  steppingDownAt,
  type Advising,
  type AdvisorScope,
  type HandOverOutcome,
  type ScopeNames,
  type SteppedDownFrom,
  type SteppingDown,
} from "./hand-over";
import { addedHolder, holderAddRefusal, holdersOfSeat, holdsSeat, seatOfTeamRow, type ActiveRoleRow, type HolderAdd, type HolderAddPlan, type Seat } from "./seat-holders";
import { isTeamSeat, type BoardFlag, type BoardRole, type OrgChart, type TeamActor } from "./team";
import { andList } from "./team-structure";

// The seat row of Edit team tree (issue #627): who holds a team-level seat,
// a new seat, and removing one (issue #643). Only the team leader and full access change them, as they
// manage departments (`mayManageDepartments`). A seat box changes who holds
// the seat; its title is changed on Members (Edit details, issue #626). Both
// sides of the data interface run these checks: the panel runs them first,
// and the server runs them again on every save.

/**
 * Change holder on a seat box: who holds the seat from now on, and what the
 * holder they replace does next. The outcome is null only when nothing was
 * picked; the rules refuse that. `scope` is where they advise (issue #900):
 * a team seat holder advises the whole team, so null and "team" are one.
 */
export type SeatHolderChange = { readonly to: number; readonly outcome: HandOverOutcome | null; readonly scope?: AdvisorScope | null };

/**
 * What becomes of a removed seat's holder (issue #900; Owner decision,
 * 2026-10-31): "stays" keeps them on the team as before (`stayingOnTeam`);
 * "advisor" is Stays as an advisor, an Advisor role at `scope`, the whole
 * team, and their access ends.
 */
export const SEAT_REMOVAL_OUTCOMES = ["stays", "advisor"] as const;
export type SeatRemovalOutcome = (typeof SEAT_REMOVAL_OUTCOMES)[number];

/** Remove seat or Remove holder as sent: what becomes of the holder, and where an advisor advises. */
export type SeatRemoval = { readonly outcome: SeatRemovalOutcome; readonly scope: AdvisorScope | null };

/** Add seat: who holds the new seat, and its title. */
export type NewSeat = { readonly personId: number; readonly title: string };

const MAX_SEAT_TITLE = 80;

export const ONLY_TEAM_SEATS = "Only the team leader can change a team-level seat.";

const id = z.number().int().positive();
const scope = z.enum(ADVISOR_SCOPES).nullable().default(null);
const changeSchema = z.object({ to: id, outcome: z.enum(HAND_OVER_OUTCOMES).nullable().default(null), scope });
// A Remove sent with no choice, as before issue #900, keeps the holder on the team.
const removalSchema = z.object({ outcome: z.enum(SEAT_REMOVAL_OUTCOMES), scope }).default({ outcome: "stays", scope: null });
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

/** Remove seat or Remove holder as sent, in its shape; nothing sent is "stays". The rules are `planSeatRemoval`'s. */
export function checkSeatRemoval(input: unknown): Checked<SeatRemoval> {
  return parsed(removalSchema.safeParse(input));
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


/**
 * A checked Change holder: the seat's row, who holds it now, who takes it,
 * and what becomes of the holder. The successor's row carries the seat's
 * title and its full-access flag (`seat`).
 */
export type SeatHolderPlan = { readonly seat: BoardRole; readonly from: number; readonly to: number; readonly steppingDown: SteppingDown };

/**
 * Who holds the seat the active team-level row `roleId` is, each once
 * (`holdersOfSeat`): its own holder and every co-holder (epic #861); none
 * when no active team-level row is `roleId`.
 */
export function holdersOfSeatRow(roleId: number, active: readonly ActiveRoleRow[], org: OrgChart): number[] {
  const row = active.find((r) => r.id === roleId && isTeamSeat(r));
  return row === undefined ? [] : holdersOfSeat(seatOfTeamRow(row), active, org);
}

/**
 * Change holder as the rules allow it, or the first reason it is refused:
 * only the team leader or full access; an active team-level seat; a successor
 * on the team who does not hold that exact seat already, by this row or by a
 * co-holder's (`holderAddRefusal`, issue #872). `roleId` is the picked
 * holder's row: only it ends, and every other holder of the seat keeps it.
 * Any other seat the successor holds stays (Owner decision, issue #837), and
 * they keep every role and division they hold; the holder becomes an advisor
 * to the team or leaves the team, as the editor picked, and nothing is picked
 * for them (`steppingDown`).
 */
export function planSeatHolderChange(input: {
  readonly actor: TeamActor | null;
  readonly roleId: number;
  readonly change: SeatHolderChange;
  readonly team: readonly TeamPerson[];
  readonly active: readonly ActiveRoleRow[];
  readonly org: OrgChart;
}): Checked<SeatHolderPlan> {
  const { actor, roleId, change, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const held = heldTeamSeat(team, roleId);
  if (held === null) return no("That seat is no longer held.");
  const next = team.find((p) => p.id === change.to);
  if (next === undefined) return no("They are not on the team.");
  const refusal = holderAddRefusal(next, [held.holder.id, ...holdersOfSeatRow(roleId, input.active, input.org)]);
  if (refusal !== null) return no(refusal);
  if (change.outcome === null) return no(`Choose what happens to ${held.holder.name}: Become an advisor or Leave the team.`);
  const step = steppingDownAt(SEAT_STEP, change.outcome, change.scope ?? null);
  if (!step.ok) return no(step.error);
  return { ok: true, value: { seat: held.seat, from: held.holder.id, to: next.id, steppingDown: step.value } };
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

/**
 * A checked Remove seat: the seat's row, who holds it, and the Advisor role
 * they get when the editor picked Stays as an advisor (`advisingAt`), else
 * null: they stay on the team as before (`stayingOnTeam`).
 */
export type SeatRemovalPlan = { readonly seat: BoardRole; readonly holder: number; readonly advising: Advising | null };

/**
 * Remove seat as the rules allow it, or the first reason it is refused: only
 * the team leader or full access; an active team-level seat, the Project
 * Manager's and the Chief Engineer's included (Owner decision). `roleId` is
 * the picked holder's row: it ends and no successor's starts, so that
 * holder's full access ends with it. Every other holder of the seat keeps it
 * (issue #872); the seat leaves the tree only with its last holder. The
 * holder keeps every other role they hold either way.
 */
export function planSeatRemoval(input: {
  readonly actor: TeamActor | null;
  readonly roleId: number;
  readonly removal: SeatRemoval;
  readonly team: readonly TeamPerson[];
}): Checked<SeatRemovalPlan> {
  const { actor, roleId, removal, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const held = heldTeamSeat(team, roleId);
  if (held === null) return no("That seat is no longer held.");
  if (removal.outcome === "stays") return { ok: true, value: { seat: held.seat, holder: held.holder.id, advising: null } };
  const advising = advisingAt(SEAT_STEP, removal.scope);
  if (!advising.ok) return no(advising.error);
  return { ok: true, value: { seat: held.seat, holder: held.holder.id, advising: advising.value } };
}

/**
 * What the Remove confirm says: the seat's title and the holder it removes by
 * name, and what happens to them. `others` are the co-holders who keep the
 * seat (issue #872): with any, the seat stays on the Team tree; with none,
 * it leaves the Team tree and the Team page. `removal` is what the editor
 * picked for the holder (issue #900); an advisor's line names where they
 * advise.
 */
export function seatRemovalLines(
  seat: { readonly title: string; readonly flag: BoardFlag | null },
  holder: string,
  others: readonly string[] = [],
  removal: SeatRemoval = { outcome: "stays", scope: null },
): readonly string[] {
  return [
    others.length === 0
      ? `${holder} no longer holds ${seat.title}. The seat leaves the Team tree and the Team page.`
      : `${holder} no longer holds ${seat.title}. ${keepTheSeat(others)}`,
    ...(seat.flag === null ? [] : [`${holder} loses the full access ${seat.title} gives.`]),
    removal.outcome === "advisor"
      ? `${holder} ${advisingLine(SEAT_STEP, removal.scope ?? defaultAdvisorScope(SEAT_STEP), NO_UNITS)}. They keep their other roles.`
      : `${holder} stays on the team and keeps their other roles and access. With no other role, they become an advisor to the team.`,
  ];
}

/** The role a team seat's holder steps down from (`SteppedDownFrom`). */
export const SEAT_STEP = { kind: "team-seat" } as const satisfies SteppedDownFrom;

/** A team seat sits in no division and no department, so its holder's only scope is the whole team. */
const NO_UNITS: ScopeNames = { division: null, department: null };

/** Remove seat's "Stays on the team" option (issue #900), beside Stays as an advisor: the holder stays as before (`stayingOnTeam`). */
export const STAYS_ON_THE_TEAM = { title: "Stays on the team", detail: "Keeps their other roles and access" } as const;

/** "Giulia Neri keeps the seat and its rights.": what a replace or remove of one co-holder says of the others (issue #872). */
export function keepTheSeat(others: readonly string[]): string {
  return `${andList(others)} ${others.length === 1 ? "keeps" : "keep"} the seat and its rights.`;
}

// Add another holder (epic #861, issue #868): the team leader's seat and any
// team-level seat take one more holder, beside the ones they have. The rule
// all seats share is `addedHolder` (./seat-holders.ts); a department's head is
// added in ./department-edit.ts.

/** The title a team leader row carries when the seat has no stored one. */
export const TEAM_LEADER_TITLE = "Team Leader";

/**
 * Add another team leader as the rules allow it, or the first reason it is
 * refused: only the team leader or full access; a person on the team who is
 * not a team leader already. Their row is a `president` row with the title
 * the first team leader row stores, and no full-access flag: the type gives
 * the team leader's rights. Every team leader now stays one.
 */
export function planTeamLeaderAdd(input: {
  readonly actor: TeamActor | null;
  readonly add: HolderAdd;
  readonly team: readonly TeamPerson[];
  readonly active: readonly ActiveRoleRow[];
  readonly org: OrgChart;
}): Checked<HolderAddPlan> {
  const { actor, add, team, active, org } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const seat: Seat = { kind: "team-leader" };
  const title = active.find((r) => holdsSeat(seat, r, org))?.title.trim() || TEAM_LEADER_TITLE;
  return addedHolder({ seat, add, team, active, org, row: { type: "president", title, fullAccess: null, departmentId: null } });
}

/**
 * Add another holder on a team-level seat as the rules allow it, or the first
 * reason it is refused: only the team leader or full access; `roleId` is an
 * active team-level seat row (`isTeamSeat`); a person on the team who does not
 * hold that seat already. The seat is the row's full-access seat when it is
 * flagged, else its type and stored title (`seatOfTeamRow`), and the new row
 * copies the row's type, title and full-access flag.
 */
export function planSeatHolderAdd(input: {
  readonly actor: TeamActor | null;
  readonly roleId: number;
  readonly add: HolderAdd;
  readonly team: readonly TeamPerson[];
  readonly active: readonly ActiveRoleRow[];
  readonly org: OrgChart;
}): Checked<HolderAddPlan> {
  const { actor, roleId, add, team, active, org } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const row = active.find((r) => r.id === roleId && isTeamSeat(r));
  if (row === undefined) return no("That seat is no longer held.");
  return addedHolder({
    seat: seatOfTeamRow(row),
    add,
    team,
    active,
    org,
    row: { type: row.type, title: row.title, fullAccess: row.fullAccess, departmentId: null },
  });
}

/** A checked Add seat: who holds the new seat, and its title as stored. */
export type NewSeatPlan = { readonly personId: number; readonly title: string };

/**
 * Add seat as the rules allow it, or the first reason it is refused: only the
 * team leader or full access; a title; one person on the team, whatever
 * other seats they hold (Owner decision, issue #837); they keep every role
 * and division they hold. The seat carries no full-access flag: only the
 * Project Manager's and the Chief Engineer's do.
 */
export function planNewSeat(input: {
  readonly actor: TeamActor | null;
  readonly add: NewSeat;
  readonly team: readonly TeamPerson[];
}): Checked<NewSeatPlan> {
  const { actor, add, team } = input;
  if (!mayManageDepartments(actor)) return no(ONLY_TEAM_SEATS);
  const titleError = seatTitleError(add.title);
  if (titleError !== null) return no(titleError);
  const person = team.find((p) => p.id === add.personId);
  if (person === undefined) return no("They are not on the team.");
  return { ok: true, value: { personId: person.id, title: storedSeatTitle(add.title) } };
}
