import assert from "node:assert/strict";
import { test } from "node:test";
import type { ApplyData } from "@/lib/apply/data";
import { applyListing, isPublic, positionCode, positionIdFromSlug, positionSlug } from "@/lib/apply/positions";
import type { TestViewer } from "@/lib/dashboard/viewer";
import { dummyApplyData, SentApplications } from "./apply";
import { dummyDashboardData } from "./index";
import { DEFAULT_DUMMY_RECRUITMENT } from "./recruitment";
import { EMPTY_DUMMY_STATE, parseDummyState, serializeDummyState, type DummyState } from "./state";
import { positions } from "./team";

// Issue #463: in dummy mode, a position the test developer posts, opens or
// closes on the dashboard is kept in the state cookie, and /apply and the
// position page read that same cookie. Each test writes through the dummy
// dashboard, takes the cookie value it saved, and reads the dummy /apply
// over that cookie read back.


/** The dummy dashboard of one test developer, keeping what a write saves as the state cookie does. */
function dashboard(viewer: TestViewer, state: DummyState = EMPTY_DUMMY_STATE) {
  let saved = state;
  const data = dummyDashboardData(
    viewer,
    { current: DEFAULT_DUMMY_RECRUITMENT, save: async () => {} },
    { current: state, save: async (next) => void (saved = next) },
  );
  return { data, cookie: () => serializeDummyState(saved) };
}

/** /apply's data for a request carrying this state cookie. */
function applyWith(stateCookie: string | null): ApplyData {
  return dummyApplyData("team-leader", null, DEFAULT_DUMMY_RECRUITMENT, new SentApplications(), undefined, undefined, parseDummyState(stateCookie));
}

const NEW_ROLE = {
  divisionId: 1,
  title: "Propulsion Test Engineer",
  description: "You plan the static fires and read their data.",
  required: ["Basic thermodynamics"],
  desirable: ["LabVIEW"],
  questions: ["Which test campaigns have you run?"],
  motivationLetter: false,
  open: true,
};

test("a position the team leader posts open is listed on /apply, with its code, under its division", async () => {
  const leader = dashboard("team-leader");
  const created = await leader.data.createPosition(NEW_ROLE);
  assert.ok(created.ok);
  if (!created.ok) return;

  const listed = await applyWith(leader.cookie()).publicPositions();
  const row = listed.find((p) => p.id === created.value.id);
  assert.ok(row, "the posted role is listed");
  assert.equal(positionCode(row), created.value.code);
  assert.equal(row.div_name, "Mission Analysis");
  assert.equal(row.description, NEW_ROLE.description);
  assert.deepEqual(row.custom_questions, NEW_ROLE.questions);

  const listing = applyListing(listed);
  const roles = listing.kind === "closed" ? [] : listing.open.flatMap((g) => g.roles);
  const role = roles.find((r) => r.code === created.value.code);
  assert.equal(role?.title, NEW_ROLE.title);
  assert.equal(role?.division, "Mission Analysis");

  // The prerendered page stands for a request with no cookie: it still lists the arrays alone.
  assert.ok(!(await applyWith(null).publicPositions()).some((p) => p.id === created.value.id));
});

test("a base position opened on the dashboard is listed on /apply, and an open one closed there is not", async () => {
  const closedBase = positions.find((p) => !p.open)!;
  const openBase = positions.find((p) => p.open)!;
  const before = await applyWith(null).publicPositions();
  assert.ok(!before.some((p) => p.id === closedBase.id));
  assert.ok(before.some((p) => p.id === openBase.id));

  const opened = dashboard("team-leader");
  await opened.data.setPositionOpen(closedBase.id, true);
  assert.ok((await applyWith(opened.cookie()).publicPositions()).some((p) => p.id === closedBase.id), "the opened role is listed");

  const closed = dashboard("team-leader");
  await closed.data.setPositionOpen(openBase.id, false);
  assert.ok(!(await applyWith(closed.cookie()).publicPositions()).some((p) => p.id === openBase.id), "the closed role is not listed");
});

test("the /apply/<slug> page of a posted position resolves for the same request", async () => {
  const leader = dashboard("team-leader");
  const created = await leader.data.createPosition(NEW_ROLE);
  assert.ok(created.ok);
  if (!created.ok) return;

  const data = applyWith(leader.cookie());
  const listed = (await data.publicPositions()).find((p) => p.id === created.value.id)!;
  const id = positionIdFromSlug(positionSlug(listed));
  assert.equal(id, created.value.id);

  // The position page reads `shownPosition`; the submit reads `position`.
  for (const read of [data.shownPosition(id!), data.position(id!)]) {
    const found = await read;
    assert.ok(found, "found, not not-found");
    assert.equal(found.position.title, NEW_ROLE.title);
    assert.ok(isPublic(found.position, found.recruitment));
  }
  assert.equal(await applyWith(null).shownPosition(id!), null, "without the cookie the role does not exist");
});

test("a posted role whose division the arrays do not have is left off /apply", async () => {
  const forged = serializeDummyState({
    ...EMPTY_DUMMY_STATE,
    newPositions: [{ id: 99, title: "Ghost", divisionId: 999, open: true, motivationLetter: false, createdAt: "2026-10-01T09:00:00.000Z" }],
  });
  const data = applyWith(forged);
  assert.ok(!(await data.publicPositions()).some((p) => p.id === 99));
  assert.equal(await data.shownPosition(99), null);
});
