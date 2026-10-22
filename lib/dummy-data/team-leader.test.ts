import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";

// The team leader's test developer (issue #252): their own Overview (board
// 72), while the operations lead keeps board 40. Both open Members on the
// whole team (board 73, issue #418).

function dashboard(view: TestViewer) {
  return dummyDashboardData(view, { current: dummyRecruitmentOf(undefined), save: async () => {} }, { current: EMPTY_DUMMY_STATE, save: async () => {} });
}

test("the team leader signs in as the team leader, in the team leader's seat", () => {
  const { viewer } = dashboard("team-leader");
  assert.equal(viewer.name, "Alessandro Greco");
  assert.deepEqual([viewer.kind, viewer.kind === "operations-lead" ? viewer.seat : null], ["operations-lead", "team-leader"]);
});

test("the team leader's Overview is board 72 and the operations lead's board 40; both list the same whole team on Members (board 73)", async () => {
  const leader = dashboard("team-leader");
  const ops = dashboard("operations-lead");
  const [leaderOverview, leaderMembers, opsOverview, opsMembers] = await Promise.all([
    leader.overview(),
    leader.members(),
    ops.overview(),
    ops.members(),
  ]);
  assert.equal(opsOverview.shape, "team");
  assert.equal(opsMembers.scope, "whole-team");
  assert.equal(leaderOverview.shape, "leader");
  assert.equal(leaderMembers.scope, "whole-team");
  if (leaderOverview.shape !== "leader" || leaderMembers.scope !== "whole-team") return;
  // The Overview's team figure and the Members page count the same people.
  assert.equal(leaderOverview.people, leaderMembers.people.length);
  assert.deepEqual(
    leaderOverview.attention.map((item) => item.kind).filter((kind) => kind !== "notice"),
    // The two open alias requests the dummy team seeds come first (board 94c, epic #538).
    ["alias-request", "alias-request", "orders-to-decide", "approved-orders"],
  );
  // No figure on the Overview names a price.
  assert.ok(leaderOverview.stats.every((stat) => !stat.value.includes("€") && !stat.detail.includes("€")));
  assert.ok(leaderOverview.attention.every((item) => !item.detail.includes("€")));
});
