import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ScopeInfo } from "@/app/actions/get-member-scopes";
import { viewerStandingOf, type ViewerStanding } from "@/lib/dashboard/viewer";
import type { Recruitment } from "./positions";
import { canSwitchRecruitment, switchRecruitment } from "./recruitment-switch";

/** A positions scope: the empty one (no one signed in, or no scope row), plus the given fields. */
function scope(fields: Partial<ScopeInfo> = {}): ScopeInfo {
  return {
    hasAdminAccess: false,
    hasOrgAccess: false,
    hasAdminEdit: false,
    hasOrgEdit: false,
    departmentIds: new Set(),
    divisionIds: new Set(),
    editableDepartmentIds: new Set(),
    editableDivisionIds: new Set(),
    ...fields,
  };
}

// Real accounts' standings, read from their active roles alone, with no scope row.
const member: ViewerStanding = viewerStandingOf({ scopes: [], activeRoles: [{ type: "core", divisionId: 5, fullAccess: null }] });
const teamLeader: ViewerStanding = viewerStandingOf({ scopes: [], activeRoles: [{ type: "president", divisionId: null, fullAccess: null }] });
const operationsLead: ViewerStanding = viewerStandingOf({ scopes: [], activeRoles: [{ type: "core", divisionId: null, fullAccess: "operations-lead" }] });
const departmentHead: ViewerStanding = viewerStandingOf({ scopes: [], activeRoles: [{ type: "head", divisionId: null, fullAccess: null }] });
const divisionLead: ViewerStanding = viewerStandingOf({ scopes: [], activeRoles: [{ type: "lead", divisionId: 5, fullAccess: null }] });

/** Runs the switch for a caller with this standing and scope, recording what was saved and refreshed. */
async function flip(viewer: ViewerStanding, caller: ScopeInfo, to: Recruitment) {
  const saved: Recruitment[] = [];
  let refreshed = 0;
  const result = await switchRecruitment(to, {
    maySwitch: async () => canSwitchRecruitment(viewer, caller),
    save: async (recruitment) => void saved.push(recruitment),
    refresh: () => void refreshed++,
  });
  return { result, saved, refreshed };
}

describe("switchRecruitment", () => {
  const allowed: [string, ViewerStanding, ScopeInfo][] = [
    ["the team leader, from their seat with no scope row", teamLeader, scope()],
    ["an org-wide positions editor", member, scope({ hasOrgAccess: true, hasOrgEdit: true })],
    ["an admin with edit", member, scope({ hasAdminAccess: true, hasAdminEdit: true })],
    ["the operations lead with an org-wide positions edit row", operationsLead, scope({ hasOrgAccess: true, hasOrgEdit: true })],
  ];
  for (const [who, viewer, caller] of allowed) {
    for (const isOpen of [false, true]) {
      test(`${who} turns recruitment ${isOpen ? "on" : "off"}; it is saved and the public pages refresh`, async () => {
        const { result, saved, refreshed } = await flip(viewer, caller, { isOpen });
        assert.deepEqual(result, { status: "switched", recruitment: { isOpen } });
        assert.deepEqual(saved, [{ isOpen }]);
        assert.equal(refreshed, 1);
      });
    }
  }

  const refused: [string, ViewerStanding, ScopeInfo][] = [
    ["a department head with edit on their department", departmentHead, scope({ departmentIds: new Set([2]), editableDepartmentIds: new Set([2]) })],
    ["a division lead with edit on their division", divisionLead, scope({ divisionIds: new Set([5]), editableDivisionIds: new Set([5]) })],
    ["a member with no positions scope", member, scope()],
    ["an org-wide positions viewer", member, scope({ hasOrgAccess: true })],
    ["an admin without edit", member, scope({ hasAdminAccess: true })],
    ["the operations lead with no positions edit row, as before", operationsLead, scope()],
    ["no one signed in", viewerStandingOf(null), scope()],
  ];
  for (const [who, viewer, caller] of refused) {
    test(`${who} is refused and nothing is written`, async () => {
      const { result, saved, refreshed } = await flip(viewer, caller, { isOpen: false });
      assert.deepEqual(result, { status: "refused" });
      assert.deepEqual(saved, []);
      assert.equal(refreshed, 0);
    });
  }
});
