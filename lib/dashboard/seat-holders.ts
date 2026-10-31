import { z } from "zod";
import type { Checked } from "./department-edit";
import type { TeamPerson } from "./division-edit";
import { headDepartmentOf, isTeamSeat, type OrgChart, type RoleType } from "./team";
import type { MovesWith } from "./team-address";
import type { FlaggedSeat } from "./viewer";

// Add another holder (epic #861, issue #868). Every seat may have several
// active holders, each with the seat's full rights (Owner decision on epic
// #861): the team leader's, a full-access seat, a department's head and any
// other team-level seat. Adding one more holder starts one role row for them
// and ends none. This module says what a seat is and who holds it; the plans
// that decide who may add a holder are in ./team-seats.ts (the team leader, a
// team-level seat) and ./department-edit.ts (a department's head), and both
// call `addedHolder` below once they let the actor through.

/** Add another holder as sent: who joins the seat. */
export type HolderAdd = { readonly personId: number };

const addSchema = z.object({ personId: z.number().int().positive() });

/** Add another holder as sent, in its shape; the rules are the plan's for that seat. */
export function checkHolderAdd(input: unknown): Checked<HolderAdd> {
  const result = addSchema.safeParse(input);
  return result.success ? { ok: true, value: result.data } : { ok: false, error: result.error.issues[0]?.message ?? "Check the form." };
}

/** An active role row as a seat is read off it: whose it is, what it is, where it sits. */
export type ActiveRoleRow = {
  readonly id: number;
  readonly memberId: number;
  readonly type: RoleType;
  /** As stored. */
  readonly title: string;
  readonly fullAccess: FlaggedSeat | null;
  readonly departmentId: number | null;
  readonly divisionId: number | null;
};

/**
 * A seat, as the rows that hold it share it: the team leader's by the
 * `president` type, a full-access seat by its flag, a department's head by
 * the department wherever the head row is kept (`headDepartmentOf`), and any
 * other team-level seat by its type and stored title, trimmed.
 */
export type Seat =
  | { readonly kind: "team-leader" }
  | { readonly kind: "full-access"; readonly seat: FlaggedSeat }
  | { readonly kind: "head"; readonly departmentId: number }
  | { readonly kind: "team-level"; readonly type: RoleType; readonly title: string };

/** The seat a team-level row is (`isTeamSeat`): its full-access seat when it is flagged, else its type and stored title. */
export function seatOfTeamRow(row: ActiveRoleRow): Seat {
  return row.fullAccess !== null ? { kind: "full-access", seat: row.fullAccess } : { kind: "team-level", type: row.type, title: row.title.trim() };
}

/** Whether the active row holds `seat`. */
export function holdsSeat(seat: Seat, row: ActiveRoleRow, org: OrgChart): boolean {
  switch (seat.kind) {
    case "team-leader":
      return row.type === "president";
    case "full-access":
      return row.fullAccess === seat.seat;
    case "head":
      return row.type === "head" && headDepartmentOf(row, org) === seat.departmentId;
    case "team-level":
      return row.fullAccess === null && isTeamSeat(row) && row.type === seat.type && row.title.trim() === seat.title;
  }
}

/** Who holds `seat` now, each once, in the order of their rows. */
export function holdersOfSeat(seat: Seat, active: readonly ActiveRoleRow[], org: OrgChart): number[] {
  return [...new Set(active.filter((r) => holdsSeat(seat, r, org)).map((r) => r.memberId))];
}

/**
 * The role a team address moves with (issue #789) that `seat` is: a
 * team-level seat with no full-access flag is none.
 */
export function tieOfSeat(seat: Seat): MovesWith | null {
  switch (seat.kind) {
    case "team-leader":
      return { kind: "team-leader" };
    case "full-access":
      return { kind: "full-access-seat", seat: seat.seat };
    case "head":
      return { kind: "department-head", departmentId: seat.departmentId };
    case "team-level":
      return null;
  }
}

/**
 * Whether a new holder of `seat` is owed an email alias request when they
 * have no alias (issue #543): a new team leader and a new head are, as a
 * hand-over makes them; a team-level seat's new holder is not, as Change
 * holder makes none.
 */
export function asksAlias(seat: Seat): boolean {
  return seat.kind === "team-leader" || seat.kind === "head";
}

/**
 * The role row Add another holder starts: the seat's type, title and
 * full-access flag, and for a head the department it heads. It starts beside
 * every row the seat's holders keep.
 */
export type NewHolderRow = {
  readonly personId: number;
  readonly type: RoleType;
  readonly title: string;
  readonly fullAccess: FlaggedSeat | null;
  readonly departmentId: number | null;
};

/** A checked Add another holder: the seat, who holds it now, and the row that makes one more holder. */
export type HolderAddPlan = { readonly seat: Seat; readonly holders: readonly number[]; readonly row: NewHolderRow };

/**
 * The rule every seat shares once the actor may add a holder: the person is
 * on the team and does not hold this exact seat already. Any other seat,
 * role and division they hold stays (Owner decision, issue #837), and every
 * holder of the seat now keeps it.
 */
export function addedHolder(input: {
  readonly seat: Seat;
  readonly add: HolderAdd;
  readonly team: readonly TeamPerson[];
  readonly active: readonly ActiveRoleRow[];
  readonly org: OrgChart;
  readonly row: Omit<NewHolderRow, "personId">;
}): Checked<HolderAddPlan> {
  const { seat, add, team, active, org, row } = input;
  const person = team.find((p) => p.id === add.personId);
  if (person === undefined) return { ok: false, error: "They are not on the team." };
  const holders = holdersOfSeat(seat, active, org);
  if (holders.includes(person.id)) return { ok: false, error: `${person.name} holds this seat now.` };
  return { ok: true, value: { seat, holders, row: { ...row, personId: person.id } } };
}
