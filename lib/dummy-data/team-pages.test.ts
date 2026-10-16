import assert from "node:assert/strict";
import { test } from "node:test";
import type { MemberDirectory } from "@/lib/dashboard/team";
import { membershipsIn } from "@/lib/dashboard/team";
import { dummyAccessPage } from "./division";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits } from "./edits";
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

/** The edits after a round trip through the cookie. */
const reread = (edits: TeamEdits) => parseEdits(serializeEdits(edits));

function divisionPage(directory: MemberDirectory) {
  if (directory.scope !== "division") throw new Error(`expected a division page, got ${directory.scope}`);
  return directory;
}

function teamRows(directory: MemberDirectory) {
  if (directory.scope !== "team") throw new Error(`expected the team directory, got ${directory.scope}`);
  return directory.rows;
}

const MISSION_ANALYSIS = 1;

test("a division lead lists only their own division, with every division each person is in", async () => {
  const page = divisionPage(await pages("division-lead").view.members());
  assert.equal(page.division.name, "Mission Analysis Division");
  assert.equal(page.division.leadsHint, "Leads are changed by the Head of Aerodynamics");
  const sofia = page.people.find((p) => p.name === "Sofia Neri")!;
  assert.deepEqual(sofia.chips.map((c) => [c.label, c.code]), [["MA", true], ["Structures", false]]);
  assert.deepEqual(sofia.divisions.map((d) => d.title), ["Mission Analyst", "CAD Engineer"]);
  const anna = page.people.find((p) => p.name === "Anna Villa")!;
  assert.deepEqual(anna.chips.map((c) => c.label), ["MA", "OA"]);
  assert.ok(page.people.every((p) => p.divisions[0].divisionId === MISSION_ANALYSIS));
});

test("a lead's Save sets titles but never a role, and Promote is refused: only the head changes leads (#231)", async () => {
  const { view, saved } = pages("division-lead");
  const writes = view.teamWrites!;
  assert.equal(await writes.saveMember(7, { role: null, pageTitle: "Mission Analyst" }), true);
  assert.equal(await writes.saveMember(7, { role: "division-lead", pageTitle: null }), false, "no new lead");
  assert.equal(await writes.saveMember(2, { role: null, pageTitle: null }), false, "never themselves");
  assert.equal(await writes.promote(7, "together"), false);
  assert.equal(await writes.promote(7, "hand-over"), false);
  assert.equal(saved.length, 1);
});

test("the team leader and a head keep their place when the operations lead saves their title", async () => {
  const ops = pages("operations-lead");
  const writes = ops.view.teamWrites!;
  assert.equal(await writes.saveMember(14, { role: null, pageTitle: "Team Leader 2026" }), true);
  assert.equal(await writes.saveMember(15, { role: "member", pageTitle: null }), false); // a head's role is not the drawer's
  const leader = teamRows(await pages("operations-lead", reread(ops.saved[0])).view.members()).find((r) => r.id === 14);
  assert.equal(leader?.role, "team-leader");
  assert.equal(leader?.pageTitle, "Team Leader 2026");
});

test("Leaves the team takes someone off the tree and onto the Alumni page", async () => {
  const lead = pages("division-lead");
  assert.equal(await lead.view.teamWrites!.moveToAlumni(5, { from: 2025, to: 2026, reason: "graduated" }), true);
  const edits = reread(lead.saved[0]);

  const tree = await pages("member", edits).view.teamTree();
  const names = tree.departments.flatMap((d) => d.divisions.flatMap((v) => v.members.map((m) => m.name)));
  assert.ok(!names.includes("Elif Kaya"));

  const alumni = await pages("operations-lead", edits).view.alumni();
  assert.ok(alumni.rows.some((a) => a.name === "Elif Kaya" && a.from === 2025 && a.to === 2026 && a.shownOnSite === true));
});

