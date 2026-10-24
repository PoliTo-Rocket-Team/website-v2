import "./access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import type { DashboardData } from "./data";
import { openDashboard } from "./open";
import type { TeamSideOverview } from "./overview";
import { accountOf, seedFixture } from "./access-matrix/fixture";
import { signInAs } from "./access-matrix/session";

// One Overview for every team seat on the database path (issue #593): the
// plain member, a member with one grant, a division lead, a department head
// and the team leader all get the same board. Each keeps the personal panels
// (the profile header with Edit profile, "Your page on the site" and their
// division's roster), and anyone holding a grant gets "Your access" listing
// it. Only the figures, rows and panels their scope reads differ. It runs on
// the access matrix's in-memory database (./access-matrix/install.ts).

async function overviewOf(name: string): Promise<TeamSideOverview> {
  seedFixture();
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  return (opening as { data: DashboardData }).data.overview();
}

/** The personal panels every seat keeps (board 52). */
function personal(overview: TeamSideOverview) {
  return {
    edit: overview.person.edit?.label,
    checklist: overview.checklist.title,
    rosters: overview.rosters.map((r) => r.title),
  };
}

const SEATS = ["member", "member with a positions grant across the team", "division lead", "department head", "team leader"] as const;

test("every team seat gets the personal panels: profile with Edit profile, Your page on the site, and their division's roster", async () => {
  const expected: Record<(typeof SEATS)[number], readonly string[]> = {
    member: ["Mission Analysis"],
    "member with a positions grant across the team": ["Mission Analysis"],
    "division lead": ["Mission Analysis"],
    // The head's and the team leader's roles name no division, so there is no roster to show.
    "department head": [],
    "team leader": [],
  };
  for (const seat of SEATS) {
    assert.deepEqual(personal(await overviewOf(seat)), { edit: "Edit profile", checklist: "Your page on the site", rosters: expected[seat] }, seat);
  }
});

test("a member gets the division board a lead gets, with only the areas they are granted", async () => {
  const plain = await overviewOf("member");
  assert.equal(plain.shape, "division");
  assert.deepEqual(plain.stats, [], "a plain member reads no area, so no figure");
  const granted = await overviewOf("member with a positions grant across the team");
  assert.equal(granted.shape, "division");
  assert.deepEqual(granted.stats.map((s) => s.label), ["Open positions"]);
  const lead = await overviewOf("division lead");
  assert.equal(lead.shape, "division");
  assert.deepEqual(lead.stats.map((s) => s.label), ["New applications", "Open positions", "Orders", "My division"]);
});

test("the plain member keeps the access hint; a seat with no grant and its own areas gets neither hint nor lines", async () => {
  assert.deepEqual((await overviewOf("member")).access, { kind: "hint" });
  for (const seat of ["division lead", "department head", "team leader"]) assert.deepEqual((await overviewOf(seat)).access, { kind: "none" }, seat);
});

test("Your access lists each grant the seat holds, a lead's and a head's included", async () => {
  const lines = async (name: string) => {
    const { access } = await overviewOf(name);
    return access.kind === "lines" ? access.lines.map((l) => l.area) : access.kind;
  };
  assert.deepEqual(await lines("member with a positions grant across the team"), ["positions"]);
  assert.deepEqual(await lines("member with a Content grant"), ["content"]);
  assert.deepEqual(await lines("member with Approve orders"), ["approve-orders"]);
  assert.deepEqual(await lines("division lead with a Content grant"), ["content"]);
  assert.deepEqual(await lines("division lead with Approve orders"), ["approve-orders"]);
  assert.deepEqual(await lines("department head with Approve orders"), ["approve-orders"]);
  assert.deepEqual(await lines("department head with a Positions grant in DM"), ["positions"]);
});

test("a Content grant has no figure card and still shows under Your access", async () => {
  const content = await overviewOf("member with a Content grant");
  assert.deepEqual(content.stats, []);
  assert.deepEqual(content.access.kind === "lines" ? content.access.lines.map((l) => l.area) : content.access.kind, ["content"]);
});

test("a lead's grant line counts the grant's own units, not the division they lead", async () => {
  const { access } = await overviewOf("division lead with a Positions grant (Can edit) in DM");
  assert.ok(access.kind === "lines", access.kind);
  assert.deepEqual(access.lines, [{ area: "positions", href: "/dashboard/positions", open: 1, divisions: 1 }]);
});

test("the Members figure names the scope it counts: the viewer's division, a department, or the whole team", async () => {
  /** The Members figure, beside the people the "Your access" Members line counts over the same units. */
  const members = async (name: string) => {
    const overview = await overviewOf(name);
    const line = overview.access.kind === "lines" ? overview.access.lines.find((l) => l.area === "members") : undefined;
    const figure = overview.stats.at(-1);
    return { label: figure?.label, detail: figure?.detail.replace(/^people /, ""), counted: line?.area === "members" ? String(line.people) : figure?.value, value: figure?.value };
  };
  const lead = await members("division lead");
  assert.deepEqual([lead.label, lead.detail], ["My division", "in Mission Analysis"]);
  for (const [name, label, detail] of [
    ["member with a members grant across the division", "My division", "in Mission Analysis"],
    ["member with a members grant across the department", "Department", "in Aerodynamics"],
    ["member with a members grant across the team", "Team", "on the team"],
  ] as const) {
    const figure = await members(name);
    assert.deepEqual([figure.label, figure.detail], [label, detail], name);
    assert.equal(figure.value, figure.counted, `${name}: the figure counts the people its grant covers`);
  }
});
