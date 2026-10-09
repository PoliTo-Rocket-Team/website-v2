import assert from "node:assert/strict";
import { test } from "node:test";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits } from "./edits";
import { dummyTeamPages } from "./team-pages";

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
  assert.equal(await writes.moveToAlumni(74), false); // another division
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
  assert.equal(await lead.view.teamWrites!.moveToAlumni(5), true);
  const edits = parseEdits(serializeEdits(lead.saved[0]));

  const member = pages("member", edits).view;
  const tree = await member.teamTree();
  const names = tree.departments.flatMap((d) => d.divisions.flatMap((v) => v.members.map((m) => m.name)));
  assert.ok(!names.includes("Elif Kaya"));

  const ops = pages("operations-lead", edits).view;
  const alumni = await ops.alumni();
  assert.ok(alumni.rows.some((a) => a.name === "Elif Kaya" && a.shownOnSite === true));
});

test("viewers who do not reach a page get no data from it", async () => {
  const member = pages("member").view;
  assert.deepEqual((await member.members()).rows, []);
  assert.deepEqual((await member.alumni()).rows, []);
  assert.equal(await member.teamWrites!.setShownOnSite(1006, true), false);
  const ops = pages("operations-lead").view;
  assert.equal((await ops.teamTree()).departments.length, 0);
});

test("a malformed edits cookie reads as no edits", () => {
  assert.deepEqual(parseEdits("not json"), NO_EDITS);
  assert.deepEqual(parseEdits(JSON.stringify({ members: { 7: { role: "admin" } }, shownOnSite: { x: true } })), NO_EDITS);
});
