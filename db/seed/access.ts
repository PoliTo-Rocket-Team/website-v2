// The access seed (issue #304): the grants the Access page gives and reads
// (issues #247, #270), as `scopes` rows. Each grant is written the way the
// page writes it (`grantRowOf`, lib/dashboard/division-access.ts): an area
// across the whole team, in a department or in a division, at view or edit;
// Content, which opens the Alumni page (issue #589); and "Approve orders"
// held on its own.

import { scopes } from "@/db/schema";
import {
  grantRowOf,
  WHOLE_TEAM_PLACE,
  type AccessLevel,
  type AccessPlace,
  type AccessTarget,
} from "@/lib/dashboard/division-access";
import { PROPULSION_HEAD, TEAM_LEADER, TWO_DIVISION_MEMBER } from "./people";
import { publicMember } from "./public-team";
import { rowsOf, tableSeedModule } from "./rows";
import { DEPARTMENT, DIVISION, DEPARTMENT_ROWS, DIVISION_ROWS } from "./structure";

// Grants are private, so every one is invented (issue #326); each goes to
// someone on the public team whose role fits it.

/** Holds "Approve orders" and no other grant (issue #270): a core member of Information Technology. */
export const APPROVE_ORDERS_ONLY = publicMember("Claudia Sanna");
/** Holds Content: site-content access, the Alumni page included (issues #234, #589). A core member of Communications. */
export const CONTENT_EDITOR = publicMember("Francesco Guerrini");

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
  { memberId: publicMember("Luca Beccaria"), givenBy: TEAM_LEADER, place: WHOLE_TEAM_PLACE, target: "members", level: "view" },
  { memberId: publicMember("Ettore De Bartolo"), givenBy: TEAM_LEADER, place: WHOLE_TEAM_PLACE, target: "orders", level: "edit" },
  { memberId: publicMember("Fabio Zeloni"), givenBy: PROPULSION_HEAD, place: department(DEPARTMENT.propulsion), target: "applications", level: "edit" },
  { memberId: publicMember("Dante Casaglia"), givenBy: TWO_DIVISION_MEMBER, place: department(DEPARTMENT.structures), target: "positions", level: "view" },
  { memberId: publicMember("Aurelio Amato"), givenBy: publicMember("Maria Angelica Fullone Penna"), place: division(DIVISION.missionAnalysis), target: "positions", level: "edit" },
  { memberId: publicMember("Federico Saviano"), givenBy: publicMember("Nicola Montagner"), place: division(DIVISION.flightControl), target: "members", level: "view" },
  { memberId: CONTENT_EDITOR, givenBy: TEAM_LEADER, place: WHOLE_TEAM_PLACE, target: "content", level: "edit" },
];

export const SCOPE_ROWS = rowsOf(scopes, [
  ...GRANTS.map(scopeRow),
  // "Approve orders" is a `team` row on `approve_orders`, always at edit (./database-division.ts).
  { memberId: APPROVE_ORDERS_ONLY, givenBy: TEAM_LEADER, scope: "team", target: "approve_orders", accessLevel: "edit" },
  // No seat a check views as holds a row here (issue #595): the team leader,
  // the operations lead, the department head, the division lead, the member,
  // the alumnus and the applicant each hold only what their roles give, so
  // an access check starts from a clean seat (docs/seed-cases.md, "Test seats").
]);

export const access = tableSeedModule({
  name: "access",
  owns: [scopes],
  rows: [SCOPE_ROWS],
});
