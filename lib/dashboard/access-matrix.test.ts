import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import type { ScopeInfo } from "@/app/actions/get-member-scopes";
import { canSwitchRecruitment } from "@/lib/apply/recruitment-switch";
import { maySiteContent } from "@/lib/content/gate";
import { canReach, DASHBOARD_PAGES, NAV_GROUPS, sidebarFor, type DashboardPageKey } from "./access";
import { mayOpenApplication, readsRecruitment, readsRecruitmentIn } from "./application-documents";
import { overviewAreasOf } from "./division-overview";
import { opensWholeTeam } from "./members-view";
import { ordersScopeOf, type OrdersScopeRow } from "./orders";
import { mayChangePositionIn } from "./position-access";
import {
  areaGrantsOf,
  GRANT_AREAS,
  isOffTeam,
  mayChange,
  readsArea,
  readsAreaIn,
  unitRowsOf,
  viewerStandingOf,
  type ActiveRoleRef,
  type AreaGrant,
  type ChangeArea,
  type DivisionUnit,
  type FlaggedSeat,
  type GrantArea,
  type ScopedRole,
  type ScopeUnitRow,
  type ViewerStanding,
} from "./viewer";
import type { RoleType } from "./team";

// The dashboard access matrix (issue #477): every viewer kind against every
// page, every area's reads and changes in every unit, the CV and letter
// links, site content, the recruitment switch and Orders. The matrix is data
// (VIEWERS below); one table-driven suite asserts each domain rule against
// every cell. Each viewer is built from active roles and scope rows the way
// `readIdentity` (./database.ts) builds the signed-in account, so a cell is
// what the database side decides.
//
// The rules the matrix encodes (Owner decision, 2026-10-21): grants are
// independent, so no grant implies another area and no grant holder reads
// or acts as a division lead; a grant reaches only the units it names; a
// `team` row on an area is a grant in every open department (`unitRowsOf`).
//
// The org: Aerodynamics (1) holds Mission Analysis (MA, 1) and Optimization
// (OA, 2); Structures (2) holds Design & Manufacturing (DM, 3).

const UNITS = { MA: { divisionId: 1, departmentId: 1 }, OA: { divisionId: 2, departmentId: 1 }, DM: { divisionId: 3, departmentId: 2 } } as const;
type Unit = keyof typeof UNITS;
const ALL: readonly Unit[] = ["MA", "OA", "DM"];
const AERODYNAMICS: readonly Unit[] = ["MA", "OA"];
const NONE: readonly Unit[] = [];
const OPEN_DEPARTMENTS = [1, 2];
const ORG = [
  { id: 1, name: "Aerodynamics", divisions: [{ id: 1, name: "Mission Analysis" }, { id: 2, name: "Optimization" }] },
  { id: 2, name: "Structures", divisions: [{ id: 3, name: "Design & Manufacturing" }] },
];

type Role = ScopedRole & ActiveRoleRef;
const role = (type: RoleType, divisionId: number | null, departmentId: number | null, fullAccess: FlaggedSeat | null = null): Role => ({
  type,
  divisionId,
  departmentId,
  fullAccess,
});
const MEMBER_ROLE = role("core", 1, 1);

/** One scope row as the `scopes` table stores it. */
const row = (scope: ScopeUnitRow["scope"], target: ScopeUnitRow["target"], level: "view" | "edit", at: { divisionId?: number; deptId?: number } = {}): ScopeUnitRow => ({
  scope,
  target,
  level,
  divisionId: at.divisionId ?? null,
  deptId: at.deptId ?? null,
});

/** A viewer as the database reads them (`readIdentity`): standing, roles and area grants, and the raw rows Orders and the switch read. */
type Viewer = ViewerStanding & {
  readonly roles: readonly ScopedRole[];
  readonly grants: readonly AreaGrant[];
  readonly rawRows: readonly ScopeUnitRow[];
  readonly headDepartment: { id: number; name: string } | null;
};

function viewerOf(roles: readonly Role[], rows: readonly ScopeUnitRow[] = [], onAlumniRecord = false): Viewer {
  const unitRows = unitRowsOf(rows, rows.some((r) => r.scope === "team" && r.target !== "approve_orders") ? OPEN_DEPARTMENTS : []);
  const standing = viewerStandingOf({ scopes: unitRows, activeRoles: roles, onAlumniRecord });
  const offTeam = isOffTeam(standing.kind);
  const head = standing.kind === "department-head" ? roles.find((r) => r.type === "head")?.departmentId ?? null : null;
  return {
    ...standing,
    roles: offTeam ? [] : roles,
    grants: offTeam ? [] : areaGrantsOf(unitRows),
    rawRows: rows,
    headDepartment: head === null ? null : { id: head, name: ORG.find((d) => d.id === head)!.name },
  };
}

/** What the recruitment switch reads: the viewer's `positions` rows as a ScopeInfo (`getScopeInfoForMember`). */
function scopeInfoOf(v: Viewer): ScopeInfo {
  const rows = v.rawRows.filter((r) => r.target === "positions" || r.target === "all");
  return {
    hasAdminAccess: rows.some((r) => r.scope === "admin"),
    hasOrgAccess: rows.some((r) => r.scope === "org"),
    hasAdminEdit: rows.some((r) => r.scope === "admin" && r.level === "edit"),
    hasOrgEdit: rows.some((r) => r.scope === "org" && r.level === "edit"),
    departmentIds: new Set(),
    divisionIds: new Set(),
    editableDepartmentIds: new Set(),
    editableDivisionIds: new Set(),
  };
}

// The matrix ------------------------------------------------------------------

