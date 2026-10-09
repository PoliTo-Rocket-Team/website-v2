import assert from "node:assert/strict";
import { test } from "node:test";
import { DashboardRefused } from "@/lib/dashboard/data";
import { stageCounts } from "@/lib/dashboard/recruitment";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { EMPTY_DUMMY_STATE, type DummyState } from "./state";

/** The dummy dashboard, with the state a write saves kept for the next read. */
function session(kind: ViewerKind, state: DummyState = EMPTY_DUMMY_STATE) {
  let saved = state;
  const data = dummyDashboardData(kind, state, async (next) => {
    saved = next;
  });
  return { data, saved: () => saved };
}

test("the sidebar's new count is the Applications page's New tab", async () => {
  for (const kind of ["operations-lead", "division-lead"] as const) {
    const { data } = session(kind);
    const [counts, page] = await Promise.all([data.navCounts(), data.applications()]);
    assert.equal(counts.applications, stageCounts(page.applications).new);
  }
});

test("a division lead sees only their division's positions and applications (board 41c)", async () => {
  const { data } = session("division-lead");
  const positions = await data.positions();
  assert.equal(positions.scope, "division");
  assert.ok(positions.positions.length > 0);
  assert.ok(positions.positions.every((p) => p.division === "Mission Analysis Division"));
  const refs = new Set(positions.positions.map((p) => p.ref));
  assert.ok((await data.applications()).applications.every((a) => refs.has(a.position.ref)));
});

test("members and applicants reach neither page", async () => {
  for (const kind of ["member", "non-member"] as const) {
    const { data } = session(kind);
    await assert.rejects(data.positions(), DashboardRefused);
    await assert.rejects(data.applications(), DashboardRefused);
  }
});

test("a test developer's write changes only the saved state, and the next read shows it", async () => {
  const lead = session("operations-lead");
  await lead.data.setRecruitmentOpen(false);
  const page = await session("operations-lead", lead.saved()).data.positions();
  assert.equal(page.recruitment.open, false);

  const first = (await lead.data.applications()).applications[0];
  const before = (await lead.data.navCounts()).applications ?? 0;
  await lead.data.setApplicationStage(first.id, "in-review");
  const after = session("operations-lead", lead.saved()).data;
  assert.equal((await after.navCounts()).applications, before - 1);
});

test("only the operations lead flips recruitment, and a lead changes only their own division", async () => {
  const division = session("division-lead");
  await assert.rejects(division.data.setRecruitmentOpen(false), DashboardRefused);
  const elsewhere = (await session("operations-lead").data.positions()).positions.find(
    (p) => p.division !== "Mission Analysis Division",
  )!;
  await assert.rejects(division.data.setPositionOpen(elsewhere.id, false), DashboardRefused);
  assert.deepEqual(division.saved(), EMPTY_DUMMY_STATE);
});
