import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { NO_EDITS, parseEdits, serializeEdits, type TeamEdits, type TeamEditsStore } from "./edits";
import { dummyDashboardData } from "./index";
import { dummyRecruitmentOf } from "./recruitment";
import { EMPTY_DUMMY_STATE } from "./state";

// Email alias requests on a preview (epic #538): Request alias, Mark created
// and Decline as the test developer runs them, each save kept after a round
// trip through the cookie. The rules are lib/dashboard/alias-request.test.ts's.

const ELIF = 5; // a member of Mission Analysis, with no alias and no request
const LUCA = 4; // a member of Mission Analysis Marco asked an alias for (seeded)
const SOFIA = 3; // a member of Mission Analysis with an alias already (seeded)

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

const aliasRows = async (data: ReturnType<ReturnType<typeof preview>["as"]>) =>
  (await data.overview()).attention.filter((a) => a.kind === "alias-request");

test("the division lead's drawer: Request alias for Elif, Requested for Luca, Sofia's alias", async () => {
  const { as } = preview();
  assert.deepEqual(await as("division-lead").memberAliases([ELIF, LUCA, SOFIA]), {
    [ELIF]: { kind: "none", requestable: true },
    [LUCA]: { kind: "requested", requestId: 1, line: "by you · 8 Oct", cancellable: true },
    [SOFIA]: { kind: "set", address: "sofia.neri@politorocketteam.it" },
  });
  assert.deepEqual(await as("member").memberAliases([ELIF]), {}, "a member does not open Members");
});

test("Request alias, then Mark created: the address lands on the record, only the requester is told and the member sees the board 94f card", async () => {
  const { as } = preview();
  assert.deepEqual(await as("division-lead").requestAlias(ELIF), { ok: true, value: null });
  assert.equal((await as("division-lead").requestAlias(ELIF)).ok, false, "one open request per member");
  assert.equal((await as("division-lead").memberAliases([ELIF]))[ELIF]?.kind, "requested");
  assert.equal((await aliasRows(as("department-head"))).length, 0, "a head answers none");
  const rows = await aliasRows(as("team-leader"));
  assert.deepEqual(rows.map((r) => r.title), [
    "Marco Bianchi asks for an email alias for Luca Marino",
    "Pietro Ricci needs an email alias",
    "Marco Bianchi asks for an email alias for Elif Kaya",
  ]);
  assert.equal((await as("team-leader").answerAlias(3, { kind: "created", address: "elif.kaya@gmail.com" })).ok, false, "the team domain only");
  assert.deepEqual(await as("team-leader").answerAlias(3, { kind: "created", address: "elif.kaya@politorocketteam.it" }), { ok: true, value: null });
  assert.deepEqual((await as("division-lead").memberAliases([ELIF]))[ELIF], { kind: "set", address: "elif.kaya@politorocketteam.it" });
  const told = (await as("division-lead").overview()).attention.map((a) => a.title);
  assert.ok(told.includes("Elif Kaya's email alias is ready"), told.join(" | "));
  assert.ok(!(await as("member").overview()).attention.some((a) => a.title.includes("email alias")), "the card, not a notice row (board 94f)");
  assert.deepEqual(await as("member").myAlias(), { address: "elif.kaya@politorocketteam.it", setUp: false });
});

test("I've set it up is kept for the member alone, after a round trip through the cookie, and refused without an alias", async () => {
  const { as } = preview();
  assert.equal(await as("member").myAlias(), null, "no alias, no card");
  assert.equal((await as("member").confirmAliasSetUp()).ok, false, "no alias to set up");
  await as("division-lead").requestAlias(ELIF);
  await as("team-leader").answerAlias(3, { kind: "created", address: "elif.kaya@politorocketteam.it" });
  assert.deepEqual(await as("member").confirmAliasSetUp(), { ok: true, value: null });
  assert.deepEqual(await as("member").myAlias(), { address: "elif.kaya@politorocketteam.it", setUp: true });
  assert.equal((await as("member").confirmAliasSetUp()).ok, false, "already set up");
  assert.equal(await as("division-lead").myAlias(), null, "Marco's own alias state is untouched");
  assert.equal(await as("non-member").myAlias(), null);
});

test("Decline closes the request and tells the requester; only an approver seat answers", async () => {
  const { as } = preview();
  assert.equal((await as("division-lead").answerAlias(1, { kind: "decline" })).ok, false);
  assert.deepEqual(await as("operations-lead").answerAlias(1, { kind: "decline" }), { ok: true, value: null });
  assert.deepEqual((await as("division-lead").memberAliases([LUCA]))[LUCA], { kind: "none", requestable: true });
  const told = (await as("division-lead").overview()).attention.map((a) => a.title);
  assert.ok(told.includes("Giulia Rossi declined the email alias for Luca Marino"), told.join(" | "));
});
