import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits, type TeamEditsStore } from "./edits";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { dummyRecords, editedRoster } from "./team-pages";

// Hand over your role on a preview (issue #262): what "Send for
// confirmation", Confirm and Decline do to the team the test developer sees
// next, each save kept after a round trip through the cookie. The rules
// themselves are lib/dashboard/hand-over-request.test.ts's.

const MISSION_ANALYSIS = 1;
const AERODYNAMICS = 1;
const MARCO = 2; // the division lead the test developer signs in as
const PIETRO = 6; // co-leads Mission Analysis
const SARA = 7; // a member of Mission Analysis
const CHIARA = 15; // Head of Aerodynamics, the department head the test developer signs in as

/** One shared cookie, and `kind`'s dashboard read over it as it stands now. */
function preview(edits: TeamEdits = NO_EDITS) {
  const store: TeamEditsStore & { current: TeamEdits } = {
    current: edits,
    save: async (next) => {
      store.current = parseEdits(serializeEdits(next));
    },
  };
  const as = (kind: TestViewer) =>
    dummyDashboardData(kind, { current: dummyRecruitmentOf(undefined), save: async () => {} }, { current: EMPTY_DUMMY_STATE, save: async () => {} }, store);
  return { store, as };
}

const roleIn = (edits: TeamEdits, personId: number, divisionId: number) =>
  dummyRecords(edits, []).find((r) => r.id === personId)?.memberships.find((m) => m.divisionId === divisionId)?.role ?? null;

const send = { role: { kind: "lead", divisionId: MISSION_ANALYSIS }, to: SARA, outcome: "advisor" } as const;

test("a lead's and a head's My profile offer Hand over your role; a member keeps Leave the team", async () => {
  const { as } = preview();
  const lead = await as("division-lead").myProfile();
  assert.deepEqual([lead?.handOver?.title, lead?.handOver?.approver], ["Lead of Mission Analysis", "department-head"]);
  assert.ok(lead?.handOver?.successors.some((s) => s.id === PIETRO && s.unit === "Mission Analysis"));
  const head = await as("department-head").myProfile();
  assert.deepEqual([head?.handOver?.title, head?.handOver?.approver], ["Head of Aerodynamics", "team-leader"]);
  assert.equal((await as("member").myProfile())?.handOver, null);
  assert.equal((await as("team-leader").myProfile())?.handOver, null, "board 77i hands the team leader's role over");
  assert.equal((await as("division-lead").leaveTeam("", false)).ok, false, "a lead hands over instead of leaving");
});

test("Send for confirmation stores a waiting hand-over and changes no role", async () => {
  const { store, as } = preview();
  const before = editedRoster(store.current);
  assert.deepEqual(await as("division-lead").sendHandOver(send), { ok: true, value: null });
  assert.deepEqual(editedRoster(store.current), before, "no role changed");
  assert.deepEqual([roleIn(store.current, MARCO, MISSION_ANALYSIS), roleIn(store.current, SARA, MISSION_ANALYSIS)], ["lead", "member"]);
  assert.deepEqual((await as("division-lead").myProfile())?.handOver?.waiting?.to, "Sara Conti");
  assert.equal((await as("division-lead").sendHandOver(send)).ok, false, "one request waits at a time");
});

test("the department head sees it as the top row of Needs your attention; nobody else does", async () => {
  const { as } = preview();
  await as("division-lead").sendHandOver(send);
  const overview = await as("department-head").overview();
  assert.deepEqual(
    overview.attention.slice(0, 2).map((row) => [row.kind, row.title, row.detail]),
    [
      ["hand-over", "Paolo Conti wants to hand over Optimization and Analysis lead to Sara Fontana", "Sent today · Paolo then becomes an advisor, without access"],
      ["hand-over", "Marco Bianchi wants to hand over Mission Analysis lead to Sara Conti", "Sent today · Marco then becomes an advisor, without access"],
    ],
  );
  for (const kind of ["team-leader", "operations-lead", "division-lead"] as const) {
    assert.ok((await as(kind).overview()).attention.every((row) => row.kind !== "hand-over"), `${kind} answers none`);
  }
});

test("only the next level up may confirm or decline; the server refuses everyone else", async () => {
  const { store, as } = preview();
  await as("division-lead").sendHandOver(send);
  const id = store.current.handOvers[0].id;
  const sent = store.current;
  for (const kind of ["team-leader", "operations-lead", "division-lead", "member", "non-member"] as const) {
    assert.equal((await as(kind).answerHandOver(id, "confirm")).ok, false, `${kind} may not confirm`);
    assert.equal((await as(kind).answerHandOver(id, "decline")).ok, false, `${kind} may not decline`);
  }
  assert.equal(store.current, sent, "nothing is saved");
});

