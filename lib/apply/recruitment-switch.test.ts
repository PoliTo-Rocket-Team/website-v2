import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { viewerStandingOf, type ActiveRoleRef, type ScopeRef, type ViewerStanding } from "@/lib/dashboard/viewer";
import type { Recruitment } from "./positions";
import { canSwitchRecruitment, switchRecruitment } from "./recruitment-switch";

/** A real account's standing, read from its active roles and scope rows the way the database reads it. */
const standing = (activeRoles: ActiveRoleRef[], scopes: ScopeRef[] = []): ViewerStanding => viewerStandingOf({ scopes, activeRoles });

const CORE: ActiveRoleRef = { type: "core", divisionId: 5, fullAccess: null };
const flagged = (fullAccess: ActiveRoleRef["fullAccess"]): ActiveRoleRef => ({ type: "core", divisionId: null, fullAccess });

/** Runs the switch for a caller with this standing, recording what was saved and refreshed. */
async function flip(viewer: ViewerStanding, to: Recruitment) {
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
// and an org or admin row, with no positions grant.
describe("switchRecruitment", () => {
  const allowed: [string, ViewerStanding][] = [
    ["the team leader, from their seat with no scope row", standing([{ type: "president", divisionId: null, fullAccess: null }])],
    ["the operations lead, from their seat with no scope row", standing([flagged("operations-lead")])],
    ["the IT lead, from their seat with no scope row", standing([flagged("it-lead")])],
    ["the Project Manager, from their seat with no scope row", standing([flagged("project-manager")])],
    ["the Chief Engineer, from their seat with no scope row", standing([flagged("chief-engineer")])],
    ["a member with an org row", standing([CORE], [{ scope: "org", target: "all", level: "edit" }])],
    ["a member with an admin row", standing([CORE], [{ scope: "admin", target: "all", level: "edit" }])],
    ["a member with an org row at Can view", standing([CORE], [{ scope: "org", target: "positions", level: "view" }])],
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

  const refused: [string, ViewerStanding][] = [
    ["a department head", standing([{ type: "head", divisionId: null, fullAccess: null }])],
    ["a division lead", standing([{ type: "lead", divisionId: 5, fullAccess: null }])],
    ["a member with no grant", standing([CORE])],
    ["a member with a positions grant across their department", standing([CORE], [{ scope: "department", target: "positions", level: "edit" }])],
    ["a member with a grant on every area in their division", standing([CORE], [{ scope: "division", target: "all", level: "edit" }])],
    ["an alumnus with an org row left over", viewerStandingOf({ scopes: [{ scope: "org", target: "all", level: "edit" }], activeRoles: [], onAlumniRecord: true })],
    ["no one signed in", viewerStandingOf(null)],
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
