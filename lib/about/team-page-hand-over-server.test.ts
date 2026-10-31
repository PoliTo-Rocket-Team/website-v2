// The public read and the Team tree's writes import server-only modules; the access matrix's stand-ins let them load outside Next.
import "@/lib/dashboard/access-matrix/install";

import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { handOverRequests, members, roles, teamPageLayerVersions, users } from "@/db/schema";
import { advisorRowsOf } from "@/lib/about/advisors";
import { accountOf, EXTRA, IDS, seedFixture } from "@/lib/dashboard/access-matrix/fixture";
import { signInAs } from "@/lib/dashboard/access-matrix/session";
import { addRows, tableRows, testDb, writesByTransaction } from "@/lib/dashboard/access-matrix/test-database";
import type { DashboardData } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { queryTeamSnapshot, teamRolesOf } from "@/lib/dashboard/team-snapshot";
import { teamPageData } from "./team-data";
import { NO_TEAM_LAYER } from "./team-layer";
import { holdingOf, layoutSeats, parseTeamLayout, resolveLayout, sameBinding, snapshot, type PageSeat, type PlaceBinding, type TeamLayout } from "./team-layout";
import type { TeamPage } from "./types";

// A Team tree hand-over and the Team page's stored layout (issue #852, ADR
// 0019 Decision 3), on the migrated in-memory Postgres: a hand-over of a
// team-level seat with no flag moves the page seats bound to the ended row
// onto the successor's row, in the draft and the published layout and in the
// same batch, so the public page shows the successor in place; every other
// hand-over writes nothing to the layout and still shows the new holder in
// place; a seat with no flag ended with no successor leaves the page and the
// editor, and the next save drops its page seats.

const SINCE = "2025-10-01";
const HOLDER = 9_401;
const SEAT = 9_500;
const SEAT_TITLE = "Safety Officer";
const TEAM_LEADER = accountOf("team leader").userId;

const seatBinding: PlaceBinding = { kind: "team-seat", roleId: SEAT };
const holderBinding: PlaceBinding = { kind: "person", memberId: HOLDER };

const rolesNow = async () => teamRolesOf(await queryTeamSnapshot(testDb));

/** The seat of the layout bound to `binding`. */
function seatBoundTo(layout: TeamLayout, binding: PlaceBinding): PageSeat {
  const seat = layoutSeats(layout).find((s) => sameBinding(s.binding, binding));
  assert.ok(seat, `the layout holds a page seat bound to ${JSON.stringify(binding)}`);
  return seat;
}

/** The stored layouts, by version. */
async function storedLayouts(): Promise<Record<string, TeamLayout | null>> {
  return Object.fromEntries((await tableRows(teamPageLayerVersions)).map((r) => [r.version as string, parseTeamLayout(r.layout)]));
}

/**
 * Stores a published and a draft version, each with the layout the team
 * snapshots to now, and a place on the draft's arc bound to the seat's holder
 * as a person (#846 R4.1). Answers the published layout.
 */
async function storeLayouts(): Promise<TeamLayout> {
  const { layout } = snapshot(await rolesNow(), NO_TEAM_LAYER);
  const nextId = Math.max(...layoutSeats(layout).map((s) => s.id), ...layout.departments.map((b) => b.id)) + 1;
  const draft: TeamLayout = { ...layout, arc: [...layout.arc, { id: nextId, binding: holderBinding, overrides: { role: "Ambassador" } }] };
  await addRows(teamPageLayerVersions, [
    { version: "published", layer: NO_TEAM_LAYER, layout },
    { version: "draft", layer: NO_TEAM_LAYER, layout: draft },
  ]);
  return layout;
}

beforeEach(async () => {
  await seedFixture();
  await addRows(members, [{ memberId: HOLDER, ndaSignedAt: SINCE }]);
  await addRows(users, [{ id: "seat-holder", email: "seat-holder@mail.test", firstName: "Seat", lastName: "Holder", member: HOLDER, createdAt: SINCE }]);
  await addRows(roles, [{ id: SEAT, memberId: HOLDER, title: SEAT_TITLE, startedAt: SINCE, type: "core", fullAccess: null }]);
});