const TEAM_BASE: readonly DashboardPageKey[] = ["overview", "my-applications", "team-tree", "my-profile"];
const CONTENT: readonly DashboardPageKey[] = ["projects", "outreach", "partners", "alumni", "faq", "team-page"];
const LEADING: readonly DashboardPageKey[] = ["positions", "applications", "members", "division-access", "orders"];
const FULL: readonly DashboardPageKey[] = [...TEAM_BASE, ...LEADING, ...CONTENT];
const PAGE_OF_AREA: Readonly<Record<GrantArea, DashboardPageKey>> = { positions: "positions", applications: "applications", members: "members", orders: "orders" };
const CHANGE_AREAS: readonly ChangeArea[] = ["positions", "applications", "members"];

/**
 * One row of the matrix. `pages`: every dashboard page the viewer reaches.
 * `reads`: per area, the units where they read it (its page's rows, the
 * Overview figures, and for Applications every CV and letter link).
 * `changes`: per area, the units where they change it. `ordersPage`: whether
 * the Orders loader answers a page. Every cell not listed is refused.
 */
type Expect = {
  readonly pages: readonly DashboardPageKey[];
  readonly reads: Readonly<Record<GrantArea, readonly Unit[]>>;
  readonly changes: Readonly<Record<ChangeArea, readonly Unit[]>>;
  readonly siteContent: boolean;
  readonly switchesRecruitment: boolean;
  readonly ordersPage: boolean;
  readonly wholeTeamMembers: boolean;
};

const nothing = { positions: NONE, applications: NONE, members: NONE, orders: NONE } as const;
const everywhere = (units: readonly Unit[]) => ({ positions: units, applications: units, members: units, orders: units });
const changing = (units: readonly Unit[]) => ({ positions: units, applications: units, members: units });

const FULL_ACCESS: Omit<Expect, "switchesRecruitment"> = {
  pages: FULL,
  reads: everywhere(ALL),
  changes: changing(ALL),
  siteContent: true,
  ordersPage: true,
  wholeTeamMembers: true,
};

const PLAIN_MEMBER: Expect = {
  pages: TEAM_BASE,
  reads: nothing,
  changes: { positions: NONE, applications: NONE, members: NONE },
  siteContent: false,
  switchesRecruitment: false,
  ordersPage: false,
  wholeTeamMembers: false,
};

/** A member holding one area grant at Can edit over `units`: that area's page and units alone. */
function singleGrant(area: GrantArea, units: readonly Unit[]): Expect {
  return {
    ...PLAIN_MEMBER,
    pages: [...TEAM_BASE, PAGE_OF_AREA[area]],
    reads: { ...nothing, [area]: units },
    changes: { positions: NONE, applications: NONE, members: NONE, ...(area === "orders" ? {} : { [area]: units }) },
    ordersPage: area === "orders",
  };
}

const SCOPES = {
  division: { at: { divisionId: 1 }, kind: "division", units: ["MA"] },
  department: { at: { deptId: 1 }, kind: "department", units: AERODYNAMICS },
  team: { at: {}, kind: "team", units: ALL },
} as const satisfies Record<string, { at: { divisionId?: number; deptId?: number }; kind: ScopeUnitRow["scope"]; units: readonly Unit[] }>;

type MatrixRow = { readonly name: string; readonly viewer: Viewer; readonly expect: Expect };

const VIEWERS: readonly MatrixRow[] = [
  // Full access: the three seats by role alone (issue #238), or an org scope row.
  { name: "team leader", viewer: viewerOf([role("president", null, null)]), expect: { ...FULL_ACCESS, switchesRecruitment: true } },
  // Open owner question (see the PR): the database switch needs an org or admin row beside the seat.
  { name: "operations lead", viewer: viewerOf([role("core", null, null, "operations-lead")]), expect: { ...FULL_ACCESS, switchesRecruitment: false } },
  {
    name: "IT lead",
    viewer: viewerOf([role("core", null, null, "it-lead")]),
    expect: { ...FULL_ACCESS, pages: [...FULL, "activity-log"], switchesRecruitment: false },
  },
  { name: "org-wide editor", viewer: viewerOf([MEMBER_ROLE], [row("org", "all", "edit")]), expect: { ...FULL_ACCESS, switchesRecruitment: true } },
  // A department head: every area in their department, by the role.
  {
    name: "department head",
    viewer: viewerOf([role("head", null, 1)]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...LEADING], reads: everywhere(AERODYNAMICS), changes: changing(AERODYNAMICS), ordersPage: true },
  },
  // A head's grant adds its own area in its own unit, and nothing else (issue #477).
  {
    name: "department head with an Applications grant in DM",
    viewer: viewerOf([role("head", null, 1)], [row("division", "applications", "edit", { divisionId: 3 })]),
    expect: {
      ...PLAIN_MEMBER,
      pages: [...TEAM_BASE, ...LEADING],
      reads: { ...everywhere(AERODYNAMICS), applications: ALL },
      changes: { ...changing(AERODYNAMICS), applications: ALL },
      ordersPage: true,
    },
  },
  // A division lead: every area in the division they lead.
  {
    name: "division lead",
    viewer: viewerOf([role("lead", 1, 1)]),
    // The Orders loader answers no page to a lead with no Orders row (`ordersScopeOf`): narrower than the sidebar, not a leak.
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...LEADING], reads: everywhere(["MA"]), changes: changing(["MA"]) },
  },
  // The leak #477 fixes: a lead's Positions grant elsewhere opened every area there, CVs included.
  {
    name: "division lead with a Positions grant (Can view) in DM",
    viewer: viewerOf([role("lead", 1, 1)], [row("division", "positions", "view", { divisionId: 3 })]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...LEADING], reads: { ...everywhere(["MA"]), positions: ["MA", "DM"] }, changes: changing(["MA"]) },
  },
  { name: "member", viewer: viewerOf([MEMBER_ROLE]), expect: PLAIN_MEMBER },
  // Each single grant, at each scope, at Can edit: its own page and units alone.
  ...GRANT_AREAS.flatMap((area) =>
    Object.entries(SCOPES).map(([scope, s]): MatrixRow => ({
      name: `member with a ${area} grant across the ${scope}`,
      viewer: viewerOf([MEMBER_ROLE], [row(s.kind, area, "edit", s.at)]),
      expect: singleGrant(area, s.units),
    })),
  ),
  // A grant at Can view reads and changes nothing.
  {
    name: "member with a Positions grant (Can view) in MA",
    viewer: viewerOf([MEMBER_ROLE], [row("division", "positions", "view", { divisionId: 1 })]),
    expect: { ...singleGrant("positions", ["MA"]), changes: { positions: NONE, applications: NONE, members: NONE } },
  },
  {
    name: "member with site-content access",
    viewer: viewerOf([MEMBER_ROLE], [row("website", "all", "edit")]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, ...CONTENT], siteContent: true },
  },
  {
    name: "member with Approve orders",
    viewer: viewerOf([MEMBER_ROLE], [row("team", "approve_orders", "edit")]),
    expect: { ...PLAIN_MEMBER, pages: [...TEAM_BASE, "orders"], ordersPage: true },
  },
  // Off the team, every scope row that outlived the roles reaches nothing (issues #201, #477).
  {
    name: "alumnus with scope rows left over",
    viewer: viewerOf([], [row("org", "all", "edit"), row("admin", "all", "edit"), row("division", "all", "edit", { divisionId: 1 }), row("website", "all", "edit"), row("team", "approve_orders", "edit")], true),
    expect: { ...PLAIN_MEMBER, pages: ["overview", "my-alumni", "my-applications", "my-account"] },
  },
  { name: "non-member", viewer: viewerOf([]), expect: { ...PLAIN_MEMBER, pages: ["overview", "my-applications", "my-account"] } },
];

