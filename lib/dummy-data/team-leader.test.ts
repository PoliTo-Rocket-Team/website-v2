import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";

// The team leader's test developer (issue #252): their own Overview and
// Members (boards 72 and 73), while the operations lead keeps boards 40 and 46.

function dashboard(view: TestViewer) {
  return dummyDashboardData(view, { current: dummyRecruitmentOf(undefined), save: async () => {} }, { current: EMPTY_DUMMY_STATE, save: async () => {} });
}

test("the team leader signs in as the team leader, in the team leader's seat", () => {
  const { viewer } = dashboard("team-leader");
  assert.equal(viewer.name, "Alessandro Greco");
  assert.deepEqual([viewer.kind, viewer.kind === "operations-lead" ? viewer.seat : null], ["operations-lead", "team-leader"]);
});

test("the team leader's Overview and Members are boards 72 and 73; the operations lead keeps boards 40 and 46", async () => {
  const leader = dashboard("team-leader");
  const ops = dashboard("operations-lead");
  const [leaderOverview, leaderMembers, opsOverview, opsMembers] = await Promise.all([
    leader.overview(),
    leader.members(),
    ops.overview(),
    ops.members(),
  ]);
  assert.equal(opsOverview.shape, "team");
  assert.equal(opsMembers.scope, "team");
  assert.equal(leaderOverview.shape, "leader");
  assert.equal(leaderMembers.scope, "whole-team");
  if (leaderOverview.shape !== "leader" || leaderMembers.scope !== "whole-team") return;
  // The Overview's team figure and the Members page count the same people.
  assert.equal(leaderOverview.people, leaderMembers.people.length);
  assert.deepEqual(
    leaderOverview.attention.map((item) => item.kind).filter((kind) => kind !== "notice"),
    ["orders-to-decide", "approved-orders", "closing-position"],
  );
  // No figure on the Overview names a price.
  assert.ok(leaderOverview.stats.every((stat) => !stat.value.includes("€") && !stat.detail.includes("€")));
  assert.ok(leaderOverview.attention.every((item) => !item.detail.includes("€")));
});