test("a hand-over of a team-level seat with no flag binds its page seats to the successor's row in both layouts, in the hand-over's batch", async () => {
  const published = await storeLayouts();
  const before = await teamPageData();
  assert.ok(before.orgChart.leaders.some((l) => l.name === "Seat Holder"), "the page shows the seat's holder");
  signInAs(TEAM_LEADER);
  const writesBefore = (await writesByTransaction()).length;

  assert.deepEqual(await teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "advisor" }), { ok: true });

  const successorRow = (await tableRows(roles)).find((r) => r.memberId === EXTRA.mover && r.title === SEAT_TITLE && r.leavedAt === null);
  assert.ok(typeof successorRow?.id === "number", "the successor holds a new seat row");
  const moved: PlaceBinding = { kind: "team-seat", roleId: successorRow.id };
  const layouts = await storedLayouts();
  for (const version of ["published", "draft"]) {
    const layout = layouts[version];
    assert.ok(layout, `${version}: a layout is stored`);
    assert.ok(!layoutSeats(layout).some((s) => sameBinding(s.binding, seatBinding)), `${version}: no page seat is bound to the ended row`);
    assert.equal(seatBoundTo(layout, moved).id, seatBoundTo(published, seatBinding).id, `${version}: the same page seat is bound to the successor's row`);
  }
  assert.deepEqual(seatBoundTo(layouts.draft!, holderBinding).binding, holderBinding, "a person-bound place stays its person's");

  const batches = (await writesByTransaction()).slice(writesBefore);
  assert.equal(batches.length, 1, "one batch");
  const tables = new Set(batches[0].map((w) => w.table));
  assert.ok(tables.has("roles") && tables.has("team_page_layer_versions"), "the hand-over and the layout move land together");

  const after = await teamPageData();
  assert.deepEqual(
    after.orgChart.leaders.map((l) => l.name),
    before.orgChart.leaders.map((l) => (l.name === "Seat Holder" ? "Mover Twice" : l.name)),
    "the successor shows in the seat's place with no editor action",
  );
});

/**
 * Hands the seat over to `successor`, who is drawn in another role on the
 * team record, and checks the handed-over page seat shows them on the public
 * page and in the editor, and that the next save keeps it. Answers the page.
 */
async function handOverToSomeoneDrawnElsewhere(successor: number): Promise<TeamPage> {
  const published = await storeLayouts();
  const seatId = seatBoundTo(published, seatBinding).id;
  signInAs(TEAM_LEADER);
  assert.deepEqual(await teamActions.changeSeatHolder(SEAT, { to: successor, outcome: "advisor" }), { ok: true });

  const successorRow = (await tableRows(roles)).find((r) => r.memberId === successor && r.title === SEAT_TITLE && r.leavedAt === null);
  assert.ok(typeof successorRow?.id === "number", "the successor holds a new seat row");
  const moved: PlaceBinding = { kind: "team-seat", roleId: successorRow.id };
  const person = (await rolesNow()).people.find((p) => p.id === successor);
  assert.ok(person, "the successor is on the team");
  assert.ok(!(person.placement.role === "board" && person.placement.seat.roleId === successorRow.id), "the successor is drawn in another role");

  const page = await teamPageData();
  assert.ok(
    page.orgChart.leaders.some((l) => l.name === person.name && l.role === SEAT_TITLE),
    "the public page shows the successor in the seat's place with no editor action",
  );

  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  const { teamPage, teamAdvisors } = (opening as { data: DashboardData }).data;
  const opened = await teamPage.open();
  assert.ok(opened);
  assert.equal(seatBoundTo(opened.content.layout, moved).id, seatId);
  const drawn = resolveLayout(opened.content.layout, opened.roles).leaders.find((l) => l.at === seatId);
  assert.equal(drawn?.shown.name, person.name, "the editor draws the successor in the seat's place");

  const saved = await teamPage.save("publish", opened.content, advisorRowsOf((await teamAdvisors.list()) ?? []));
  assert.ok(saved.ok, JSON.stringify(saved));
  const stored = (await storedLayouts()).published;
  assert.ok(stored);
  assert.equal(seatBoundTo(stored, moved).id, seatId, "the next save keeps the page seat");
  assert.ok((await teamPageData()).orgChart.leaders.some((l) => l.name === person.name && l.role === SEAT_TITLE), "and the page still shows it");
  return page;
}

test("a hand-over of a team-level seat with no flag to the team leader shows them in the seat's place, and the next save keeps it", async () => {
  const leader = accountOf("team leader").memberId;
  assert.ok(leader !== null);
  const page = await handOverToSomeoneDrawnElsewhere(leader);
  const name = (await rolesNow()).people.find((p) => p.id === leader)?.name;
  assert.equal(page.orgChart.leader?.name, name, "they still show as the team leader");
});