/** What every reach and read answers when nobody is signed in: the dashboard does not open (`dashboardOpening`), so every cell refuses. */
const SIGNED_OUT: Expect = { ...PLAIN_MEMBER, pages: [] };

/** Open owner question (issue #477): a Positions-only member sees each position's application counts, with no names or files. */
const OWNER_QUESTIONS = [{ viewer: "member with a positions grant across the division", cell: "Positions page: per-position application counts" }] as const;

// The domain rules, cell by cell -------------------------------------------------

const PAGE_KEYS = DASHBOARD_PAGES.map((p) => p.key);
const unitsWhere = (check: (unit: DivisionUnit) => boolean) => ALL.filter((u) => check(UNITS[u]));

describe("the access matrix covers every viewer kind and every page", () => {
  test("every viewer kind the issue names has a row", () => {
    const names = VIEWERS.map((v) => v.name);
    for (const area of GRANT_AREAS) for (const scope of Object.keys(SCOPES)) assert.ok(names.includes(`member with a ${area} grant across the ${scope}`));
    for (const name of ["team leader", "operations lead", "IT lead", "department head", "division lead", "member", "alumnus with scope rows left over", "non-member"]) {
      assert.ok(names.includes(name), name);
    }
    assert.deepEqual(SIGNED_OUT.pages, []);
    assert.equal(OWNER_QUESTIONS.length, 1);
  });

  test("each row names only real pages", () => {
    for (const { name, expect } of VIEWERS) for (const page of expect.pages) assert.ok(PAGE_KEYS.includes(page), `${name}: ${page}`);
  });
});

describe("pages and the sidebar (canReach, sidebarFor)", () => {
  for (const { name, viewer, expect } of VIEWERS) {
    test(name, () => {
      for (const page of PAGE_KEYS) assert.equal(canReach(viewer, page), expect.pages.includes(page), `${name}: ${page}`);
      // The sidebar lists only pages the viewer reaches, and every listed-group page they reach.
      const listed = sidebarFor(viewer, { counts: {}, hasShownApplications: true }).flatMap((s) => s.items.map((i) => i.key));
      const inGroups = DASHBOARD_PAGES.filter((p) => (NAV_GROUPS as readonly string[]).includes(p.place)).map((p) => p.key);
      assert.deepEqual([...listed].sort(), expect.pages.filter((p) => inGroups.includes(p)).sort(), name);
    });
  }
});

describe("area reads, the CV and letter links, and changes (readsArea, readsAreaIn, readsRecruitmentIn, mayOpenApplication, mayChange)", () => {
  for (const { name, viewer, expect } of VIEWERS) {
    test(name, () => {
      for (const area of GRANT_AREAS) {
        const units = expect.reads[area];
        assert.equal(readsArea(viewer, area), units.length > 0, `${name}: reads ${area}`);
        assert.deepEqual(unitsWhere((u) => readsAreaIn(viewer, area, u)), units, `${name}: ${area} units`);
      }
      assert.deepEqual(overviewAreasOf(viewer), GRANT_AREAS.filter((a) => expect.reads[a].length > 0), `${name}: Overview figures`);
      for (const area of ["positions", "applications"] as const) {
        assert.equal(readsRecruitment(viewer, area), expect.reads[area].length > 0, `${name}: ${area} page`);
        assert.deepEqual(unitsWhere((u) => readsRecruitmentIn(viewer, area, u)), expect.reads[area], `${name}: ${area} rows`);
      }
      // The CV and the letter open exactly where the Applications page lists the application; withdrawn, nowhere.
      assert.deepEqual(unitsWhere((u) => mayOpenApplication(viewer, { unit: u, withdrawn: false })), expect.reads.applications, `${name}: files`);
      for (const u of ALL) assert.equal(mayOpenApplication(viewer, { unit: UNITS[u], withdrawn: true }), false, `${name}: withdrawn in ${u}`);
      for (const area of CHANGE_AREAS) {
        const changes = unitsWhere((u) => mayChange(viewer, area, u) && (area === "members" || mayChangePositionIn(viewer, area, u)));
        assert.deepEqual(changes, expect.changes[area], `${name}: changes ${area}`);
        // A change needs the read: nobody changes where they cannot see.
        for (const u of expect.changes[area]) assert.ok(expect.reads[area].includes(u), `${name}: ${area} change in ${u} without the read`);
      }
    });
  }
});

