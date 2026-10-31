// The public read imports server-only modules; the access matrix's stand-ins let it load outside Next.
import "@/lib/dashboard/access-matrix/install";

import assert from "node:assert/strict";
import { test } from "node:test";
import { departments, divisions, roles, teamPageLayerVersions, users } from "@/db/schema";
import { advisorRowsOf } from "@/lib/about/advisors";
import { accountOf, seedFixture } from "@/lib/dashboard/access-matrix/fixture";
import { signInAs } from "@/lib/dashboard/access-matrix/session";
import { addRows, changeRows, tableRows, testDb } from "@/lib/dashboard/access-matrix/test-database";
import { seeded } from "@/lib/dashboard/access-matrix/whole-seed";
import type { DashboardData } from "@/lib/dashboard/data";
import { openDashboard } from "@/lib/dashboard/open";
import { queryTeamSnapshot, teamRolesOf } from "@/lib/dashboard/team-snapshot";
import { teamPageData } from "./team-data";
import { NO_TEAM_LAYER, type TeamPageLayer } from "./team-layer";
import { parseTeamLayout, snapshot, type TeamLayout } from "./team-layout";
import { teamBuildOf } from "./team-roles";
import type { TeamPage } from "./types";

// The public /about/the-team read on the stored layout (issue #850), on the
// migrated in-memory Postgres holding the whole seed
// (lib/dashboard/access-matrix/whole-seed.ts): Team tree changes leave the
// page's seats and core members as they were, a seat with no holder or whose
// team seat is gone is not drawn, and a save stores the layer with its
// snapshot layout in one row.

const ROLE_DAY = "2026-10-30";

/** The seats a page draws: the leader, the arc and every department block. */
const seatsOf = (page: TeamPage) => ({ leader: page.orgChart.leader, leaders: page.orgChart.leaders, groups: page.departments.groups });

async function publishedLayout(): Promise<TeamLayout> {
  const row = (await tableRows(teamPageLayerVersions)).find((r) => r.version === "published");
  const layout = parseTeamLayout(row?.layout);
  assert.ok(layout, "the seeded published version holds a layout");
  return layout;
}

type RoleRow = { id: number; memberId: number | null; title: string | null; type: string | null; divisionId: number | null; deptId: number | null; leavedAt: string | null; fullAccess: string | null };
type DivisionRow = { id: number; deptId: number | null; closedAt: string | null };

async function nameOf(memberId: number): Promise<string> {
  const user = (await tableRows(users)).find((u) => u.member === memberId);
  assert.ok(user, `member ${memberId} has a user row`);
  return [user.firstName, user.lastName].filter(Boolean).join(" ");
}

/** The page the published version draws with its stored layout set aside: the layout derived from its layer on the roles as they stand. */
async function derivedPage(): Promise<TeamPage> {
  const stored = (await tableRows(teamPageLayerVersions)).find((r) => r.version === "published")?.layout;
  await changeRows(teamPageLayerVersions, { version: "published" }, { layout: null });
  try {
    return await teamPageData();
  } finally {
    await changeRows(teamPageLayerVersions, { version: "published" }, { layout: stored });
  }
}

/** The team-level seats in the order the Team tree draws them, read from the roles as they stand now. */
async function boardArc() {
  return teamBuildOf(teamRolesOf(await queryTeamSnapshot(testDb))).arc.flatMap(({ person: { placement } }) => (placement.role === "board" ? [placement.seat] : []));
}

const leadDivisions =(layout: TeamLayout) =>
  layout.departments.flatMap((b) => b.leads.flatMap((l) => (l.binding.kind === "division-lead" ? [l.binding.divisionId] : [])));
const headDepartments = (layout: TeamLayout) => layout.departments.flatMap((b) => (b.head.binding.kind === "department-head" ? [b.head.binding.departmentId] : []));

