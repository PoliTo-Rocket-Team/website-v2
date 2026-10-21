import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyAccessPage } from "./division";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits, type TeamEditsStore } from "./edits";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";
import { personFor } from "./team";
import { dummyTeamPages, editedRoster } from "./team-pages";

// Full access follows the role on a preview (issue #501): the operations
// lead's seat sits on the head role of Operations, not on Giulia Rossi, so
// Change head and a confirmed head hand-over move it to the successor. The
// Access page reads the seat off the roster as the test developer left it.

const OPERATIONS = 6;
const GIULIA = 1; // Head of Operations, the operations lead in the arrays
const ANDREA = 8; // a member of Communications, in Operations
const SARA = 7; // a member of Mission Analysis

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

/** Who holds the operations lead's seat on the team leader's Access page, read off the roster as `edits` left it. */
function operationsLeads(edits: TeamEdits): number[] {
  const page = dummyAccessPage("operations-lead", personFor["team-leader"], editedRoster(edits))!;
  return page.roleAccess.flatMap((r) => ("seat" in r && r.seat === "operations-lead" ?[r.person.id] : []));
}

test("the operations lead's seat starts on the head of Operations", () => {
  assert.deepEqual(operationsLeads(NO_EDITS), [GIULIA]);
});

test("Change head on Operations moves the seat to the new head and away from the head they replace", async () => {
  let kept = NO_EDITS;
  const writes = dummyTeamPages("team-leader", NO_EDITS, async (next) => {
    kept = parseEdits(serializeEdits(next));
  }).teamWrites!;
  const saved = await writes.saveDepartment(OPERATIONS, { name: "Operations", code: "OP", kind: "operations", head: { to: SARA, outcome: "advisor" } });
  assert.ok(saved.ok);
  assert.deepEqual(operationsLeads(kept), [SARA]);
});

test("a confirmed head hand-over on Operations moves the seat to the successor and away from the sender", async () => {
  const { store, as } = preview();
  assert.ok((await as("operations-lead").sendHandOver({ role: { kind: "head", departmentId: OPERATIONS }, to: ANDREA, outcome: "advisor" })).ok);
  assert.deepEqual(operationsLeads(store.current), [GIULIA], "sending changes no role");
  assert.ok((await as("team-leader").answerHandOver(store.current.handOvers[0].id, "confirm")).ok);
  assert.deepEqual(operationsLeads(store.current), [ANDREA]);
});