describe("site content, the recruitment switch, Orders and the whole-team Members page", () => {
  for (const { name, viewer, expect } of VIEWERS) {
    test(name, () => {
      assert.equal(maySiteContent(viewer), expect.siteContent, `${name}: site content`);
      assert.equal(canSwitchRecruitment(viewer, scopeInfoOf(viewer)), expect.switchesRecruitment, `${name}: recruitment switch`);
      const scope = isOffTeam(viewer.kind)
        ? null
        : ordersScopeOf(
            { fullAccess: viewer.kind === "operations-lead", teamLeader: viewer.roles.some((r) => r.type === "president"), headDepartment: viewer.headDepartment },
            viewer.rawRows as readonly OrdersScopeRow[],
            ORG,
          );
      assert.equal(scope !== null, expect.ordersPage, `${name}: Orders page`);
      if (scope !== null) assert.ok(canReach(viewer, "orders"), `${name}: an Orders page they cannot reach`);
      assert.equal(opensWholeTeam(viewer), expect.wholeTeamMembers, `${name}: whole-team Members`);
    });
  }
});

describe("grants are independent (issue #477)", () => {
  const holders = VIEWERS.filter((v) => v.viewer.kind === "member" && v.viewer.grants.length > 0);

  test("a single grant on one area opens no other area, page or unit", () => {
    for (const { name, viewer } of holders) {
      const [granted] = new Set(viewer.grants.map((g) => g.target));
      for (const area of GRANT_AREAS.filter((a) => a !== granted)) {
        assert.equal(readsArea(viewer, area), false, `${name}: reads ${area}`);
        assert.equal(canReach(viewer, PAGE_OF_AREA[area]), false, `${name}: ${area} page`);
        for (const u of ALL) assert.equal(readsAreaIn(viewer, area, UNITS[u]), false, `${name}: ${area} in ${u}`);
      }
      for (const area of CHANGE_AREAS.filter((a) => a !== granted)) for (const u of ALL) assert.equal(mayChange(viewer, area, UNITS[u]), false, `${name}: changes ${area}`);
    }
  });

  test("no grant holder reads or acts as a division lead anywhere", () => {
    for (const { name, viewer } of holders) {
      assert.equal(viewer.kind, "member", name);
      assert.equal(canReach(viewer, "division-access"), false, `${name}: Access page`);
      assert.equal(opensWholeTeam(viewer), false, name);
      assert.ok(overviewAreasOf(viewer).length < GRANT_AREAS.length, `${name}: reads every area as a lead does`);
    }
  });

  test("a lead's or head's grant on one area opens that area there, and no other area", () => {
    const lead = VIEWERS.find((v) => v.name === "division lead with a Positions grant (Can view) in DM")!.viewer;
    assert.equal(readsAreaIn(lead, "positions", UNITS.DM), true);
    for (const area of ["applications", "members", "orders"] as const) assert.equal(readsAreaIn(lead, area, UNITS.DM), false, area);
    assert.equal(mayOpenApplication(lead, { unit: UNITS.DM, withdrawn: false }), false, "a CV in DM");
  });

  test("a grant reaches only the units it names: a division, a department's divisions, or every open department's", () => {
    for (const area of GRANT_AREAS) {
      for (const [scope, s] of Object.entries(SCOPES)) {
        const { viewer } = VIEWERS.find((v) => v.name === `member with a ${area} grant across the ${scope}`)!;
        assert.deepEqual(unitsWhere((u) => readsAreaIn(viewer, area, u)), s.units, `${area} across the ${scope}`);
      }
    }
  });
});

// The server side: every loader, action, page and route asks these rules ----------
//
// The loaders in lib/dashboard/database*.ts and the server actions in
// app/dashboard/*actions.ts are server-only and query a live database, so, as
// lib/apply/database-refresh.test.ts does, their contract is pinned from the
// source text: each one asks its rule before it reads or writes. The same
// loaders run for real on the test-developer path in
// lib/dummy-data/access-matrix.test.ts.

const root = new URL("../../", import.meta.url);
const source = (file: string) => readFileSync(new URL(file, root), "utf8");

/** The text of one top-level function, from its signature to its closing brace. */
function body(text: string, name: string): string {
  const start = text.search(new RegExp(`(async )?function ${name}[<(]`));
  assert.notEqual(start, -1, `${name} is defined`);
  const end = text.indexOf("\n}\n", start);
  assert.notEqual(end, -1, `${name} ends`);
  return text.slice(start, end);
}

/** `first` appears in `name`'s body, and before `then` when given. */
function asksFirst(file: string, name: string, first: string, then?: string) {
  const text = body(source(file), name);
  const at = text.indexOf(first);
  assert.notEqual(at, -1, `${file} ${name} asks ${first}`);
  if (then !== undefined) {
    const later = text.indexOf(then);
    assert.notEqual(later, -1, `${file} ${name} does ${then}`);
    assert.ok(at < later, `${file} ${name} asks ${first} before ${then}`);
  }
}

/**
 * Each loader and write on the database side, the rule it asks, and the read
 * or write that must come after it. The rule is one of the domain rules the
 * matrix above pins.
 */
