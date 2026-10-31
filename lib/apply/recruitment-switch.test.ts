import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { RecruitmentReader, RecruitmentRole } from "@/lib/dashboard/application-documents";
import { RECRUITMENT_MANAGER_DIVISION_CODE } from "@/lib/dashboard/notices";
import { viewerStandingOf, type ActiveRoleRef, type AreaGrant, type ScopeRef } from "@/lib/dashboard/viewer";
import type { Recruitment } from "./positions";
import { canSwitchRecruitment, switchRecruitment } from "./recruitment-switch";

/** A role and the place it holds, as `readIdentity` reads it, with the full-access seat it is flagged as. */
type Held = RecruitmentRole & Pick<ActiveRoleRef, "fullAccess">;

/** Where a role sits: its division, that division's department, its code and the day it closed. */
type Place = Pick<RecruitmentRole, "divisionId" | "departmentId" | "divisionCode" | "divisionClosedAt">;

const TEST_BENCH: Place = { divisionId: 5, departmentId: 1, divisionCode: "TBE", divisionClosedAt: null };
const LOGISTICS: Place = { divisionId: 7, departmentId: 3, divisionCode: RECRUITMENT_MANAGER_DIVISION_CODE, divisionClosedAt: null };
const CLOSED_LOGISTICS: Place = { ...LOGISTICS, divisionClosedAt: "2026-09-01" };
const NOWHERE: Place = { divisionId: null, departmentId: null, divisionCode: null, divisionClosedAt: null };

const held = (type: RecruitmentRole["type"], place: Place, fullAccess: ActiveRoleRef["fullAccess"] = null): Held => ({ type, ...place, fullAccess });

/** A real account as the dashboard reads it: its standing from its active roles and scope rows, its roles and its area grants. */
function reader(roles: readonly Held[], scopes: readonly ScopeRef[] = [], grants: readonly AreaGrant[] = []): RecruitmentReader {
  const standing = viewerStandingOf({ scopes, activeRoles: roles });
  return { ...standing, roles: roles.map(({ fullAccess: _, ...role }) => role), grants };
}

const CORE = held("core", TEST_BENCH);
const flagged = (fullAccess: ActiveRoleRef["fullAccess"]) => held("core", NOWHERE, fullAccess);
const onLogistics = (target: AreaGrant["target"]): AreaGrant => ({ target, level: "edit", unit: { kind: "division", divisionId: LOGISTICS.divisionId! } });
const OFF_TEAM: RecruitmentReader = { ...viewerStandingOf(null), roles: [], grants: [] };

/** Runs the switch for this caller, recording what was saved and refreshed. */
async function flip(viewer: RecruitmentReader, to: Recruitment) {
  const saved: Recruitment[] = [];
  let refreshed = 0;
  const result = await switchRecruitment(to, {
    maySwitch: async () => canSwitchRecruitment(viewer),
    save: async (recruitment) => void saved.push(recruitment),
    refresh: () => void refreshed++,
  });
  return { result, saved, refreshed };
}

// Full access includes the switch (Owner decision, issue #621): every seat
// and an org or admin row, with no positions grant. The recruitment manager,
// an active lead of the open Logistics division, has it too (Owner decision,
// issue #875).
describe("switchRecruitment", () => {
  const allowed: [string, RecruitmentReader][] = [
    ["the team leader, from their seat with no scope row", reader([held("president", NOWHERE)])],
    ["the operations lead, from their seat with no scope row", reader([flagged("operations-lead")])],
    ["the IT lead, from their seat with no scope row", reader([flagged("it-lead")])],
    ["the Project Manager, from their seat with no scope row", reader([flagged("project-manager")])],
    ["the Chief Engineer, from their seat with no scope row", reader([flagged("chief-engineer")])],
    ["a member with an org row", reader([CORE], [{ scope: "org", target: "all", level: "edit" }])],
    ["a member with an admin row", reader([CORE], [{ scope: "admin", target: "all", level: "edit" }])],
    ["a member with an org row at Can view", reader([CORE], [{ scope: "org", target: "positions", level: "view" }])],
    ["the recruitment manager, the lead of the open Logistics division, with no scope row", reader([held("lead", LOGISTICS)])],
    ["the recruitment manager who also leads another division", reader([held("lead", TEST_BENCH), held("lead", LOGISTICS)])],
  ];
  for (const [who, viewer] of allowed) {
    for (const isOpen of [false, true]) {
      test(`${who} turns recruitment ${isOpen ? "on" : "off"}; it is saved and the public pages refresh`, async () => {
        const { result, saved, refreshed } = await flip(viewer, { isOpen });
        assert.deepEqual(result, { status: "switched", recruitment: { isOpen } });
        assert.deepEqual(saved, [{ isOpen }]);
        assert.equal(refreshed, 1);
      });
    }
  }

  const refused: [string, RecruitmentReader][] = [
    ["a department head", reader([held("head", { ...NOWHERE, departmentId: LOGISTICS.departmentId })])],
    ["another division's lead", reader([held("lead", TEST_BENCH)])],
    ["a lead of the Logistics division once it is closed", reader([held("lead", CLOSED_LOGISTICS)])],
    ["a member of the Logistics division who leads nothing", reader([held("core", LOGISTICS)])],
    ["a member with no grant", reader([CORE])],
    ["a member with a positions grant across their department", reader([CORE], [{ scope: "department", target: "positions", level: "edit" }])],
    ["a member with a grant on every area in their division", reader([CORE], [{ scope: "division", target: "all", level: "edit" }])],
    [
      "a member whose only Logistics link is an area grant on it",
      reader([CORE], [{ scope: "division", target: "all", level: "edit" }], [onLogistics("positions"), onLogistics("applications")]),
    ],
    [
      "an alumnus with an org row left over",
      { ...viewerStandingOf({ scopes: [{ scope: "org", target: "all", level: "edit" }], activeRoles: [], onAlumniRecord: true }), roles: [], grants: [] },
    ],
    ["someone off the team", OFF_TEAM],
  ];
  for (const [who, viewer] of refused) {
    test(`${who} is refused and nothing is written`, async () => {
      const { result, saved, refreshed } = await flip(viewer, { isOpen: false });
      assert.deepEqual(result, { status: "refused" });
      assert.deepEqual(saved, []);
      assert.equal(refreshed, 0);
    });
  }
});
