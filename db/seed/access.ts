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
import { SEATS, seatOf, type SeatGrant } from "@/lib/seeded-accounts";
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

if (seatOf("approve-orders").memberId !== APPROVE_ORDERS_ONLY) throw new Error("the Approve-orders seat is not the member who holds it alone");

/** A seat's grant, given by the team leader across the whole team. */
function seatGrantRow(memberId: number, grant: SeatGrant) {
  // "Approve orders" is a `team` row on `approve_orders`, always at edit (./database-division.ts).
  const where = grant.area === "approve_orders" ? ({ scope: "team", target: "approve_orders" } as const) : grantRowOf(WHOLE_TEAM_PLACE, grant.area);
  return { memberId, givenBy: TEAM_LEADER, accessLevel: grant.level, ...where };
}

export const SCOPE_ROWS = rowsOf(scopes, [
  ...GRANTS.map(scopeRow),
  // Every seat holds exactly the grants its row in lib/seeded-accounts.ts
  // names (issues #595, #607): none for the team leader, the full-access
  // seats, the head, the lead, the member, the alumnus and the applicant, so
  // an access check starts from a clean seat; one each for the one-grant
  // seats and the Approve-orders holder (docs/seed-cases.md, "Test seats").
  ...SEATS.flatMap(({ memberId, grants }) => (memberId === null ? [] : grants.map((grant) => seatGrantRow(memberId, grant)))),
]);

export const access = tableSeedModule({
  name: "access",
  owns: [scopes],
  rows: [SCOPE_ROWS],
});