const LOADERS: readonly (readonly [file: string, fn: string, rule: string, before?: string])[] = [
  // Overview, sidebar badge, Team tree, Members, recruitment switch (./database.ts).
  ["lib/dashboard/database.ts", "overviewShapeOf", 'case "alumni":\n      return Promise.reject(new DashboardRefused'],
  ["lib/dashboard/database.ts", "navCountsOf", 'if (!readsArea(identity, "applications")) return {};', "readPositions("],
  ["lib/dashboard/database.ts", "divisionOverview", "const areas = overviewAreasOf(identity);", "readPositions("],
  ["lib/dashboard/database.ts", "readApplicationFigures", 'scopedPositions(identity, "applications")', "readInterviews"],
  ["lib/dashboard/database.ts", "readOrderFigures", 'readsAreaIn(identity, "orders"'],
  ["lib/dashboard/database.ts", "readMemberFigures", 'areaUnitsOf(identity, "members")', "readActiveMemberCount("],
  ["lib/dashboard/database.ts", "departmentOverview", 'const interviewed = scopedPositions(identity, "applications");', "interviewed.then(readInterviews)"],
  ["lib/dashboard/database.ts", "scopedPositions", "readsAreaIn(identity, area"],
  ["lib/dashboard/database.ts", "membersOf", "if (opensWholeTeam(identity))", "readDivisionMembers(identity"],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", 'canReach(identity, "team-tree") ? rosterOf(snapshot) : []'],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", "canSwitchRecruitment(identity, "],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", "partners: partnerEditor(identity,"],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", "faqs: faqEditor(identity,"],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", "teamPage: teamPageEditor(identity,"],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", "teamAdvisors: advisorEditor(identity,"],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", "outreach: outreachEditor(identity,"],
  ["lib/dashboard/database.ts", "openDatabaseDashboard", "projects: projectEditor(identity,"],
  ["lib/dashboard/database.ts", "readIdentity", "if (isOffTeam(standing.kind)) return { ...base, role: null, roles: [], divisionIds: [], departmentIds: [], grants: []"],
  // Positions and Applications, and the document route's check (./database-recruitment.ts).
  ["lib/dashboard/database-recruitment.ts", "positionsPage", 'if (!readsRecruitment(identity, "positions")) throw new DashboardRefused', "readPositionRows("],
  ["lib/dashboard/database-recruitment.ts", "applicationsPage", 'if (!readsRecruitment(identity, "applications")) throw new DashboardRefused', "readPositionRows("],
  ["lib/dashboard/database-recruitment.ts", "readPositionRows", "readsRecruitmentIn(identity, area,", "scoped.map("],
  ["lib/dashboard/database-recruitment.ts", "applicationDocument", 'if (!readsRecruitment(identity, "applications")) throw new DashboardRefused', "getDb()"],
  ["lib/dashboard/database-recruitment.ts", "applicationDocument", "if (!mayOpenApplication(identity, place)) throw new DashboardRefused", "parsePrivatePathname("],
  ["lib/dashboard/database-recruitment.ts", "readPostableDivisions", 'if (!readsRecruitment(identity, "positions")) return [];', 'mayChange(identity, "positions"'],
  ["lib/dashboard/database-recruitment.ts", "createPosition", "readPostableDivisions(identity)", "runAuditQuery("],
  ["lib/dashboard/database-recruitment.ts", "setPositionOpen", 'mayChangePosition(identity, "positions", positionId)', "runAuditQuery("],
  ["lib/dashboard/database-recruitment.ts", "editPosition", 'mayChangePosition(identity, "positions", positionId)', "runAuditQuery("],
  ["lib/dashboard/database-recruitment.ts", "mayChangePosition", "mayChangePositionIn(identity, area, unit)"],
  ["lib/dashboard/database-recruitment.ts", "readApplicationFor", 'mayChangePosition(identity, "applications", row.position_id)'],
  ["lib/dashboard/database-recruitment.ts", "moveApplication", "readApplicationFor(identity, applicationId)", "runAuditQuery("],
  // Access and Orders (./database-division.ts).
  ["lib/dashboard/database-division.ts", "leadDivisions", 'if (identity.kind !== "division-lead"'],
  ["lib/dashboard/database-division.ts", "readHeadDepartment", 'if (identity.kind !== "department-head") return null;'],
  ["lib/dashboard/database-division.ts", "accessUnitOf", 'if (identity.kind === "operations-lead") return readTeamUnit();'],
  ["lib/dashboard/database-division.ts", "saveAccess", "if (access === null) return refused(", "writeAccess("],
  ["lib/dashboard/database-division.ts", "removeAllAccess", "if (access === null) return refused(", "writeAccess("],
  ["lib/dashboard/database-division.ts", "readOrdersScope", "isOffTeam(identity.kind)) return null;"],
  ["lib/dashboard/database-division.ts", "readOrdersPage", "if (scope === null) return null;", "ordersPageFor("],
  ["lib/dashboard/database-division.ts", "placeOrder", 'if (scope === null) return refused("You do not have access to Orders.");', "runAuditQuery("],
  ["lib/dashboard/database-division.ts", "editOrder", "if (!canEditOrder(found.scope, found.order)) return refused(OUT_OF_SCOPE);", "runAuditQuery("],
  ["lib/dashboard/database-division.ts", "cancelOrder", "if (!canEditOrder(found.scope, found.order)) return refused(OUT_OF_SCOPE);", "runAuditQuery("],
  ["lib/dashboard/database-division.ts", "decideOrder", "checkDecision(found.scope.decides", "runAuditQuery("],
  ["lib/dashboard/database-division.ts", "markOrdered", "checkMarkOrdered(found.scope.decides", "runAuditQuery("],
  ["lib/dashboard/database-division.ts", "setApproveOrders", "byTeamLeader: isTeamLeader(identity)", "runAuditQuery("],
  // Members, the Team tree's edit view, and their writes (./database-team.ts).
  ["lib/dashboard/database-team.ts", "actorOf", "isOffTeam(identity.kind) ? null"],
  ["lib/dashboard/database-team.ts", "readViewingActor", 'readsAreaIn(identity, "members"'],
  ["lib/dashboard/database-team.ts", "readActor", 'mayChange(identity, "members"'],
  ["lib/dashboard/database-team.ts", "readDivisionMembers", "readViewingActor(identity,", "divisionMembers("],
  ["lib/dashboard/database-team.ts", "readDivisionMembers", 'readsAreaIn(identity, "applications"', "readJoining(division)"],
  ["lib/dashboard/database-team.ts", "readTeamStructure", 'if (actor === null || actor.kind === "lead") return null;', "readPerDivision("],
  ["lib/dashboard/database-team.ts", "findForAdd", "reachesDivision(actor, divisionId", "lookupForAdd("],
  ["lib/dashboard/database-team.ts", "findPeople", 'if (actor === null || actor.kind === "lead") return { kind: "none" };', "searchTeam("],
  ["lib/dashboard/database-team.ts", "saveMember", "rolesTheViewerChanges(identity, actor, personId)", "runAuditQuery("],
  ["lib/dashboard/database-team.ts", "promote", 'if (identity.kind !== "division-lead"', "runAuditBatch("],
  ["lib/dashboard/database-team.ts", "moveToAlumni", "if (actor === null) return false;", "runAuditBatch("],
  ["lib/dashboard/database-team.ts", "confirmJoin", "actingOn(identity, row.division_id)", "moveApplication(identity"],
  ["lib/dashboard/database-team.ts", "addMember", "actingOn(identity, add.divisionId)", "runAudit"],
  ["lib/dashboard/database-team.ts", "confirmNda", "actingOn(identity, row.division_id)", "runAudit"],
  ["lib/dashboard/database-team.ts", "cancelAdd", "actingOn(identity, row.divisionId)", "runAudit"],
  ["lib/dashboard/database-team.ts", "removeFromDivision", "actingOn(identity, divisionId)", "runAuditBatch("],
  ["lib/dashboard/database-team.ts", "saveMemberDetails", "actingOn(identity, divisionId)", "runAudit"],
  ["lib/dashboard/database-team.ts", "setMemberPhoto", "actingOn(identity, divisionId)"],
  ["lib/dashboard/database-team.ts", "createDivision", "if (actor === null) return refused(", "writeDivisionPlan("],
  ["lib/dashboard/database-team.ts", "saveDivision", "if (actor === null || subject === null) return refused(", "writeDivisionPlan("],
  ["lib/dashboard/database-team.ts", "closeDivision", "if (actor === null) return refused(", "runAuditBatch("],
  ["lib/dashboard/database-team.ts", "createDepartment", "planDepartmentCreate({ actor,", "runAuditBatch("],
  ["lib/dashboard/database-team.ts", "saveDepartment", "planDepartmentSave({ actor,", "runAudit"],
  ["lib/dashboard/database-team.ts", "closeDepartment", "planDepartmentClose({", "runAuditBatch("],
  ["lib/dashboard/database-team.ts", "handOverTeamLeader", "planTeamLeaderHandOver({", "runAuditBatch("],
  ["lib/dashboard/database-team.ts", "answerHandOver", "planHandOverAnswer({ viewerId,", "runAuditQuery("],
  // The Alumni page and an alumnus's own entry (./database-alumni.ts).
  ["lib/dashboard/database-alumni.ts", "readAlumniDirectory", 'canReach(viewer, "alumni") ? await readAlumni() : []'],
  ["lib/dashboard/database-alumni.ts", "setAlumnusShown", 'if (!canReach(viewer, "alumni")', "runAuditBatch("],
  ["lib/dashboard/database-alumni.ts", "fixAlumnus", 'if (!canReach(viewer, "alumni")) return refused(', "runAudit"],
  ["lib/dashboard/database-alumni.ts", "setAlumnusPhoto", 'if (!canReach(viewer, "alumni")) return refused(', "runAudit"],
  ["lib/dashboard/database-alumni.ts", "addAdvisor", 'if (!canReach(viewer, "alumni")) return refused(', "runAudit"],
  ["lib/dashboard/database-alumni.ts", "ownKey", 'if (identity.kind !== "alumni"'],
  // Notices, hand-overs and the viewer's own pages: each reads or writes the viewer's own rows alone.
  ["lib/dashboard/database-notices.ts", "dismissNotice", 'if (memberId === null) return refused("This notice is not yours.");', "runAuditQuery("],
  ["lib/dashboard/database-hand-over.ts", "sendHandOver", 'if (memberId === null) return refused("This page is for team members.");', "runAudit"],
  ["lib/dashboard/database-self.ts", "readProfile", "if (isOffTeam(identity.kind) || memberId === null) return null;", "getDb()"],
  ["lib/dashboard/database-self.ts", "readAccount", "if (!isOffTeam(identity.kind)) return null;", "getDb()"],
  ["lib/dashboard/database-self.ts", "withdrawApplication", 'if (!application) return refused("That application is not yours', "runAuditQuery("],
  ["lib/dashboard/database-self.ts", "chooseInterviewSlot", "pickableSlot(mine?.active.find((a) => a.id === applicationId), slotId)", "runAuditBatch("],
];

