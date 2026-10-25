import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { canSwitchRecruitment } from "@/lib/apply/recruitment-switch";
import { maySiteContent } from "@/lib/content/gate";
import { canReach, DASHBOARD_PAGES, NAV_GROUPS, sidebarFor, type DashboardPageKey } from "./access";
import { mayOpenApplication, readsRecruitment, readsRecruitmentIn } from "./application-documents";
import { overviewAreasOf } from "./division-overview";
import { opensWholeTeam } from "./members-view";
import { ordersScopeOf, type OrdersScopeRow } from "./orders";
import { mayChangePositionIn } from "./position-access";
import { GRANT_AREAS, isOffTeam, ledDivisionIds, mayChange, readsArea, readsAreaIn } from "./viewer";
import { ALL, CHANGE_AREAS, CONTENT, ORG, PAGE_OF_AREA, SCOPES, SIGNED_OUT, TEAM_BASE, UNITS, unitsWhere, VIEWERS, type Unit, type Viewer } from "./access-matrix/matrix";
import { aliasAttentionFor, answersAliasRequests, managesMember, type AliasRequest, type AliasTeamPerson } from "./alias-request";
import { ownAliasOf, planAliasSetUp, showsAliasCard } from "./alias-setup";
import type { TeamPerson } from "./division-edit";
import { membershipsOf, type OrgChart } from "./team";

// The dashboard access matrix (issue #477), cell by cell against the domain
// rules. The matrix itself is data in ./access-matrix/matrix.ts; the server
// side, every loader, action and file route called for real as each viewer,
// is ./access-matrix-server.test.ts.

const PAGE_KEYS = DASHBOARD_PAGES.map((p) => p.key);

