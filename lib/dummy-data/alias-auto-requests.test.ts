import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyAliasRequestsOf } from "./aliases";
import { NO_MEMBER_DETAILS } from "@/lib/dashboard/details";
import { detailsKey, NO_EDITS, parseEdits, serializeEdits, type TeamEdits, type TeamEditsStore } from "./edits";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";

// Automatic alias requests on a preview (issue #543): every write that makes
// someone a division lead, a department head or the team leader asks for
// their alias in the same save, unless their PRT email is set (issue #563)
// or they have an open request already, and the approvers answer it as any other. The database side runs
// the same rule (lib/dashboard/alias-auto-request-server.test.ts).

const AERODYNAMICS = 1;
const OPERATIONS = 6;
const MISSION_ANALYSIS = 1;
const SARA = 7; // a member of Mission Analysis, with no PRT email and no request
const ANDREA = 8; // a member of Communications, in Operations, with no PRT email and no request
const MARCO = 2; // co-leads Mission Analysis

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

type Preview = ReturnType<typeof preview>;

/** The open requests for `memberId`, each as who asked. */
const openFor = (edits: TeamEdits, memberId: number) =>
  dummyAliasRequestsOf(edits).filter((r) => r.memberId === memberId && r.outcome === null).map((r) => r.requesterId);

/** Each route that makes `who` a lead, a head or the team leader, as a viewer who may. */
const ROUTES: readonly { readonly name: string; readonly who: number; readonly run: (p: Preview) => Promise<{ ok: boolean }> }[] = [
  {
    name: "a lead change from the Team tree (Edit division)",
    who: SARA,
    run: ({ as }) => as("team-leader").teamWrites!.saveDivision(MISSION_ANALYSIS, { name: "Mission Analysis", code: "MA", members: [], emails: [], newLeads: [SARA], oldLeads: [] }),
  },
  {
    name: "a new division's lead (New division)",
    who: SARA,
    run: ({ as }) => as("team-leader").teamWrites!.createDivision(AERODYNAMICS, { name: "Composites", code: "CMP", members: [], emails: [], newLeads: [SARA], oldLeads: [] }),
  },
  {
    name: "a head set at create (New department)",
    who: SARA,
    run: ({ as }) => as("team-leader").teamWrites!.createDepartment({ name: "Propulsion", code: "PRP", kind: "technical", heads: [SARA] }),
  },
  {
    name: "a head set at save (Change head)",
    who: SARA,
    run: ({ as }) => as("team-leader").teamWrites!.saveDepartment(OPERATIONS, { name: "Operations", code: "OP", kind: "operations", head: { to: SARA, outcome: "advisor" } }),
  },
  {
    name: "the team leader hand-over",
    who: SARA,
    run: ({ as }) => as("team-leader").teamWrites!.handOverTeamLeader({ to: SARA, outcome: "advisor" }),
  },
  {
    name: "a lead's hand-over request, confirmed",
    who: SARA,
    run: async ({ store, as }) => {
      assert.ok((await as("division-lead").sendHandOver({ role: { kind: "lead", divisionId: MISSION_ANALYSIS }, to: SARA, outcome: "advisor" })).ok);
      return as("department-head").answerHandOver(store.current.handOvers.at(-1)!.id, "confirm");
    },
  },
  {
    name: "a head's hand-over request, confirmed",
    who: ANDREA,
    run: async ({ store, as }) => {
      assert.ok((await as("operations-lead").sendHandOver({ role: { kind: "head", departmentId: OPERATIONS }, to: ANDREA, outcome: "advisor" })).ok);
      return as("team-leader").answerHandOver(store.current.handOvers.at(-1)!.id, "confirm");
    },
  },
];

describe("every preview route that makes someone a lead, a head or the team leader asks for their alias", () => {
  for (const route of ROUTES) {
    test(`${route.name}: one automatic request when their PRT email is empty and no request is open`, async () => {
      const p = preview();
      assert.equal((await route.run(p)).ok, true);
      assert.deepEqual(openFor(p.store.current, route.who), [null]);
    });

    test(`${route.name}: none when their PRT email is already set`, async () => {
      const details = { ...NO_MEMBER_DETAILS, prtEmail: "already.set@politorocketteam.it" };
      const p = preview({ ...NO_EDITS, details: { [detailsKey({ kind: "person", id: route.who })]: details } });
      assert.equal((await route.run(p)).ok, true);
      assert.deepEqual(openFor(p.store.current, route.who), []);
    });

    test(`${route.name}: none when they already have an open request, which stays as it was`, async () => {
      const p = preview({ ...NO_EDITS, aliasRequests: [{ id: 50, memberId: route.who, requesterId: MARCO, sentAt: "2026-10-09T10:00:00+02:00", outcome: null }] });
      assert.equal((await route.run(p)).ok, true);
      assert.deepEqual(openFor(p.store.current, route.who), [MARCO]);
    });
  }
});

test("a role change refused asks for nothing", async () => {
  const { store, as } = preview();
  assert.equal((await as("member").teamWrites?.handOverTeamLeader({ to: SARA, outcome: "advisor" }))?.ok ?? false, false);
  assert.equal((await as("department-head").teamWrites!.createDepartment({ name: "Propulsion", code: "PRP", kind: "technical", heads: [SARA] })).ok, false);
  assert.deepEqual(openFor(store.current, SARA), []);
});

test("the automatic request is the approvers' automatic row, and Mark created works on it; others still see Request alias", async () => {
  const { store, as } = preview();
  assert.ok((await as("team-leader").teamWrites!.createDepartment({ name: "Propulsion", code: "PRP", kind: "technical", heads: [SARA] })).ok);
  for (const approver of ["team-leader", "operations-lead"] as const) {
    const row = (await as(approver).overview()).attention.find((a) => a.kind === "alias-request" && a.title === "Sara Conti needs an email alias");
    assert.equal(row?.detail, "Automatic · became Propulsion head today and has no alias", approver);
  }
  const [request] = dummyAliasRequestsOf(store.current).filter((r) => r.memberId === SARA && r.outcome === null);
  assert.deepEqual(await as("operations-lead").answerAlias(request!.id, { kind: "created", address: "sara.conti@politorocketteam.it" }), { ok: true, value: null });
  assert.deepEqual((await as("team-leader").memberAliases([SARA]))[SARA], { kind: "set", address: "sara.conti@politorocketteam.it" });
  // Elif is a member of Mission Analysis, no lead, with no alias and no request: Marco still asks for hers by hand.
  assert.deepEqual((await as("division-lead").memberAliases([5]))[5], { kind: "none", requestable: true });
});
