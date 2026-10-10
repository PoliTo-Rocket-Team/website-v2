import assert from "node:assert/strict";
import { test } from "node:test";
import { dummyDivisionAccess } from "./division";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits } from "./edits";
import { personFor } from "./team";
import { dummyJoiners, dummyTeamPages, editedRoster } from "./team-pages";
import { applications } from "./applications";

/** The pages as `kind` sees them, keeping every saved edit in memory as the cookie would. */
function pages(kind: Parameters<typeof dummyTeamPages>[0], start: TeamEdits = NO_EDITS) {
  const saved: TeamEdits[] = [];
  const view = dummyTeamPages(kind, start, async (next) => {
    saved.push(next);
  });
  return { view, saved };
}

test("a division lead lists and changes only their own division, never themselves", async () => {
  const { view, saved } = pages("division-lead");
  const directory = await view.members();
  assert.equal(directory.scope, "division");
  assert.ok(directory.rows.length > 0);
  assert.ok(directory.rows.every((r) => r.division === "Mission Analysis Division"));
  const writes = view.teamWrites!;
  assert.equal(await writes.saveMember(7, { role: "member", pageTitle: "Mission Analyst" }), true);
  assert.equal(await writes.saveMember(2, { role: "member", pageTitle: null }), false); // themselves
  assert.equal(await writes.moveToAlumni(74, { from: 2024, to: 2026, reason: null }), false); // another division
  assert.equal(saved.length, 1);
});

test("the team leader and a head keep their place when the operations lead saves their title", async () => {
  const ops = pages("operations-lead");
  const writes = ops.view.teamWrites!;
  assert.equal(await writes.saveMember(14, { role: null, pageTitle: "Team Leader 2026" }), true);
  assert.equal(await writes.saveMember(15, { role: "member", pageTitle: null }), false); // a head's role is not the drawer's
  const after = pages("operations-lead", parseEdits(serializeEdits(ops.saved[0]))).view;
  const leader = (await after.members()).rows.find((r) => r.id === 14);
  assert.equal(leader?.role, "team-leader");
  assert.equal(leader?.pageTitle, "Team Leader 2026");
});

test("moving someone to alumni takes them off the tree and onto the Alumni page", async () => {
  const lead = pages("division-lead");
  assert.equal(await lead.view.teamWrites!.moveToAlumni(5, { from: 2025, to: 2026, reason: "graduated" }), true);
  const edits = parseEdits(serializeEdits(lead.saved[0]));

  const member = pages("member", edits).view;
  const tree = await member.teamTree();
  const names = tree.departments.flatMap((d) => d.divisions.flatMap((v) => v.members.map((m) => m.name)));
  assert.ok(!names.includes("Elif Kaya"));

  const ops = pages("operations-lead", edits).view;
  const alumni = await ops.alumni();
  assert.ok(alumni.rows.some((a) => a.name === "Elif Kaya" && a.from === 2025 && a.to === 2026 && a.shownOnSite === true));
});

test("moving someone to alumni ends their access and keeps them on record", async () => {
  const lead = pages("division-lead");
  const before = dummyDivisionAccess(personFor["division-lead"], editedRoster(NO_EDITS))!;
  assert.ok(before.grants.some((g) => g.person.name === "Luca Marino"));

  assert.equal(await lead.view.teamWrites!.moveToAlumni(4, { from: 2024, to: 2026, reason: null }), true);
  const edits = lead.saved[0];
  const after = dummyDivisionAccess(personFor["division-lead"], editedRoster(edits))!;
  assert.ok(!after.grants.some((g) => g.person.name === "Luca Marino"), "their access ends");
  assert.ok(!after.people.some((p) => p.name === "Luca Marino"), "no access can be given to them");
  const alumni = await pages("operations-lead", edits).view.alumni();
  assert.ok(alumni.rows.some((a) => a.name === "Luca Marino"), "they stay on record, on the Alumni page");
});

test("a lead promotes a member beside them, or hands the division over and becomes a member", async () => {
  const together = pages("division-lead");
  assert.equal(await together.view.teamWrites!.promote(7, "together"), true);
  const both = await pages("division-lead", together.saved[0]).view.members();
  assert.deepEqual(both.rows.filter((r) => r.role === "division-lead").map((r) => r.name).sort(), ["Marco Bianchi", "Sara Conti"]);

  const handOver = pages("division-lead");
  assert.equal(await handOver.view.teamWrites!.promote(7, "hand-over"), true);
  const after = await pages("division-lead", handOver.saved[0]).view.members();
  assert.deepEqual(after.rows.filter((r) => r.role === "division-lead").map((r) => r.name), ["Sara Conti"]);

  assert.equal(await pages("division-lead").view.teamWrites!.promote(74, "together"), false, "another division");
  assert.equal(await pages("operations-lead").view.teamWrites!.promote(7, "together"), false, "only a division lead promotes");
});

test("an application the lead accepts joins the waiting list", () => {
  const accepted = applications.find((a) => a.positionId === 4 && a.state.stage === "new")!;
  const current = applications.map((a) =>
    a.id === accepted.id ? { ...a, state: { stage: "accepted" as const, acceptedAt: "2026-10-09T10:00:00+02:00", ndaArrived: false } } : a,
  );
  assert.ok(dummyJoiners(current).some((j) => j.applicationId === accepted.id));
  assert.ok(!dummyJoiners(applications).some((j) => j.applicationId === accepted.id));
});

test("viewers who do not reach a page get no data from it", async () => {
  const member = pages("member").view;
  assert.deepEqual((await member.members()).rows, []);
  assert.deepEqual((await member.alumni()).rows, []);
  assert.equal(await member.teamWrites!.setShownOnSite(1006, true), false);
  const applicant = pages("non-member").view;
  assert.equal((await applicant.teamTree()).departments.length, 0);
});

test("the operations lead gets the whole Team tree (issue #183)", async () => {
  const ops = pages("operations-lead").view;
  assert.ok((await ops.teamTree()).departments.length > 0);
});

test("a malformed edits cookie reads as no edits", () => {
  assert.deepEqual(parseEdits("not json"), NO_EDITS);
  assert.deepEqual(parseEdits(JSON.stringify({ members: { 7: { role: "admin" } }, shownOnSite: { x: true } })), NO_EDITS);
});