test("Leaves the team ends their access and keeps them on record", async () => {
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

test("Leaves the team follows the permission rule, and the server refuses it otherwise (#231)", async () => {
  const lead = pages("division-lead");
  const writes = lead.view.teamWrites!;
  const page = divisionPage(await lead.view.members());
  // Sofia is also in Design & Manufacturing, in Structures: only the team leader may.
  const sofia = page.people.find((p) => p.id === 3)!;
  assert.deepEqual(sofia.leave, { allowed: false, reason: "Also in Design & Manufacturing, so only the team leader can do this" });
  assert.equal(await writes.moveToAlumni(3, { from: 2024, to: 2026, reason: null }), false);
  // Anna is also in Optimization and Analysis, in Aerodynamics: only its head may.
  const anna = page.people.find((p) => p.id === 13)!;
  assert.deepEqual(anna.leave, { allowed: false, reason: "Also in Optimization and Analysis, so only the Head of Aerodynamics can do this" });
  assert.equal(await writes.moveToAlumni(13, { from: 2025, to: 2026, reason: null }), false);
  assert.equal(await writes.moveToAlumni(8, { from: 2023, to: 2026, reason: null }), false, "Communications is not theirs");
  assert.equal(await writes.moveToAlumni(9, { from: 2023, to: 2026, reason: null }), false, "nor is another division's lead");
  assert.equal(lead.saved.length, 0);

  assert.equal(await writes.moveToAlumni(6, { from: 2025, to: 2026, reason: null }), true, "Pietro is only in Mission Analysis");
  const { rows } = await pages("operations-lead", lead.saved[0]).view.alumni();
  assert.ok(rows.some((a) => a.name === "Pietro Ricci" && a.from === 2025 && a.to === 2026));

  // The operations lead reaches the whole team, as Move to alumni did (#201).
  const ops = pages("operations-lead");
  assert.equal(await ops.view.teamWrites!.moveToAlumni(3, { from: 2024, to: 2026, reason: "graduated" }), true);
  assert.equal(await ops.view.teamWrites!.moveToAlumni(1, { from: 2022, to: 2026, reason: null }), false, "never themselves");
});

test('"Remove from <division>" ends only that division\'s role, and is refused for the only division (#231)', async () => {
  const lead = pages("division-lead");
  const writes = lead.view.teamWrites!;
  const page = divisionPage(await lead.view.members());
  assert.equal(page.people.find((p) => p.id === 7)?.removal.kind, "only-division");
  assert.equal(await writes.removeFromDivision(7, MISSION_ANALYSIS), false, "Sara is only in Mission Analysis");
  assert.equal(await writes.removeFromDivision(13, 2), false, "Optimization and Analysis is not the lead's");
  assert.equal(lead.saved.length, 0);

  assert.equal(await writes.removeFromDivision(13, MISSION_ANALYSIS), true);
  const edits = reread(lead.saved[0]);
  const anna = editedRoster(edits).find((e) => e.id === 13)!;
  assert.deepEqual(membershipsIn(anna.placement).map((m) => m.divisionId), [2], "she keeps Optimization and Analysis");
  assert.ok(!divisionPage(await pages("division-lead", edits).view.members()).people.some((p) => p.id === 13));
});

test('someone added by email is "Waiting for NDA" and no member until Confirm NDA, which records the date and who (#231)', async () => {
  const lead = pages("division-lead");
  const added = await lead.view.teamWrites!.addMember({
    kind: "email",
    divisionId: MISSION_ANALYSIS,
    email: "  Nora.Blu@Studenti.Polito.it ",
    firstName: "Nora",
    lastName: "Blu",
    title: "Mission Analyst",
    details: null,
  });
  assert.deepEqual(added, { ok: true, value: "waiting" });
  const waiting = reread(lead.saved[0]);
  const page = divisionPage(await pages("division-lead", waiting).view.members());
  const nora = page.waiting.find((w) => w.email === "nora.blu@studenti.polito.it")!;
  assert.equal(nora.name, "Nora Blu");
  assert.ok(!page.people.some((p) => p.name === "Nora Blu"), "not a member yet");
  assert.ok(!editedRoster(waiting).some((e) => e.email === "nora.blu@studenti.polito.it"), "not on the roster or the tree");

  const confirmer = pages("division-lead", waiting);
  assert.equal(await confirmer.view.teamWrites!.confirmNda(nora.joinId), true);
  const confirmed = reread(confirmer.saved[0]);
  const after = divisionPage(await pages("division-lead", confirmed).view.members());
  const member = after.people.find((p) => p.name === "Nora Blu")!;
  assert.deepEqual(member.nda, { signedOn: "2026-10-09", confirmedBy: "Marco Bianchi" });
  assert.equal(member.title, "Mission Analyst");
  assert.ok(!after.waiting.some((w) => w.joinId === nora.joinId));
  assert.equal(await pages("division-lead", confirmed).view.teamWrites!.confirmNda(nora.joinId), false, "only once");
});

test('Cancel add deletes a "Waiting for NDA" entry and nothing else; only a lead or head of that division may (#231)', async () => {
  const lead = pages("division-lead");
  await lead.view.teamWrites!.addMember({
    kind: "email",
    divisionId: MISSION_ANALYSIS,
    email: "nora.blu@studenti.polito.it",
    firstName: "Nora",
    lastName: "Blu",
    title: null,
    details: null,
  });
  const waiting = reread(lead.saved[0]);
  const before = divisionPage(await pages("division-lead", waiting).view.members());
  const nora = before.waiting.find((w) => w.email === "nora.blu@studenti.polito.it")!;
  const elena = before.waiting.find((w) => w.email === "elena.marino@studenti.polito.it")!;

  assert.equal(await pages("member", waiting).view.teamWrites!.cancelAdd(nora.joinId), false, "a member cannot");

  const first = pages("division-lead", waiting);
  assert.equal(await first.view.teamWrites!.cancelAdd(nora.joinId), true);
  const second = pages("division-lead", reread(first.saved[0]));
  assert.equal(await second.view.teamWrites!.cancelAdd(elena.joinId), true, "also an add the dummy team starts with");
  const cancelled = reread(second.saved[0]);
  const after = divisionPage(await pages("division-lead", cancelled).view.members());
  assert.deepEqual(after.waiting, [], "no one waits any more");
  assert.deepEqual(after.people.map((p) => p.id), before.people.map((p) => p.id), "no member changed");
  assert.deepEqual(editedRoster(cancelled), editedRoster(waiting), "the roster is as it was");
  assert.equal(await pages("division-lead", cancelled).view.teamWrites!.confirmNda(nora.joinId), false, "nothing left to confirm");

  const again = pages("division-lead", cancelled);
  await again.view.teamWrites!.addMember({ kind: "email", divisionId: MISSION_ANALYSIS, email: "nora.blu@studenti.polito.it", firstName: "Nora", lastName: "Blu", title: null, details: null });
  const readded = divisionPage(await pages("division-lead", reread(again.saved[0])).view.members());
  assert.ok(readded.waiting.some((w) => w.email === "nora.blu@studenti.polito.it"), "the email can be added again");
});

test("an existing member added to another division joins at once, keeps their other divisions and signs no second NDA (#231)", async () => {
  // Matteo Greco is in Design & Manufacturing and Optimization and Analysis.
  const matteo = people.find((p) => p.name === "Matteo Greco")!;
  const lead = pages("division-lead");
  const found = await lead.view.findForAdd(MISSION_ANALYSIS, "matteo gre");
  assert.ok(found.kind === "people" && found.people.some((m) => m.id === matteo.id && !m.here));

  const added = await lead.view.teamWrites!.addMember({ kind: "member", divisionId: MISSION_ANALYSIS, personId: matteo.id, title: "Trajectory Analyst" });
  assert.deepEqual(added, { ok: true, value: "joined" });
  const edits = reread(lead.saved[0]);
  const page = divisionPage(await pages("division-lead", edits).view.members());
  const row = page.people.find((p) => p.id === matteo.id)!;
  assert.deepEqual(row.divisions.map((d) => d.divisionId).sort(), [1, 2, 3]);
  assert.equal(row.title, "Trajectory Analyst");
  assert.ok(!page.waiting.some((w) => w.email === matteo.email), "no wait for an NDA");
  assert.equal(row.nda?.signedOn, "2024-10-15", "the NDA they signed when they joined the team");

  const again = await pages("division-lead", edits).view.teamWrites!.addMember({ kind: "member", divisionId: MISSION_ANALYSIS, personId: matteo.id, title: null });
  assert.deepEqual(again, { ok: false, error: "They are already in this division." });
  const byEmail = await pages("division-lead").view.teamWrites!.addMember({
    kind: "email",
    divisionId: MISSION_ANALYSIS,
    email: "ELENA.MARINO@studenti.polito.it",
    firstName: "",
    lastName: "",
    title: null,
    details: null,
  });
  assert.deepEqual(byEmail, { ok: false, error: "They are already waiting for their NDA here." });
});

test("Edit details saves the title in the lead's own division only, and the details", async () => {
  const lead = pages("division-lead");
  const writes = lead.view.teamWrites!;
  const details = {
    prtEmail: "s.neri@politorocketteam.it",
    phone: "+39 333 123 4567",
    discord: "sofia.n",
    linkedin: "linkedin.com/in/sofia-neri",
    politoId: "s312456",
    programme: "Aerospace Engineering",
    level: "Year 3 Bachelor's",
    country: "Italy",
    birthDate: "2003-03-14",
    gender: "Female",
  };
  assert.deepEqual(await writes.saveMemberDetails({ kind: "person", id: 3 }, 3, { title: "CAD Lead", details }), {
    ok: false,
    error: "You can edit only people in your own division.",
  });
  assert.deepEqual(await writes.saveMemberDetails({ kind: "person", id: 3 }, MISSION_ANALYSIS, { title: "Orbit Analyst", details }), { ok: true, value: null });
  const sofia = divisionPage(await pages("division-lead", reread(lead.saved[0])).view.members()).people.find((p) => p.id === 3)!;
  assert.deepEqual(sofia.divisions.map((d) => d.title), ["Orbit Analyst", "CAD Engineer"]);
  assert.equal(sofia.details.politoId, "312456");
  assert.equal(sofia.details.gender, "Female");
});

test("an application the lead accepts joins the waiting list", () => {
  const accepted = applications.find((a) => a.positionId === 4 && a.state.stage === "new")!;
  const current = applications.map((a) =>
    a.id === accepted.id ? { ...a, state: { stage: "accepted" as const, acceptedAt: "2026-10-09T10:00:00+02:00", ndaArrived: false } } : a,
  );
  assert.ok(dummyJoiners(current).some((j) => j.applicationId === accepted.id));
  assert.ok(!dummyJoiners(applications).some((j) => j.applicationId === accepted.id));
});

test("the division lead's joining banners match the accepted applications of people not on the team yet", async () => {
  const page = divisionPage(await pages("division-lead").view.members());
  const division = divisions.find((d) => d.name === page.division.name)!;
  const onTeam = new Set(people.map((p) => p.email));
  const accepted = applications.filter(
    (a) =>
      a.state.stage === "accepted" &&
      positions.find((p) => p.id === a.positionId)?.divisionId === division.id &&
      !onTeam.has(a.applicant.email),
  );
  assert.ok(accepted.length > 1);
  assert.deepEqual(page.joining.map((j) => j.applicationId).sort(), accepted.map((a) => a.id).sort());
});

test("the dummy team has someone in two divisions across two departments (issue #229)", () => {
  const departmentOf = (divisionId: number) => divisions.find((d) => d.id === divisionId)!.departmentId;
  const across = people.filter((p) => {
    const memberships = membershipsIn(p.placement);
    return memberships.length >= 2 && new Set(memberships.map((m) => departmentOf(m.divisionId))).size >= 2;
  });
  assert.ok(across.length >= 1);
});

test("viewers who do not reach a page get no data from it", async () => {
  const member = pages("member").view;
  assert.equal((await member.members()).scope, "none");
  assert.deepEqual(await member.findForAdd(MISSION_ANALYSIS, "sara"), { kind: "none" });
  assert.deepEqual((await member.alumni()).rows, []);
  assert.equal(await member.teamWrites!.setShownOnSite(1006, true), false);
  assert.equal((await member.teamWrites!.addMember({ kind: "member", divisionId: 1, personId: 3, title: null })).ok, false);
  const applicant = pages("non-member").view;
  assert.equal((await applicant.teamTree()).departments.length, 0);
});

test("the operations lead gets the whole Team tree (issue #183)", async () => {
  const ops = pages("operations-lead").view;
  assert.ok((await ops.teamTree()).departments.length > 0);
});

function departmentPage(directory: MemberDirectory) {
  if (directory.scope !== "department") throw new Error(`expected a department page, got ${directory.scope}`);
  return directory;
}

test("the department head's Members page holds their department's open divisions, and no closed one (#235, #251)", async () => {
  const page = departmentPage(await pages("department-head").view.members());
  assert.equal(page.department.name, "Aerodynamics");
  assert.deepEqual(page.tabs.map((t) => t.division.code), ["MA", "OA"], "Wind Tunnel is closed and listed nowhere");
  assert.equal(new Set(page.everyone.map((p) => p.id)).size, page.everyone.length, "everyone once");
  assert.ok(page.everyone.some((p) => p.name === "Matteo Greco"), "in Optimization and Analysis beside Structures");
  assert.ok(!page.everyone.some((p) => p.name === "Federica Leone"), "nobody from Structures alone");
});

test("a department head acts only on people in their department's divisions; the server refuses the rest (#235)", async () => {
  const { view, saved } = pages("department-head");
  const writes = view.teamWrites!;
  const SOFIA = 3; // Mission Analysis, and Design & Manufacturing in Structures
  const MATTEO = 72; // Design & Manufacturing, and Optimization and Analysis
  const FEDERICA = 21; // leads Design & Manufacturing only
  const LUCA = 4; // Mission Analysis only
  const years = { reason: "graduated", from: 2024, to: 2026 } as const;

  assert.equal(await writes.removeFromDivision(MATTEO, 2), true, "out of Optimization, keeping Structures");
  assert.equal(await writes.removeFromDivision(MATTEO, 3), false, "Design & Manufacturing is not the head's");
  assert.equal(await writes.removeFromDivision(FEDERICA, 3), false);
  assert.equal(await writes.moveToAlumni(SOFIA, years), false, "also in Structures");
  assert.equal(await writes.moveToAlumni(FEDERICA, years), false);
  assert.equal(await writes.moveToAlumni(LUCA, years), true);
  assert.equal((await writes.addMember({ kind: "member", divisionId: 3, personId: LUCA, title: null })).ok, false);
  assert.deepEqual(await writes.addMember({ kind: "member", divisionId: 2, personId: LUCA, title: null }), { ok: true, value: "joined" });
  assert.equal(saved.length, 3);
  assert.deepEqual(await view.findForAdd(3, "Luca Marino"), { kind: "none" }, "Add member finds nobody for a division outside the department");
});

test("a malformed edits cookie reads as no edits", () => {
  assert.deepEqual(parseEdits("not json"), NO_EDITS);
  assert.deepEqual(parseEdits(JSON.stringify({ members: { 7: { role: "admin" } }, shownOnSite: { x: true } })), NO_EDITS);
});
