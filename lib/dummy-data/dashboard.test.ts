import assert from "node:assert/strict";
import { test } from "node:test";
import { DashboardRefused } from "@/lib/dashboard/data";
import { newCount } from "@/lib/dashboard/recruitment";
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
    assert.equal(counts.applications, newCount(page.applications));
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

  const fresh = (await lead.data.applications()).applications.find((a) => a.state.stage === "new")!;
  const before = (await lead.data.navCounts()).applications ?? 0;
  assert.deepEqual(await lead.data.moveApplication(fresh.id, { kind: "open" }), { ok: true, value: null });
  const after = session("operations-lead", lead.saved()).data;
  assert.equal((await after.navCounts()).applications, before - 1);
  const opened = (await after.applications()).applications.find((a) => a.id === fresh.id)!;
  assert.equal(opened.state.stage, "in-review");
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

test("an illegal move is refused and saves nothing", async () => {
  const lead = session("division-lead");
  const fresh = (await lead.data.applications()).applications.find((a) => a.state.stage === "new")!;
  const result = await lead.data.moveApplication(fresh.id, { kind: "confirm-join" });
  assert.equal(result.ok, false);
  assert.deepEqual(lead.saved(), EMPTY_DUMMY_STATE);
});

test("a lead moves only applications to their own division's roles", async () => {
  const theirs = (await session("operations-lead").data.applications()).applications.find(
    (a) => a.position.division !== "Mission Analysis Division",
  )!;
  const lead = session("division-lead");
  await assert.rejects(lead.data.moveApplication(theirs.id, { kind: "reject" }), DashboardRefused);
  assert.deepEqual(lead.saved(), EMPTY_DUMMY_STATE);
});

test("a new position is made in the lead's division, coded from it, closed unless opened, and listed next read", async () => {
  const lead = session("division-lead");
  const page = await lead.data.positions();
  assert.deepEqual(page.newPosition.divisions.map((d) => d.name), ["Mission Analysis Division"]);
  const input = {
    divisionId: page.newPosition.divisions[0].id,
    title: "Trajectory Analyst II",
    description: "You plan and check rocket trajectories.",
    required: ["Python or MATLAB"],
    desirable: [],
    questions: ["Tell us about a simulation you built."],
    motivationLetter: true,
  };
  const result = await lead.data.createPosition(input);
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.value.code, `AER-MSA-${String(page.newPosition.nextId).padStart(3, "0")}`);
  const listed = (await session("division-lead", lead.saved()).data.positions()).positions.find((p) => p.title === "Trajectory Analyst II");
  assert.equal(listed?.open, false);
});

test("a new position in a division the lead does not lead is refused", async () => {
  const lead = session("division-lead");
  await assert.rejects(
    lead.data.createPosition({ divisionId: 13, title: "Safety Officer II", description: "Safety.", required: ["Care"] }),
    DashboardRefused,
  );
  assert.deepEqual(lead.saved(), EMPTY_DUMMY_STATE);
  const ops = await session("operations-lead").data.positions();
  assert.ok(ops.newPosition.divisions.length > 1);
});

test("Accept leaves the person's other applications at their stages", async () => {
  const ops = session("operations-lead");
  const all = (await ops.data.applications()).applications;
  const giulia = all.find((a) => a.applicant.name === "Giulia Rossi" && a.position.division === "Mission Analysis Division")!;
  const othersBefore = all.filter((a) => a.applicant.email === giulia.applicant.email && a.id !== giulia.id);
  assert.ok(othersBefore.length > 0);
  assert.deepEqual(await ops.data.moveApplication(giulia.id, { kind: "accept" }), { ok: true, value: null });

  const next = (await session("operations-lead", ops.saved()).data.applications()).applications;
  assert.equal(next.find((a) => a.id === giulia.id)?.state.stage, "accepted");
  for (const other of othersBefore) assert.deepEqual(next.find((a) => a.id === other.id)?.state, other.state);
  assert.deepEqual(
    next.find((a) => a.id === giulia.id)?.otherApplications.map((o) => o.stage),
    giulia.otherApplications.map((o) => o.stage),
  );
});

test("opening an application already at interview writes nothing and keeps its times and booking", async () => {
  const lead = session("division-lead");
  const booked = (await lead.data.applications()).applications.find((a) => a.state.stage === "interview" && a.state.booked !== null)!;
  assert.deepEqual(await lead.data.moveApplication(booked.id, { kind: "open" }), { ok: true, value: null });
  assert.deepEqual(lead.saved(), EMPTY_DUMMY_STATE);
});

test("a division lead's overview is scoped to their division and lists their interviews (board 56)", async () => {
  const overview = await session("division-lead").data.overview();
  assert.equal(overview.shape, "division");
  if (overview.shape !== "division") return;
  assert.deepEqual(
    overview.stats.map((s) => s.label),
    ["New applications", "Open positions", "Orders", "My division"],
  );
  assert.equal(overview.stats[2].value, "2 waiting");
  assert.deepEqual(
    overview.interviews.map((i) => i.state),
    ["booked", "booked", "waiting"],
  );
});