test("a hand-over of a team-level seat with no flag to someone who holds another team-level seat shows them in both places, and the next save keeps it", async () => {
  const manager = accountOf("Project Manager").memberId;
  assert.ok(manager !== null);
  const page = await handOverToSomeoneDrawnElsewhere(manager);
  const name = (await rolesNow()).people.find((p) => p.id === manager)?.name;
  assert.ok(page.orgChart.leaders.some((l) => l.name === name && l.role !== SEAT_TITLE), "they still show in their own seat's place");
});

test("a hand-over of a team-level seat no stored page seat is bound to writes nothing to the layout", async () => {
  const { layout } = snapshot(await rolesNow(), NO_TEAM_LAYER);
  const without: TeamLayout = { ...layout, arc: layout.arc.filter((s) => !sameBinding(s.binding, seatBinding)) };
  await addRows(teamPageLayerVersions, [{ version: "published", layer: NO_TEAM_LAYER, layout: without }]);
  const stored = await tableRows(teamPageLayerVersions);
  signInAs(TEAM_LEADER);
  assert.deepEqual(await teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "advisor" }), { ok: true });
  assert.deepEqual(await tableRows(teamPageLayerVersions), stored);
});

test("a hand-over with no stored layout yet writes none, and the page draws its derived layout", async () => {
  await addRows(teamPageLayerVersions, [{ version: "published", layer: NO_TEAM_LAYER, layout: null }]);
  const stored = await tableRows(teamPageLayerVersions);
  signInAs(TEAM_LEADER);
  assert.deepEqual(await teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "advisor" }), { ok: true });
  assert.deepEqual(await tableRows(teamPageLayerVersions), stored);
  assert.ok((await teamPageData()).orgChart.leaders.some((l) => l.name === "Mover Twice"));
});

test("a Team page save that lands between the hand-over's read and its batch refuses the hand-over, and nothing is written", async () => {
  await storeLayouts();
  signInAs(TEAM_LEADER);
  const batch = testDb.batch;
  testDb.batch = async (queries) => {
    testDb.batch = batch;
    // Another save replaces the layer rows, as every Team page save does.
    const rows = await tableRows(teamPageLayerVersions);
    await testDb.delete(teamPageLayerVersions);
    await testDb.insert(teamPageLayerVersions).values(rows.map(({ version, layer, layout }) => ({ version, layer, layout })) as never);
    return batch(queries);
  };
  try {
    assert.deepEqual(await teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "advisor" }), {
      ok: false,
      error: "The Team page was saved while this ran. Try again.",
    });
  } finally {
    testDb.batch = batch;
  }
  assert.ok((await tableRows(roles)).some((r) => r.id === SEAT && r.leavedAt === null), "the seat is still held");
  assert.deepEqual(seatBoundTo((await storedLayouts()).published!, seatBinding).binding, seatBinding);
});

test("a Team page save that binds a page seat to the ended row between the hand-over's read and its batch refuses the hand-over, and nothing is written", async () => {
  const { layout } = snapshot(await rolesNow(), NO_TEAM_LAYER);
  const without: TeamLayout = { ...layout, arc: layout.arc.filter((s) => !sameBinding(s.binding, seatBinding)) };
  await addRows(teamPageLayerVersions, [{ version: "published", layer: NO_TEAM_LAYER, layout: without }]);
  signInAs(TEAM_LEADER);
  const batch = testDb.batch;
  testDb.batch = async (queries) => {
    testDb.batch = batch;
    // Another save replaces the layer rows with a layout that binds a page seat to the seat's row.
    await testDb.delete(teamPageLayerVersions);
    await testDb.insert(teamPageLayerVersions).values({ version: "published", layer: NO_TEAM_LAYER, layout });
    return batch(queries);
  };
  try {
    assert.deepEqual(await teamActions.changeSeatHolder(SEAT, { to: EXTRA.mover, outcome: "advisor" }), {
      ok: false,
      error: "The Team page was saved while this ran. Try again.",
    });
  } finally {
    testDb.batch = batch;
  }
  const rows = await tableRows(roles);
  assert.ok(rows.some((r) => r.id === SEAT && r.leavedAt === null), "the seat is still held");
  assert.ok(!rows.some((r) => r.memberId === EXTRA.mover && r.title === SEAT_TITLE), "the successor holds no seat row");
  assert.deepEqual(seatBoundTo((await storedLayouts()).published!, seatBinding).binding, seatBinding, "the saved page seat is still bound to the held seat");
});