test("adding, removing, moving or reordering a seat in the Team tree leaves the public page's seats and core members unchanged", async () => {
  await seeded();
  const before = await teamPageData();
  const layout = await publishedLayout();
  const roleRows = (await tableRows(roles)) as RoleRow[];
  const divisionRows = (await tableRows(divisions)) as DivisionRow[];
  const active = roleRows.filter((r) => r.leavedAt === null);
  const drawnLeads = leadDivisions(layout);
  const drawnHeads = headDepartments(layout);

  // Added: a new department, and a new division under a department the page shows, led by a lead the page already shows.
  const shownLead = active.find((r) => r.type === "lead" && r.divisionId !== null && drawnLeads.includes(r.divisionId))!;
  assert.ok(shownLead, "the page shows a seeded division lead");
  await addRows(departments, [{ name: "Payload", code: "PAY", startedAt: ROLE_DAY, kind: "technical" }]);
  await addRows(divisions, [{ name: "Wind Tunnel", code: "WTN", deptId: drawnHeads[0], startedAt: ROLE_DAY }]);
  const added = ((await tableRows(divisions)) as (DivisionRow & { name: string })[]).find((d) => d.name === "Wind Tunnel")!;
  await addRows(roles, [{ memberId: shownLead.memberId, deptId: added.deptId, divisionId: added.id, title: "Second lead", startedAt: ROLE_DAY, type: "lead" }]);

  // Moved: a division whose lead the page shows, under another department the page shows.
  const movedDivision = divisionRows.find((d) => d.id !== shownLead.divisionId && drawnLeads.includes(d.id))!;
  const target = drawnHeads.find((id) => id !== movedDivision.deptId)!;
  await changeRows(divisions, { id: movedDivision.id }, { deptId: target });

  // Reordered: two unflagged team-level seats, which the Team tree orders by start date (the flagged two keep their place), and the later one now starts first.
  // The seed seats none, so two division members gain one each, under the title they already show as core members.
  const coreOnly = active.filter((r) => r.type === "core" && r.divisionId !== null && active.filter((o) => o.memberId === r.memberId).length === 1);
  assert.ok(coreOnly.length >= 2, "the seed has two people who are only division members");
  await addRows(roles, [
    { memberId: coreOnly[0].memberId, title: coreOnly[0].title, startedAt: "2026-10-01", type: "core" },
    { memberId: coreOnly[1].memberId, title: coreOnly[1].title, startedAt: ROLE_DAY, type: "core" },
  ]);
  const unflagged = async () => (await boardArc()).filter((seat) => seat.flag === null).map((seat) => seat.roleId);
  const [first, second] = await unflagged();
  assert.ok(first !== undefined && second !== undefined, "the Team tree holds two unflagged team-level seats");
  assert.deepEqual(seatsOf(await teamPageData()), seatsOf(before));
  const derivedBefore = await derivedPage();
  await changeRows(roles, { id: second }, { startedAt: "2000-01-01" });
  const [nowFirst, nowSecond] = await unflagged();
  assert.deepEqual([nowFirst, nowSecond], [second, first], "the Team tree's own seat order reversed");
  assert.notDeepEqual((await derivedPage()).orgChart.leaders, derivedBefore.orgChart.leaders, "without a stored layout the reorder moves the arc");
  const reordered = await teamPageData();
  assert.deepEqual(seatsOf(reordered), seatsOf(before));
  assert.deepEqual(reordered.coreMembers.members, before.coreMembers.members);

  // Removed: a division whose lead the page does not show.
  const hidden = divisionRows.find((d) => d.closedAt === null && !drawnLeads.includes(d.id) && active.some((r) => r.type === "lead" && r.divisionId === d.id))!;
  assert.ok(hidden, "a seeded division has a lead the page hides");
  await changeRows(divisions, { id: hidden.id }, { closedAt: ROLE_DAY });

  const after = await teamPageData();
  assert.deepEqual(seatsOf(after), seatsOf(before));
  assert.deepEqual(after.coreMembers.members, before.coreMembers.members);

  // The same changes on a version with no layout: the layout its layer snapshots to on the changed team, which does follow them.
  await changeRows(teamPageLayerVersions, { version: "published" }, { layout: null });
  assert.notDeepEqual(seatsOf(await teamPageData()), seatsOf(before), "without a stored layout the page follows the Team tree");
});

