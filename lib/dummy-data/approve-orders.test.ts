import assert from "node:assert/strict";
import { test } from "node:test";
import { canReach } from "@/lib/dashboard/access";
import { orderActions } from "@/lib/dashboard/orders";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits, type TeamEditsStore } from "./edits";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { personFor } from "./team";

// "Approve orders" on a preview (issue #270): the team leader test viewer
// gives it on the Access page, the test developer switches to the member it
// went to, and the member reaches Orders and decides there.

/** One test developer's team edits, kept through the cookie between viewer switches. */
function editsCookie(): TeamEditsStore {
  let cookie = serializeEdits(NO_EDITS);
  return {
    get current(): TeamEdits {
      return parseEdits(cookie);
    },
    save: async (next) => void (cookie = serializeEdits(next)),
  };
}

function viewAs(viewer: TestViewer, edits: TeamEditsStore) {
  return dummyDashboardData(viewer, { current: dummyRecruitmentOf(undefined), save: async () => {} }, { current: EMPTY_DUMMY_STATE, save: async () => {} }, edits);
}

const member = personFor.member.id;

test("Approve orders given as the team leader is kept when the test developer switches to that member", async () => {
  const edits = editsCookie();
  assert.equal(viewAs("member", edits).viewer.approveOrders, false);
  assert.equal(await viewAs("member", edits).orders(), null);

  // What the Access page's Give access drawer sends (board 71b).
  const given = await viewAs("team-leader", edits).saveAccess({ personId: member, where: "team", areas: {}, approveOrders: true });
  assert.equal(given.ok, true);

  const switched = viewAs("member", edits);
  assert.equal(switched.viewer.approveOrders, true);
  assert.equal(canReach(switched.viewer, "orders"), true);
  const page = await switched.orders();
  assert.ok(page);
  assert.deepEqual(page.scope, { edits: [], decides: "approve-orders" });
  const waiting = page.orders.find((o) => o.status === "waiting")!;
  const actions = orderActions(page.scope, waiting);
  assert.equal(actions.decide, true);
  assert.equal(actions.edit, null);
  assert.equal(actions.cancel, false);
  assert.equal((await switched.decideOrder(waiting.id, { kind: "approve" })).ok, true);

  // Back on the team leader's Access page, the member is listed as a holder.
  const access = await viewAs("team-leader", edits).divisionAccess();
  assert.ok(access?.approveOrders.holders.some((h) => h.person.id === member));
});

test("Approve orders removed as the team leader is gone when the test developer switches back", async () => {
  const edits = editsCookie();
  await viewAs("team-leader", edits).setApproveOrders({ personId: member, holds: true });
  assert.equal(viewAs("member", edits).viewer.approveOrders, true);

  assert.equal((await viewAs("team-leader", edits).removeAllAccess(member)).ok, true);
  const switched = viewAs("member", edits);
  assert.equal(switched.viewer.approveOrders, false);
  assert.equal(canReach(switched.viewer, "orders"), false);
  assert.equal(await switched.orders(), null);
});
