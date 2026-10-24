import assert from "node:assert/strict";
import { test } from "node:test";
import { DashboardRefused } from "@/lib/dashboard/data";
import { roleCovers } from "@/lib/dashboard/division-access";
import { newCount } from "@/lib/dashboard/recruitment";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentCookieValue, dummyRecruitmentOf, type DummyRecruitmentStore } from "./recruitment";
import { EMPTY_DUMMY_STATE, type DummyState } from "./state";

// The Positions and Applications pages on a preview (issue #142): what each
// viewer reaches, and a test developer's writes kept for the next read.

/**
 * The dummy dashboard, with what a write saves kept for the next read: the
 * recruitment cookie (#121) and the changes cookie.
 */
function session(kind: TestViewer, state: DummyState = EMPTY_DUMMY_STATE, recruitmentCookie?: string) {
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

test("full access, a head and a lead may switch every role their Positions page lists, and read Applications (issue #487)", async () => {
  for (const kind of ["operations-lead", "department-head", "division-lead"] as const) {
    const page = await session(kind).data.positions();
    assert.ok(page.positions.length > 0, kind);
    assert.ok(page.positions.every((p) => p.canChange), kind);
    assert.equal(page.readsApplications, true, kind);
  }
});

test("full access, a head and a lead may move every application their Applications page lists (issue #577)", async () => {
  for (const kind of ["operations-lead", "department-head", "division-lead"] as const) {
    const page = await session(kind).data.applications();
    assert.ok(page.applications.length > 0, kind);
    assert.ok(page.applications.every((a) => a.canChange), kind);
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
      ["Optimization and Analysis Division", ["Marco Bianchi", "Paolo Conti"]],
    ],
  );
});

test("the lead of two divisions has one Access list over both, and gives access in each person's own division (#185)", async () => {
  const { data } = session("division-lead");
  const access = (await data.divisionAccess())!;
  assert.equal(access.unit.kind, "division");
  if (access.unit.kind !== "division") return;
  assert.deepEqual(access.unit.divisions.map((d) => d.division.name), ["Mission Analysis Division", "Optimization and Analysis Division"]);
  assert.ok(access.grants.some((g) => g.person.name === "Sara Fontana"), "a grant in Optimization and Analysis is listed too");
  // Sara Fontana is in Optimization and Analysis (2), Sara Conti in Mission Analysis (1).
  const given = await data.saveAccess({ personId: 32, areas: { positions: "edit" } });
  assert.ok(given.ok && given.value.every((g) => g.place.kind === "division" && g.place.division.id === 2));
  assert.equal((await data.saveAccess({ personId: 32, where: 1, areas: { positions: "edit" } })).ok, false);
  assert.equal((await data.saveAccess({ personId: 38, where: 3, areas: { positions: "view" } })).ok, false, "Design & Manufacturing is not theirs");
});

test("Access lists the other leads with their role's access, never the viewer (boards 60 and 65)", async () => {
  const lead = (await session("division-lead").data.divisionAccess())!;
  // The lead of two divisions sees the other leads of both (#185).
  assert.deepEqual(lead.roleAccess.map((r) => r.person.name), ["Pietro Ricci", "Paolo Conti"]);
  assert.ok(lead.grants.every((g) => g.place.kind === "division"));

  const head = (await session("department-head").data.divisionAccess())!;
  assert.equal(head.unit.kind, "department");
  // One role row per division a lead leads: Marco leads both of the department's (#185).
  assert.deepEqual(head.roleAccess.map((r) => r.person.name).sort(), ["Marco Bianchi", "Marco Bianchi", "Paolo Conti", "Pietro Ricci"]);
  assert.ok(head.grants.some((g) => g.place.kind === "department"), "a grant across the whole department");
  // A lead's grants may show beside their role row, but never an area their role already gives (issue #591).
  assert.ok(head.grants.every((g) => !roleCovers(g.person, g.place, g.target)));
});

test("the operations lead's Access and Orders cover the whole team (issue #238)", async () => {
  const { data } = session("operations-lead");
  const access = (await data.divisionAccess())!;
  assert.equal(access.unit.kind, "team");
  if (access.unit.kind === "team") assert.equal(access.unit.departments.length, 6);
  // Grants from both departments with any, Aerodynamics' division and department-wide ones alike.
  assert.ok(access.grants.some((g) => g.place.kind === "department"));
  assert.ok(access.roleAccess.some((r) => r.person.name === "Chiara Rinaldi" && r.place.kind === "department"));
  const orders = (await data.orders())!;
  assert.deepEqual(orders.scope.edits, [{ kind: "team" }]);
  assert.equal(orders.scope.decides, null, "full access alone does not decide orders");
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
  assert.equal(after.people.filter((r) => r.name === joining.name).length, 1);
  assert.equal(after.people.find((r) => r.name === joining.name)?.title, "Mission Analyst");
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
  assert.equal(after.people.filter((r) => r.name === joining.name).length, 1);
});

