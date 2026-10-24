import assert from "node:assert/strict";
import { test } from "node:test";
import type { TeamSideOverview } from "@/lib/dashboard/overview";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { NO_EDITS } from "./edits";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { personFor } from "./team";

// What waits for a decision on the dummy Overview (issue #592), as on the
// database side: whoever decides orders, whatever their Overview's shape,
// gets the team leader's two decision rows over the whole team; nobody else
// gets either. A member holding Approve orders also gets one "Your access"
// line for it.

type OnTeam = Exclude<TestViewer, "non-member" | "alumni">;

function overviewOf(view: OnTeam, holdsApproveOrders: boolean): Promise<TeamSideOverview> {
  const edits = holdsApproveOrders ? { ...NO_EDITS, approveOrders: { [personFor[view].id]: { holds: true as const, givenOn: "2026-10-20" } } } : NO_EDITS;
  const data = dummyDashboardData(
    view,
    { current: dummyRecruitmentOf(undefined), save: async () => {} },
    { current: EMPTY_DUMMY_STATE, save: async () => {} },
    { current: edits, save: async () => {} },
  );
  return data.overview() as Promise<TeamSideOverview>;
}

const decisionRows = (overview: TeamSideOverview) =>
  overview.attention.filter((a) => a.kind === "orders-to-decide" || a.kind === "approved-orders").map((a) => a.title);

test("every Approve orders holder gets the team leader's two decision rows, counted across the team; without it, none", async () => {
  const leader = decisionRows(await overviewOf("team-leader", false));
  assert.equal(leader.length, 2, `the team leader's rows: ${leader.join(" | ")}`);
  for (const view of ["operations-lead", "department-head", "division-lead", "member"] as const) {
    assert.deepEqual(decisionRows(await overviewOf(view, true)), leader, `${view} with Approve orders`);
    assert.deepEqual(decisionRows(await overviewOf(view, false)), [], `${view} without it`);
  }
});

test("a member holding Approve orders gets one Approve orders line under Your access, in place of the access hint", async () => {
  const holder = await overviewOf("member", true);
  const waiting = Number(/^(\d+) order/.exec(decisionRows(holder)[0])?.[1]);
  assert.deepEqual(holder.access, { kind: "lines", lines: [{ area: "approve-orders", href: "/dashboard/orders", waiting }] });
  assert.deepEqual((await overviewOf("member", false)).access, { kind: "hint" });
});

test("a lead or a head holding Approve orders gets the same line; the team leader decides by their seat, which is no grant", async () => {
  for (const view of ["department-head", "division-lead"] as const) {
    const { access } = await overviewOf(view, true);
    assert.deepEqual(access.kind === "lines" ? access.lines.map((l) => l.area) : access.kind, ["approve-orders"], view);
  }
  assert.deepEqual((await overviewOf("team-leader", false)).access, { kind: "none" });
});