test("a page seat whose bound seat has no holder, or whose team seat is gone, is not drawn on /about/the-team", async () => {
  await seeded();
  const before = await teamPageData();
  const roleRows = (await tableRows(roles)) as RoleRow[];

  // No holder: the Chief Engineer's seat is left with no one in it.
  const engineer = roleRows.find((r) => r.fullAccess === "chief_engineer" && r.leavedAt === null)!;
  const engineerName = await nameOf(engineer.memberId!);
  assert.ok(before.orgChart.leaders.some((l) => l.name === engineerName));
  await changeRows(roles, { id: engineer.id }, { leavedAt: ROLE_DAY });
  const noHolder = await teamPageData();
  assert.deepEqual(noHolder.orgChart.leaders, before.orgChart.leaders.filter((l) => l.name !== engineerName));
  assert.deepEqual(noHolder.orgChart.leader, before.orgChart.leader);
  assert.deepEqual(noHolder.departments.groups, before.departments.groups);
  assert.ok(parseTeamLayout((await tableRows(teamPageLayerVersions))[0].layout), "the layout still holds the seat");

  // Gone: a department whose head the page shows is closed.
  const departmentId = headDepartments(await publishedLayout())[0];
  const head = roleRows.find((r) => r.type === "head" && r.deptId === departmentId && r.leavedAt === null)!;
  const headName = await nameOf(head.memberId!);
  const heads = (page: TeamPage) => page.departments.groups.flatMap((g) => g.members.flatMap((m) => (m.kind === "head" ? [m.name] : [])));
  assert.ok(heads(noHolder).includes(headName));
  await changeRows(departments, { id: departmentId }, { closedAt: ROLE_DAY });
  const gone = await teamPageData();
  assert.deepEqual(heads(gone), heads(noHolder).filter((name) => name !== headName));
  assert.deepEqual(gone.orgChart.leaders, noHolder.orgChart.leaders);
});

test("a section whose seats have no holder is drawn empty on /about/the-team, never from the hand-typed record", async () => {
  await seeded();
  const before = await teamPageData();
  const roleRows = (await tableRows(roles)) as RoleRow[];

  // The team leader's seat is left with no one in it.
  const president = roleRows.find((r) => r.type === "president" && r.leavedAt === null)!;
  assert.ok(president, "the seed seats a team leader");
  assert.equal(before.orgChart.leader?.name, await nameOf(president.memberId!));
  await changeRows(roles, { id: president.id }, { leavedAt: ROLE_DAY });
  const noLeader = await teamPageData();
  assert.equal(noLeader.orgChart.leader, null, "the page draws no team leader, and not the hand-typed one");
  assert.deepEqual(noLeader.orgChart.leaders, before.orgChart.leaders);
  assert.deepEqual(noLeader.departments.groups, before.departments.groups);
  assert.deepEqual(noLeader.header, before.header);

  // Every department head's seat is left with no one in it.
  const heads = roleRows.filter((r) => r.type === "head" && r.leavedAt === null);
  const headNames = await Promise.all(heads.map((h) => nameOf(h.memberId!)));
  for (const head of heads) await changeRows(roles, { id: head.id }, { leavedAt: ROLE_DAY });
  const noHeads = await teamPageData();
  assert.deepEqual(noHeads.departments.groups, [], "the departments area is empty, not the hand-typed carousel");
  // The layer puts some heads on the arc too: their places there go with their seats.
  assert.deepEqual(noHeads.orgChart.leaders, before.orgChart.leaders.filter((l) => !headNames.includes(l.name)));
  assert.equal(noHeads.orgChart.leader, null);
});

test("a save from today's editor stores the layer and its snapshot layout in one row", async () => {
  await seedFixture();
  signInAs(accountOf("team leader").userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open");
  const { teamPage, teamAdvisors } = (opening as { data: DashboardData }).data;
  const layer: TeamPageLayer = { ...NO_TEAM_LAYER, intro: "Saved with its layout." };
  const saved = await teamPage.save("publish", layer, advisorRowsOf((await teamAdvisors.list()) ?? []));
  assert.ok(saved.ok, JSON.stringify(saved));
  const rows = await tableRows(teamPageLayerVersions);
  const teamRoles = teamRolesOf(await queryTeamSnapshot(testDb));
  assert.deepEqual(
    rows.map((r) => [r.version, r.layer, r.layout]),
    [["published", layer, snapshot(teamRoles, layer).layout]],
  );
});