test("an accepted member joins a new division with no NDA wait, keeps their other divisions, and no NDA is recorded (board 58h2)", async () => {
  const start = leadOver(EMPTY_DUMMY_STATE);
  const matteo = (await start.data.applications()).applications.find((a) => a.applicant.email === "m.greco@politorocketteam.it")!;
  assert.equal(matteo.state.stage, "accepted");
  assert.equal(matteo.standing.kind, "member");

  // There is no second NDA to tick, so nothing is saved.
  assert.equal((await start.data.moveApplication(matteo.id, { kind: "set-nda", arrived: true })).ok, false);
  assert.deepEqual(start.saved(), EMPTY_DUMMY_STATE);

  // Add to Mission Analysis lands at once.
  assert.ok((await start.data.moveApplication(matteo.id, { kind: "confirm-join" })).ok);
  const joined = leadOver(start.saved());
  const entry = (await joined.data.applications()).applications.find((a) => a.id === matteo.id);
  assert.equal(entry?.state.stage, "joined");

  // He is in Mission Analysis now, and still in both divisions he was in.
  const members = await joined.data.members();
  assert.ok(members.scope === "division" && members.people.some((r) => r.name === "Matteo Greco" && r.role === "member"));
  const tree = await joined.data.teamTree();
  // Listed under every division he is in, and first at one of them.
  const listedIn = tree.departments
    .flatMap((d) => d.divisions)
    .filter((v) => [v.lead, ...v.members].some((p) => p?.name === "Matteo Greco"));
  assert.equal(listedIn.length, 3);
  assert.ok(listedIn.some((v) => v.name.startsWith("Mission Analysis")));
  const places = listedIn.flatMap((v) => [v.lead, ...v.members]).filter((p) => p?.name === "Matteo Greco");
  assert.equal(places.filter((p) => p?.first).length, 1);
});

test("the whole team's dummy page lists every division's waiting rows and joining banners, Confirm join offered by the Applications rule (#584)", async () => {
  const { data } = session("operations-lead");
  const directory = await data.members();
  assert.equal(directory.scope, "whole-team");
  if (directory.scope !== "whole-team") return;
  const waiting = directory.queues.flatMap((q) => q.waiting.map((w) => [w.email, q.divisionId, q.editable]));
  assert.deepEqual(waiting, [["elena.marino@studenti.polito.it", 1, true]]);
  const joining = directory.queues.flatMap((q) => q.joining);
  assert.ok(joining.length > 0, "someone is joining");
  assert.ok(joining.every((j) => j.canConfirm), "full access changes Applications everywhere");
});

/** The whole team's joining banners, as the team leader's Members page lists them. */
async function leaderJoining(state: DummyState) {
  const directory = await session("team-leader", state).data.members();
  assert.equal(directory.scope, "whole-team");
  return directory.scope === "whole-team" ? directory.queues.flatMap((q) => q.joining) : [];
}

test("Mark NDA received on the team leader's Members banner is the Applications tick: it readies Confirm join, and a viewer who may not change the application is refused (#601)", async () => {
  const waiting = (await leaderJoining(EMPTY_DUMMY_STATE)).find((j) => !j.ndaArrived);
  assert.ok(waiting, "a joining banner waits for the signed NDA");
  assert.equal(waiting.canConfirm, true, "the team leader may change every application");

  // A viewer who may not change the application is refused the move, and nothing is saved.
  const outsider = session("member");
  await assert.rejects(outsider.data.moveApplication(waiting.applicationId, { kind: "set-nda", arrived: true }), DashboardRefused);
  assert.deepEqual(outsider.saved(), EMPTY_DUMMY_STATE);

  // Before the mark, Confirm join is refused.
  const leader = session("team-leader");
  assert.equal(await leader.data.teamWrites!.confirmJoin(waiting.applicationId), false);

  // The banner's mark sends `set-nda`, and the banner then reads the NDA arrived.
  assert.ok((await leader.data.moveApplication(waiting.applicationId, { kind: "set-nda", arrived: true })).ok);
  const marked = (await leaderJoining(leader.saved())).find((j) => j.applicationId === waiting.applicationId);
  assert.equal(marked?.ndaArrived, true);

  // Confirm join now goes through.
  assert.equal(await session("team-leader", leader.saved()).data.teamWrites!.confirmJoin(waiting.applicationId), true);
});
