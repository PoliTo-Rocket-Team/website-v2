import assert from "node:assert/strict";
import { test } from "node:test";
import type { MemberDirectory } from "@/lib/dashboard/team";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits } from "./edits";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { dummyTeamPages } from "./team-pages";

// New division, Edit division and Close division on a preview (#232, #251):
// what each save does to the team the test developer sees next. The rules
// themselves are lib/dashboard/division-edit.test.ts's.

/** The head's pages over `edits`, with each save kept after a round trip through the cookie. */
function head(edits: TeamEdits = NO_EDITS) {
  let kept = edits;
  const view = dummyTeamPages("department-head", edits, async (next) => {
    kept = parseEdits(serializeEdits(next));
  });
  return { writes: view.teamWrites!, view, kept: () => kept };
}

function department(directory: MemberDirectory) {
  if (directory.scope !== "department") throw new Error(`expected the department page, got ${directory.scope}`);
  return directory;
}

const MISSION_ANALYSIS = 1;
const OPTIMIZATION = 2;
const WIND_TUNNEL = 15;
const keep = { name: "Mission Analysis", code: "MA", newLeads: [], oldLeads: [], members: [], emails: [] };

async function tabOf(edits: TeamEdits, divisionId: number) {
  return department(await head(edits).view.members()).tabs.find((t) => t.division.id === divisionId);
}

test("a lead picked from another division leads this one too and keeps their own", async () => {
  const h = head();
  // Paolo Conti (20) leads Optimization and Analysis.
  assert.deepEqual(await h.writes.saveDivision(MISSION_ANALYSIS, { ...keep, newLeads: [20] }), { ok: true, value: null });
  const paolo = (await tabOf(h.kept(), MISSION_ANALYSIS))!.people.find((p) => p.id === 20)!;
  assert.equal(paolo.role, "lead");
  assert.deepEqual(paolo.divisions.map((d) => [d.divisionId, d.role]), [[MISSION_ANALYSIS, "lead"], [OPTIMIZATION, "lead"]]);
});

test("the team leader, a board seat and the head can lead a division and keep their own role", async () => {
  // Alessandro Greco (14) is the team leader, Federica Moretti (94) the Chief Engineer, Chiara Rinaldi (15) the head.
  const h = head();
  assert.deepEqual(await h.writes.saveDivision(MISSION_ANALYSIS, { ...keep, newLeads: [14, 94, 15] }), { ok: true, value: null });
  const leads = (await tabOf(h.kept(), MISSION_ANALYSIS))!.people.filter((p) => p.role === "lead").map((p) => p.id);
  assert.ok([14, 94, 15].every((id) => leads.includes(id)), leads.join());
  const tree = await head(h.kept()).view.teamTree();
  assert.equal(tree.leader?.id, 14, "still drawn as the team leader");
  const missionAnalysis = tree.departments.flatMap((d) => d.divisions).find((d) => d.id === MISSION_ANALYSIS)!;
  const listed = [missionAnalysis.lead, ...missionAnalysis.members].map((p) => p?.id);
  assert.ok([14, 94, 15].every((id) => listed.includes(id)), "and listed in the division they lead");
});

test("a seat holder whose only division it is can leave it and keeps the seat", async () => {
  // The team leader (14) leads Mission Analysis and is in no other division.
  const first = head();
  await first.writes.saveDivision(MISSION_ANALYSIS, { ...keep, newLeads: [14] });
  const row = (await tabOf(first.kept(), MISSION_ANALYSIS))!.people.find((p) => p.id === 14);
  assert.equal(row?.removal.kind, "offered", "the seat keeps them on the team, so this division is not their last place");
  const leaves = head(first.kept());
  const saved = await leaves.writes.saveDivision(MISSION_ANALYSIS, { ...keep, oldLeads: [{ personId: 14, via: "removed", outcome: "leave-division" }] });
  assert.deepEqual(saved, { ok: true, value: null });
  assert.equal((await tabOf(leaves.kept(), MISSION_ANALYSIS))!.people.some((p) => p.id === 14), false);
  assert.equal((await head(leaves.kept()).view.teamTree()).leader?.id, 14, "still the team leader");
});

