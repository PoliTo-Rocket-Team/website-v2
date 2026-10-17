// The access seed (issue #304): the grants the Access page gives and reads
// (issues #247, #270), as `scopes` rows. Each grant is written the way the
// page writes it (`grantRowOf`, lib/dashboard/division-access.ts): an area
// across the whole team, in a department or in a division, at view or edit;
// Alumni access; and "Approve orders" held on its own.

import { scopes } from "@/db/schema";
import {
  grantRowOf,
  WHOLE_TEAM_PLACE,
  type AccessLevel,
  type AccessPlace,
  type AccessTarget,
} from "@/lib/dashboard/division-access";
import { TEAM_LEADER, TESTER_MEMBER } from "./people";
import { rowsOf, tableSeedModule } from "./rows";
import { DEPARTMENT, DIVISION, DEPARTMENT_ROWS, DIVISION_ROWS } from "./structure";

/** Holds "Approve orders" and no other grant (issue #270). */
export const APPROVE_ORDERS_ONLY = 24;
/** Holds Alumni access: site-content access (issue #234). */
export const ALUMNI_EDITOR = 36;

function department(id: number): AccessPlace {
  const row = DEPARTMENT_ROWS.rows.find((d) => d.id === id);
  if (row === undefined) throw new Error(`no seeded department ${id}`);
  return { kind: "department", department: { id, name: row.name } };
}

function division(id: number): AccessPlace {
  const row = DIVISION_ROWS.rows.find((d) => d.id === id);
  if (row === undefined) throw new Error(`no seeded division ${id}`);
  return { kind: "division", division: { id, name: row.name } };
}

type Grant = {
  readonly memberId: number;
  readonly givenBy: number | null;
  readonly place: AccessPlace;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

function scopeRow({ memberId, givenBy, place, target, level }: Grant) {
  return { memberId, givenBy, accessLevel: level, ...grantRowOf(place, target) };
}

/** The grants, as the Access page gives them. */
export const GRANTS: readonly Grant[] = [
  { memberId: 7, givenBy: TEAM_LEADER, place: WHOLE_TEAM_PLACE, target: "members", level: "view" },
  { memberId: 9, givenBy: TEAM_LEADER, place: WHOLE_TEAM_PLACE, target: "orders", level: "edit" },
  { memberId: 14, givenBy: 2, place: department(DEPARTMENT.propulsion), target: "applications", level: "edit" },
  { memberId: 30, givenBy: 4, place: department(DEPARTMENT.structures), target: "positions", level: "view" },
  { memberId: 28, givenBy: TESTER_MEMBER["division-lead"], place: division(DIVISION.missionAnalysis), target: "positions", level: "edit" },
  { memberId: 22, givenBy: 26, place: division(DIVISION.flightControl), target: "members", level: "view" },
  { memberId: ALUMNI_EDITOR, givenBy: TEAM_LEADER, place: WHOLE_TEAM_PLACE, target: "alumni", level: "edit" },
];

export const SCOPE_ROWS = rowsOf(scopes, [
  ...GRANTS.map(scopeRow),
  // "Approve orders" is a `team` row on `approve_orders`, always at edit (./database-division.ts).
  { memberId: APPROVE_ORDERS_ONLY, givenBy: TEAM_LEADER, scope: "team", target: "approve_orders", accessLevel: "edit" },
  // The local testers' rows (issue #129): the division-lead tester edits all
  // of Mission Analysis; the operations-lead tester edits positions team-wide,
  // the access the recruitment switch checks.
  { memberId: TESTER_MEMBER["division-lead"], scope: "division", target: "all", accessLevel: "edit", divisionId: DIVISION.missionAnalysis },
  { memberId: TESTER_MEMBER["operations-lead"], scope: "org", target: "positions", accessLevel: "edit" },
]);

export const access = tableSeedModule({
  name: "access",
  owns: [scopes],
  rows: [SCOPE_ROWS],
});
