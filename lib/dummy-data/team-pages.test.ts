import assert from "node:assert/strict";
import { test } from "node:test";
import { dummyAccessPage } from "./division";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits } from "./edits";
import { dummyNoticeAttention, dummyNoticesOf } from "./notices";
import { divisions, people, personFor, positions } from "./team";
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
  const before = dummyAccessPage("division-lead", personFor["division-lead"], editedRoster(NO_EDITS))!;
  assert.ok(before.grants.some((g) => g.person.name === "Luca Marino"));

  assert.equal(await lead.view.teamWrites!.moveToAlumni(4, { from: 2024, to: 2026, reason: null }), true);
  const edits = lead.saved[0];
  const after = dummyAccessPage("division-lead", personFor["division-lead"], editedRoster(edits))!;
  assert.ok(!after.grants.some((g) => g.person.name === "Luca Marino"), "their access ends");
  assert.ok(!after.people.some((p) => p.name === "Luca Marino"), "no access can be given to them");
  const alumni = await pages("operations-lead", edits).view.alumni();
  assert.ok(alumni.rows.some((a) => a.name === "Luca Marino"), "they stay on record, on the Alumni page");
});

test("Move to alumni by a division lead reaches only their own division (issue #201)", async () => {
  const lead = pages("division-lead");
  const writes = lead.view.teamWrites!;
  assert.equal(await writes.moveToAlumni(8, { from: 2023, to: 2026, reason: null }), false, "Communications is not theirs");
  assert.equal(await writes.moveToAlumni(9, { from: 2023, to: 2026, reason: null }), false, "nor is another division's lead");
  assert.equal(lead.saved.length, 0);

  assert.equal(await writes.moveToAlumni(6, { from: 2025, to: 2026, reason: null }), true);
  const { rows } = await pages("operations-lead", lead.saved[0]).view.alumni();
  assert.ok(rows.some((a) => a.name === "Pietro Ricci" && a.from === 2025 && a.to === 2026), "their only role ended, so they left the team");
});

test("Move to alumni by the operations lead ends the whole membership, in any division (issue #201)", async () => {
  const ops = pages("operations-lead");
  assert.equal(await ops.view.teamWrites!.moveToAlumni(8, { from: 2023, to: 2026, reason: "graduated" }), true);
  const edits = ops.saved[0];
  assert.ok(!(await pages("operations-lead", edits).view.members()).rows.some((r) => r.name === "Andrea Ferri"));
  assert.ok((await pages("operations-lead", edits).view.alumni()).rows.some((a) => a.name === "Andrea Ferri"));
  assert.equal(await ops.view.teamWrites!.moveToAlumni(1, { from: 2022, to: 2026, reason: null }), false, "never themselves");
});

test("a lead promotes a member beside them, or hands the division over and becomes a member", async () => {
  const together = pages("division-lead");
  assert.equal(await together.view.teamWrites!.promote(7, "together"), true);
  const both = await pages("division-lead", together.saved[0]).view.members();
  // Pietro Ricci already leads Mission Analysis beside Marco (issue #230).
  assert.deepEqual(both.rows.filter((r) => r.role === "division-lead").map((r) => r.name).sort(), [
    "Marco Bianchi",
    "Pietro Ricci",
    "Sara Conti",
  ]);

  const handOver = pages("division-lead");
  assert.equal(await handOver.view.teamWrites!.promote(7, "hand-over"), true);
  const after = await pages("division-lead", handOver.saved[0]).view.members();
  assert.deepEqual(after.rows.filter((r) => r.role === "division-lead").map((r) => r.name).sort(), ["Pietro Ricci", "Sara Conti"]);

  assert.equal(await pages("division-lead").view.teamWrites!.promote(74, "together"), false, "another division");
  assert.equal(await pages("operations-lead").view.teamWrites!.promote(7, "together"), false, "only a division lead promotes");
});

test("a promotion tells the dummy head of the division's department, until they dismiss it (#188)", async () => {
  const head = people.find((p) => p.name === "Chiara Rinaldi")!; // head of Aerodynamics, Mission Analysis's department
  const lead = personFor["division-lead"];
  const now = new Date("2026-10-10T12:00:00Z");
  const promoted = pages("division-lead");
  assert.equal(await promoted.view.teamWrites!.promote(7, "hand-over"), true);
  const edits = parseEdits(serializeEdits(promoted.saved[0]));

  const [notice, ...rest] = dummyNoticeAttention(head, dummyNoticesOf(edits), now);
  assert.deepEqual(rest, []);
  assert.equal(notice.title, "Sara Conti now leads Mission Analysis Division");
  assert.ok(notice.detail.startsWith("Marco Bianchi handed over"));
  assert.ok(
    dummyNoticeAttention(lead, dummyNoticesOf(edits), now).every((a) => !a.title.includes("now leads")),
    "the lead who promoted is not told",
  );

  const id = "dismissNotice" in notice.action ? notice.action.dismissNotice : -1;
  const dismissed = { ...edits, dismissedNotices: [...edits.dismissedNotices, id] };
  assert.deepEqual(dummyNoticeAttention(head, dummyNoticesOf(dismissed), now), []);
});

test("an application the lead accepts joins the waiting list", () => {
  const accepted = applications.find((a) => a.positionId === 4 && a.state.stage === "new")!;
  const current = applications.map((a) =>
    a.id === accepted.id ? { ...a, state: { stage: "accepted" as const, acceptedAt: "2026-10-09T10:00:00+02:00", ndaArrived: false } } : a,
  );
  assert.ok(dummyJoiners(current).some((j) => j.applicationId === accepted.id));
  assert.ok(!dummyJoiners(applications).some((j) => j.applicationId === accepted.id));
});

test("the division lead's joining banners match the accepted applications to the division's positions", async () => {
  const directory = await pages("division-lead").view.members();
  assert.ok(directory.scope === "division");
  const division = divisions.find((d) => d.name === directory.division)!;
  const accepted = applications.filter(
    (a) => a.state.stage === "accepted" && positions.find((p) => p.id === a.positionId)?.divisionId === division.id,
  );
  assert.ok(accepted.length > 1);
  assert.deepEqual(directory.joining.map((j) => j.applicationId).sort(), accepted.map((a) => a.id).sort());
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