test("a removed lead keeps Remove's three outcomes: stays as a member, leaves this division, leaves the team", async () => {
  // Anna Villa (13) is in Mission Analysis and Optimization and Analysis: lead her first, then let each outcome play.
  const first = head();
  await first.writes.saveDivision(MISSION_ANALYSIS, { ...keep, newLeads: [13] });

  const stays = head(first.kept());
  await stays.writes.saveDivision(MISSION_ANALYSIS, { ...keep, oldLeads: [{ personId: 13, via: "removed", outcome: "member" }] });
  assert.equal((await tabOf(stays.kept(), MISSION_ANALYSIS))!.people.find((p) => p.id === 13)?.role, "member");

  const leaves = head(first.kept());
  await leaves.writes.saveDivision(MISSION_ANALYSIS, { ...keep, oldLeads: [{ personId: 13, via: "removed", outcome: "leave-division" }] });
  assert.equal((await tabOf(leaves.kept(), MISSION_ANALYSIS))!.people.some((p) => p.id === 13), false);
  assert.ok((await tabOf(leaves.kept(), OPTIMIZATION))!.people.some((p) => p.id === 13), "keeps Optimization and Analysis");

  // Pietro Ricci (6) only leads Mission Analysis, so the head may move him to Alumni.
  const gone = head();
  assert.equal((await gone.writes.saveDivision(MISSION_ANALYSIS, { ...keep, oldLeads: [{ personId: 6, via: "removed", outcome: "leave-team" }] })).ok, true);
  assert.ok(gone.kept().movedToAlumni[6]);
  const alumni = await dummyTeamPages("operations-lead", gone.kept(), async () => {}).alumni();
  assert.ok(alumni.rows.some((a) => a.name === "Pietro Ricci"));
});

test("a replaced lead becomes an advisor in the division with no access, or moves to Alumni; never a member (#253)", async () => {
  // Pietro Ricci (6) only leads Mission Analysis; Sara Conti (7) is a member of it.
  const advises = head();
  const replaced = { ...keep, newLeads: [7], oldLeads: [{ personId: 6, via: "replaced", outcome: "advisor" }] };
  assert.deepEqual(await advises.writes.saveDivision(MISSION_ANALYSIS, replaced), { ok: true, value: null });
  const people = (await tabOf(advises.kept(), MISSION_ANALYSIS))!.people;
  const pietro = people.find((p) => p.id === 6);
  assert.equal(pietro?.role, "member", "an advisor leads nothing");
  assert.equal(pietro?.divisions.find((d) => d.divisionId === MISSION_ANALYSIS)?.title, "Advisor");
  assert.equal(people.find((p) => p.id === 7)?.role, "lead");
  assert.deepEqual(advises.kept().advisors[6], { place: { kind: "division", divisionId: MISSION_ANALYSIS }, access: "ends" });

  const leaves = head();
  const left = await leaves.writes.saveDivision(MISSION_ANALYSIS, { ...replaced, oldLeads: [{ personId: 6, via: "replaced", outcome: "leave" }] });
  assert.deepEqual(left, { ok: true, value: null });
  assert.ok(leaves.kept().movedToAlumni[6]);

  const member = await head().writes.saveDivision(MISSION_ANALYSIS, { ...replaced, oldLeads: [{ personId: 6, via: "replaced", outcome: "member" }] });
  assert.equal(member.ok, false, "a hand-over never leaves them as a member");
});

test("a changed code is the one the division's position codes read", async () => {
  const h = head();
  await h.writes.saveDivision(MISSION_ANALYSIS, { ...keep, code: "MX" });
  const data = dummyDashboardData(
    "department-head",
    { current: dummyRecruitmentOf(undefined), save: async () => {} },
    { current: EMPTY_DUMMY_STATE, save: async () => {} },
    { current: h.kept(), save: async () => {} },
  );
  const rows = (await data.positions()).positions.filter((p) => p.division === "Mission Analysis Division");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((p) => p.code.split("-")[1] === "MX"), rows.map((p) => p.code).join());
});

