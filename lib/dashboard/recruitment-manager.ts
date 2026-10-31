// The recruitment manager (issue #194): the lead of the open Logistics
// division. Since issue #885 the same lead seat is also a full-access seat
// (`fullAccessSeatOf`, ./viewer.ts), so this module holds the one rule both
// read, with no import back into the viewer.

import { divisionRoleOf, type RoleType } from "./team";

/** A division of the team as the recruitment manager rule reads it: its code and whether it is closed. */
export type TeamDivision = { readonly id: number; readonly code: string | null; readonly closedAt: string | null };

/**
 * The code of the division whose leads are the recruitment manager: Logistics,
 * in the Operations department (owner ruling on #194,
 * https://github.com/PoliTo-Rocket-Team/website-v2/issues/194#issuecomment-6341780484).
 */
export const RECRUITMENT_MANAGER_DIVISION_CODE = "LGS";

/**
 * The division whose leads are the recruitment manager: the open division
 * with the Logistics code. Null when that division is closed or the team has
 * none, and then nobody is the recruitment manager. This is the one rule that
 * finds it.
 */
export function recruitmentManagerDivision<D extends TeamDivision>(team: readonly D[]): D | null {
  return team.find((d) => d.code === RECRUITMENT_MANAGER_DIVISION_CODE && d.closedAt === null) ?? null;
}

/** An active role with what the rule reads of its division: its id, code and the day it closed (null while open). */
export type DivisionRoleRef = {
  readonly type: RoleType;
  readonly divisionId: number | null;
  readonly divisionCode: string | null;
  readonly divisionClosedAt: string | null;
};

/**
 * Whether the roles lead the division `recruitmentManagerDivision` finds: a
 * lead (or head) role in the open Logistics division. A member role there
 * leads nothing, and a role in a closed Logistics division finds none. Every
 * co-holder of the lead seat (epic #861) holds such a role, and a role that
 * ended is not active, so the answer follows the role alone.
 */
export function leadsRecruitmentManagerDivision(roles: readonly DivisionRoleRef[]): boolean {
  const led = roles.flatMap((r) =>
    r.divisionId !== null && divisionRoleOf(r.type) === "lead" ? [{ id: r.divisionId, code: r.divisionCode, closedAt: r.divisionClosedAt }] : [],
  );
  return recruitmentManagerDivision(led) !== null;
}