/** The page seat bound to `binding` in the stored published layout shows `memberId` on the team now. */
async function shows(binding: PlaceBinding, memberId: number): Promise<void> {
  const layout = (await storedLayouts()).published;
  assert.ok(layout);
  assert.equal(holdingOf(seatBoundTo(layout, binding).binding, await rolesNow())?.person.id, memberId);
}

test("a hand-over of the team leader, a full-access seat, a department head or a division lead writes nothing to the layout and shows the new holder in place", async () => {
  const STRUCTURES = IDS.department("DM");
  const DM = IDS.division("DM");
  const MEMBER = IDS.person("DM");
  const cases: readonly { name: string; binding: PlaceBinding; successor: number; handOver: () => Promise<{ ok: boolean }> }[] = [
    {
      name: "the team leader",
      binding: { kind: "team-leader" },
      successor: MEMBER,
      handOver: () => (signInAs(TEAM_LEADER), teamActions.handOverTeamLeader({ to: MEMBER, outcome: "advisor" })),
    },
    {
      name: "a full-access seat",
      binding: { kind: "full-access-seat", seat: "project-manager" },
      successor: EXTRA.mover,
      handOver: async () => {
        signInAs(TEAM_LEADER);
        const row = (await tableRows(roles)).find((r) => r.memberId === accountOf("Project Manager").memberId && r.leavedAt === null && r.deptId === null && r.divisionId === null);
        return teamActions.changeSeatHolder(row!.id as number, { to: EXTRA.mover, outcome: "advisor" });
      },
    },
    {
      name: "a department head",
      binding: { kind: "department-head", departmentId: STRUCTURES },
      successor: MEMBER,
      handOver: async () => {
        await addRows(handOverRequests, [{ id: 99, fromId: EXTRA.head, role: "head", deptId: STRUCTURES, toId: MEMBER, outcome: "advisor", createdAt: new Date().toISOString() }]);
        signInAs(TEAM_LEADER);
        return actions.answerHandOver(99, "confirm");
      },
    },
    {
      name: "a division lead",
      binding: { kind: "division-lead", divisionId: DM, place: 0 },
      successor: MEMBER,
      handOver: () => (signInAs("head-str"), actions.answerHandOver(IDS.handOver("DM"), "confirm")),
    },
  ];
  for (const { name, binding, successor, handOver } of cases) {
    await seedFixture();
    await storeLayouts();
    const stored = await tableRows(teamPageLayerVersions);
    assert.equal((await handOver()).ok, true, name);
    assert.deepEqual(await tableRows(teamPageLayerVersions), stored, `${name}: the layout rows are as they were`);
    await shows(binding, successor);
  }
});

test("a team-level seat with no flag ended with no successor leaves the public page and the editor, and the next save drops its page seats", async () => {
  await storeLayouts();
  signInAs(TEAM_LEADER);
  assert.deepEqual(await teamActions.removeSeat(SEAT), { ok: true });
  assert.ok(!(await teamPageData()).orgChart.leaders.some((l) => l.name === "Seat Holder"), "not on the public page");

  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  const { teamPage, teamAdvisors } = (opening as { data: DashboardData }).data;
  const opened = await teamPage.open();
  assert.ok(opened);
  const seatId = seatBoundTo(opened.content.layout, seatBinding).id;
  const drawn = resolveLayout(opened.content.layout, opened.roles);
  assert.ok(!drawn.leaders.some((l) => l.at === seatId), "the seat's page seat is not drawn in the editor");
  assert.ok(drawn.leaders.some((l) => l.shown.name === "Seat Holder"), "the place bound to the holder as a person still shows them, an advisor now");

  const saved = await teamPage.save("publish", opened.content, advisorRowsOf((await teamAdvisors.list()) ?? []));
  assert.ok(saved.ok, JSON.stringify(saved));
  for (const [version, layout] of Object.entries(await storedLayouts())) {
    if (layout === null) continue;
    assert.ok(!layoutSeats(layout).some((s) => sameBinding(s.binding, seatBinding)), `${version}: no page seat bound to the ended row`);
  }
});