describe("the access matrix covers every viewer kind and every page", () => {
  test("every viewer kind the issue names has a row", () => {
    const names = VIEWERS.map((v) => v.name);
    for (const area of GRANT_AREAS) for (const scope of Object.keys(SCOPES)) assert.ok(names.includes(`member with a ${area} grant across the ${scope}`));
    for (const name of ["team leader", "operations lead", "IT lead", "department head", "division lead", "member", "alumnus with scope rows left over", "non-member"]) {
      assert.ok(names.includes(name), name);
    }
    assert.deepEqual(SIGNED_OUT.pages, []);
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
      assert.equal(canSwitchRecruitment(viewer), expect.switchesRecruitment, `${name}: recruitment switch`);
      const scope = isOffTeam(viewer.kind)
        ? null
        : ordersScopeOf(
            {
              fullAccess: viewer.kind === "operations-lead",
              teamLeader: viewer.roles.some((r) => r.type === "president"),
              headDepartment: viewer.headDepartment,
              ledDivisionIds: ledDivisionIds({ scopes: [], activeRoles: viewer.heldRoles }),
            },
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

  test("a lead's or head's Positions grant on another unit opens Positions there, and no other area, CV or figure about applications", () => {
    for (const name of ["division lead with a Positions grant (Can view) in DM", "department head with a Positions grant in DM"]) {
      const { viewer } = VIEWERS.find((v) => v.name === name)!;
      assert.equal(readsAreaIn(viewer, "positions", UNITS.DM), true, name);
      for (const area of ["applications", "members", "orders"] as const) assert.equal(readsAreaIn(viewer, area, UNITS.DM), false, `${name}: ${area}`);
      // The counts, new markers and quiet lines on a role follow this rule (`readPositionRows`, ./database-recruitment.ts).
      assert.equal(readsRecruitmentIn(viewer, "applications", UNITS.DM), false, `${name}: application figures`);
      assert.equal(mayOpenApplication(viewer, { unit: UNITS.DM, withdrawn: false }), false, `${name}: a CV in DM`);
    }
  });

  test("a Content grant reaches the six content editors, Alumni among them, and the site-content gate, and nothing else (issues #504, #589)", () => {
    const { viewer } = VIEWERS.find((v) => v.name === "member with a Content grant")!;
    assert.equal(maySiteContent(viewer), true);
    assert.deepEqual(PAGE_KEYS.filter((page) => canReach(viewer, page)), [...TEAM_BASE, ...CONTENT].sort((a, b) => PAGE_KEYS.indexOf(a) - PAGE_KEYS.indexOf(b)));
    assert.equal(canReach(viewer, "alumni"), true);
    for (const area of GRANT_AREAS) assert.equal(readsArea(viewer, area), false, area);
  });

  test("no other grant reaches the content editors or the site-content gate: Positions, Applications, Members, Orders, Approve orders, and no Can view or old Alumni website row (issues #504, #589)", () => {
    const others = VIEWERS.filter((v) => v.viewer.kind === "member" && v.name !== "member with a Content grant" && v.viewer.rawRows.length > 0);
    const names = others.map((v) => v.name);
    for (const area of GRANT_AREAS) assert.ok(names.some((n) => n.startsWith(`member with a ${area} grant`)), area);
    for (const name of [
      "member with a Can view website row on content",
      "member with a Can view website row on all",
      "member with a Can edit website row on all",
      "member with Approve orders",
    ])
      assert.ok(names.includes(name), name);
    for (const { name, viewer } of others) {
      assert.equal(maySiteContent(viewer), false, `${name}: site content`);
      for (const page of CONTENT) assert.equal(canReach(viewer, page), false, `${name}: ${page}`);
    }
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

// Email alias requests (epic #538) ------------------------------------------
//
// Who leads or heads whom is read from the viewer's roles on the team
// (`managesMember`): a lead for their division, a head for their department,
// the team leader for anyone; a grant makes nobody a requester. Full access
// asks for anyone on top of it (issue #721, ./alias-request.test.ts). Who answers is the viewer's seat
// (`answersAliasRequests`): the team leader, the operations lead and the IT
// lead, never the board seats or full access from a scope row.

const ALIAS_ORG: OrgChart = {
  departments: ORG.map((d) => ({ id: d.id, name: d.name, code: null, kind: "technical" as const })),
  divisions: ORG.flatMap((d) => d.divisions.map((v) => ({ id: v.id, name: v.name, departmentId: d.id, code: null }))),
};
const VIEWER_ID = 100;
const personIn = (u: Unit) => 200 + ALL.indexOf(u);

/** The viewer as the alias rules read them: their active roles on the team, none once off it. */
function aliasPersonOf(viewer: Viewer): AliasTeamPerson {
  const memberships = membershipsOf(
    viewer.roles.flatMap((r) =>
      r.divisionId !== null && r.type !== "head" && r.type !== "president" ? [{ divisionId: r.divisionId, role: r.type === "lead" ? "lead" : "member", since: "2025-10-01" } as const] : [],
    ),
  );
  const beyond = viewer.roles.flatMap((r): TeamPerson["beyond"] =>
    r.type === "president" ? [{ kind: "team-leader", title: "" }] : r.type === "head" ? [{ kind: "head", departmentId: r.departmentId, title: "Head" }] : [],
  );
  return { id: VIEWER_ID, name: "Viewer", emails: [], signInEmail: "viewer@mail.test", memberships, beyond };
}

const ALIAS_TEAM: readonly AliasTeamPerson[] = ALL.map((u) => ({
  id: personIn(u),
  name: `Person ${u}`,
  emails: [],
  signInEmail: `person-${u.toLowerCase()}@mail.test`,
  memberships: membershipsOf([{ divisionId: UNITS[u].divisionId, role: "member", since: "2025-10-01" }]),
  beyond: [],
}));

describe("email alias requests: who asks, who answers, and the approver rows (managesMember, answersAliasRequests, aliasAttentionFor)", () => {
  const open: AliasRequest[] = ALL.map((u, i) => ({ id: i + 1, memberId: personIn(u), requesterId: null, sentAt: "2026-10-22T09:00:00Z" }));
  for (const { name, viewer, expect } of VIEWERS) {
    test(name, () => {
      const me = aliasPersonOf(viewer);
      const team = [...ALIAS_TEAM, me];
      assert.deepEqual(
        ALL.filter((u) => managesMember(me, team.find((p) => p.id === personIn(u))!, ALIAS_ORG)),
        expect.aliases.requests,
        `${name}: Request alias`,
      );
      assert.equal(answersAliasRequests(viewer), expect.aliases.answers, `${name}: answers`);
      const rows = aliasAttentionFor(viewer, open, team, ALIAS_ORG, new Date("2026-10-22T12:00:00Z"));
      assert.equal(rows.length, expect.aliases.answers ? open.length : 0, `${name}: one Overview row per open request`);
    });
  }
});

// A member's own alias card (issue #542): every viewer on the team sees their
// own alias until they set it up, whatever their role; off the team, none.
// "I've set it up" is allowed once, and never without an alias.

describe("the member's own alias card and I've set it up (ownAliasOf, showsAliasCard, planAliasSetUp)", () => {
  const ADDRESS = "viewer.alias@politorocketteam.it";
  for (const { name, viewer } of VIEWERS) {
    test(name, () => {
      const onTeam = !isOffTeam(viewer.kind);
      const fresh = ownAliasOf({ kind: viewer.kind, alias: ADDRESS, setUpAt: null });
      assert.deepEqual(fresh, onTeam ? { address: ADDRESS, setUp: false } : null, `${name}: their alias`);
      assert.equal(showsAliasCard(fresh), onTeam, `${name}: the card`);
      assert.equal(planAliasSetUp(fresh).ok, onTeam, `${name}: I've set it up`);
      const done = ownAliasOf({ kind: viewer.kind, alias: ADDRESS, setUpAt: "2026-10-22T10:00:00Z" });
      assert.equal(showsAliasCard(done), false, `${name}: the card once set up`);
      assert.equal(planAliasSetUp(done).ok, false, `${name}: a second press`);
      const none = ownAliasOf({ kind: viewer.kind, alias: null, setUpAt: null });
      assert.equal(showsAliasCard(none), false, `${name}: no alias, no card`);
      assert.equal(planAliasSetUp(none).ok, false, `${name}: no alias to set up`);
    });
  }
});

// Pages ---------------------------------------------------------------------
//
// A page is a server component that renders what its loader hands it; the
// loaders themselves are called for real in ./access-matrix-server.test.ts.
// Here each page under app/dashboard is pinned to check its reach before it
// reads anything.

const root = new URL("../../", import.meta.url);
const source = (file: string) => readFileSync(new URL(file, root), "utf8");

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
  test("the table lists every page file", () => {
    const listed = Object.keys(PAGES).sort();
    const pages = (dir: string): string[] =>
      readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name === "page.tsx" ? [`${dir}/page.tsx`] : [],
      );
    assert.deepEqual(pages("app/dashboard").sort(), listed);
  });

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
