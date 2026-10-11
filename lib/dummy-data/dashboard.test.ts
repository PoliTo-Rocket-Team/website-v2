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

test("a department head sees every division of their department, and New position offers only those (boards 63, 63b, 64)", async () => {
  const { data } = session("department-head");
  const aerodynamics = ["Mission Analysis Division", "Optimization and Analysis Division"];
  const positions = await data.positions();
  assert.equal(positions.scope, "department");
  if (positions.scope !== "department") return;
  assert.deepEqual(positions.department.divisions.map((d) => d.name), aerodynamics);
  assert.ok(positions.positions.length > 0);
  assert.deepEqual([...new Set(positions.positions.map((p) => p.division))].sort(), aerodynamics);
  assert.deepEqual(positions.newPosition.divisions.map((d) => d.name), aerodynamics);

  const applications = await data.applications();
  assert.equal(applications.scope.kind, "department");
  const refs = new Set(positions.positions.map((p) => p.ref));
  assert.ok(applications.applications.length > 0);
  assert.ok(applications.applications.every((a) => refs.has(a.position.ref)));
  const [counts] = await Promise.all([data.navCounts()]);
  assert.equal(counts.applications, newCount(applications.applications));

  // A role in another department is refused.
  await assert.rejects(data.createPosition({ divisionId: 4, title: "x", description: "x", required: ["x"] }), DashboardRefused);
});

test("a department head's Overview has a row per division of their department (board 62)", async () => {
  const overview = await session("department-head").data.overview();
  assert.equal(overview.shape, "department");
  if (overview.shape !== "department") return;
  assert.deepEqual(
    overview.divisions.map((d) => [d.name, d.leads]),
    [
      ["Mission Analysis Division", ["Marco Bianchi", "Pietro Ricci"]],
      ["Optimization and Analysis Division", ["Paolo Conti"]],
    ],
  );
});

test("Access lists the other leads with their role's access, never the viewer (boards 60 and 65)", async () => {
  const lead = (await session("division-lead").data.divisionAccess())!;
  assert.deepEqual(lead.roleAccess.map((r) => r.person.name), ["Pietro Ricci"]);
  assert.ok(lead.grants.every((g) => g.place.kind === "division"));

  const head = (await session("department-head").data.divisionAccess())!;
  assert.equal(head.unit.kind, "department");
  assert.deepEqual(head.roleAccess.map((r) => r.person.name).sort(), ["Marco Bianchi", "Paolo Conti", "Pietro Ricci"]);
  assert.ok(head.grants.some((g) => g.place.kind === "department"), "a grant across the whole department");
  assert.ok(head.grants.every((g) => g.person.standing === "member"));
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

test("Edit position opens on the role's saved text, and a save shows on the next read (issue #207)", async () => {
  const lead = session("division-lead");
  const before = (await lead.data.positions()).positions.find((p) => p.title === "Mission Analyst")!;
  assert.equal(before.code, "AER-MSA-001");
  assert.ok(before.content.description.length > 0);
  assert.ok(before.content.required.length > 0);

  const edit = { ...before.content, title: "Mission Analyst Lead", required: ["MATLAB"], motivationLetter: false };
  assert.deepEqual(await lead.data.editPosition(before.id, edit), { ok: true, value: null });
  const after = (await session("division-lead", lead.saved()).data.positions()).positions.find((p) => p.id === before.id)!;
  assert.equal(after.title, "Mission Analyst Lead");
  assert.deepEqual(after.content, { ...edit, required: ["MATLAB"] });
  assert.equal(after.open, before.open);

  const refusedEdit = await lead.data.editPosition(before.id, { ...edit, description: " " });
  assert.equal(refusedEdit.ok, false);
});

test("a lead cannot edit a role outside their division", async () => {
  const elsewhere = (await session("operations-lead").data.positions()).positions.find(
    (p) => p.division !== "Mission Analysis Division",
  )!;
  const lead = session("division-lead");
  await assert.rejects(lead.data.editPosition(elsewhere.id, elsewhere.content), DashboardRefused);
  assert.deepEqual(lead.saved(), EMPTY_DUMMY_STATE);
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

/** The lead's dummy dashboard over the given applications state, keeping what a write saves. */
function leadOver(state: DummyState) {
  let saved = state;
  const recruitment: DummyRecruitmentStore = { current: dummyRecruitmentOf(undefined), save: async () => {} };
  const data = dummyDashboardData("division-lead", recruitment, { current: state, save: async (next) => void (saved = next) });
  return { data, saved: () => saved };
}

test("Confirm join is one rule on both pages: it waits for the NDA tick, the application ends Joined, and they join once", async () => {
  const start = leadOver(EMPTY_DUMMY_STATE);
  const directory = await start.data.members();
  assert.equal(directory.scope, "division");
  if (directory.scope !== "division") return;
  const [joining] = directory.joining;
  assert.equal(joining.position, "Mission Analyst");
  assert.equal(joining.ndaArrived, false);

  // Members page (board 59): refused until the NDA is ticked, and nothing is saved.
  assert.equal(await start.data.teamWrites!.confirmJoin(joining.applicationId), false);
  assert.deepEqual(start.saved(), EMPTY_DUMMY_STATE);

  // The tick on Applications (58g) readies the Members page's Confirm join.
  assert.ok((await start.data.moveApplication(joining.applicationId, { kind: "set-nda", arrived: true })).ok);
  const ticked = leadOver(start.saved());
  const waiting = await ticked.data.members();
  if (waiting.scope !== "division") return;
  assert.equal(waiting.joining.find((j) => j.applicationId === joining.applicationId)?.ndaArrived, true);
  assert.equal(await ticked.data.teamWrites!.confirmJoin(joining.applicationId), true);

  // The application reads Joined, the person is on the division once, and no second join lands from either page.
  const joined = leadOver(ticked.saved());
  const entry = (await joined.data.applications()).applications.find((a) => a.id === joining.applicationId);
  assert.equal(entry?.state.stage, "joined");
  const after = await joined.data.members();
  if (after.scope !== "division") return;
  assert.ok(!after.joining.some((j) => j.applicationId === joining.applicationId));
  assert.equal(after.rows.filter((r) => r.name === joining.name).length, 1);
  assert.equal(after.rows.find((r) => r.name === joining.name)?.pageTitle, "Mission Analyst");
  assert.equal(await joined.data.teamWrites!.confirmJoin(joining.applicationId), false);
  assert.equal((await joined.data.moveApplication(joining.applicationId, { kind: "confirm-join" })).ok, false);
});

test("Confirm join on Applications puts the person on the Members page too", async () => {
  const start = leadOver(EMPTY_DUMMY_STATE);
  const directory = await start.data.members();
  if (directory.scope !== "division") return;
  const [joining] = directory.joining;
  await start.data.moveApplication(joining.applicationId, { kind: "set-nda", arrived: true });
  const ticked = leadOver(start.saved());
  assert.ok((await ticked.data.moveApplication(joining.applicationId, { kind: "confirm-join" })).ok);
  const after = await leadOver(ticked.saved()).data.members();
  if (after.scope !== "division") return;
  assert.ok(!after.joining.some((j) => j.applicationId === joining.applicationId));
  assert.equal(after.rows.filter((r) => r.name === joining.name).length, 1);
});
