import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ScopeInfo } from "@/app/actions/get-member-scopes";
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

/** Runs the switch for a caller with this scope, recording what was saved and refreshed. */
async function flip(caller: ScopeInfo, to: Recruitment) {
  const saved: Recruitment[] = [];
  let refreshed = 0;
  const result = await switchRecruitment(to, {
    maySwitch: async () => canSwitchRecruitment(caller),
    save: async (recruitment) => void saved.push(recruitment),
    refresh: () => void refreshed++,
  });
  return { result, saved, refreshed };
}

describe("switchRecruitment", () => {
  const allowed: [string, ScopeInfo][] = [
    ["an org-wide positions editor", scope({ hasOrgAccess: true, hasOrgEdit: true })],
    ["an admin with edit", scope({ hasAdminAccess: true, hasAdminEdit: true })],
  ];
  for (const [who, caller] of allowed) {
    for (const isOpen of [false, true]) {
      test(`${who} turns recruitment ${isOpen ? "on" : "off"}; it is saved and the public pages refresh`, async () => {
        const { result, saved, refreshed } = await flip(caller, { isOpen });
        assert.deepEqual(result, { status: "switched", recruitment: { isOpen } });
        assert.deepEqual(saved, [{ isOpen }]);
        assert.equal(refreshed, 1);
      });
    }
  }

  const refused: [string, ScopeInfo][] = [
    ["a department lead with edit", scope({ departmentIds: new Set([2]), editableDepartmentIds: new Set([2]) })],
    ["a division lead with edit", scope({ divisionIds: new Set([5]), editableDivisionIds: new Set([5]) })],
    ["an org-wide positions viewer", scope({ hasOrgAccess: true })],
    ["an admin without edit", scope({ hasAdminAccess: true })],
    ["no one signed in, or a member with no positions scope", scope()],
  ];
  for (const [who, caller] of refused) {
    test(`${who} is refused and nothing is written`, async () => {
      const { result, saved, refreshed } = await flip(caller, { isOpen: false });
      assert.deepEqual(result, { status: "refused" });
      assert.deepEqual(saved, []);
      assert.equal(refreshed, 0);
    });
  }
});
