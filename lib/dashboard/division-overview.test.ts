import assert from "node:assert/strict";
import { test } from "node:test";
import { divisionOverviewOf, overviewAreasOf, type DivisionFigures } from "./division-overview";
import type { AttentionItem, DivisionOverview } from "./overview";
import { viewerStandingOf, type ActiveRoleRef, type ScopeRef, type ScopeTarget } from "./viewer";

// The division Overview built area by area (issue #471): a member granted
// some areas sees only those areas' figures, rows and panels, whatever was
// read; a division lead sees the whole board, as before.

const MSA = 3;
const now = new Date("2026-10-21T10:00:00Z");
const core: ActiveRoleRef = { type: "core", divisionId: MSA, fullAccess: null };
const grant = (target: ScopeTarget): ScopeRef => ({ scope: "division", target, level: "view" });
const member = (...targets: ScopeTarget[]) => viewerStandingOf({ scopes: targets.map(grant), activeRoles: [core] });

const notice: AttentionItem = { kind: "notice", title: "Your notice", detail: "For you", action: { label: "Dismiss", dismissNotice: 1 } };

/** Everything the board could show: every area read, as for a lead. */
const everything: DivisionFigures = {
  now,
  notices: [notice],
  positions: [{ id: 7, title: "Test Engineer", open: true, divisionName: "Mission Analysis" }],
  applications: {
    positions: [{ id: 7, title: "Test Engineer", open: true, divisionName: "Mission Analysis", newApplications: 2, oldestNew: new Date("2026-10-15T10:00:00Z") }],
    interviews: [{ applicant: "Ada Applicant", position: "Test Engineer", state: "waiting" }],
  },
  orders: { count: 3, total: 12_000 },
  members: { count: 6, divisionName: "Mission Analysis Division", withoutPhoto: ["Mia Member"] },
};

const statLabels = (overview: DivisionOverview) => overview.stats.map((s) => s.label);
const attentionKinds = (overview: DivisionOverview) => overview.attention.map((a) => a.kind);
const text = (overview: DivisionOverview) => JSON.stringify(overview);

test("a Positions-only member's Overview shows positions figures alone: no applications, interviews, orders or people (issue #471)", () => {
  const areas = overviewAreasOf(member("positions"));
  assert.deepEqual(areas, ["positions"]);
  const overview = divisionOverviewOf(areas, everything);
  assert.deepEqual(statLabels(overview), ["Open positions"]);
  assert.deepEqual(attentionKinds(overview), ["notice"], "only their own notice: no new-application or no-photo row");
  assert.deepEqual(overview.interviews, []);
  for (const leaked of ["Ada Applicant", "new application", "Mia Member", "Orders", "My division"]) {
    assert.equal(text(overview).includes(leaked), false, leaked);
  }
});

test("an Applications-only member's Overview shows new applications and interviews alone (issue #471)", () => {
  const areas = overviewAreasOf(member("applications"));
  assert.deepEqual(areas, ["applications"]);
  const overview = divisionOverviewOf(areas, everything);
  assert.deepEqual(statLabels(overview), ["New applications"]);
  assert.equal(overview.stats[0]?.value, "2");
  assert.deepEqual(attentionKinds(overview), ["applications", "notice"]);
  assert.deepEqual(overview.interviews, everything.applications?.interviews);
  for (const leaked of ["Open positions", "Orders", "My division", "Mia Member"]) assert.equal(text(overview).includes(leaked), false, leaked);
});

test("a Positions + Applications member's Overview shows both areas and nothing of Orders or Members (issue #471)", () => {
  const areas = overviewAreasOf(member("positions", "applications"));
  assert.deepEqual(areas, ["positions", "applications"]);
  const overview = divisionOverviewOf(areas, everything);
  assert.deepEqual(statLabels(overview), ["New applications", "Open positions"]);
  assert.deepEqual(attentionKinds(overview), ["applications", "notice"]);
  assert.equal(overview.interviews.length, 1);
  for (const leaked of ["Orders", "My division", "Mia Member"]) assert.equal(text(overview).includes(leaked), false, leaked);
});

test("an Orders-only or a Members-only member's Overview shows that area alone (issue #471)", () => {
  const orders = divisionOverviewOf(overviewAreasOf(member("orders")), everything);
  assert.deepEqual(statLabels(orders), ["Orders"]);
  assert.deepEqual(attentionKinds(orders), ["notice"]);
  assert.deepEqual(orders.interviews, []);
  const members = divisionOverviewOf(overviewAreasOf(member("members")), everything);
  assert.deepEqual(statLabels(members), ["My division"]);
  assert.deepEqual(attentionKinds(members), ["no-photo", "notice"]);
  assert.deepEqual(members.interviews, []);
});

test("an area left unread adds nothing, and a figure read for an ungranted area is dropped (issue #471)", () => {
  const unread = divisionOverviewOf(["positions"], { now, notices: [] });
  assert.deepEqual(unread.stats, []);
  assert.deepEqual(unread.attention, []);
  assert.deepEqual(divisionOverviewOf([], everything).stats, []);
});

test("a division lead reads every area, so their Overview is the whole board, as before", () => {
  const lead = viewerStandingOf({ scopes: [], activeRoles: [{ type: "lead", divisionId: MSA, fullAccess: null }] });
  const areas = overviewAreasOf(lead);
  assert.deepEqual(areas, ["positions", "applications", "members", "orders"]);
  const overview = divisionOverviewOf(areas, everything);
  assert.deepEqual(statLabels(overview), ["New applications", "Open positions", "Orders", "My division"]);
  assert.deepEqual(overview.stats.map((s) => s.value), ["2", "1", "3 waiting", "6"]);
  assert.deepEqual(attentionKinds(overview), ["applications", "no-photo", "notice"]);
  assert.equal(overview.interviews.length, 1);
});

test("a member with a grant on every area sees the whole board over their grants", () => {
  assert.deepEqual(statLabels(divisionOverviewOf(overviewAreasOf(member("all")), everything)), ["New applications", "Open positions", "Orders", "My division"]);
});
