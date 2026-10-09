import assert from "node:assert/strict";
import { test } from "node:test";
import { DashboardRefused } from "@/lib/dashboard/data";
import { stageCounts } from "@/lib/dashboard/recruitment";
import type { ViewerKind } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentCookieValue, dummyRecruitmentOf, type DummyRecruitmentStore } from "./recruitment";
import { EMPTY_DUMMY_STATE, type DummyState } from "./state";

// The Positions and Applications pages on a preview (issue #142): what each
// viewer reaches, and a test developer's writes kept for the next read.

/**
 * The dummy dashboard, with what a write saves kept for the next read: the
 * recruitment cookie (#121) and the changes cookie.
 */
function session(kind: ViewerKind, state: DummyState = EMPTY_DUMMY_STATE, recruitmentCookie?: string) {
  let saved = state;
  let savedRecruitment = recruitmentCookie;
  const recruitment: DummyRecruitmentStore = {
    current: dummyRecruitmentOf(recruitmentCookie),
    save: async (r) => void (savedRecruitment = dummyRecruitmentCookieValue(r)),
  };
  const data = dummyDashboardData(kind, recruitment, {
    current: state,
    save: async (next) => void (saved = next),
  });
  return { data, saved: () => saved, savedRecruitment: () => savedRecruitment };
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
  await lead.data.setRecruitment({ isOpen: false });
  const next = session("operations-lead", lead.saved(), lead.savedRecruitment()).data;
  assert.equal((await next.recruitment()).recruitment.isOpen, false);
  const overview = await next.overview();
  assert.equal(overview.shape, "team");
  if (overview.shape === "team") assert.equal(overview.stats.find((s) => s.label === "Recruitment")?.value, "Closed");

  const first = (await lead.data.applications()).applications[0];
  const before = (await lead.data.navCounts()).applications ?? 0;
  await lead.data.setApplicationStage(first.id, "in-review");
  const after = session("operations-lead", lead.saved()).data;
  assert.equal((await after.navCounts()).applications, before - 1);
});

test("only the operations lead flips recruitment, and a lead changes only their own division", async () => {
  const division = session("division-lead");
  assert.deepEqual(await division.data.setRecruitment({ isOpen: false }), { status: "refused" });
  const elsewhere = (await session("operations-lead").data.positions()).positions.find(
    (p) => p.division !== "Mission Analysis Division",
  )!;
  await assert.rejects(division.data.setPositionOpen(elsewhere.id, false), DashboardRefused);
  assert.deepEqual(division.saved(), EMPTY_DUMMY_STATE);
  assert.equal(division.savedRecruitment(), undefined);
});
