import {
  areaGrantsOf,
  coveredDivisionIds,
  grantedAreasOf,
  mayChange,
  viewerUnitsOf,
  type GrantArea,
  type ScopeUnitRow,
  type ScopedRole,
} from "@/lib/dashboard/viewer";
import type { OrgChart, TeamActor } from "@/lib/dashboard/team";

// A Members grant the member test viewer can hold (issue #351), so a preview
// shows the Members page as a grant holder sees it. The test developer signs
// in as the member with `grant=<one of TEST_GRANTS>`; View as never passes
// it, so switching viewer drops the grant. The member is Elif Kaya, in
// Mission Analysis (division 1, in Aerodynamics, department 1).

export const TEST_GRANTS = ["members-view", "members-edit-department"] as const;
export type TestGrant = (typeof TEST_GRANTS)[number];

/** The grant a cookie or a query names; null for anything else. */
export function testGrantOf(value: string | null | undefined): TestGrant | null {
  return (TEST_GRANTS as readonly string[]).includes(value ?? "") ? (value as TestGrant) : null;
}

const MISSION_ANALYSIS = 1;
const AERODYNAMICS = 1;

/**
 * The scope row each grant is: Members at Can view in Mission Analysis, or
 * Members at Can edit across Aerodynamics.
 */
const SCOPE_ROW: Readonly<Record<TestGrant, ScopeUnitRow>> = {
  "members-view": { scope: "division", target: "members", level: "view", divisionId: MISSION_ANALYSIS, deptId: null },
  "members-edit-department": { scope: "department", target: "members", level: "edit", divisionId: null, deptId: AERODYNAMICS },
};

/** The areas the member holding `grant` is granted (issue #471): Members alone, by its scope row. */
export function testGrantAreas(grant: TestGrant): readonly GrantArea[] {
  return grantedAreasOf([SCOPE_ROW[grant]]);
}

/** The member's own role: a member of Mission Analysis, which changes nobody. */
const MEMBER_ROLE: ScopedRole = { type: null, divisionId: MISSION_ANALYSIS, departmentId: AERODYNAMICS };

/**
 * Who the member holding `grant` reads and changes the Members page as, by
 * the rules the database side runs (`readViewingActor` and `readActor`,
 * lib/dashboard/database-team.ts): reading reaches every division the grant
 * covers; changing reaches those where `mayChange` holds on Members.
 */
export function grantActors(grant: TestGrant, org: OrgChart): { readonly viewing: TeamActor | null; readonly changing: TeamActor | null } {
  const rows = [SCOPE_ROW[grant]];
  const covered = coveredDivisionIds(viewerUnitsOf(rows, [MEMBER_ROLE]), org.divisions);
  const authority = { kind: "member" as const, roles: [MEMBER_ROLE], grants: areaGrantsOf(rows) };
  const changes = covered.filter((divisionId) => {
    const division = org.divisions.find((d) => d.id === divisionId);
    return division !== undefined && mayChange(authority, "members", { divisionId, departmentId: division.departmentId });
  });
  const lead = (divisionIds: number[]): TeamActor | null => (divisionIds.length === 0 ? null : { kind: "lead", divisionIds });
  return { viewing: lead(covered.filter((id) => org.divisions.some((d) => d.id === id))), changing: lead(changes) };
}