test("New division opens with its lead and members; a new email waits for Confirm NDA", async () => {
  const h = head();
  const created = await h.writes.createDivision(1, { name: "Flight Dynamics", code: "FD", newLeads: [13], oldLeads: [], members: [7], emails: ["new.person@studenti.polito.it"] });
  assert.ok(created.ok);
  const tab = (await tabOf(h.kept(), created.value))!;
  assert.equal(tab.division.name, "Flight Dynamics Division");
  assert.deepEqual(tab.people.map((p) => [p.id, p.role]), [[13, "lead"], [7, "member"]]);
  assert.deepEqual(tab.waiting.map((w) => w.email), ["new.person@studenti.polito.it"]);

  const confirm = head(h.kept());
  assert.equal(await confirm.writes.confirmNda(tab.waiting[0].joinId), true);
  const after = (await tabOf(confirm.kept(), created.value))!;
  assert.equal(after.waiting.length, 0);
  assert.ok(after.people.some((p) => p.signInEmail === "new.person@studenti.polito.it"));
});

test("closing an empty division takes it off the chart, closes its open positions and drops its access", async () => {
  const h = head();
  assert.equal((await h.writes.closeDivision(MISSION_ANALYSIS)).ok, false, "people are still in it");
  // A new division, then its only lead moved out from the Members list, leaves it empty.
  const created = await h.writes.createDivision(1, { name: "Flight Dynamics", code: "FD", newLeads: [13], oldLeads: [], members: [], emails: [] });
  assert.ok(created.ok);
  const emptied = head(h.kept());
  assert.equal(await emptied.writes.removeFromDivision(13, created.value), true);
  const closer = head(emptied.kept());
  assert.deepEqual(await closer.writes.closeDivision(created.value), { ok: true, value: null });
  const page = department(await head(closer.kept()).view.members());
  assert.ok(!page.tabs.some((t) => t.division.id === created.value));
  const structure = (await head(closer.kept()).view.teamStructure())!;
  assert.ok(!structure.departments.flatMap((d) => d.divisions).some((d) => d.id === created.value), "no closed-divisions list either");

  // Optimization and Analysis has an open position and access given in it.
  const shut: TeamEdits = { ...NO_EDITS, divisions: { [OPTIMIZATION]: { name: "Optimization and Analysis Division", code: "OA", departmentId: 1, closedOn: "2026-10-09" } } };
  const data = dummyDashboardData(
    "department-head",
    { current: dummyRecruitmentOf(undefined), save: async () => {} },
    { current: EMPTY_DUMMY_STATE, save: async () => {} },
    { current: shut, save: async () => {} },
  );
  const positions = (await data.positions()).positions.filter((p) => p.division === "Optimization and Analysis Division");
  assert.ok(positions.length > 0 && positions.every((p) => !p.open));
  const access = (await data.divisionAccess())!;
  assert.ok(access.unit.kind === "department" && !access.unit.divisions.some((d) => d.id === OPTIMIZATION));
  assert.ok(!access.grants.some((g) => g.place.kind === "division" && g.place.division.id === OPTIMIZATION));
});

test("a closed division never opens again: a save on it is refused, even with a lead (#251)", async () => {
  const h = head(NO_EDITS);
  const saved = await h.writes.saveDivision(WIND_TUNNEL, { ...keep, name: "Wind Tunnel", code: "WT", newLeads: [13] });
  assert.deepEqual(saved, { ok: false, error: "That division is not one you manage." });
  assert.equal(h.kept(), NO_EDITS, "nothing is saved");
  assert.equal(await tabOf(h.kept(), WIND_TUNNEL), undefined);
});

test("a division lead's division writes are refused on the server", async () => {
  const lead = dummyTeamPages("division-lead", NO_EDITS, async () => assert.fail("nothing is saved"));
  assert.equal((await lead.teamWrites!.saveDivision(MISSION_ANALYSIS, { ...keep, code: "MX" })).ok, false);
  assert.equal((await lead.teamWrites!.createDivision(1, { ...keep, name: "Flight Dynamics", code: "FD", newLeads: [3] })).ok, false);
  assert.equal((await lead.teamWrites!.closeDivision(MISSION_ANALYSIS)).ok, false);
  assert.deepEqual(await lead.findPeople("Sara"), { kind: "none" });
});
