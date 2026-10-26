import type { TeamPerson } from "./division-edit";
import { divisionShortName } from "./overview";
import type { OrgChart } from "./team";
import { SEAT_OF_FLAG, type FlaggedSeat, type SeatFlag } from "./viewer";

// Shared team addresses (epic #578, issue #786; board 102). Besides each
// member's PRT email, the team has shared addresses on the team domain, such
// as a recruitment or a logistics address. Each one has one holder, says
// what it is for, and may move with a role: when that role changes hands,
// the address follows it (a later slice of the epic). This module owns the
// tie, its label and how the member side view lists a member's addresses;
// `team_addresses` stores what it says.

/**
 * The role a team address moves with (grill #785, R1.1): one the org model
 * names stably, never a free-text label. A full-access seat is read from its
 * `roles.full_access` flag, a head by their department, a lead by their
 * division.
 */
export type MovesWith =
  | { readonly kind: "team-leader" }
  | { readonly kind: "full-access-seat"; readonly seat: FlaggedSeat }
  | { readonly kind: "department-head"; readonly departmentId: number }
  | { readonly kind: "division-lead"; readonly divisionId: number };

/** A team address as stored: the address, what it is for, its holder and the role it moves with, if any. */
export type TeamAddress = {
  readonly address: string;
  readonly purpose: string;
  readonly holderId: number;
  readonly movesWith: MovesWith | null;
};

/** The tie as `team_addresses` stores it: its kind and the one reference that kind needs. */
export type StoredTie = {
  readonly moves_with: "team_leader" | "full_access_seat" | "department_head" | "division_lead" | null;
  readonly moves_with_seat: SeatFlag | null;
  readonly moves_with_dept_id: number | null;
  readonly moves_with_division_id: number | null;
};

/**
 * The tie a stored row holds. The database's `team_addresses_tie` check
 * keeps the reference each kind needs, so a kind without it reads as no tie
 * rather than a broken one.
 */
export function movesWithOf(row: StoredTie): MovesWith | null {
  switch (row.moves_with) {
    case "team_leader":
      return { kind: "team-leader" };
    case "full_access_seat":
      return row.moves_with_seat === null ? null : { kind: "full-access-seat", seat: SEAT_OF_FLAG[row.moves_with_seat] };
    case "department_head":
      return row.moves_with_dept_id === null ? null : { kind: "department-head", departmentId: row.moves_with_dept_id };
    case "division_lead":
      return row.moves_with_division_id === null ? null : { kind: "division-lead", divisionId: row.moves_with_division_id };
    case null:
      return null;
  }
}

/** Each full-access seat as the org chart names it. */
const SEAT_ROLE_NAMES: Readonly<Record<FlaggedSeat, string>> = {
  "operations-lead": "Operations Lead",
  "it-lead": "IT Lead",
  "project-manager": "Project Manager",
  "chief-engineer": "Chief Engineer",
};

/**
 * The role a tie names, as the org chart names it: "Team Leader", "IT
 * Lead", "Head of Propulsion", "Logistics Lead". A unit the chart no longer
 * holds (closed since) reads by its role alone.
 */
export function movesWithLabel(tie: MovesWith, org: OrgChart): string {
  switch (tie.kind) {
    case "team-leader":
      return "Team Leader";
    case "full-access-seat":
      return SEAT_ROLE_NAMES[tie.seat];
    case "department-head": {
      const department = org.departments.find((d) => d.id === tie.departmentId);
      return department === undefined ? "Department Head" : `Head of ${department.name}`;
    }
    case "division-lead": {
      const division = org.divisions.find((d) => d.id === tie.divisionId);
      return division === undefined ? "Division Lead" : `${divisionShortName(division.name)} Lead`;
    }
  }
}

/** One line of the side view's Team addresses row (board 102): the address, what it is for, and the role it moves with, if any. */
export type TeamAddressLine = {
  readonly address: string;
  readonly purpose: string;
  /** "Logistics Lead"; null for an address tied to no role. */
  readonly movesWith: string | null;
};

/** The team addresses each member holds, by member id; a member holding none is left out. */
export type MemberTeamAddresses = Readonly<Record<number, readonly TeamAddressLine[]>>;

/** Orders addresses by the address, in any letter case. */
function byAddress(a: TeamAddressLine, b: TeamAddressLine): number {
  const x = a.address.toLowerCase();
  const y = b.address.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * The Team addresses row of each of `memberIds` on the team (board 102):
 * every address they hold, sorted by address. A member off the team, or
 * holding none, is left out, so the row is hidden for them.
 */
export function memberTeamAddressesFor(input: {
  readonly memberIds: readonly number[];
  readonly team: readonly TeamPerson[];
  readonly org: OrgChart;
  readonly held: readonly TeamAddress[];
}): MemberTeamAddresses {
  const { team, org, held } = input;
  const out: Record<number, readonly TeamAddressLine[]> = {};
  for (const memberId of input.memberIds) {
    if (!team.some((p) => p.id === memberId)) continue;
    const lines = held
      .filter((a) => a.holderId === memberId)
      .map((a): TeamAddressLine => ({
        address: a.address,
        purpose: a.purpose,
        movesWith: a.movesWith === null ? null : movesWithLabel(a.movesWith, org),
      }))
      .sort(byAddress);
    if (lines.length > 0) out[memberId] = lines;
  }
  return out;
}