describe("every database loader and write asks its rule before it reads or writes", () => {
  for (const [file, fn, rule, before] of LOADERS) {
    test(`${file.replace("lib/dashboard/", "")} ${fn}`, () => asksFirst(file, fn, rule, before));
  }

  test("every method the database side hands the data interface for Positions, Applications, Access, Orders and Members is in the table", () => {
    const listed = new Set(LOADERS.map(([file, fn]) => `${file} ${fn}`));
    const handed = (file: string, factory: string) =>
      [...body(source(file), factory).matchAll(/=> (\w+)\(identity/g)].map((m) => `${file} ${m[1]}`);
    for (const [file, factory] of [
      ["lib/dashboard/database-recruitment.ts", "databaseRecruitmentPages"],
      ["lib/dashboard/database-division.ts", "databaseDivisionPages"],
      ["lib/dashboard/database-team.ts", "databaseTeamWrites"],
    ] as const) {
      for (const method of handed(file, factory)) {
        if (method.endsWith(" readAccessPage")) continue; // its rule is `accessUnitOf`, in the table
        assert.ok(listed.has(method), `${method} has no row in the matrix`);
      }
    }
  });

  test("open owner question: the Positions page still counts each position's applications for whoever reads Positions", () => {
    asksFirst("lib/dashboard/database-recruitment.ts", "readPositionRows", "applications: own.reduce((sum, t) => sum + t.n, 0),");
  });
});

/**
 * Every server action, and the gate it passes before the data interface runs
 * it: a page the viewer must reach (`canReach`), the site-content gate inside
 * a content editor, or the data interface's own rule. A gate that is a page
 * refuses every viewer the matrix says does not reach it.
 */
type Gate = { readonly page: DashboardPageKey | readonly DashboardPageKey[] } | { readonly editor: string } | { readonly data: string };

const ACTIONS: Readonly<Record<string, Readonly<Record<string, Gate>>>> = {
  "app/dashboard/actions.ts": {
    dismissNotice: { page: "overview" },
    saveAccess: { page: "division-access" },
    removeAllAccess: { page: "division-access" },
    placeOrder: { page: "orders" },
    editOrder: { page: "orders" },
    cancelOrder: { page: "orders" },
    decideOrder: { page: "orders" },
    markOrdered: { page: "orders" },
    measurePartnerLogo: { page: "partners" },
    savePartner: { page: "partners" },
    removePartner: { page: "partners" },
    reorderPartners: { page: "partners" },
    saveFaq: { page: "faq" },
    removeFaq: { page: "faq" },
    reorderFaqs: { page: "faq" },
    saveTeamPage: { page: "team-page" },
    resetTeamPageLayer: { page: "team-page" },
    uploadTeamPagePhoto: { page: "team-page" },
    endAdvising: { page: "team-page" },
    saveOutreachPost: { editor: "outreach" },
    addOutreachTag: { editor: "outreach" },
    uploadOutreachPhoto: { editor: "outreach" },
    discardOutreachPhoto: { editor: "outreach" },
    saveLinkedin: { page: "my-profile" },
    uploadPhoto: { page: "my-profile" },
    removePhoto: { page: "my-profile" },
    leaveTeam: { page: "my-profile" },
    setMyAlumniShown: { page: "my-alumni" },
    uploadMyAlumniPhoto: { page: "my-alumni" },
    removeMyAlumniPhoto: { page: "my-alumni" },
    sendHandOver: { page: "my-profile" },
    answerHandOver: { page: "overview" },
    withdrawApplication: { page: "my-applications" },
    chooseInterviewSlot: { page: "my-applications" },
    saveDetails: { page: ["my-account", "my-profile"] },
    deleteAccount: { page: ["my-account", "my-profile"] },
  },
  "app/dashboard/team-actions.ts": {
    setAlumnusShown: { page: "alumni" },
    fixAlumnus: { page: "alumni" },
    setAlumnusPhoto: { page: "alumni" },
    addAdvisor: { page: "alumni" },
    saveMember: { page: "members" },
    promote: { page: "members" },
    moveToAlumni: { page: "members" },
    confirmJoin: { page: "members" },
    findForAdd: { page: "members" },
    addMember: { page: "members" },
    confirmNda: { page: "members" },
    cancelAdd: { page: "members" },
    removeFromDivision: { page: "members" },
    saveMemberDetails: { page: "members" },
    setMemberPhoto: { page: "members" },
    findPeople: { page: "members" },
    createDivision: { page: "members" },
    saveDivision: { page: "members" },
    closeDivision: { page: "members" },
    createDepartment: { page: "team-tree" },
    saveDepartment: { page: "team-tree" },
    closeDepartment: { page: "team-tree" },
    handOverTeamLeader: { page: "team-tree" },
  },
  "app/dashboard/outreach-actions.ts": {
    unpublishOutreachPost: { page: "outreach" },
    deleteOutreachPost: { page: "outreach" },
    pinOutreachPost: { page: "outreach" },
    unpinOutreachPost: { page: "outreach" },
    saveOutreachSummit: { page: "outreach" },
  },
  "app/dashboard/project-actions.ts": {
    saveProject: { editor: "projects" },
    createProject: { editor: "projects" },
    reorderProjects: { editor: "projects" },
    uploadProjectPhoto: { editor: "projects" },
    discardProjectPhoto: { editor: "projects" },
  },
  "app/dashboard/recruitment-actions.ts": {
    setPositionOpen: { data: "setPositionOpen" },
    moveApplication: { data: "moveApplication" },
    createPosition: { data: "createPosition" },
    editPosition: { data: "editPosition" },
    setRecruitment: { data: "setRecruitment" },
  },
};

/** What a gate looks like in an action's body. */
function gateText(file: string, gate: Gate): string {
  if ("editor" in gate) return file.endsWith("project-actions.ts") ? `opening.data.${gate.editor}.` : `contentWrite((data) => data.${gate.editor}.`;
  if ("data" in gate) return `data.${gate.data}(`;
  if (typeof gate.page !== "string") return "write(OWN_PAGES,";
  if (file.endsWith("team-actions.ts")) return gate.page === "members" ? '"members")' : `writesOn("${gate.page}")`;
  if (file.endsWith("outreach-actions.ts")) return "onOutreach(";
  return `write("${gate.page}",`;
}

describe("every server action passes its gate before the data interface", () => {
  for (const [file, actions] of Object.entries(ACTIONS)) {
    test(`${file}: every exported action has a row, and asks its gate`, () => {
      const text = source(file);
      const exported = [...text.matchAll(/^export async function (\w+)\(/gm)].map((m) => m[1]);
      assert.deepEqual([...exported].sort(), Object.keys(actions).sort(), `${file}: the matrix lists every action`);
      for (const [name, gate] of Object.entries(actions)) assert.ok(body(text, name).includes(gateText(file, gate)), `${file} ${name} asks ${JSON.stringify(gate)}`);
    });
  }

  test("each gate refuses a dashboard that did not open: signed out, or an account that did not resolve", () => {
    assert.ok(body(source("app/dashboard/actions.ts"), "dataFor").includes('if (opening.kind !== "open") return'));
    assert.ok(body(source("app/dashboard/actions.ts"), "contentWrite").includes('opening.kind === "open" ? run(opening.data) : refused('));
    assert.ok(body(source("app/dashboard/team-actions.ts"), "writesOn").includes('if (opening.kind !== "open" || !canReach(opening.data.viewer, page)) return null;'));
    for (const name of ["findForAdd", "findPeople"]) assert.ok(body(source("app/dashboard/team-actions.ts"), name).includes('opening.kind !== "open" || !canReach(opening.data.viewer, "members")'), name);
    assert.ok(body(source("app/dashboard/outreach-actions.ts"), "onOutreach").includes('if (opening.kind !== "open") return refused('));
    assert.ok(body(source("app/dashboard/outreach-actions.ts"), "onOutreach").includes('if (!canReach(opening.data.viewer, "outreach")) return refused('));
    assert.ok(body(source("app/dashboard/recruitment-actions.ts"), "answer").includes('if (opening.kind !== "open") return refused('));
    for (const name of Object.keys(ACTIONS["app/dashboard/project-actions.ts"])) {
      assert.ok(body(source("app/dashboard/project-actions.ts"), name).includes('if (opening.kind !== "open") return refused('), name);
    }
    assert.ok(body(source("app/dashboard/actions.ts"), "dataFor").includes("canReach(viewer, page)"));
  });

  test("a page-gated action refuses every viewer who does not reach its page", () => {
    for (const actions of Object.values(ACTIONS)) {
      for (const gate of Object.values(actions)) {
        if (!("page" in gate)) continue;
        const pages = typeof gate.page === "string" ? [gate.page] : gate.page;
        for (const { name, viewer, expect } of VIEWERS) {
          assert.equal(pages.some((p) => canReach(viewer, p)), pages.some((p) => expect.pages.includes(p)), `${name}: ${pages.join(", ")}`);
        }
        assert.equal(pages.some((p) => SIGNED_OUT.pages.includes(p)), false);
      }
    }
  });
});

/** Every dashboard page file, and the page key it checks before it reads. */
const PAGES: Readonly<Record<string, DashboardPageKey | "editor">> = {
  "app/dashboard/page.tsx": "overview",
  "app/dashboard/my-alumni/page.tsx": "my-alumni",
  "app/dashboard/my-applications/page.tsx": "my-applications",
  "app/dashboard/team-tree/page.tsx": "team-tree",
  "app/dashboard/positions/page.tsx": "positions",
  "app/dashboard/applications/page.tsx": "applications",
  "app/dashboard/members/page.tsx": "members",
  "app/dashboard/projects/page.tsx": "projects",
  "app/dashboard/projects/[slug]/page.tsx": "editor",
  "app/dashboard/outreach/page.tsx": "outreach",
  "app/dashboard/outreach/new/page.tsx": "outreach",
  "app/dashboard/outreach/[slug]/page.tsx": "outreach",
  "app/dashboard/partners/page.tsx": "partners",
  "app/dashboard/alumni/page.tsx": "alumni",
  "app/dashboard/faq/page.tsx": "faq",
  "app/dashboard/team-page/page.tsx": "team-page",
  "app/dashboard/access/page.tsx": "division-access",
  "app/dashboard/orders/page.tsx": "orders",
  "app/dashboard/profile/page.tsx": "my-profile",
  "app/dashboard/account/page.tsx": "my-account",
};

describe("every page under app/dashboard checks its reach before it reads", () => {
  for (const [file, key] of Object.entries(PAGES)) {
    test(file, () => {
      const text = source(file);
      assert.match(text, /if \(opening\.kind === "signed-out"\) redirect\(/);
      if (key === "editor") {
        // The project editor's list is null for a viewer the site-content gate refuses.
        assert.match(text, /if \(items === null\) notFound\(\);/);
        return;
      }
      const check = text.indexOf(`, "${key}")) notFound();`);
      assert.notEqual(check, -1, `${file} checks ${key}`);
      assert.match(text.slice(check - 60, check), /canReach\((data|opening\.data)\.viewer$/);
      assert.ok(!/await data\.\w+\(/.test(text.slice(0, check)), `${file} reads before it checks`);
    });
  }
});

describe("the CV and letter links", () => {
  test("the document route answers only through the dashboard's rule, refusing before it reads the file", () => {
    const route = source("app/dashboard/applications/[id]/[document]/route.ts");
    const opened = route.indexOf('if (opening.kind !== "open") return refusal(401');
    const asked = route.indexOf("opening.data.applicationDocument(applicationId, kind)");
    const refused = route.indexOf('if (error instanceof DashboardRefused) return refusal(403');
    const read = route.indexOf("readPrivateFile(stored.pathname)");
    assert.ok(opened !== -1 && asked !== -1 && refused !== -1 && read !== -1);
    assert.ok(opened < asked && asked < refused && refused < read);
  });

  test("the old file address asks the same rule, and no scope row: an applicant opens their own file, anyone else what `applicationDocument` hands them", () => {
    const route = source("app/(legacy)/docs/applications/[r2key]/[filename]/route.ts");
    assert.doesNotMatch(route, /ScopeInfo|getUserScope|getScopeInfo/);
    asksFirst("app/(legacy)/docs/applications/[r2key]/[filename]/route.ts", "openableFile", "a.userId === userId", "openDashboard()");
    asksFirst("app/(legacy)/docs/applications/[r2key]/[filename]/route.ts", "openableFile", "opening.data.applicationDocument(application.id, application.kind)");
    assert.ok(body(route, "GET").indexOf("openableFile(fileHash, userId)") < body(route, "GET").indexOf("readPrivateFile("));
  });
});