test("Confirm: the successor leads, the sender is an advisor whose access ends, and they are told", async () => {
  const { store, as } = preview();
  await as("division-lead").sendHandOver(send);
  const id = store.current.handOvers[0].id;
  assert.deepEqual(await as("department-head").answerHandOver(id, "confirm"), { ok: true, value: null });
  assert.deepEqual([roleIn(store.current, SARA, MISSION_ANALYSIS), roleIn(store.current, MARCO, MISSION_ANALYSIS)], ["lead", "member"]);
  assert.deepEqual(store.current.advisors[MARCO], { place: { kind: "division", divisionId: MISSION_ANALYSIS }, access: "ends" });
  assert.deepEqual(editedRoster(store.current).find((e) => e.id === MARCO)?.access, [], "only the Advisor role is left: no access");
  assert.equal(store.current.members[MARCO]?.titles?.[MISSION_ANALYSIS], "Advisor");
  assert.ok((await as("department-head").overview()).attention.every((row) => !row.title.startsWith("Marco Bianchi wants")), "the row is gone");
  const told = (await as("division-lead").overview()).attention.find((row) => row.title === "Chiara Rinaldi confirmed your hand-over");
  assert.equal(told?.detail, "Mission Analysis lead to Sara Conti · 9 Oct");
  assert.equal((await as("department-head").answerHandOver(id, "decline")).ok, false, "answered once");
});

test("Confirm with Leave the team moves the sender to Alumni", async () => {
  const { store, as } = preview();
  await as("division-lead").sendHandOver({ ...send, to: PIETRO, outcome: "leave" });
  await as("department-head").answerHandOver(store.current.handOvers[0].id, "confirm");
  assert.ok(store.current.movedToAlumni[MARCO] !== undefined);
  assert.ok(!editedRoster(store.current).some((e) => e.id === MARCO));
});

test("Decline changes no role and tells the sender", async () => {
  const { store, as } = preview();
  await as("division-lead").sendHandOver(send);
  const before = editedRoster(store.current);
  assert.deepEqual(await as("department-head").answerHandOver(store.current.handOvers[0].id, "decline"), { ok: true, value: null });
  assert.deepEqual(editedRoster(store.current), before);
  assert.deepEqual(store.current.advisors, {});
  const told = (await as("division-lead").overview()).attention.find((row) => row.title === "Chiara Rinaldi declined your hand-over");
  assert.equal(told?.detail, "Mission Analysis lead to Sara Conti · 9 Oct · you keep the role");
  assert.equal((await as("division-lead").myProfile())?.handOver?.waiting, null, "they may send a new one");
});

test("a head's hand-over goes to the team leader, and Confirm makes the successor head", async () => {
  const { store, as } = preview();
  assert.ok((await as("department-head").sendHandOver({ role: { kind: "head", departmentId: AERODYNAMICS }, to: MARCO, outcome: "advisor" })).ok);
  const id = store.current.handOvers[0].id;
  const row = (await as("team-leader").overview()).attention[0];
  assert.deepEqual([row.kind, row.title], ["hand-over", "Chiara Rinaldi wants to hand over Aerodynamics head to Marco Bianchi"]);
  assert.equal((await as("operations-lead").answerHandOver(id, "confirm")).ok, false, "full access is not the team leader");
  assert.ok((await as("team-leader").answerHandOver(id, "confirm")).ok);
  const roster = editedRoster(store.current);
  assert.deepEqual(roster.find((e) => e.id === MARCO)?.placement.role, "head");
  assert.deepEqual(roster.find((e) => e.id === CHIARA)?.placement.role, "divisions");
  assert.deepEqual(store.current.advisors[CHIARA], { place: { kind: "department", departmentId: AERODYNAMICS }, access: "ends" });
});

test("a hand-over whose sender is removed as lead lapses: it blocks no new send and never comes back", async () => {
  const { store, as } = preview();
  await as("division-lead").sendHandOver(send);
  const id = store.current.handOvers[0].id;
  const division = { name: "Mission Analysis", code: "MA", newLeads: [], oldLeads: [], members: [], emails: [] };
  await as("department-head").teamWrites!.saveDivision(MISSION_ANALYSIS, { ...division, oldLeads: [{ personId: MARCO, via: "removed", outcome: "member" }] });
  assert.deepEqual(store.current.handOvers.find((h) => h.id === id)?.answered, { answer: "lapsed" }, "closed by the save that changed his role");
  const marcoRow = (rows: readonly { title: string }[]) => rows.some((row) => row.title.startsWith("Marco Bianchi wants"));
  assert.ok(!marcoRow((await as("department-head").overview()).attention));

  // Made lead again, the old request stays closed: no row with its old successor, nothing waiting on My profile.
  await as("department-head").teamWrites!.saveDivision(MISSION_ANALYSIS, { ...division, newLeads: [MARCO] });
  assert.equal(roleIn(store.current, MARCO, MISSION_ANALYSIS), "lead");
  assert.ok(!marcoRow((await as("department-head").overview()).attention), "it never comes back");
  assert.equal((await as("division-lead").myProfile())?.handOver?.waiting, null);
  assert.equal((await as("department-head").answerHandOver(id, "confirm")).ok, false, "nobody can answer it");
  assert.deepEqual(await as("division-lead").sendHandOver({ ...send, to: PIETRO }), { ok: true, value: null }, "a new send is not blocked");
  assert.equal((await as("division-lead").myProfile())?.handOver?.waiting?.to, "Pietro Ricci");
});
