import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { aliasRequests, handOverRequests, members } from "@/db/schema";
import { insertRows, keepWrites, recordedWrites, rowsIn, updateRows } from "./access-matrix/fake-db";
import { accountOf, EXTRA, IDS, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";

// Automatic alias requests on the database (issue #543): every write that
// makes someone a division lead, a department head or the team leader asks
// for their alias in the same batch, unless they have one on their record or
// an open request already. Each route runs for real against the in-memory
// database (./access-matrix/fake-db.ts), which stores what each write does.

const DM = IDS.division("DM");
const STRUCTURES = IDS.department("DM");
const LEAD = IDS.lead("DM"); // leads Design & Manufacturing
const MEMBER = IDS.person("DM"); // a member of Design & Manufacturing, with no alias and no request
const TEAM_LEADER = accountOf("team leader").userId;
const OTHER_REQUESTER = accountOf("team leader").memberId;

/** The open requests for `memberId`, each as who asked. */
const openFor = (memberId: number) => rowsIn(aliasRequests).filter((r) => r.memberId === memberId && r.outcome === null).map((r) => r.requestedBy);

const aliasInserts = () => recordedWrites().filter((w) => w.kind === "insert" && w.table === "alias_requests").length;

/** Each route that makes MEMBER a lead, a head or the team leader, signed in as someone who may. */
const ROUTES: readonly { readonly name: string; readonly run: () => Promise<{ ok: boolean }> }[] = [
  {
    name: "a lead change from the Team tree (Edit division)",
    run: () => {
      signInAs(TEAM_LEADER);
      return teamActions.saveDivision(DM, { name: "Design & Manufacturing", code: "DMA", members: [], emails: [], newLeads: [MEMBER], oldLeads: [{ personId: LEAD, via: "replaced", outcome: "advisor" }] });
    },
  },
  {
    name: "a new division's lead (New division)",
    run: () => {
      signInAs(TEAM_LEADER);
      return teamActions.createDivision(STRUCTURES, { name: "Composites", code: "CMP", members: [], emails: [], newLeads: [MEMBER], oldLeads: [] });
    },
  },
  {
    name: "a head set at create (New department)",
    run: () => {
      signInAs(TEAM_LEADER);
      return teamActions.createDepartment({ name: "Propulsion", code: "PRP", kind: "technical", heads: [MEMBER] });
    },
  },
  {
    name: "a head set at save (Change head)",
    run: () => {
      signInAs(TEAM_LEADER);
      return teamActions.saveDepartment(STRUCTURES, { name: "Structures", code: "STR", kind: "technical", head: { to: MEMBER, outcome: "advisor" } });
    },
  },
  {
    name: "the team leader hand-over",
    run: () => {
      signInAs(TEAM_LEADER);
      return teamActions.handOverTeamLeader({ to: MEMBER, outcome: "advisor" });
    },
  },
  {
    name: "a lead's hand-over request, confirmed",
    run: () => {
      signInAs("head-str");
      return actions.answerHandOver(IDS.handOver("DM"), "confirm");
    },
  },
  {
    name: "a head's hand-over request, confirmed",
    run: () => {
      insertRows(handOverRequests, [{ id: 99, fromId: EXTRA.head, role: "head", deptId: STRUCTURES, toId: MEMBER, outcome: "advisor", createdAt: new Date().toISOString() }]);
      signInAs(TEAM_LEADER);
      return actions.answerHandOver(99, "confirm");
    },
  },
];

function seeded(): void {
  seedFixture();
  keepWrites();
}

describe("every route that makes someone a lead, a head or the team leader asks for their alias", () => {
  for (const route of ROUTES) {
    test(`${route.name}: one automatic request when they have no alias and no open request`, async () => {
      seeded();
      assert.equal((await route.run()).ok, true);
      assert.deepEqual(openFor(MEMBER), [null]);
    });

    test(`${route.name}: none when they already have an alias on their record`, async () => {
      seeded();
      updateRows(members, { memberId: MEMBER }, { emailAlias: "person.dm@politorocketteam.it" });
      assert.equal((await route.run()).ok, true);
      assert.deepEqual(openFor(MEMBER), []);
      assert.equal(aliasInserts(), 0);
    });

    test(`${route.name}: none when they already have an open request, which stays as it was`, async () => {
      seeded();
      insertRows(aliasRequests, [{ id: 77, memberId: MEMBER, requestedBy: OTHER_REQUESTER, createdAt: new Date().toISOString() }]);
      assert.equal((await route.run()).ok, true);
      assert.deepEqual(openFor(MEMBER), [OTHER_REQUESTER]);
      assert.equal(aliasInserts(), 0, "the one-open-request index is never reached");
    });
  }
});

describe("a role change refused asks for nothing", () => {
  const REFUSED: readonly { readonly name: string; readonly run: () => Promise<{ ok: boolean }> }[] = [
    // Promote is a division lead's, and no lead may change a division's leads (`mayChangeDivision`), so it is always refused.
    { name: "Promote", run: () => (signInAs("lead-dm"), teamActions.promote(MEMBER, { mode: "together" })) },
    { name: "Edit division by a member", run: () => (signInAs("person-dm"), teamActions.saveDivision(DM, { name: "Design & Manufacturing", code: "DMA", members: [], emails: [], newLeads: [MEMBER], oldLeads: [] })) },
    { name: "New department naming two heads", run: () => (signInAs(TEAM_LEADER), teamActions.createDepartment({ name: "Propulsion", code: "PRP", kind: "technical", heads: [MEMBER, EXTRA.mover] })) },
    { name: "Change head by a head", run: () => (signInAs("head-str"), teamActions.saveDepartment(STRUCTURES, { name: "Structures", code: "STR", kind: "technical", head: { to: MEMBER, outcome: "advisor" } })) },
    { name: "the team leader hand-over by someone else", run: () => (signInAs("head-str"), teamActions.handOverTeamLeader({ to: MEMBER, outcome: "advisor" })) },
    { name: "a hand-over confirmed by someone who does not answer it", run: () => (signInAs("person-dm"), actions.answerHandOver(IDS.handOver("DM"), "confirm")) },
  ];
  for (const route of REFUSED) {
    test(route.name, async () => {
      seeded();
      assert.equal((await route.run()).ok, false);
      assert.equal(aliasInserts(), 0);
      assert.deepEqual(openFor(MEMBER), []);
    });
  }
});

test("closing a division or a department makes nobody a lead or a head, so it asks for nothing", async () => {
  seeded();
  signInAs(TEAM_LEADER);
  assert.equal((await teamActions.closeDivision(EXTRA.emptyDivision)).ok, true);
  assert.equal((await teamActions.closeDepartment(EXTRA.emptyDepartment, { people: [] })).ok, true);
  assert.equal(aliasInserts(), 0);
});
