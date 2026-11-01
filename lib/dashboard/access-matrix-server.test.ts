import "./access-matrix/install";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { NextRequest } from "next/server";
import * as actions from "@/app/dashboard/actions";
import * as outreachActions from "@/app/dashboard/outreach-actions";
import * as projectActions from "@/app/dashboard/project-actions";
import * as recruitmentActions from "@/app/dashboard/recruitment-actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { GET as documentGET } from "@/app/dashboard/applications/[id]/[document]/route";
import { GET as legacyGET } from "@/app/(legacy)/docs/applications/[r2key]/[filename]/route";
import { GET as membersExportGET } from "@/app/dashboard/members/export/route";
import {
  betterAuthUsers,
  divisions,
  logs,
  members,
  orders,
  projects,
  projectVersions,
  prtEmailRemovals,
  recruitmentSetting,
  roles,
  scopes,
  teamAddresses,
  teamAddressRemovals,
  teamAddressReroutes,
  teamAddressRequests,
  teamLeaves,
  users,
} from "@/db/schema";
import { databaseTeamRoles } from "@/lib/about/team-data";
import { teamBuildOf } from "@/lib/about/team-roles";
import { editorVersion } from "@/lib/content/versioned";
import { importedProjects } from "@/lib/project-content/import";
import { footerProjects, publishedProjects } from "@/lib/project-content/public";
import { publishedPageOf } from "@/lib/project-content/record";
import { readProjectStamps } from "./database-projects";
import { GATE_OFF, GATE_ON, OTHER_DB, PREVIEW_DB } from "@/lib/dev-tester-fixture";
import { ADMIN_TESTER_TITLE } from "./acting-account";
import { recordViewAs, viewAsRefusal } from "./database-view-as";
import { readViewAsOpening } from "./database-view-as-dialog";
import { viewAsSiteOf, type ViewAsSite } from "./view-as";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { DashboardRefused, type DashboardData } from "./data";
import { areaLevelsOf, canChangePerson, checkRemoveGrant, grantablePeople, heldIn, heldLines, holdsAny, placeKey, placesOf, removalOf, type AccessPage } from "./division-access";
import type { TeamSearch } from "./division-edit";
import { SEAT_TITLE_REQUIRED } from "./division-members";
import { membersExportFileName, XLSX_TYPE } from "./members-export";
import { filterTeam, NO_TEAM_FILTER } from "./team-members";
import { membersModelOf, NO_MEMBERS_FILTER, shownMembers } from "./members-view";
import { readSheet } from "./access-matrix/xlsx";
import { openDashboard } from "./open";
import { canEditOrder, type OrdersPage } from "./orders";
import { overviewOfSections, type OverviewSections, type TeamSideOverview } from "./overview";
import type { TeamStructure } from "./team-structure";
import { applicationsModelOf } from "./applications-view";
import { positionsModelOf } from "./positions-view";
import type { ApplicationsPage, PositionsPage } from "./recruitment";
import { addRows, changeRows, clearRows, databaseWrites, loggedWriters, logRowsSinceSeed, tableRows } from "./access-matrix/test-database";
import type { OwnAlias } from "./alias-setup";
import { isOffTeam, isTeamLeader } from "./viewer";
import { fileReads, resetFiles } from "./access-matrix/fakes/files";
import { ownPublicStoreHost } from "./access-matrix/fakes/public-store";
import { accountOf, cvHash, EXTRA, IDS, MARKERS, seedFixture } from "./access-matrix/fixture";
import { ALL, ORG, VIEWERS, type Expect, type MatrixRow, type Unit } from "./access-matrix/matrix";
import { signInAs, viewAs } from "./access-matrix/session";

// The server side of the dashboard access matrix (issue #477): every loader
// the data interface hands the pages, every server action under
// app/dashboard and both CV and letter routes, called for real as every
// matrix viewer and signed out. They run against a migrated in-memory
// Postgres (./access-matrix/test-database.ts) seeded with the matrix's org
// and a unit's worth of private data in each division
// (./access-matrix/fixture.ts); only the database client, the session, Next's
// cache and headers and the file stores are swapped
// (./access-matrix/install.ts). Each unit's data carries markers, so an
// answer is checked for what it holds, not for the rule its code asks; a
// write is checked by the rows it changed.

/** Signs in as the matrix viewer and opens their dashboard on a freshly seeded database. */
async function open(name: string): Promise<DashboardData> {
  await seedFixture();
  signInAs(accountOf(name).userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
  return (opening as { data: DashboardData }).data;
}

/** A call's answer, or "refused" when it threw DashboardRefused. */
async function answerOf(call: () => Promise<unknown>): Promise<unknown> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof DashboardRefused) return "refused";
    throw error;
  }
}

/** Every marker the viewer may be shown: each area's, in the units they read it. */
function allowedMarkers(expect: Expect): Set<string> {
  const allowed = new Set<string>();
  const add = (markers: readonly string[]) => markers.forEach((m) => allowed.add(m));
  for (const u of ALL) {
    if (expect.reads.positions.includes(u)) add([...MARKERS.positions(u), ...MARKERS.title(u)]);
    if (expect.reads.applications.includes(u)) add([...MARKERS.applications(u), ...MARKERS.title(u)]);
    if (expect.reads.members.includes(u)) add(MARKERS.members(u));
    // The Orders page lists the whole team's orders to anyone it opens for (issue #233).
    if (expect.ordersPage || expect.reads.orders.includes(u)) add(MARKERS.orders(u));
  }
  return allowed;
}

/** The markers in an answer the viewer may not be shown. */
function leaked(answer: unknown, expect: Expect): string[] {
  const text = JSON.stringify(answer ?? null).toLowerCase();
  const allowed = allowedMarkers(expect);
  return ALL.flatMap((u: Unit) => Object.values(MARKERS).flatMap((of) => of(u))).filter((m) => !allowed.has(m) && text.includes(m));
}

/**
 * A read the data interface hands a page: its path on the interface, the
 * arguments it is called with (each unit's, where it takes one), and, for a
 * read that answers in parts, how its parts arrive as one answer.
 */
type Read = { readonly path: string; readonly args?: readonly (readonly unknown[])[]; readonly whole?: (answer: unknown) => Promise<unknown> };

const READS: readonly Read[] = [
  { path: "navCounts" },
  { path: "hasShownApplications" },
  { path: "overview" },
  // The page streams the Overview by section (issue #397): every section is swept, as it arrives.
  { path: "overviewSections", whole: (answer) => overviewOfSections(answer as OverviewSections) },
  { path: "myAlumni" },
  { path: "members" },
  { path: "findForAdd", args: ALL.map((u) => [IDS.division(u), "person"]) },
  { path: "findPeople", args: [["person"]] },
  { path: "findMoveTargets", args: ALL.map((u) => [IDS.person(u)]) },
  { path: "alumni" },
  { path: "teamTree" },
  { path: "teamStructure" },
  { path: "recruitment" },
  { path: "positions" },
  { path: "applications" },
  { path: "applicationDocument", args: ALL.flatMap((u) => [[IDS.application(u), "cv"], [IDS.application(u), "motivation-letter"]]) },
  { path: "divisionAccess" },
  { path: "orders" },
  { path: "activityLog" },
  { path: "partners.list" },
  { path: "faqs.list" },
  { path: "teamPage.open" },
  { path: "teamAdvisors.list" },
  { path: "outreach.posts.list" },
  { path: "outreach.tags" },
  { path: "outreach.featured" },
  { path: "projects.list" },
  { path: "projects.board" },
  { path: "myProfile" },
  { path: "myAccount" },
  { path: "myApplications" },
  { path: "memberAliases", args: [[ALL.map((u) => IDS.person(u))]] },
  { path: "memberTeamAddresses", args: [[ALL.map((u) => IDS.person(u))]] },
  { path: "myAlias" },
  { path: "myTeamAddresses" },
];

/** Calls the method at `path` on the data interface. */
function callPath(data: DashboardData, path: string, args: readonly unknown[]): Promise<unknown> {
  const parts = path.split(".");
  const owner = parts.slice(0, -1).reduce<Record<string, unknown>>((o, p) => o[p] as Record<string, unknown>, data as unknown as Record<string, unknown>);
  return (owner[parts[parts.length - 1]] as (...a: readonly unknown[]) => Promise<unknown>)(...args);
}

/** Every read, once per argument list, by a name that says which. */
const readCalls = (): [string, (data: DashboardData) => Promise<unknown>][] =>
  READS.flatMap(({ path, args = [[]], whole }) =>
    args.map((a): [string, (data: DashboardData) => Promise<unknown>] => [
      `${path}(${a.join(", ")})`,
      async (d) => {
        const answer = await callPath(d, path, a);
        return whole === undefined ? answer : whole(answer);
      },
    ]),
  );

/** Every method's path on the data interface, editors and the team's writes included. */
function methodPaths(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, v]) => {
    if (key === "viewer") return [];
    if (typeof v === "function") return [`${prefix}${key}`];
    return v !== null && typeof v === "object" ? methodPaths(v as Record<string, unknown>, `${prefix}${key}.`) : [];
  });
}

/**
 * The markers the viewer's pages must show, so a clean answer is never one
 * that read nothing: each role's description where they read Positions, each
 * applicant where they read Applications, each person's private details where
 * they read Members, each order where Orders opens for them.
 */
function expectedMarkers(expect: Expect): string[] {
  return ALL.flatMap((u) => [
    ...(expect.reads.positions.includes(u) ? MARKERS.positions(u) : []),
    ...(expect.reads.applications.includes(u) ? MARKERS.applications(u) : []),
    ...(expect.reads.members.includes(u) ? MARKERS.members(u) : []),
    ...(expect.ordersPage ? MARKERS.orders(u) : []),
  ]);
}

/** The unit a position, by id, sits in. */
const unitOfPosition = (id: number): Unit => ALL.find((u) => IDS.position(u) === id)!;
/** The unit a division, by name, is. */
const unitNamed = (name: string): Unit => ALL.find((u) => ORG.flatMap((d) => d.divisions).find((d) => d.id === IDS.division(u))!.name === name)!;

describe("figures about applications come only where the viewer reads Applications (issue #477, scope update)", () => {
  // Each unit holds one new application, so a figure counts the units it covers.
  for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
    const reads = expect.reads.applications;
    test(name, async () => {
      const data = await open(name);

      const positions = await answerOf(() => data.positions());
      if (positions !== "refused") {
        for (const row of (positions as PositionsPage).positions) {
          const unit = unitOfPosition(row.id);
          assert.equal(row.applications !== null, reads.includes(unit), `${name}: counts on the role in ${unit}`);
          // New, at interview, and accepted: three, one of them new.
          if (row.applications !== null) assert.deepEqual([row.applications.total, row.applications.fresh], [3, 1], `${name}: counts in ${unit}`);
        }
      }

      const counts = await data.navCounts();
      assert.deepEqual(counts, reads.length === 0 ? {} : { applications: reads.length }, `${name}: the Applications badge`);

      const overview = await answerOf(() => data.overview());
      if (overview === "refused") return;
      // Every seat reads one Overview, a member's with only their granted areas (issue #593).
      const board = overview as TeamSideOverview;
      const fresh = board.stats.find((s) => s.label === "New applications");
      if (reads.length === 0) assert.equal(fresh, undefined, `${name}: a New applications figure`);
      else assert.equal(fresh?.value, String(reads.length), `${name}: New applications`);
      const rows = board.attention.filter((a) => a.kind === "applications" || a.kind === "quiet-position");
      for (const row of rows) {
        const id = Number(/position=(\d+)/.exec(JSON.stringify(row.action))?.[1]);
        assert.ok(reads.includes(unitOfPosition(id)), `${name}: "${row.title}" is about a role where they do not read Applications`);
      }
      // The team leader's board lists what waits for their decision, never new applications (board 72).
      if (board.shape !== "leader") assert.equal(rows.filter((a) => a.kind === "applications").length, reads.length, `${name}: one new-application row per unit read`);
      if (board.shape === "department") {
        for (const d of board.divisions) assert.equal(d.newApplications, reads.includes(unitNamed(d.name)) ? 1 : 0, `${name}: ${d.name}`);
      }
      if (board.shape === "leader") {
        for (const d of board.departments) {
          const inside = ALL.filter((u) => IDS.department(u) === d.id && reads.includes(u)).length;
          assert.equal(d.newApplications, inside, `${name}: ${d.name}`);
        }
      }
    });
  }
});

// The intro each Positions grant holder's page reads: the places the grant names, never their own division (Mission Analysis).
const GRANT_INTROS: Readonly<Record<string, string>> = {
  "member with a positions grant across the division": "Roles in the Mission Analysis.",
  "member with a positions grant across the department": "Roles in the Aerodynamics Department.",
  // A `team` row is a grant in every open department, the fixture's spare one included: the line names the team once (issue #577).
  "member with a positions grant across the team": "Every role in the team.",
  "member with a Positions grant (Can view) in MA": "Roles in the Mission Analysis.",
  "member with a Positions grant (Can edit) in MA and (Can view) in DM": "Roles in the Design & Manufacturing and the Mission Analysis.",
};

describe("the Positions page offers only what the viewer may do (issue #487)", () => {
  for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
    test(name, async () => {
      const data = await open(name);
      const page = await answerOf(() => data.positions());
      if (page === "refused") return;
      const positions = page as PositionsPage;
      // Each role's switch is live exactly where the viewer changes Positions.
      for (const row of positions.positions) {
        const unit = unitOfPosition(row.id);
        assert.equal(row.canChange, expect.changes.positions.includes(unit), `${name}: the switch on the role in ${unit}`);
      }
      // The Applications column only for someone who reads Applications somewhere.
      assert.equal(positionsModelOf(positions).columns.includes("applications"), expect.reads.applications.length > 0, `${name}: the Applications column`);
      if (name in GRANT_INTROS) {
        assert.equal(positions.scope, "granted", name);
        assert.ok(positionsModelOf(positions).intro.startsWith(`${GRANT_INTROS[name]} `), `${name}: ${positionsModelOf(positions).intro}`);
      } else {
        assert.notEqual(positions.scope, "granted", name);
      }
    });
  }
});

// The intro each Applications grant holder's page reads: what the grant covers, never their own division (issue #577).
const APPLICATIONS_GRANT_INTROS: Readonly<Record<string, string>> = {
  "member with a applications grant across the division": "Applications for roles in the Mission Analysis.",
  "member with a applications grant across the department": "Applications for roles in the Aerodynamics Department.",
  "member with a applications grant across the team": "Applications for every role in the team.",
  "member with an Applications grant (Can view) across the team": "Applications for every role in the team.",
  "member with an Applications grant (Can edit) in MA and (Can view) in DM": "Applications for roles in the Design & Manufacturing and the Mission Analysis.",
};

describe("the Applications page offers a move only where the viewer may make it (issue #577)", () => {
  for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
    test(name, async () => {
      const data = await open(name);
      const page = await answerOf(() => data.applications());
      if (page === "refused") return;
      const applications = page as ApplicationsPage;
      // Each application's panel offers steps exactly where the viewer changes Applications.
      for (const a of applications.applications) {
        const position = applications.positions.find((p) => p.ref === a.position.ref)!;
        const unit = unitOfPosition(Number(position.ref));
        assert.equal(a.canChange, expect.changes.applications.includes(unit), `${name}: the application in ${unit}`);
      }
      if (name in APPLICATIONS_GRANT_INTROS) {
        assert.equal(applications.scope.kind, "granted", name);
        assert.equal(applicationsModelOf(applications).intro, APPLICATIONS_GRANT_INTROS[name], name);
      } else {
        assert.notEqual(applications.scope.kind, "granted", name);
      }
    });
  }
});

const ACTION_FILES = ["actions", "team-actions", "outreach-actions", "project-actions", "recruitment-actions"].map((f) =>
  readFileSync(new URL(`../../app/dashboard/${f}.ts`, import.meta.url), "utf8"),
);

/** How an action calls a method: `data.positions(`, `writes.saveMember(` for the team's writes, `partners.save(` on an editor. */
function callText(path: string): string {
  const parts = path.split(".");
  if (parts.length === 1 || parts[0] === "teamWrites") return `.${parts[parts.length - 1]}(`;
  return `${parts[parts.length - 2]}.${parts[parts.length - 1]}(`;
}

/**
 * The writes on the data interface no server action makes, called directly
 * as every viewer the matrix keeps out: Approve orders, which the Access page
 * gives through its own write, and the content editors' plain item writes,
 * which their own save methods run behind the site-content gate.
 */
const neverAsked = async () => ({ ok: false as const, error: "never asked" });
const DIRECT_WRITES = new Map<string, { readonly args: readonly unknown[]; readonly may: (r: MatrixRow) => boolean; readonly proves: Proof }>([
  ["setApproveOrders", { args: [{ personId: IDS.person("DM"), holds: true }], may: (r) => isTeamLeader(r.viewer), proves: "write" }],
  ["teamAdvisors.save", { args: ["save-draft", []], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["outreach.posts.save", { args: [null, "save-draft", neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["outreach.posts.saveUnfinished", { args: [null, neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["outreach.posts.reorder", { args: [() => true, []], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.save", { args: [null, "save-draft", neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.saveUnfinished", { args: [null, neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.unpublish", { args: [1], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.reorder", { args: [() => true, []], may: (r) => r.expect.siteContent, proves: "gate" }],
  // The dashboard no longer sets the project order (issue #506); the stored write stays behind the gate.
  ["projects.setSiteOrder", { args: [[]], may: (r) => r.expect.siteContent, proves: "gate" }],
]);

describe("the data interface opens only for a resolved account, and every method on it is called here", () => {
  test("signed out, or holding a session that resolves to no account, nothing opens", async () => {
    await seedFixture();
    signInAs(null);
    assert.equal((await openDashboard()).kind, "signed-out");
    signInAs("no-such-account");
    assert.equal((await openDashboard()).kind, "account-unresolved");
  });

  test("each method is a read the sweep below calls, or the write of an action called further down", async () => {
    const paths = methodPaths((await open("team leader")) as unknown as Record<string, unknown>);
    const reads = READS.map((r) => r.path);
    for (const path of reads) assert.ok(paths.includes(path), `${path} is not on the data interface`);
    const unreached = paths.filter((p) => !reads.includes(p) && !ACTION_FILES.some((text) => text.includes(callText(p))));
    assert.deepEqual(unreached.sort(), [...DIRECT_WRITES.keys()].sort(), "every write no action makes is called directly below");
  });
});

describe("every loader, as every matrix viewer, answers only what the viewer reads", () => {
  for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
    test(name, async () => {
      const data = await open(name);
      let seen = "";
      for (const [read, call] of readCalls()) {
        const answer = await answerOf(() => call(data));
        assert.deepEqual(leaked(answer, expect), [], `${name}: ${read} holds data the viewer does not read`);
        seen += JSON.stringify(answer ?? null).toLowerCase();
      }
      assert.deepEqual(
        expectedMarkers(expect).filter((m) => !seen.includes(m)),
        [],
        `${name}: data the viewer reads is missing`,
      );
      assert.deepEqual(await databaseWrites(), [], `${name}: a read wrote`);
    });
  }
});

// Server actions ------------------------------------------------------------
//
// Every exported server action, called as each matrix viewer and signed out,
// aimed at Design & Manufacturing (DM): a unit most viewers do not reach.
// Each runs once as an account that may make it (`control`), which shows the
// input is one the action takes and the write lands; then as every viewer
// who may not, which must get a refusal and leave no write behind.

const PHOTO = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "photo.jpg", { type: "image/jpeg" });

function form(fields: Readonly<Record<string, string | File>>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** A refusal, in any of the shapes the dashboard answers one. */
function isRefusal(answer: unknown): boolean {
  if (answer === "refused" || answer === false || answer === null) return true;
  if (typeof answer !== "object") return false;
  if ("ok" in answer) return (answer as { ok: boolean }).ok === false;
  if ("kind" in answer) return (answer as { kind: string }).kind === "none";
  return false;
}

/** The account a case names: a matrix viewer's, or a fixture account by its user id. */
const userIdOf = (who: string) => (VIEWERS.some((v) => v.name === who) ? accountOf(who).userId : who);

async function attempt(userId: string | null, run: () => Promise<unknown>) {
  await seedFixture();
  resetFiles();
  signInAs(userId);
  const answer = await answerOf(run);
  return { answer, writes: (await databaseWrites()) };
}

/** The refusals a gate answers before the data interface looks at anything: signed out, no such page, no site-content access. */
const GATE_REFUSALS = ["Sign in again to make changes.", "You do not have this page.", SITE_CONTENT_REFUSAL];

/**
 * What the control's answer proves: `write`, that the write lands; `answer`,
 * for a read, that it answers; `gate`, that the site-content gate lets them
 * through, where the write itself needs content rows the fixture does not
 * hold (the gate is the whole rule there: `maySiteContent`, pinned per viewer
 * in ./access-matrix.test.ts).
 */
type Proof = "write" | "answer" | "gate";

type ActionCase = {
  /** `<file>.<export>`: the action under app/dashboard it calls. */
  readonly action: string;
  readonly run: () => Promise<unknown>;
  /** Who may make it. Undefined where the matrix does not decide the cell (the reason is named beside the case); never for an out-of-scope viewer. */
  readonly may: (row: MatrixRow) => boolean | undefined;
  /**
   * An account that may make it, so a refusal below is the rule's and not
   * the input's; or, where no account may, the check that the input is one
   * the action takes.
   */
  readonly control: { readonly who: string; readonly proves: Proof } | { readonly valid: () => boolean };
};

const by = (who: string, proves: Proof = "write") => ({ who, proves });

function proven(proves: Proof, answer: unknown, writes: readonly unknown[]): boolean {
  if (proves === "gate") return !GATE_REFUSALS.includes((answer as { error?: string } | null)?.error ?? "");
  return !isRefusal(answer) && (proves === "answer" || writes.length > 0);
}

const DM: Unit = "DM";
/** An email alias as Mark created leaves it, the member's PRT email (epic #538, issue #563), laid over the seeded row. */
const aliasOf = (memberId: number) => `alias-${memberId}@politorocketteam.it`;
const giveAlias = (memberId: number) => changeRows(members, { memberId }, { prtEmail: aliasOf(memberId) });
/** An open team address request for the member of DM, sent by its lead. */
const TEAM_ADDRESS_REQUEST = 1;
const addTeamAddressRequest = () =>
  addRows(teamAddressRequests, [
    { id: TEAM_ADDRESS_REQUEST, memberId: IDS.person(DM), address: "design@politorocketteam.it", purpose: "Design", requestedBy: IDS.lead(DM) },
  ]);
/** DM's lead's team address, not set up yet. */
const TEAM_ADDRESS = 1;
const addTeamAddress = () => addRows(teamAddresses, [{ id: TEAM_ADDRESS, address: "structures@politorocketteam.it", purpose: "Structures", holderId: IDS.lead(DM) }]);
/**
 * An open routing item: a team address tied to DM's lead, held by the member
 * of DM, goes to DM's lead. Mark done moves an address only to whoever holds
 * the tied role then (issue #795), so the item is one a role change could
 * have left.
 */
const TEAM_ADDRESS_REROUTE = 1;
const addTeamAddressReroute = async () => {
  await addRows(teamAddresses, [
    {
      id: TEAM_ADDRESS,
      address: "structures@politorocketteam.it",
      purpose: "Structures",
      holderId: IDS.person(DM),
      movesWith: "division_lead",
      movesWithDivisionId: IDS.division(DM),
    },
  ]);
  await addRows(teamAddressReroutes, [{ id: TEAM_ADDRESS_REROUTE, addressId: TEAM_ADDRESS, toMember: IDS.lead(DM), fromMember: IDS.person(DM) }]);
};
/** A team address held by the member of DM, with nothing waiting on it. */
const addMembersTeamAddress = () =>
  addRows(teamAddresses, [{ id: TEAM_ADDRESS, address: "structures@politorocketteam.it", purpose: "Structures", holderId: IDS.person(DM) }]);
/** An open removal of that address, sent by DM's lead (issue #797). */
const TEAM_ADDRESS_REMOVAL = 1;
const addTeamAddressRemoval = async () => {
  await addMembersTeamAddress();
  await addRows(teamAddressRemovals, [
    { id: TEAM_ADDRESS_REMOVAL, addressId: TEAM_ADDRESS, address: "structures@politorocketteam.it", fromMember: IDS.person(DM), removedBy: IDS.lead(DM) },
  ]);
};
/** An open removal of the PRT email of DM's member, as the database opens one when they leave (issue #931). */
const PRT_EMAIL_REMOVAL = 1;
const addPrtEmailRemoval = () => addRows(prtEmailRemovals, [{ id: PRT_EMAIL_REMOVAL, memberId: IDS.person(DM), address: "person.dm@politorocketteam.it" }]);
const changesDM = (area: "positions" | "applications" | "members") => (r: MatrixRow) => r.expect.changes[area].includes(DM);
const reaches = (page: Expect["pages"][number]) => (r: MatrixRow) => r.expect.pages.includes(page);
const fullAccess = (r: MatrixRow) => r.expect.wholeTeamMembers;
const isMember = (r: MatrixRow) => r.viewer.kind === "member" || r.viewer.kind === "alumni" || r.viewer.kind === "non-member";
/** Grants are independent: a member never acts as a lead, so no member makes a lead's or a head's change. */
const leadsOnly = (r: MatrixRow) => (fullAccess(r) ? true : isMember(r) ? false : undefined);
const nobody = () => false;
const POSITION = { title: "Engineer", description: "The role.", required: ["CAD"] };
const ALUMNUS = `m${accountOf("alumnus with scope rows left over").memberId}`;
const DETAILS = { firstName: "A", lastName: "B", phone: "", politoId: "", programme: "", level: "", country: "", birthDate: "", linkedin: "" };
const MEMBER_DETAILS = { phone: "", politoId: "", programme: "", level: "", country: "", birthDate: "", linkedin: "", prtEmail: "", discord: "", gender: "" };
const ORDER = { item: "Bolts", link: "https://example.com/bolts", price: "1", quantity: "1", reason: "Needed", division: String(IDS.division(DM)) };
const DIVISION = { newLeads: [EXTRA.mover], oldLeads: [], members: [], emails: [] };
/** A change in Structures' units: a lead's or a head's of it, or full access. DM is the matrix's unit there. */
const inStructures = (r: MatrixRow) => (r.expect.reads.members.includes(DM) ? leadsOnly(r) : false);
const siteContent = (r: MatrixRow) => r.expect.siteContent;
/**
 * Access on someone in DM: full access. No matrix lead leads DM, and a lead's
 * grant there adds no Access there (Owner decision, #478; #488). A head whose
 * own scope rows name DM is not decided here.
 */
const accessInDM = (r: MatrixRow) =>
  fullAccess(r) ? true : r.viewer.kind === "department-head" && r.viewer.rawRows.some((x) => x.divisionId === IDS.division(DM)) ? undefined : false;
const decidesOrders = (r: MatrixRow) => r.expect.decidesOrders;
/** The active seat row a matrix viewer's team-level seat is, in the database as seeded now. */
const seatRowOf = async (name: string): Promise<number> => {
  const row = (await tableRows(roles)).find((r) => r.memberId === accountOf(name).memberId && r.leavedAt == null && r.deptId == null && r.divisionId == null);
  if (typeof row?.id !== "number") throw new Error(`${name} holds no team-level seat`);
  return row.id;
};
const HOST = ownPublicStoreHost();

const ACTION_CASES: readonly ActionCase[] = [
  // Positions and Applications.
  { action: "recruitment-actions.setPositionOpen", run: () => recruitmentActions.setPositionOpen(IDS.position(DM), false), may: changesDM("positions"), control: by("team leader") },
  { action: "recruitment-actions.editPosition", run: () => recruitmentActions.editPosition(IDS.position(DM), POSITION), may: changesDM("positions"), control: by("team leader") },
  { action: "recruitment-actions.deletePosition", run: () => recruitmentActions.deletePosition(IDS.position(DM)), may: changesDM("positions"), control: by("team leader") },
  {
    action: "recruitment-actions.createPosition",
    run: () => recruitmentActions.createPosition({ ...POSITION, divisionId: IDS.division(DM) }),
    may: changesDM("positions"),
    control: by("team leader"),
  },
  {
    action: "recruitment-actions.moveApplication",
    run: () => recruitmentActions.moveApplication(IDS.application(DM), { kind: "reject" }),
    may: changesDM("applications"),
    control: by("team leader"),
  },
  // The Statuses editor (issue #752): anyone who moves applications anywhere manages the one list.
  {
    action: "recruitment-actions.changeStatusList",
    run: () => recruitmentActions.changeStatusList({ kind: "edit", key: "new", was: { name: "New", colour: "#8A8A8F" }, name: "New", colour: "#8A8A8F" }),
    may: (r) => r.expect.changes.applications.length > 0,
    control: by("team leader"),
  },
  { action: "recruitment-actions.setRecruitment", run: () => recruitmentActions.setRecruitment(false), may: (r) => r.expect.switchesRecruitment, control: by("team leader") },

  // Members, in DM.
  { action: "team-actions.saveMember", run: () => teamActions.saveMember(IDS.person(DM), IDS.division(DM), "member"), may: changesDM("members"), control: by("team leader") },
  { action: "team-actions.moveToAlumni", run: () => teamActions.moveToAlumni(IDS.person(DM), "2024 – 2026", null), may: changesDM("members"), control: by("team leader") },
  // Confirm join is the Applications area's on the Members banner too (Owner decision, 2026-10-22, issue #584).
  { action: "team-actions.confirmJoin", run: () => teamActions.confirmJoin(IDS.joining(DM)), may: changesDM("applications"), control: by("team leader") },
  { action: "team-actions.findForAdd", run: () => teamActions.findForAdd(IDS.division(DM), "person"), may: changesDM("members"), control: by("team leader", "answer") },
  {
    action: "team-actions.addMember",
    run: () =>
      teamActions.addMember({ kind: "email", divisionId: IDS.division(DM), email: "new@mail.test", firstName: "New", lastName: "Person", title: "Member", details: MEMBER_DETAILS }),
    may: changesDM("members"),
    control: by("team leader"),
  },
  { action: "team-actions.confirmNda", run: () => teamActions.confirmNda(IDS.join(DM)), may: changesDM("members"), control: by("team leader") },
  { action: "team-actions.cancelAdd", run: () => teamActions.cancelAdd(IDS.join(DM)), may: changesDM("members"), control: by("team leader") },
  // Someone in DM and Testing: a division can let go of someone who stays on the team elsewhere.
  { action: "team-actions.removeFromDivision", run: () => teamActions.removeFromDivision(EXTRA.mover, IDS.division(DM)), may: changesDM("members"), control: by("team leader") },
  // Moving DM's member to Testing (issue #647): out of DM and into Structures, the rules of removing and adding.
  { action: "team-actions.findMoveTargets", run: () => teamActions.findMoveTargets(IDS.person(DM)), may: changesDM("members"), control: by("team leader", "answer") },
  {
    action: "team-actions.moveMember",
    run: () =>
      teamActions.moveMember({
        personId: IDS.person(DM),
        from: { kind: "division", divisionId: IDS.division(DM) },
        to: { kind: "division", divisionId: EXTRA.testing, as: "member" },
        title: "",
        replaced: null,
        successor: null,
      }),
    may: changesDM("members"),
    control: by("team leader"),
  },
  {
    action: "team-actions.saveMemberDetails",
    run: () => teamActions.saveMemberDetails({ kind: "person", id: IDS.person(DM) }, IDS.division(DM), { title: "Member", details: MEMBER_DETAILS }),
    may: changesDM("members"),
    control: by("team leader"),
  },
  {
    action: "team-actions.setMemberPhoto",
    run: () => teamActions.setMemberPhoto(IDS.person(DM), form({ photo: PHOTO() })),
    may: changesDM("members"),
    control: by("team leader"),
  },

  // The Team tree's structure: divisions and departments, in Structures.
  { action: "team-actions.findPeople", run: () => teamActions.findPeople("person"), may: leadsOnly, control: by("team leader", "answer") },
  { action: "team-actions.createDivision", run: () => teamActions.createDivision(IDS.department(DM), { name: "Avionics", code: "AVI", ...DIVISION }), may: inStructures, control: by("team leader") },
  { action: "team-actions.saveDivision", run: () => teamActions.saveDivision(EXTRA.emptyDivision, { name: "Avionics", code: "AVI", ...DIVISION }), may: inStructures, control: by("team leader") },
  { action: "team-actions.closeDivision", run: () => teamActions.closeDivision(EXTRA.emptyDivision), may: inStructures, control: by("team leader") },
  { action: "team-actions.createDepartment", run: () => teamActions.createDepartment({ name: "Avionics", code: "AVI", kind: "technical", heads: [EXTRA.mover] }), may: fullAccess, control: by("team leader") },
  {
    action: "team-actions.saveDepartment",
    run: () => teamActions.saveDepartment(EXTRA.emptyDepartment, { name: "Spares", code: "SPR", kind: "technical", head: null }),
    may: fullAccess,
    control: by("team leader"),
  },
  { action: "team-actions.closeDepartment", run: () => teamActions.closeDepartment(EXTRA.emptyDepartment, { people: [] }), may: fullAccess, control: by("team leader") },
  {
    action: "team-actions.handOverTeamLeader",
    run: () => teamActions.handOverTeamLeader({ to: IDS.person(DM), outcome: "leave" }),
    may: (r) => r.name === "team leader",
    control: by("team leader"),
  },
  // The seat row of Edit team tree (issue #627): the team leader and full access, as for departments.
  {
    action: "team-actions.changeSeatHolder",
    run: async () => teamActions.changeSeatHolder(await seatRowOf("Project Manager"), { to: EXTRA.mover, outcome: "advisor" }),
    may: fullAccess,
    control: by("team leader"),
  },
  { action: "team-actions.addSeat", run: () => teamActions.addSeat({ personId: EXTRA.mover, title: "Safety Officer" }), may: fullAccess, control: by("team leader") },
  // Remove seat (issue #643): the same viewers as the rest of the seat row.
  { action: "team-actions.removeSeat", run: async () => teamActions.removeSeat(await seatRowOf("Project Manager")), may: fullAccess, control: by("team leader") },
  // Add another holder (epic #861, issue #868): the same viewers as the rest of the seat row, on every seat kind.
  { action: "team-actions.addTeamLeader", run: () => teamActions.addTeamLeader({ personId: EXTRA.mover }), may: fullAccess, control: by("team leader") },
  {
    action: "team-actions.addSeatHolder",
    run: async () => teamActions.addSeatHolder(await seatRowOf("Project Manager"), { personId: EXTRA.mover }),
    may: fullAccess,
    control: by("team leader"),
  },
  { action: "team-actions.addDepartmentHead", run: () => teamActions.addDepartmentHead(IDS.department(DM), { personId: EXTRA.mover }), may: fullAccess, control: by("team leader") },

  // The Alumni page: site content under the Content grant (issue #589). The
  // control is a member holding Content at Can edit, so each write is proven
  // to land for them, and every Can view `website` row is refused above.
  { action: "team-actions.setAlumnusShown", run: () => teamActions.setAlumnusShown(ALUMNUS, false), may: reaches("alumni"), control: by("member with a Content grant") },
  { action: "team-actions.fixAlumnus", run: () => teamActions.fixAlumnus(ALUMNUS, { shown: true, name: "Alum", founder: null, roles: [] }), may: reaches("alumni"), control: by("member with a Content grant") },
  { action: "team-actions.setAlumnusPhoto", run: () => teamActions.setAlumnusPhoto(ALUMNUS, form({ photo: PHOTO() })), may: reaches("alumni"), control: by("member with a Content grant") },
  {
    action: "team-actions.addAdvisor",
    run: () => teamActions.addAdvisor({ group: "Advisors", name: "Ada Advisor", role: "Advisor", from: 2022, to: 2023 }, null),
    may: reaches("alumni"),
    control: by("member with a Content grant"),
  },

  // Access, on someone in DM. A lead's Access page covers only the divisions they lead by role (#488).
  { action: "actions.saveAccess", run: () => actions.saveAccess({ personId: IDS.person(DM), areas: { positions: "edit" } }), may: accessInDM, control: by("team leader") },
  { action: "actions.removeAllAccess", run: () => actions.removeAllAccess(IDS.person(DM)), may: accessInDM, control: by("team leader") },
  // The one grant DM's member holds: Members, in DM (./access-matrix/fixture.ts).
  {
    action: "actions.removeGrant",
    run: () => actions.removeGrant({ personId: IDS.person(DM), where: IDS.division(DM), target: "members" }),
    may: accessInDM,
    control: by("team leader"),
  },

  // Orders. Which units' orders an Orders page edits is #233's; the matrix pins the refusal without Orders.
  { action: "actions.placeOrder", run: () => actions.placeOrder(form(ORDER)), may: (r) => (r.expect.ordersPage ? undefined : false), control: by("team leader") },
  { action: "actions.editOrder", run: () => actions.editOrder(IDS.order(DM), form(ORDER)), may: (r) => (r.expect.ordersPage ? undefined : false), control: by("team leader") },
  { action: "actions.cancelOrder", run: () => actions.cancelOrder(IDS.order(DM)), may: (r) => (r.expect.ordersPage ? undefined : false), control: by("team leader") },
  // Only the team leader, or someone they gave Approve orders, decides (issue #233).
  { action: "actions.decideOrder", run: () => actions.decideOrder(IDS.order(DM), { kind: "approve" }), may: decidesOrders, control: by("team leader") },
  { action: "actions.markOrdered", run: () => actions.markOrdered(IDS.approvedOrder(DM)), may: decidesOrders, control: by("team leader") },

  // Site content: the site-content gate.
  { action: "actions.measurePartnerLogo", run: () => actions.measurePartnerLogo(form({ logo: PHOTO() })), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.savePartner", run: () => actions.savePartner(null, "save-draft", form({ name: "Partner" })), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.removePartner", run: () => actions.removePartner(1), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.reorderPartners", run: () => actions.reorderPartners("main", []), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.saveFaq", run: () => actions.saveFaq(null, "save-draft", form({ question: "Who?", answer: "Us." })), may: siteContent, control: by("team leader") },
  { action: "actions.removeFaq", run: () => actions.removeFaq(1), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.reorderFaqs", run: () => actions.reorderFaqs([]), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.saveTeamPage", run: () => actions.saveTeamPage("save-draft", {}, []), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.resetTeamPageLayer", run: () => actions.resetTeamPageLayer(), may: siteContent, control: by("team leader") },
  { action: "actions.uploadTeamPagePhoto", run: () => actions.uploadTeamPagePhoto(form({ photo: PHOTO() })), may: siteContent, control: by("team leader") },
  { action: "actions.endAdvising", run: () => actions.endAdvising(1, 1), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.saveOutreachPost", run: () => actions.saveOutreachPost(null, "save-draft", { title: "Post" }), may: siteContent, control: by("team leader", "gate") },
  { action: "actions.addOutreachTag", run: () => actions.addOutreachTag("Launch"), may: siteContent, control: by("team leader") },
  { action: "actions.uploadOutreachPhoto", run: () => actions.uploadOutreachPhoto(form({ photo: PHOTO() })), may: siteContent, control: by("team leader") },
  { action: "actions.discardOutreachPhoto", run: () => actions.discardOutreachPhoto(`https://${HOST}/post-photos/x.jpg`), may: siteContent, control: by("team leader") },
  { action: "outreach-actions.unpublishOutreachPost", run: () => outreachActions.unpublishOutreachPost(1), may: siteContent, control: by("team leader", "gate") },
  { action: "outreach-actions.deleteOutreachPost", run: () => outreachActions.deleteOutreachPost(1), may: siteContent, control: by("team leader", "gate") },
  { action: "outreach-actions.featureOutreachPost", run: () => outreachActions.featureOutreachPost(1), may: siteContent, control: by("team leader", "gate") },
  { action: "outreach-actions.unfeatureOutreachPost", run: () => outreachActions.unfeatureOutreachPost(1), may: siteContent, control: by("team leader", "gate") },
  { action: "project-actions.saveProject", run: () => projectActions.saveProject(1, "save-draft", {}), may: siteContent, control: by("team leader", "gate") },
  { action: "project-actions.createProject", run: () => projectActions.createProject({ name: "Rocket" }), may: siteContent, control: by("team leader", "gate") },
  // The migrations import Cavour as project 1, published (drizzle/0037).
  { action: "project-actions.deleteProject", run: () => projectActions.deleteProject(1), may: siteContent, control: by("team leader") },
  { action: "project-actions.uploadProjectPhoto", run: () => projectActions.uploadProjectPhoto(form({ photo: PHOTO() })), may: siteContent, control: by("team leader") },
  { action: "project-actions.discardProjectPhoto", run: () => projectActions.discardProjectPhoto(`https://${HOST}/project-photos/x.jpg`), may: siteContent, control: by("team leader") },
  { action: "project-actions.uploadProjectBackground", run: () => projectActions.uploadProjectBackground(form({ background: PHOTO() })), may: siteContent, control: by("team leader") },

  // The viewer's own pages: only their own rows.
  { action: "actions.saveLinkedin", run: () => actions.saveLinkedin("https://www.linkedin.com/in/someone"), may: reaches("my-profile"), control: by("member") },
  // The viewer's own PRT email and their own request for one (issue #921); no matrix viewer has either yet.
  { action: "actions.savePrtEmail", run: () => actions.savePrtEmail("viewer.own@politorocketteam.it"), may: reaches("my-profile"), control: by("member") },
  { action: "actions.requestOwnAlias", run: () => actions.requestOwnAlias("viewer.own@politorocketteam.it"), may: reaches("my-profile"), control: by("member") },
  { action: "actions.uploadPhoto", run: () => actions.uploadPhoto(form({ photo: PHOTO() })), may: reaches("my-profile"), control: by("member") },
  { action: "actions.removePhoto", run: () => actions.removePhoto(), may: reaches("my-profile"), control: by("member") },
  { action: "actions.leaveTeam", run: () => actions.leaveTeam("Moving on", false), may: reaches("my-profile"), control: by("member") },
  { action: "actions.setMyAlumniShown", run: () => actions.setMyAlumniShown(false), may: reaches("my-alumni"), control: by("alumnus with scope rows left over") },
  { action: "actions.uploadMyAlumniPhoto", run: () => actions.uploadMyAlumniPhoto(form({ photo: PHOTO() })), may: reaches("my-alumni"), control: by("alumnus with scope rows left over") },
  { action: "actions.removeMyAlumniPhoto", run: () => actions.removeMyAlumniPhoto(), may: reaches("my-alumni"), control: by("alumnus with scope rows left over") },
  // Optimization's lead hands it over; nobody else may send it.
  {
    action: "actions.sendHandOver",
    run: () => actions.sendHandOver({ role: { kind: "lead", divisionId: IDS.division("OA") }, to: IDS.person("OA"), outcome: "advisor" }),
    may: nobody,
    control: by("lead-oa"),
  },
  // DM's lead asks; the head of Structures answers (board 62c), and nobody in the matrix is.
  { action: "actions.answerHandOver", run: () => actions.answerHandOver(IDS.handOver(DM), "decline"), may: nobody, control: by("head-str") },
  // Email aliases (epic #538), for someone in DM: full access (issue #721), or a lead or a head of them, asks;
  // a lead or a head of them (the team leader included) cancels; only the team leader, the operations lead and the IT lead answer.
  { action: "actions.requestAlias", run: () => actions.requestAlias({ memberId: IDS.person(DM), address: "person.dm@politorocketteam.it" }), may: (r) => r.expect.aliases.requests.includes(DM), control: by("team leader") },
  {
    action: "actions.cancelAliasRequest",
    run: () => actions.cancelAliasRequest(IDS.aliasRequest(DM)),
    may: (r) => r.expect.aliases.manages.includes(DM),
    control: by("team leader"),
  },
  { action: "actions.answerAlias", run: () => actions.answerAlias(IDS.aliasRequest(DM), { kind: "decline" }), may: (r) => r.expect.aliases.answers, control: by("IT lead") },
  // Team addresses (epic #578, issue #787): who asks follows the alias rule.
  {
    action: "actions.requestTeamAddress",
    run: () => actions.requestTeamAddress({ memberId: IDS.person(DM), address: "design@politorocketteam.it", purpose: "Design", movesWith: null }),
    may: (r) => r.expect.aliases.requests.includes(DM),
    control: by("team leader"),
  },
  // Who answers is the alias rule (issue #788): the request is added first, as the fixture holds none.
  {
    action: "actions.answerTeamAddress",
    run: async () => (await addTeamAddressRequest(), actions.answerTeamAddress(TEAM_ADDRESS_REQUEST, { kind: "decline" })),
    may: (r) => r.expect.aliases.answers,
    control: by("IT lead"),
  },
  // Who moves a team address is the alias rule too (issue #789): the routing item is added first, as the fixture holds none.
  {
    action: "actions.markTeamAddressRerouteDone",
    run: async () => (await addTeamAddressReroute(), actions.markTeamAddressRerouteDone(TEAM_ADDRESS_REROUTE)),
    may: (r) => r.expect.aliases.answers,
    control: by("IT lead"),
  },
  // Who removes a team address is who may request one for its holder (issue #797); who marks the removal done is the alias rule.
  {
    action: "actions.removeTeamAddress",
    run: async () => (await addMembersTeamAddress(), actions.removeTeamAddress(TEAM_ADDRESS)),
    may: (r) => r.expect.aliases.requests.includes(DM),
    control: by("team leader"),
  },
  {
    action: "actions.markTeamAddressRemovalDone",
    run: async () => (await addTeamAddressRemoval(), actions.markTeamAddressRemovalDone(TEAM_ADDRESS_REMOVAL)),
    may: (r) => r.expect.aliases.answers,
    control: by("IT lead"),
  },
  // Who answers a personal PRT email removal is the alias rule too (issue #931): Mark done and Keep address alike.
  {
    action: "actions.answerPrtEmailRemoval",
    run: async () => (await addPrtEmailRemoval(), actions.answerPrtEmailRemoval(PRT_EMAIL_REMOVAL, "removed")),
    may: (r) => r.expect.aliases.answers,
    control: by("IT lead"),
  },
  // "I've set it up" (issue #542): DM's lead has an alias and stores it; no matrix viewer has one of their own,
  // so each is refused, and nobody's press reaches the lead's record.
  { action: "actions.confirmAliasSetUp", run: async () => (await giveAlias(IDS.lead(DM)), actions.confirmAliasSetUp()), may: nobody, control: by("lead-dm") },
  // "I've set it up" on a team address (owner finding on PR #794): only its holder, DM's lead, stores it; no matrix viewer holds it.
  {
    action: "actions.confirmTeamAddressSetUp",
    run: async () => (await addTeamAddress(), actions.confirmTeamAddressSetUp(TEAM_ADDRESS)),
    may: nobody,
    control: by("lead-dm"),
  },
  // A notice, an application and an interview of someone else's.
  { action: "actions.dismissNotice", run: () => actions.dismissNotice(IDS.notice(DM)), may: nobody, control: by("lead-dm") },
  { action: "actions.withdrawApplication", run: () => actions.withdrawApplication(IDS.application(DM)), may: nobody, control: by("applicant-dm") },
  { action: "actions.chooseInterviewSlot", run: () => actions.chooseInterviewSlot(IDS.interview(DM), IDS.slot(DM)), may: nobody, control: by("interviewee-dm") },
  // Everyone signed in changes their own details and closes their own account.
  { action: "actions.saveDetails", run: () => actions.saveDetails(DETAILS), may: () => true, control: by("member") },
  { action: "actions.deleteAccount", run: () => actions.deleteAccount(false, false), may: () => true, control: by("member") },
];

const ACTION_MODULES = {
  actions,
  "team-actions": teamActions,
  "outreach-actions": outreachActions,
  "project-actions": projectActions,
  "recruitment-actions": recruitmentActions,
} as const;

describe("every server action refuses every viewer the matrix keeps out, and writes nothing", () => {
  test("every exported action under app/dashboard has a case", () => {
    const exported = Object.entries(ACTION_MODULES).flatMap(([file, module]) =>
      Object.entries(module)
        .filter(([, value]) => typeof value === "function")
        .map(([name]) => `${file}.${name}`),
    );
    assert.deepEqual([...new Set(ACTION_CASES.map((c) => c.action))].sort(), exported.sort());
  });

  for (const c of ACTION_CASES) {
    test(c.action, async () => {
      if ("valid" in c.control) assert.ok(c.control.valid(), "the input is one the action takes");
      else {
        const control = await attempt(userIdOf(c.control.who), c.run);
        assert.ok(proven(c.control.proves, control.answer, control.writes), `${c.control.who} may make it (${c.control.proves}): ${JSON.stringify(control.answer)}`);
      }
      const signedOut = await attempt(null, c.run);
      assert.ok(isRefusal(signedOut.answer), `signed out: ${JSON.stringify(signedOut.answer)}`);
      assert.deepEqual(signedOut.writes, [], "signed out: wrote");
      for (const row of VIEWERS) {
        if (c.may(row) !== false) continue;
        const { answer, writes } = await attempt(accountOf(row.name).userId, c.run);
        assert.ok(isRefusal(answer), `${row.name}: not refused: ${JSON.stringify(answer)}`);
        assert.deepEqual(writes, [], `${row.name}: wrote`);
        assert.deepEqual(leaked(answer, row.expect), [], `${row.name}: answered data they do not read`);
      }
    });
  }

  for (const [path, { args, may, proves }] of DIRECT_WRITES) {
    test(`${path}, which no action makes, called directly`, async () => {
      const run = async () => {
        const opening = await openDashboard();
        return opening.kind === "open" ? callPath(opening.data, path, args) : "refused";
      };
      const control = await attempt(accountOf("team leader").userId, run);
      assert.ok(proven(proves, control.answer, control.writes), `the team leader (${proves}): ${JSON.stringify(control.answer)}`);
      for (const row of VIEWERS.filter((r) => !may(r))) {
        const { answer, writes } = await attempt(accountOf(row.name).userId, run);
        assert.ok(isRefusal(answer), `${row.name}: not refused: ${JSON.stringify(answer)}`);
        assert.deepEqual(writes, [], `${row.name}: wrote`);
      }
    });
  }
});

// The break-glass admin (issue #646) signs in with the team leader's rights
// and no member row. The refusal loop above proves only who is kept out, so
// every action the team leader is the control for, and the matrix lets the
// break-glass admin make, is made here as the break-glass admin, and proven
// the way the control is.

describe("the break-glass admin makes every action the matrix lets the team leader make (issue #646)", () => {
  const breakGlass = VIEWERS.find((r) => r.viewer.breakGlass)!;
  const teamLeaderCases = ACTION_CASES.filter(
    (c): c is ActionCase & { control: { who: string; proves: Proof } } => "who" in c.control && c.control.who === "team leader" && c.may(breakGlass) === true,
  );

  test("the cases cover the Access page, order decisions and the seats", () => {
    const covered = teamLeaderCases.map((c) => c.action);
    for (const action of ["actions.saveAccess", "actions.removeGrant", "actions.decideOrder", "actions.markOrdered", "team-actions.changeSeatHolder", "team-actions.addSeat", "team-actions.removeSeat", "team-actions.addTeamLeader", "team-actions.addSeatHolder", "team-actions.addDepartmentHead"]) {
      assert.ok(covered.includes(action), action);
    }
  });

  for (const c of teamLeaderCases) {
    test(c.action, async () => {
      const made = await attempt(accountOf(breakGlass.name).userId, c.run);
      assert.ok(proven(c.control.proves, made.answer, made.writes), `${c.action} (${c.control.proves}): ${JSON.stringify(made.answer)}`);
    });
  }

  for (const [path, { args, may, proves }] of DIRECT_WRITES) {
    if (!may(breakGlass)) continue;
    test(`${path}, called directly`, async () => {
      const made = await attempt(accountOf(breakGlass.name).userId, async () => {
        const opening = await openDashboard();
        return opening.kind === "open" ? callPath(opening.data, path, args) : "refused";
      });
      assert.ok(proven(proves, made.answer, made.writes), `${path} (${proves}): ${JSON.stringify(made.answer)}`);
    });
  }
});

// The recruitment switch follows full access (Owner decision, 2026-10-24, issue #621)
//
// The refusal loop above visits only the rows the matrix keeps out, so each
// row it lets in is proven here: the switch closes and opens again on the
// database, as that viewer. The seats among them hold no scope row at all.

describe("every full-access viewer switches recruitment on the database (issue #621)", () => {
  const switchers = VIEWERS.filter((r) => r.expect.switchesRecruitment);
  const isOpen = async () => (await tableRows(recruitmentSetting)).map((r) => r.isOpen);

  test("the matrix lets in every full-access row and no other", () => {
    assert.deepEqual(
      switchers.map((r) => r.name).sort(),
      ["Chief Engineer", "IT lead", "Project Manager", "break-glass admin", "operations lead", "operations lead with Approve orders", "org-wide editor", "team leader"].sort(),
    );
  });

  for (const row of switchers) {
    test(`${row.name}: Close recruitment and Open recruitment each write the recruitment_setting row`, async () => {
      const closed = await attempt(accountOf(row.name).userId, () => recruitmentActions.setRecruitment(false));
      assert.ok(!isRefusal(closed.answer), `${row.name}: refused: ${JSON.stringify(closed.answer)}`);
      assert.ok(
        closed.writes.some((w) => w.table === "recruitment_setting"),
        `${row.name}: no recruitment_setting write: ${JSON.stringify(closed.writes)}`,
      );
      assert.deepEqual(await isOpen(), [false], `${row.name}: recruitment is still open`);

      const opened = await answerOf(() => recruitmentActions.setRecruitment(true));
      assert.ok(!isRefusal(opened), `${row.name}: refused to open: ${JSON.stringify(opened)}`);
      assert.deepEqual(await isOpen(), [true], `${row.name}: recruitment did not open`);
    });
  }
});

// The Alumni page is site content (issue #589) --------------------------------
//
// Owner decision, 2026-10-22: the Alumni page follows the site-content rule,
// so it opens to full access and a Content grant, which is an edit grant. A
// Can view `website` row, on `all` (the old Alumni grant) or on `content`,
// opens neither the page nor any of its writes.

const ALUMNI_WRITES = ["team-actions.setAlumnusShown", "team-actions.fixAlumnus", "team-actions.setAlumnusPhoto", "team-actions.addAdvisor"] as const;
const alumniWrite = (action: (typeof ALUMNI_WRITES)[number]) => ACTION_CASES.find((c) => c.action === action)!;

describe("the Alumni page and its writes follow the Content grant at Can edit, and no Can view website row (issue #589)", () => {
  for (const name of ["member with a Can view website row on all", "member with a Can view website row on content"]) {
    test(`${name}: no Alumni page, and every Alumni write refused`, async () => {
      const data = await open(name);
      assert.deepEqual((await data.alumni()).rows, [], `${name}: the Alumni page answers rows`);
      for (const action of ALUMNI_WRITES) {
        const { answer, writes } = await attempt(accountOf(name).userId, alumniWrite(action).run);
        assert.ok(isRefusal(answer), `${name}: ${action} not refused: ${JSON.stringify(answer)}`);
        assert.deepEqual(writes, [], `${name}: ${action} wrote`);
      }
    });
  }

  test("member with a Content grant: the Alumni page, and every Alumni write lands", async () => {
    const name = "member with a Content grant";
    const data = await open(name);
    assert.ok((await data.alumni()).rows.length > 0, `${name}: the Alumni page answers no rows`);
    for (const action of ALUMNI_WRITES) {
      const { answer, writes } = await attempt(accountOf(name).userId, alumniWrite(action).run);
      assert.ok(!isRefusal(answer), `${name}: ${action} refused: ${JSON.stringify(answer)}`);
      assert.ok(writes.length > 0, `${name}: ${action} wrote nothing`);
    }
  });
});

// Email alias requests (epic #538) ------------------------------------------

describe("email alias requests: the approver rows, Request alias in the drawer, and one open request per member", () => {
  for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
    test(name, async () => {
      const data = await open(name);
      const overview = await answerOf(() => data.overview());
      const rows = overview === "refused" ? [] : (overview as TeamSideOverview).attention.filter((a) => a.kind === "prt-email-request" && "answerAlias" in a.action);
      assert.equal(rows.length, expect.aliases.answers ? ALL.length : 0, `${name}: one Overview row per open request`);
      const aliases = (await data.memberAliases(ALL.map((u) => IDS.person(u)))) as Record<number, { kind: string; requestable?: boolean }>;
      const requestable = ALL.filter((u) => aliases[IDS.person(u)]?.requestable === true);
      assert.deepEqual(requestable, expect.pages.includes("members") ? expect.aliases.requests : [], `${name}: Request alias`);
      assert.deepEqual(await databaseWrites(), [], `${name}: a read wrote`);
    });
  }

  test("a second request for a member with one open is refused by the server, and writes nothing", async () => {
    const { answer, writes } = await attempt(accountOf("team leader").userId, () => actions.requestAlias({ memberId: IDS.lead(DM), address: "lead.dm@politorocketteam.it" }));
    assert.ok(isRefusal(answer), JSON.stringify(answer));
    assert.deepEqual(writes, []);
  });

  test("Mark created saves the address as the member's PRT email; an automatic request tells nobody (the member sees the board 94f card)", async () => {
    const { answer, writes } = await attempt(accountOf("operations lead").userId, () =>
      actions.answerAlias(IDS.aliasRequest(DM), { kind: "created", address: "lead.dm@politorocketteam.it" }),
    );
    assert.ok(!isRefusal(answer), JSON.stringify(answer));
    assert.deepEqual(
      writes.map((w) => w.table).sort(),
      ["alias_requests", "members"],
    );
  });
});

// What waits for a decision on the Overview (issue #592) ---------------------
//
// Each unit holds one order waiting for a decision and one approved, not
// ordered yet. Deciding is team-wide, so whoever decides orders, whatever
// their Overview's shape, gets both rows counted across the team; nobody else
// gets either. A member holding Approve orders also gets one "Your access"
// line for it.

describe("the decision rows come to every Overview whose viewer decides orders (issue #592)", () => {
  for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
    test(name, async () => {
      const data = await open(name);
      const overview = await answerOf(() => data.overview());
      if (overview === "refused") return;
      const titles = (overview as TeamSideOverview).attention
        .filter((a) => a.kind === "orders-to-decide" || a.kind === "approved-orders")
        .map((a) => `${a.kind}: ${a.title} → ${a.action !== null && "href" in a.action ? a.action.href : "no link"}`);
      assert.deepEqual(
        titles,
        expect.decidesOrders
          ? [
              `orders-to-decide: ${ALL.length} orders wait for your decision → /dashboard/orders`,
              `approved-orders: ${ALL.length} approved orders are not ordered yet → /dashboard/orders`,
            ]
          : [],
        `${name}: the decision rows`,
      );
    });
  }

  test("a member whose only scope row is Approve orders gets one Approve orders line under Your access", async () => {
    const name = "member with Approve orders";
    assert.deepEqual(VIEWERS.find((v) => v.name === name)!.viewer.rawRows.map((r) => [r.scope, r.target]), [["team", "approve_orders"]]);
    const board = (await (await open(name)).overview()) as TeamSideOverview;
    assert.deepEqual(board.access, { kind: "lines", lines: [{ area: "approve-orders", href: "/dashboard/orders", waiting: ALL.length }] });
    const plain = (await (await open("member")).overview()) as TeamSideOverview;
    assert.deepEqual(plain.access, { kind: "none" }, "a member without it gets no Approve orders line");
  });
});

// A member's own alias card and "I've set it up" (issue #542) -----------------
//
// Each viewer, and DM's lead beside them, has an alias on their record. The
// card reads the viewer's own alias alone; "I've set it up" names no member,
// so it stores the time on the viewer's own row and leaves DM's lead's alone.
// Off the team there is no card and nothing to set up.

describe("a member reads only their own alias card and sets up only their own alias", () => {
  for (const { name, viewer } of VIEWERS as readonly MatrixRow[]) {
    test(name, async () => {
      const { userId, memberId } = accountOf(name);
      const onTeam = memberId !== null && !isOffTeam(viewer.kind);
      await seedFixture();
      resetFiles();
      if (memberId !== null) await giveAlias(memberId);
      await giveAlias(IDS.lead(DM));
      signInAs(userId);
      const opening = await openDashboard();
      assert.equal(opening.kind, "open");
      const data = (opening as { data: DashboardData }).data;
      const own = await data.myAlias();
      assert.deepEqual(own, onTeam ? ({ address: aliasOf(memberId!), setUp: false } satisfies OwnAlias) : null, `${name}: the card`);
      assert.ok(!JSON.stringify(own).includes(aliasOf(IDS.lead(DM))), `${name}: read someone else's alias`);

      const answer = await answerOf(() => actions.confirmAliasSetUp());
      const setUp = (await tableRows(members)).filter((r) => r.emailAliasSetUpAt !== null).map((r) => r.memberId);
      if (onTeam) {
        assert.ok(!isRefusal(answer), `${name}: ${JSON.stringify(answer)}`);
        assert.deepEqual(setUp, [memberId], `${name}: only their own record is set up`);
        assert.deepEqual(await data.myAlias(), { address: aliasOf(memberId!), setUp: true }, `${name}: the card is gone`);
        assert.ok(isRefusal(await answerOf(() => actions.confirmAliasSetUp())), `${name}: a second press`);
      } else {
        assert.ok(isRefusal(answer), `${name}: not refused: ${JSON.stringify(answer)}`);
        assert.deepEqual(setUp, [], `${name}: wrote`);
      }
    });
  }

  test("a member with no alias is refused, and writes nothing", async () => {
    const { answer, writes } = await attempt(accountOf("member").userId, () => actions.confirmAliasSetUp());
    assert.ok(isRefusal(answer), JSON.stringify(answer));
    assert.deepEqual(writes, []);
  });
});

// A lead's Access page ------------------------------------------------------

describe("a lead's Access page covers only the divisions they lead by role (Owner decision, #478; #488)", () => {
  const LEAD = "division lead with a Positions grant (Can edit) in DM";
  const MA = IDS.division("MA");

  test("Access lists only the led division, while the grant in DM still opens Positions there", async () => {
    const data = await open(LEAD);
    const page = (await data.divisionAccess()) as AccessPage | null;
    assert.ok(page !== null, "the lead has an Access page");
    assert.equal(page.unit.kind, "division");
    assert.deepEqual(placesOf(page.unit).map(placeKey), [MA], "the unit's places");
    for (const person of page.people) assert.equal(person.division?.id, MA, `${person.name} is listed outside the led division`);
    for (const grant of page.grants) assert.deepEqual(placeKey(grant.place), MA, "a grant listed outside the led division");
    // The grant gives what it gives a member there: the role in DM is on the Positions page.
    const positions = (await data.positions()) as PositionsPage;
    assert.ok(positions.positions.some((p) => p.id === IDS.position(DM)), "the role in DM on Positions");
  });

  test("a Save that names DM is refused on the server and writes nothing", async () => {
    const saves = [
      { personId: IDS.person("MA"), where: IDS.division(DM), areas: { positions: "view" } },
      { personId: IDS.person(DM), where: IDS.division(DM), areas: { positions: "view" } },
      { personId: IDS.person(DM), areas: { positions: "view" } },
    ];
    for (const save of saves) {
      const { answer, writes } = await attempt(accountOf(LEAD).userId, () => actions.saveAccess(save));
      assert.ok(isRefusal(answer), `${JSON.stringify(save)}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, [], `${JSON.stringify(save)}: wrote`);
    }
  });

  test("Remove all access leaves a grant in DM alone", async () => {
    await seedFixture();
    resetFiles();
    // Someone in the led division who holds a grant in DM, at a level the lead holds there.
    await addRows(scopes, [{ id: 9_000, memberId: IDS.person("MA"), scope: "division", target: "positions", accessLevel: "view", divisionId: IDS.division(DM) }]);
    signInAs(accountOf(LEAD).userId);
    await answerOf(() => actions.removeAllAccess(IDS.person("MA")));
    assert.deepEqual(await databaseWrites(), [], "a grant outside the led division was touched");
  });
});

// Grants to leads and heads -------------------------------------------------

describe("leads and heads hold grants beyond their role, and their role access stays locked (issue #591)", () => {
  // A plain division lead and a plain department head, with no scope rows, as real leads start in production.
  const LEAD = IDS.lead("MA");
  const HEAD = EXTRA.head;
  const FULL = "operations lead";
  const scopeRowsOf = async (memberId: number) => (await tableRows(scopes)).filter((r) => r.memberId === memberId);

  /** A freshly seeded database, with `rows` added to it. */
  async function seedKeeping(rows: readonly Record<string, unknown>[] = []): Promise<void> {
    await seedFixture();
    resetFiles();
    if (rows.length > 0) await addRows(scopes, rows);
  }

  /** The Access page as `name` reads it now, on the database as it stands. */
  async function pageAs(name: string): Promise<AccessPage> {
    signInAs(accountOf(name).userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
    const page = await (opening as { data: DashboardData }).data.divisionAccess();
    assert.ok(page !== null, `${name}: an Access page`);
    return page;
  }

  test("full access gives a plain lead Content and whole-team Orders, and a plain head Content; the next read lists them", async () => {
    await seedKeeping();
    signInAs(accountOf(FULL).userId);
    const toLead = await actions.saveAccess({ personId: LEAD, where: "team", areas: { content: "edit", orders: "edit" } });
    assert.ok(!isRefusal(toLead), `to the lead: ${JSON.stringify(toLead)}`);
    const toHead = await actions.saveAccess({ personId: HEAD, where: "team", areas: { content: "edit" } });
    assert.ok(!isRefusal(toHead), `to the head: ${JSON.stringify(toHead)}`);

    assert.deepEqual((await scopeRowsOf(LEAD)).map((r) => `${r.scope} ${r.target} ${r.accessLevel}`).sort(), ["team orders edit", "website content edit"]);
    assert.deepEqual((await scopeRowsOf(HEAD)).map((r) => `${r.scope} ${r.target} ${r.accessLevel}`), ["website content edit"]);
    const page = await pageAs(FULL);
    const listed = (id: number) => page.grants.filter((g) => g.person.id === id).map((g) => `${placeKey(g.place)} ${g.target} ${g.level}`).sort();
    assert.deepEqual(listed(LEAD), ["team content edit", "team orders edit"]);
    assert.deepEqual(listed(HEAD), ["team content edit"]);
    // Beside the role row, which stays as it was.
    assert.deepEqual(page.roleAccess.filter((r) => r.person.id === LEAD).map((r) => placeKey(r.place)), [IDS.division("MA")]);
    assert.deepEqual(page.roleAccess.filter((r) => r.person.id === HEAD).map((r) => placeKey(r.place)), [`department-${IDS.department(DM)}`]);
  });

  test("the single-grant Remove and Remove all access take a lead's and a head's grants away, and leave their role alone", async () => {
    await seedKeeping([
      { id: 9_100, memberId: LEAD, scope: "website", target: "content", accessLevel: "edit" },
      { id: 9_101, memberId: LEAD, scope: "team", target: "orders", accessLevel: "view" },
      { id: 9_102, memberId: HEAD, scope: "division", target: "positions", accessLevel: "view", divisionId: IDS.division("MA") },
      { id: 9_103, memberId: HEAD, scope: "website", target: "content", accessLevel: "edit" },
    ]);
    const page = await pageAs(FULL);
    // Edit access and each Remove reach them, by the same rules the server runs.
    for (const grant of page.grants.filter((g) => g.person.id === LEAD || g.person.id === HEAD)) {
      assert.ok(checkRemoveGrant(page, removalOf(grant)).ok, `Remove on ${grant.person.name}'s ${grant.target}`);
      assert.ok(canChangePerson(heldIn(page.unit, grant.place), grant.person, grant.place, areaLevelsOf(page.grants, grant.person.id, grant.place)));
    }
    const one = await actions.removeGrant({ personId: LEAD, where: "team", target: "content" });
    assert.ok(!isRefusal(one), JSON.stringify(one));
    assert.deepEqual((await scopeRowsOf(LEAD)).map((r) => r.id), [9_101]);
    const all = await actions.removeAllAccess(HEAD);
    assert.ok(!isRefusal(all), JSON.stringify(all));
    assert.deepEqual(await scopeRowsOf(HEAD), []);
    assert.ok(!(await databaseWrites()).some((w) => w.table === "roles"), "a role was touched");
    const after = await pageAs(FULL);
    assert.deepEqual(after.roleAccess.filter((r) => r.person.id === LEAD || r.person.id === HEAD).length, 2, "both role rows stay");
  });

  test("the server refuses any change to access a role already gives, and writes nothing", async () => {
    const STRAY = { id: 9_200, memberId: LEAD, scope: "division", target: "positions", accessLevel: "view", divisionId: IDS.division("MA") };
    const cases: [string, () => Promise<unknown>][] = [
      [FULL, () => actions.saveAccess({ personId: LEAD, where: IDS.division("MA"), areas: { positions: "edit" } })],
      [FULL, () => actions.saveAccess({ personId: LEAD, where: IDS.division("MA"), areas: { members: "view", orders: "edit" } })],
      [FULL, () => actions.saveAccess({ personId: HEAD, where: `department-${IDS.department(DM)}`, areas: { members: "edit" } })],
      [FULL, () => actions.saveAccess({ personId: HEAD, where: IDS.division(DM), areas: { orders: "view" } })],
      [FULL, () => actions.removeGrant({ personId: LEAD, where: IDS.division("MA"), target: "positions" })],
      ["department head", () => actions.saveAccess({ personId: LEAD, where: IDS.division("MA"), areas: { applications: "view" } })],
    ];
    for (const [name, run] of cases) {
      await seedKeeping([STRAY]);
      signInAs(accountOf(name).userId);
      const answer = await answerOf(run);
      assert.ok(isRefusal(answer), `${name}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(await databaseWrites(), [], `${name}: wrote`);
    }
    // The stray row the role already gives is no grant on the page, and Remove all leaves it.
    await seedKeeping([STRAY]);
    const page = await pageAs(FULL);
    assert.equal(page.grants.some((g) => g.person.id === LEAD), false);
    assert.ok(!isRefusal(await actions.removeAllAccess(LEAD)));
    assert.deepEqual(await databaseWrites(), []);
  });

  test("full-access seats stay locked but for Approve orders: Give access offers them to the team leader alone, and no area Save to one is accepted", async () => {
    await seedKeeping();
    const page = await pageAs("team leader");
    const seats = page.people.filter((p) => p.role.kind === "full").map((p) => p.id);
    for (const name of [FULL, "IT lead"]) assert.ok(seats.includes(accountOf(name).memberId!), `the ${name} is on the page`);
    // Only the team leader gives Approve orders, so only their Give access lists a full-access seat (issue #635).
    const listedSeats = grantablePeople(page).filter((p) => p.role.kind === "full").map((p) => p.id);
    for (const name of [FULL, "IT lead"]) assert.ok(listedSeats.includes(accountOf(name).memberId!), `the team leader's Give access lists the ${name}`);
    for (const name of [FULL, "IT lead", "department head", "division lead"]) {
      const theirs = await pageAs(name);
      assert.deepEqual(grantablePeople(theirs).filter((p) => p.role.kind === "full"), [], `${name}'s Give access lists a full-access seat`);
    }
  });

  // Approve orders to a full-access seat (issue #635) ----------------------------

  const SEAT = () => accountOf(FULL).memberId!;
  const IT = () => accountOf("IT lead").memberId!;
  const approveRow = (memberId: number) => ({ id: 9_300 + memberId, memberId, scope: "team", target: "approve_orders", accessLevel: "edit" });
  const holderIds = (page: AccessPage) => page.approveOrders.holders.map((h) => h.person.id);

  test("the team leader gives the operations lead Approve orders with no area, and the write lands", async () => {
    await seedKeeping();
    signInAs(accountOf("team leader").userId);
    const answer = await answerOf(() => actions.saveAccess({ personId: SEAT(), where: "team", areas: {}, approveOrders: true }));
    assert.ok(!isRefusal(answer), JSON.stringify(answer));
    assert.deepEqual((await scopeRowsOf(SEAT())).map((r) => `${r.scope} ${r.target}`), ["team approve_orders"]);
    assert.ok(holderIds(await pageAs("team leader")).includes(SEAT()), "the next read lists them as a holder");
  });

  test("the team leader removes the operations lead's Approve orders, by Edit access and by Remove all access; the next read no longer lists them", async () => {
    const removals: [string, () => Promise<unknown>][] = [
      ["Edit access", () => actions.saveAccess({ personId: SEAT(), where: "team", areas: {}, approveOrders: false })],
      ["Remove all access", () => actions.removeAllAccess(SEAT())],
    ];
    for (const [label, run] of removals) {
      await seedKeeping([approveRow(SEAT())]);
      assert.ok(holderIds(await pageAs("team leader")).includes(SEAT()), `${label}: a holder before`);
      const answer = await answerOf(run);
      assert.ok(!isRefusal(answer), `${label}: ${JSON.stringify(answer)}`);
      assert.deepEqual(await scopeRowsOf(SEAT()), [], `${label}: the row stays`);
      assert.ok(!holderIds(await pageAs("team leader")).includes(SEAT()), `${label}: still listed as a holder`);
    }
  });

  test("nobody but the team leader gives or removes Approve orders for a full-access seat, and a refusal writes nothing", async () => {
    const cases: [string, readonly Record<string, unknown>[], () => Promise<unknown>][] = [];
    for (const [name, target] of [
      ["IT lead", SEAT],
      [FULL, IT],
      ["department head", SEAT],
      ["division lead", SEAT],
    ] as const) {
      cases.push([name, [], () => actions.saveAccess({ personId: target(), where: "team", areas: {}, approveOrders: true })]);
      cases.push([name, [approveRow(target())], () => actions.saveAccess({ personId: target(), where: "team", areas: {}, approveOrders: false })]);
      cases.push([name, [approveRow(target())], () => actions.removeAllAccess(target())]);
    }
    for (const [name, rows, run] of cases) {
      await seedKeeping(rows);
      signInAs(accountOf(name).userId);
      const before = (await tableRows(scopes)).length;
      const answer = await answerOf(run);
      assert.ok(isRefusal(answer), `${name}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(await databaseWrites(), [], `${name}: wrote`);
      assert.equal((await tableRows(scopes)).length, before, `${name}: the scope rows changed`);
    }
  });

  test("every other grant to a full-access seat is still refused and writes nothing, an area beside Approve orders included", async () => {
    const saves: [string, Record<string, unknown>][] = [
      ["team leader", { personId: SEAT(), where: "team", areas: { content: "edit" } }],
      ["team leader", { personId: SEAT(), where: "team", areas: { content: "edit" }, approveOrders: true }],
      ["team leader", { personId: SEAT(), where: "team", areas: { orders: "view" }, approveOrders: true }],
      ["team leader", { personId: IT(), where: `department-${IDS.department("MA")}`, areas: { members: "view" } }],
      ["team leader", { personId: IT(), where: IDS.division("MA"), areas: { positions: "edit" }, approveOrders: true }],
      ["team leader", { personId: SEAT(), where: "team", areas: {} }],
      [FULL, { personId: IT(), where: "team", areas: { content: "view" } }],
    ];
    for (const [name, save] of saves) {
      await seedKeeping();
      signInAs(accountOf(name).userId);
      const answer = await answerOf(() => actions.saveAccess(save as Parameters<typeof actions.saveAccess>[0]));
      assert.ok(isRefusal(answer), `${name} ${JSON.stringify(save)}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(await databaseWrites(), [], `${name} ${JSON.stringify(save)}: wrote`);
    }
  });

  test("an operations lead who holds Approve orders decides orders with it", async () => {
    await seedKeeping();
    signInAs(accountOf(FULL).userId);
    const without = (await ((await openDashboard()) as { data: DashboardData }).data.orders()) as OrdersPage | null;
    assert.equal(without?.scope.decides, null, "deciding before the grant");
    signInAs(accountOf("team leader").userId);
    assert.ok(!isRefusal(await actions.saveAccess({ personId: SEAT(), where: "team", areas: {}, approveOrders: true })));
    signInAs(accountOf(FULL).userId);
    // The Orders scope's `decides` is `decideRightOf` over the viewer's stored rows.
    const page = (await ((await openDashboard()) as { data: DashboardData }).data.orders()) as OrdersPage | null;
    assert.equal(page?.scope.decides, "approve-orders");
  });

  test("Give access lists the leads and heads in reach, never the viewer", async () => {
    await seedKeeping();
    // A head's page: the leads of the head's own divisions.
    const head = await pageAs("department head");
    const headLists = grantablePeople(head).map((p) => p.id);
    for (const id of [IDS.lead("MA"), IDS.lead("OA")]) assert.ok(headLists.includes(id), `the head's page lists lead ${id}`);
    assert.ok(!headLists.includes(accountOf("department head").memberId!), "the viewer");
    // A team page: every lead and head.
    const team = await pageAs(FULL);
    const teamLists = grantablePeople(team).map((p) => p.id);
    for (const id of [...ALL.map((u) => IDS.lead(u)), HEAD]) assert.ok(teamLists.includes(id), `the team page lists ${id}`);
    assert.ok(!teamLists.includes(accountOf(FULL).memberId!), "the viewer");
    // A lead's page: a co-lead whose role holds all the lead could give is not listed.
    const lead = await pageAs("division lead");
    assert.ok(!grantablePeople(lead).some((p) => p.id === IDS.lead("MA")), "the co-lead of Mission Analysis");
  });

  test("a division lead with no scope rows holds their role's areas: Your access and Give access", async () => {
    await seedKeeping();
    const page = await pageAs("division lead");
    assert.equal(page.unit.kind, "division");
    if (page.unit.kind !== "division") return;
    assert.deepEqual(
      page.unit.divisions.map((d) => [d.division.id, d.held]),
      [[IDS.division("MA"), ["positions", "applications", "members", "orders"].map((target) => ({ target, level: "edit" }))]],
    );
    assert.ok(holdsAny(page.unit), "Your access and Give access show");
    assert.ok(grantablePeople(page).some((p) => p.id === IDS.person("MA")), "Give access lists the member of Mission Analysis");
  });

  test("a lead of two divisions holds Orders at Can edit by role in each, and reads one Your access line (issue #632)", async () => {
    await seedKeeping();
    const self = accountOf("division lead").memberId!;
    await addRows(roles, [{ id: 9_400, memberId: self, divisionId: IDS.division("OA"), title: "Division Lead", startedAt: "2025-10-01", type: "lead" }]);
    const page = await pageAs("division lead");
    assert.equal(page.unit.kind, "division");
    if (page.unit.kind !== "division") return;
    const roleAreas = ["positions", "applications", "members", "orders"].map((target) => ({ target, level: "edit" }));
    assert.deepEqual(
      page.unit.divisions.map((d) => [d.division.id, d.held]),
      [
        [IDS.division("MA"), roleAreas],
        [IDS.division("OA"), roleAreas],
      ],
    );
    assert.deepEqual(heldLines(page.unit).length, 1, "one Your access line over both divisions");
  });

  test("a lead of two divisions reads each division's grants, with when and by whom each was given, from the one batched read (issue #397)", async () => {
    const self = accountOf("division lead").memberId!;
    const teamLeader = accountOf("team leader");
    const itLead = accountOf("IT lead");
    // No grant anywhere: the batched read answers an empty list, and the lead still holds their role's areas in both.
    await seedKeeping();
    await clearRows(scopes);
    await addRows(roles, [{ id: 9_400, memberId: self, divisionId: IDS.division("OA"), title: "Division Lead", startedAt: "2025-10-01", type: "lead" }]);
    const empty = await pageAs("division lead");
    assert.deepEqual(empty.grants, [], "no grant in either led division");
    assert.deepEqual(empty.unit.kind === "division" && empty.unit.divisions.map((d) => d.division.id), [IDS.division("MA"), IDS.division("OA")], "both led divisions");

    // A grant in each led division, one given while viewing as the team leader, and one in a division the lead does not lead.
    const given = { givenBy: teamLeader.memberId, scope: "division" };
    await addRows(scopes, [
      { ...given, id: 9_500, memberId: IDS.person("MA"), target: "members", accessLevel: "view", divisionId: IDS.division("MA") },
      { ...given, id: 9_501, memberId: IDS.person("OA"), target: "positions", accessLevel: "edit", divisionId: IDS.division("OA"), givenByActingAccount: itLead.userId },
      { ...given, id: 9_502, memberId: IDS.person("OA"), target: "orders", accessLevel: "view", divisionId: IDS.division(DM) },
    ]);
    await changeRows(logs, { tableName: "scopes", operation: "INSERT", recordId: "9500" }, { changedAt: "2026-10-01T09:00:00.000Z" });
    await changeRows(logs, { tableName: "scopes", operation: "INSERT", recordId: "9501" }, { changedAt: "2026-10-02T09:00:00.000Z" });

    const page = await pageAs("division lead");
    assert.deepEqual(
      page.grants.map((g) => ({ id: g.id, place: g.place.kind === "division" ? g.place.division.id : g.place.kind, target: g.target, level: g.level, givenOn: g.givenOn, givenBy: g.givenBy })),
      [
        { id: 9_501, place: IDS.division("OA"), target: "positions", level: "edit", givenOn: "2026-10-02", givenBy: `IT lead as Viewer ${teamLeader.userId}` },
        { id: 9_500, place: IDS.division("MA"), target: "members", level: "view", givenOn: "2026-10-01", givenBy: `Viewer ${teamLeader.userId}` },
      ],
      "each led division's grant, newest first, with its own date and giver; none from a division not led",
    );
  });

  test("a lead with no Orders grant gives Orders, at Can view or Can edit, to a member of their own division (issue #632)", async () => {
    for (const level of ["view", "edit"] as const) {
      await seedKeeping();
      signInAs(accountOf("division lead").userId);
      const answer = await answerOf(() => actions.saveAccess({ personId: IDS.person("MA"), areas: { orders: level } }));
      assert.ok(!isRefusal(answer), `${level}: ${JSON.stringify(answer)}`);
      assert.deepEqual(
        (await scopeRowsOf(IDS.person("MA"))).map((r) => `${r.scope} ${r.divisionId} ${r.target} ${r.accessLevel}`),
        [`division ${IDS.division("MA")} orders ${level}`],
      );
    }
    // Still within the limit: nothing outside the led division, no member of another division, and no area the lead does not hold.
    await seedKeeping();
    signInAs(accountOf("division lead").userId);
    for (const save of [
      { personId: IDS.person("MA"), where: IDS.division(DM), areas: { orders: "view" } },
      { personId: IDS.person("OA"), areas: { orders: "view" } },
      { personId: IDS.person("OA"), where: IDS.division("OA"), areas: { orders: "edit" } },
      { personId: IDS.person("MA"), areas: { content: "edit" } },
    ]) {
      const answer = await answerOf(() => actions.saveAccess(save as Parameters<typeof actions.saveAccess>[0]));
      assert.ok(isRefusal(answer), `${JSON.stringify(save)}: not refused: ${JSON.stringify(answer)}`);
    }
    assert.deepEqual(await databaseWrites(), []);
  });

  test("nobody gives, changes or removes a lead's Orders in a division they lead, and a refusal writes nothing (issue #632)", async () => {
    const STORED = { id: 9_500, memberId: IDS.lead("OA"), scope: "division", target: "orders", accessLevel: "view", divisionId: IDS.division("OA") };
    const cases: [string, readonly Record<string, unknown>[], () => Promise<unknown>][] = [
      ["department head", [], () => actions.saveAccess({ personId: IDS.lead("OA"), where: IDS.division("OA"), areas: { orders: "view" } })],
      ["department head", [STORED], () => actions.saveAccess({ personId: IDS.lead("OA"), where: IDS.division("OA"), areas: { orders: "edit" } })],
      ["department head", [STORED], () => actions.removeGrant({ personId: IDS.lead("OA"), where: IDS.division("OA"), target: "orders" })],
      [FULL, [], () => actions.saveAccess({ personId: LEAD, where: IDS.division("MA"), areas: { orders: "edit" } })],
      [FULL, [STORED], () => actions.saveAccess({ personId: IDS.lead("OA"), where: IDS.division("OA"), areas: { orders: "edit" } })],
      [FULL, [STORED], () => actions.removeGrant({ personId: IDS.lead("OA"), where: IDS.division("OA"), target: "orders" })],
    ];
    for (const [name, rows, run] of cases) {
      await seedKeeping(rows);
      signInAs(accountOf(name).userId);
      const before = (await tableRows(scopes)).length;
      const answer = await answerOf(run);
      assert.ok(isRefusal(answer), `${name}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(await databaseWrites(), [], `${name}: wrote`);
      assert.equal((await tableRows(scopes)).length, before, `${name}: the scope rows changed`);
    }
  });

  test("a stored Orders row for a lead in a division they lead is no grant, Remove all leaves it, and it changes nothing on Orders (issue #632)", async () => {
    const self = () => accountOf("division lead").memberId!;
    const stored = () => ({ id: 9_600, memberId: self(), scope: "division", target: "orders", accessLevel: "view", divisionId: IDS.division("MA") });
    // The lead's Orders page, without the row and with it.
    await seedKeeping();
    signInAs(accountOf("division lead").userId);
    const without = (await ((await openDashboard()) as { data: DashboardData }).data.orders()) as OrdersPage;
    await seedKeeping([stored()]);
    signInAs(accountOf("division lead").userId);
    const withRow = (await ((await openDashboard()) as { data: DashboardData }).data.orders()) as OrdersPage;
    assert.deepEqual(withRow.scope, without.scope, "the row changes what the lead does on Orders");
    // Not listed on Access, and Remove all access leaves it.
    for (const viewer of [FULL, "department head"]) {
      await seedKeeping([stored()]);
      const page = await pageAs(viewer);
      assert.equal(page.grants.some((g) => g.person.id === self()), false, `${viewer}: the row is listed as a grant`);
      assert.ok(!isRefusal(await actions.removeAllAccess(self())), `${viewer}: Remove all refused`);
      assert.deepEqual(await databaseWrites(), [], `${viewer}: Remove all wrote`);
      assert.deepEqual((await scopeRowsOf(self())).map((r) => r.id), [9_600], `${viewer}: the row was not left in place`);
    }
  });

  test("once the person no longer leads the division, the same stored Orders row is a grant again and Remove takes it away (issue #632)", async () => {
    const self = () => accountOf("division lead").memberId!;
    await seedKeeping([{ id: 9_600, memberId: self(), scope: "division", target: "orders", accessLevel: "view", divisionId: IDS.division("MA") }]);
    const listed = (page: AccessPage) => page.grants.filter((g) => g.person.id === self()).map((g) => `${placeKey(g.place)} ${g.target} ${g.level}`);
    assert.deepEqual(listed(await pageAs(FULL)), [], "listed while they lead MA");
    // They stay in Mission Analysis as a member.
    await changeRows(roles, { memberId: self(), type: "lead" }, { type: "core", title: "Member" });
    const page = await pageAs(FULL);
    const grant = page.grants.find((g) => g.person.id === self() && g.target === "orders");
    assert.ok(grant !== undefined, "the row is not listed once they no longer lead");
    assert.deepEqual(listed(page), [`${IDS.division("MA")} orders view`]);
    assert.ok(checkRemoveGrant(page, removalOf(grant)).ok, "Remove is not offered");
    const answer = await actions.removeGrant({ personId: self(), where: IDS.division("MA"), target: "orders" });
    assert.ok(!isRefusal(answer), JSON.stringify(answer));
    assert.deepEqual(await scopeRowsOf(self()), []);
    assert.deepEqual(listed(await pageAs(FULL)), []);
  });

  test("the delegation limits still hold with a lead or head as the target", async () => {
    const cases: [string, unknown][] = [
      // Nothing above the viewer's own: a head holds no Content.
      ["department head", { personId: IDS.lead("OA"), where: "department-1", areas: { content: "edit" } }],
      // Content goes to the whole team only, and only at Can edit.
      [FULL, { personId: LEAD, where: `department-${IDS.department("MA")}`, areas: { content: "edit" } }],
      [FULL, { personId: HEAD, where: "team", areas: { content: "view" } }],
      // Approve orders only from the team leader.
      [FULL, { personId: LEAD, where: "team", areas: {}, approveOrders: true }],
      // Orders in a division the lead leads comes with their role (issue #632).
      ["department head", { personId: IDS.lead("OA"), where: IDS.division("OA"), areas: { orders: "view" } }],
    ];
    for (const [name, save] of cases) {
      await seedKeeping();
      signInAs(accountOf(name).userId);
      const answer = await answerOf(() => actions.saveAccess(save as Parameters<typeof actions.saveAccess>[0]));
      assert.ok(isRefusal(answer), `${name} ${JSON.stringify(save)}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(await databaseWrites(), [], `${name}: wrote`);
    }
    // Within the limits it lands: the team leader gives Approve orders.
    await seedKeeping();
    signInAs(accountOf("team leader").userId);
    assert.ok(!isRefusal(await actions.saveAccess({ personId: LEAD, where: "team", areas: {}, approveOrders: true })));
    assert.deepEqual((await scopeRowsOf(LEAD)).map((r) => r.target), ["approve_orders"]);
  });
});

// A lead's Orders, by role ----------------------------------------------------

describe("a division lead with no scope row edits their own division's orders by role (issue #590)", () => {
  const LEAD = "division lead";
  const MA: Unit = "MA";
  const orderFor = (u: Unit) => form({ ...ORDER, division: String(IDS.division(u)) });
  /** Signs in as the matrix's plain lead of MA, on a freshly seeded database with these scope rows added. */
  async function openLead(extra: readonly (typeof scopes.$inferInsert)[] = []): Promise<DashboardData> {
    await seedFixture();
    resetFiles();
    await addRows(scopes, extra);
    signInAs(accountOf(LEAD).userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    return (opening as { data: DashboardData }).data;
  }
  const viewRow = (): typeof scopes.$inferInsert => ({ id: 9_100, memberId: accountOf(LEAD).memberId!, scope: "team", target: "orders", accessLevel: "view" });

  test("the lead holds no scope row: the matrix seeds none for them", async () => {
    await openLead();
    assert.deepEqual((await tableRows(scopes)).filter((r) => r.memberId === accountOf(LEAD).memberId), []);
  });

  test("Orders opens, editing the led division alone, and deciding nothing", async () => {
    const page = (await (await openLead()).orders()) as OrdersPage | null;
    assert.ok(page !== null, "the Orders page opens for the lead");
    assert.deepEqual(page.scope, { edits: [{ kind: "division", division: { id: IDS.division(MA), name: "Mission Analysis" } }], decides: null });
    const order = (u: Unit) => page.orders.find((o) => o.id === IDS.order(u))!;
    assert.equal(canEditOrder(page.scope, order(MA)), true, "an order in MA");
    assert.equal(canEditOrder(page.scope, order(DM)), false, "an order in DM");
  });

  test("the Overview Orders figure counts the order waiting in the led division", async () => {
    const board = (await (await openLead()).overview()) as TeamSideOverview;
    assert.ok(board.shape === "division", `the lead's Overview: ${board.shape}`);
    assert.equal(board.stats.find((s) => s.label === "Orders")?.value, "1 waiting");
  });

  test("New order is taken for the led division and refused for another, and Edit order and Cancel request take the led division's order", async () => {
    const asLead = (run: () => Promise<unknown>) => attempt(accountOf(LEAD).userId, run);
    for (const [label, run] of [
      ["New order in MA", () => actions.placeOrder(orderFor(MA))],
      ["Edit order in MA", () => actions.editOrder(IDS.order(MA), orderFor(MA))],
      ["Cancel request in MA", () => actions.cancelOrder(IDS.order(MA))],
    ] as const) {
      const { answer, writes } = await asLead(run);
      assert.ok(!isRefusal(answer), `${label}: ${JSON.stringify(answer)}`);
      assert.ok(writes.length > 0, `${label}: wrote nothing`);
    }
    for (const [label, run] of [
      ["New order in DM", () => actions.placeOrder(orderFor(DM))],
      ["Edit order in DM", () => actions.editOrder(IDS.order(DM), orderFor(DM))],
      ["Cancel request in DM", () => actions.cancelOrder(IDS.order(DM))],
    ] as const) {
      const { answer, writes } = await asLead(run);
      assert.ok(isRefusal(answer), `${label}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, [], `${label}: wrote`);
    }
  });

  test("with a whole-team Orders (Can view) row too, the lead still edits and cancels their own division's orders, and edits nothing elsewhere", async () => {
    const page = (await (await openLead([viewRow()])).orders()) as OrdersPage;
    assert.deepEqual(page.scope.edits, [{ kind: "division", division: { id: IDS.division(MA), name: "Mission Analysis" } }]);
    const seeded = async (run: () => Promise<unknown>) => {
      await openLead([viewRow()]);
      const answer = await answerOf(run);
      return { answer, writes: (await databaseWrites()) };
    };
    for (const run of [() => actions.editOrder(IDS.order(MA), orderFor(MA)), () => actions.cancelOrder(IDS.order(MA))]) {
      const { answer, writes } = await seeded(run);
      assert.ok(!isRefusal(answer), JSON.stringify(answer));
      assert.ok(writes.length > 0);
    }
    for (const run of [() => actions.editOrder(IDS.order(DM), orderFor(DM)), () => actions.cancelOrder(IDS.order(DM)), () => actions.placeOrder(orderFor(DM))]) {
      const { answer, writes } = await seeded(run);
      assert.ok(isRefusal(answer), `not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, []);
    }
  });
});

// One edit action set on Orders ----------------------------------------------

describe("whoever may edit a waiting order may also cancel it, the team leader in every division (issue #675)", () => {
  const TEAM_LEADER = "team leader";
  const orderFor = (u: Unit) => form({ ...ORDER, division: String(IDS.division(u)) });
  const storedOrder = async (u: Unit) => (await tableRows(orders)).find((r) => r.id === IDS.order(u))!;
  type StoredStatus = (typeof orders.$inferSelect)["status"];
  /** Seeds the database, lays `status` over the unit's order, signs in as `who` and runs `run`. */
  async function attemptAt(who: string, u: Unit, status: StoredStatus, run: () => Promise<unknown>) {
    await seedFixture();
    resetFiles();
    await changeRows(orders, { id: IDS.order(u) }, { status });
    signInAs(accountOf(who).userId);
    const answer = await answerOf(run);
    return { answer, writes: await databaseWrites() };
  }

  test("the team leader cancels and edits a waiting order in every division, and each write is stored", async () => {
    const asTeamLeader = (run: () => Promise<unknown>) => attempt(accountOf(TEAM_LEADER).userId, run);
    for (const u of ALL) {
      const cancelled = await asTeamLeader(() => actions.cancelOrder(IDS.order(u)));
      assert.ok(!isRefusal(cancelled.answer), `Cancel request in ${u}: ${JSON.stringify(cancelled.answer)}`);
      assert.equal((await storedOrder(u)).status, "cancelled", `Cancel request in ${u}`);

      const edited = await asTeamLeader(() => actions.editOrder(IDS.order(u), orderFor(u)));
      assert.ok(!isRefusal(edited.answer), `Edit order in ${u}: ${JSON.stringify(edited.answer)}`);
      const row = await storedOrder(u);
      assert.equal(row.name, ORDER.item, `Edit order in ${u}`);
      assert.equal(row.status, "pending", `Edit order in ${u}`);
    }
  });

  test("every matrix viewer whose Orders page may edit a waiting order may cancel it too, and one who may not is refused both with nothing written", async () => {
    const seen = { editors: 0, refused: 0 };
    for (const { name, expect } of VIEWERS) {
      const page = expect.ordersPage ? ((await (await open(name)).orders()) as OrdersPage | null) : null;
      for (const u of ALL) {
        const shown = page?.orders.find((o) => o.id === IDS.order(u));
        const may = page !== null && shown !== undefined && canEditOrder(page.scope, shown);
        seen[may ? "editors" : "refused"]++;
        for (const [label, run] of [
          ["Cancel request", () => actions.cancelOrder(IDS.order(u))],
          ["Edit order", () => actions.editOrder(IDS.order(u), orderFor(u))],
        ] as const) {
          const { answer, writes } = await attempt(accountOf(name).userId, run);
          if (may) {
            assert.ok(!isRefusal(answer), `${name}, ${label} in ${u}: ${JSON.stringify(answer)}`);
            assert.ok(writes.length > 0, `${name}, ${label} in ${u}: wrote nothing`);
          } else {
            assert.ok(isRefusal(answer), `${name}, ${label} in ${u}: not refused: ${JSON.stringify(answer)}`);
            assert.deepEqual(writes, [], `${name}, ${label} in ${u}: wrote`);
          }
        }
      }
    }
    assert.ok(seen.editors > 0 && seen.refused > 0, `both sides are exercised: ${JSON.stringify(seen)}`);
  });

  test("even for the team leader, a request is cancelled only while waiting and edited only while waiting or sent back", async () => {
    for (const status of ["changes_requested", "accepted", "ordered", "rejected"] as const) {
      const cancel = await attemptAt(TEAM_LEADER, DM, status, () => actions.cancelOrder(IDS.order(DM)));
      assert.ok(isRefusal(cancel.answer), `Cancel request on ${status}: not refused: ${JSON.stringify(cancel.answer)}`);
      assert.deepEqual(cancel.writes, [], `Cancel request on ${status}: wrote`);

      const edit = await attemptAt(TEAM_LEADER, DM, status, () => actions.editOrder(IDS.order(DM), orderFor(DM)));
      if (status === "changes_requested") {
        assert.ok(!isRefusal(edit.answer), `Edit and send again: ${JSON.stringify(edit.answer)}`);
        assert.equal((await storedOrder(DM)).status, "pending", "an edit sends it back to waiting");
      } else {
        assert.ok(isRefusal(edit.answer), `Edit order on ${status}: not refused: ${JSON.stringify(edit.answer)}`);
        assert.deepEqual(edit.writes, [], `Edit order on ${status}: wrote`);
      }
    }
  });
});

// A lead's own division, in the Team tree ------------------------------------

describe("a division lead with no scope row edits their own division in the Team tree (issue #594)", () => {
  const LEAD = "division lead";
  const MA: Unit = "MA";
  const OA: Unit = "OA";
  const self = () => accountOf(LEAD).memberId!;
  type Extra = { readonly scopes?: readonly (typeof scopes.$inferInsert)[]; readonly roles?: readonly (typeof roles.$inferInsert)[] };
  /** Seeds the database with `extra` added, keeps what each write leaves behind, signs in as the matrix's plain lead of MA and runs `run`. */
  async function asLead(run: (data: DashboardData) => Promise<unknown>, extra: Extra = {}) {
    await seedFixture();
    resetFiles();
    await addRows(scopes, extra.scopes ?? []);
    await addRows(roles, extra.roles ?? []);
    signInAs(accountOf(LEAD).userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const answer = await answerOf(() => run((opening as { data: DashboardData }).data));
    return { answer, writes: (await databaseWrites()) };
  }
  const save = async (u: Unit, change: { name?: string; code?: string; newLeads?: number[]; oldLeads?: unknown[] } = {}) => {
    const division = (await tableRows(divisions)).find((d) => d.id === IDS.division(u))!;
    return { name: String(division.name), code: String(division.code), newLeads: [], oldLeads: [], members: [], emails: [], ...change };
  };
  /** The type of each open role `memberId` holds in the unit's division. */
  const rolesIn = async (memberId: number, u: Unit) =>
    (await tableRows(roles))
      .filter((r) => r.memberId === memberId && r.divisionId === IDS.division(u) && r.leavedAt === null)
      .map((r) => r.type)
      .sort();
  const extraRole = (id: number, memberId: number, u: Unit | number, type: "lead" | "core"): typeof roles.$inferInsert => ({
    id,
    memberId,
    divisionId: typeof u === "number" ? u : IDS.division(u),
    title: type === "lead" ? "Division Lead" : "Member",
    startedAt: "2025-10-01",
    type,
  });
  const membersGrant = (u: Unit): typeof scopes.$inferInsert => ({ id: 9_200, memberId: self(), scope: "division", target: "members", accessLevel: "edit", divisionId: IDS.division(u) });
  const writes = async (label: string, run: (data: DashboardData) => Promise<unknown>, extra: Extra = {}) => {
    const result = await asLead(run, extra);
    assert.ok(!isRefusal(result.answer), `${label}: ${JSON.stringify(result.answer)}`);
    assert.ok(result.writes.length > 0, `${label}: wrote nothing`);
  };
  const refuses = async (label: string, run: (data: DashboardData) => Promise<unknown>, extra: Extra = {}) => {
    const result = await asLead(run, extra);
    assert.ok(isRefusal(result.answer), `${label}: not refused: ${JSON.stringify(result.answer)}`);
    assert.deepEqual(result.writes, [], `${label}: wrote`);
    /** The reason given, where the action answers one. */
    return typeof result.answer === "object" && result.answer !== null ? String((result.answer as { error?: string }).error ?? "") : "";
  };

  test("the lead holds no scope row: the matrix seeds none for them", async () => {
    await asLead(async () => null);
    assert.deepEqual((await tableRows(scopes)).filter((r) => r.memberId === self()), []);
  });

  test("Edit division saves a new name and a new code on the led division", async () => {
    await writes("rename and recode MA", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { name: "Flight Analysis", code: "FLA" })));
    const division = (await tableRows(divisions)).find((d) => d.id === IDS.division(MA))!;
    assert.deepEqual([division.name, division.code], ["Flight Analysis", "FLA"]);
  });

  test("Edit division adds a lead, replaces a lead and removes a lead on the led division", async () => {
    await writes("add MA's member as a lead", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { newLeads: [IDS.person(MA)] })));
    assert.deepEqual(await rolesIn(IDS.person(MA), MA), ["lead"]);

    await writes("add someone from DM as a lead", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { newLeads: [EXTRA.mover] })));
    assert.deepEqual(await rolesIn(EXTRA.mover, MA), ["lead"]);

    const replaced = { personId: IDS.lead(MA), via: "replaced", outcome: "advisor" };
    await writes("replace MA's other lead", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { newLeads: [EXTRA.mover], oldLeads: [replaced] })));
    assert.deepEqual([(await rolesIn(EXTRA.mover, MA)), (await rolesIn(IDS.lead(MA), MA))], [["lead"], ["advisor"]], "the replaced lead becomes an advisor in MA");

    const removed = { personId: IDS.lead(MA), via: "removed", outcome: "member" };
    await writes("remove MA's other lead", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { oldLeads: [removed] })));
    assert.deepEqual(await rolesIn(IDS.lead(MA), MA), ["core"], "the removed lead stays as a member");
  });

  test("every rule of Edit division still holds for the lead's save", async () => {
    const out = (personId: number, outcome: string) => ({ personId, via: "removed", outcome });
    // Every lead of MA as seeded: the matrix's leads of it, MA's own lead among them.
    await seedFixture();
    const every = (await tableRows(roles))
      .filter((r) => r.type === "lead" && r.divisionId === IDS.division(MA) && r.leavedAt === null)
      .map((r) => out(Number(r.memberId), "member"));
    assert.ok(every.length >= 2);
    assert.equal(await refuses("remove every lead", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { oldLeads: every }))), "A division needs at least one lead.");
    const leaves = await refuses("take MA's other lead out of their only division", async () =>
      teamActions.saveDivision(IDS.division(MA), await save(MA, { oldLeads: [out(IDS.lead(MA), "leave-division")] })),
    );
    assert.match(leaves, /only division/);
    const alsoInDM = { roles: [extraRole(9_300, IDS.lead(MA), "DM", "core")] };
    await refuses("move MA's other lead, who is also in DM, to alumni", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { oldLeads: [out(IDS.lead(MA), "leave-team")] })), alsoInDM);
    await writes("move MA's other lead, in MA alone, to alumni", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { oldLeads: [out(IDS.lead(MA), "leave-team")] })));
    assert.equal(await refuses("take OA's code", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { code: "OPT" }))), "Optimization already uses OPT.");
    await refuses("replace a lead with no new lead", async () =>
      teamActions.saveDivision(IDS.division(MA), await save(MA, { oldLeads: [{ personId: IDS.lead(MA), via: "replaced", outcome: "advisor" }] })),
    );
  });

  test("Edit division's lead and member pickers search the whole team for the lead", async () => {
    const { answer, writes } = await asLead(() => teamActions.findPeople("Mover"));
    assert.ok(answer !== null && typeof answer === "object" && (answer as TeamSearch).kind === "people", `the pickers answered ${JSON.stringify(answer)}`);
    assert.ok((answer as Extract<TeamSearch, { kind: "people" }>).people.some((p) => p.id === EXTRA.mover), "someone outside the led division is found");
    assert.deepEqual(writes, []);
  });

  test("the drawer's member actions add someone from the team, invite an email and remove a member in the led division", async () => {
    await writes("add OA's member to MA", () => teamActions.addMember({ kind: "member", divisionId: IDS.division(MA), personId: IDS.person(OA), title: "Member" }));
    assert.deepEqual(await rolesIn(IDS.person(OA), MA), ["core"]);
    await writes("invite an email to MA", () =>
      teamActions.addMember({ kind: "email", divisionId: IDS.division(MA), email: "new@mail.test", firstName: "New", lastName: "Person", title: "Member", details: MEMBER_DETAILS }),
    );
    const moverInMA = { roles: [extraRole(9_301, EXTRA.mover, MA, "core")] };
    await writes("remove a member of MA", () => teamActions.removeFromDivision(EXTRA.mover, IDS.division(MA)), moverInMA);
    assert.deepEqual(await rolesIn(EXTRA.mover, MA), []);
  });

  test("on a division they do not lead, every one of those is refused and writes nothing", async () => {
    for (const u of [OA, DM]) {
      await refuses(`rename ${u}`, async () => teamActions.saveDivision(IDS.division(u), await save(u, { name: "Renamed", code: "REN" })));
      await refuses(`add a lead to ${u}`, async () => teamActions.saveDivision(IDS.division(u), await save(u, { newLeads: [IDS.person(u)] })));
      await refuses(`remove ${u}'s lead`, async () => teamActions.saveDivision(IDS.division(u), await save(u, { newLeads: [IDS.person(u)], oldLeads: [{ personId: IDS.lead(u), via: "removed", outcome: "member" }] })));
      await refuses(`add someone to ${u}`, () => teamActions.addMember({ kind: "member", divisionId: IDS.division(u), personId: EXTRA.head, title: "Member" }));
      await refuses(`invite an email to ${u}`, () =>
        teamActions.addMember({ kind: "email", divisionId: IDS.division(u), email: "new@mail.test", firstName: "New", lastName: "Person", title: "Member", details: MEMBER_DETAILS }),
      );
      await refuses(`remove a member of ${u}`, () => teamActions.removeFromDivision(EXTRA.mover, IDS.division(u)), { roles: [extraRole(9_302, EXTRA.mover, OA, "core")] });
    }
  });

  test("a Members (Can edit) grant on DM gives no Edit division there: no pencil, no save, no lead change", async () => {
    const grant = { scopes: [membersGrant(DM)] };
    const { answer } = await asLead((data) => data.teamStructure(), grant);
    const dm = (answer as TeamStructure).departments.flatMap((d) => d.divisions).find((d) => d.id === IDS.division(DM))!;
    assert.equal(dm.page, null, "no pencil on DM");
    await refuses("rename DM", async () => teamActions.saveDivision(IDS.division(DM), await save(DM, { name: "Renamed", code: "REN" })), grant);
    await refuses("add a lead to DM", async () => teamActions.saveDivision(IDS.division(DM), await save(DM, { newLeads: [EXTRA.mover] })), grant);
    const leadAlsoInOA = { scopes: [membersGrant(DM)], roles: [extraRole(9_303, IDS.lead(DM), OA, "core")] };
    await refuses("take DM's lead out of DM", () => teamActions.removeFromDivision(IDS.lead(DM), IDS.division(DM)), leadAlsoInOA);
  });

  test("a lead of two divisions edits both, and the Team tree gives each a pencil", async () => {
    const leadsOA = { roles: [extraRole(9_304, self(), OA, "lead")] };
    await writes("rename MA", async () => teamActions.saveDivision(IDS.division(MA), await save(MA, { name: "Flight Analysis", code: "FLA" })), leadsOA);
    await writes("rename OA", async () => teamActions.saveDivision(IDS.division(OA), await save(OA, { name: "Shape Work", code: "SHW" })), leadsOA);
    const { answer } = await asLead((data) => data.teamStructure(), leadsOA);
    const editable = (answer as TeamStructure).departments.flatMap((d) => d.divisions).filter((d) => d.page !== null).map((d) => d.id);
    assert.deepEqual(editable, [IDS.division(MA), IDS.division(OA)]);
  });

  test("the Team tree's edit view gives the lead a pencil on MA alone, and no department pencil, Add division or Add department", async () => {
    const { answer } = await asLead((data) => data.teamStructure());
    const structure = answer as TeamStructure | null;
    assert.ok(structure !== null, "the edit view opens for the lead");
    assert.equal(structure.departmentsEditable, false);
    assert.deepEqual(structure.departments.filter((d) => d.divisionsEditable).map((d) => d.id), [], "no Add division and no Close division anywhere");
    assert.deepEqual(structure.departments.flatMap((d) => d.divisions).filter((d) => d.page !== null).map((d) => d.id), [IDS.division(MA)]);
  });

  test("New division and Close division stay refused for the lead, in their own department and on their own division", async () => {
    const closing = await refuses("close MA", () => teamActions.closeDivision(IDS.division(MA)));
    assert.equal(closing, "Only the Head of Aerodynamics or the team leader can do this.", "refused by who may close, not by who is in it");
    await refuses("create a division in Aerodynamics", () => teamActions.createDivision(IDS.department(MA), { name: "Avionics", code: "AVI", newLeads: [self()], oldLeads: [], members: [], emails: [] }));
  });
});

// The Members export --------------------------------------------------------

// Every field the member drawer shows, written out by hand so a column
// dropped from the export fails here instead of agreeing with itself.
const EXPECTED_EXPORT_HEADER = [
  "Name",
  "Role",
  "Department",
  "Divisions",
  "Member since",
  "PRT email",
  "Personal email",
  "Phone",
  "Discord",
  "LinkedIn",
  "PoliTo ID",
  "Program",
  "Level",
  "From",
  "Date of birth",
  "Gender",
  "NDA",
  "NDA signed on",
  "NDA confirmed by",
];

describe("one Edit details panel: whoever may edit a member in scope saves their details and position (issue #584)", () => {
  const tables = (writes: readonly { readonly kind: string; readonly table: string }[]) => [...new Set(writes.map((w) => `${w.kind} ${w.table}`))].sort();
  const SAVE = { title: "Engineer", details: MEMBER_DETAILS };

  test("full access saves the details of a seat with no division from the whole team, with their seat's title (#626)", async () => {
    for (const name of ["operations lead", "team leader"]) {
      const { answer, writes } = await attempt(accountOf(name).userId, () => teamActions.saveMemberDetails({ kind: "person", id: EXTRA.head }, null, SAVE));
      assert.deepEqual(answer, { ok: true }, name);
      assert.ok(writes.length > 0, `${name}: wrote nothing`);
      assert.ok(tables(writes).some((t) => t.endsWith(" roles")), `${name}: the seat's title: ${tables(writes)}`);
    }
    const photo = await attempt(accountOf("operations lead").userId, () => teamActions.setMemberPhoto(EXTRA.head, form({ photo: PHOTO() })));
    assert.deepEqual(photo.answer, { ok: true });
    const named = await attempt(accountOf("team leader").userId, () => teamActions.saveMemberDetails({ kind: "person", id: EXTRA.head }, IDS.division(DM), SAVE));
    assert.ok(isRefusal(named.answer), "a title in a division they are not in");
    assert.deepEqual(named.writes, []);
  });

  test("full access saves the details of someone in a division, with their title there, and changes who leads it", async () => {
    const details = await attempt(accountOf("operations lead").userId, () =>
      teamActions.saveMemberDetails({ kind: "person", id: IDS.person(DM) }, IDS.division(DM), SAVE),
    );
    assert.deepEqual(details.answer, { ok: true });
    assert.ok(tables(details.writes).some((t) => t.endsWith(" roles")), "the title in DM");
    const lead = await attempt(accountOf("operations lead").userId, () => teamActions.saveMember(IDS.person(DM), IDS.division(DM), "division-lead"));
    assert.deepEqual(lead.answer, { ok: true });
    assert.ok(lead.writes.length > 0);
  });

  test("a head edits their department's people only, and a division lead changes who leads their own division alone (#594)", async () => {
    const head = accountOf("department head").userId;
    assert.deepEqual((await attempt(head, () => teamActions.saveMemberDetails({ kind: "person", id: IDS.person("MA") }, IDS.division("MA"), SAVE))).answer, { ok: true });
    for (const run of [
      () => teamActions.saveMemberDetails({ kind: "person", id: EXTRA.head }, null, SAVE),
      () => teamActions.saveMemberDetails({ kind: "person", id: IDS.person(DM) }, null, SAVE),
      () => teamActions.setMemberPhoto(IDS.person(DM), form({ photo: PHOTO() })),
    ]) {
      const { answer, writes } = await attempt(head, run);
      assert.ok(isRefusal(answer), `not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, []);
    }
    const lead = await attempt(accountOf("division lead").userId, () => teamActions.saveMember(IDS.person("MA"), IDS.division("MA"), "division-lead"));
    assert.deepEqual(lead.answer, { ok: true }, "a new lead of the division they lead");
    assert.ok(lead.writes.length > 0);
    const elsewhere = await attempt(accountOf("division lead").userId, () => teamActions.saveMember(IDS.person(DM), IDS.division(DM), "division-lead"));
    assert.ok(isRefusal(elsewhere.answer), "never in a division they do not lead");
    assert.deepEqual(elsewhere.writes, []);
  });
});

describe("Edit details sets a seat's title: the team leader and full access only, on the seat's row, its title alone (issue #626)", () => {
  const RENAMED = "Chief of Propulsion";
  const HEAD_ROW = 6_000;

  /** Saves `title` as `viewer` on `personId`'s seat on a freshly seeded database that keeps its writes: the answer, and each role row the save changed, as it was and as it is. */
  async function saveSeatTitle(viewer: string, personId: number, title: string) {
    await seedFixture();
    const before = await tableRows(roles);
    signInAs(accountOf(viewer).userId);
    const answer = await answerOf(() => teamActions.saveMemberDetails({ kind: "person", id: personId }, null, { title, details: MEMBER_DETAILS }));
    const changed = (await tableRows(roles)).flatMap((now, n) => (JSON.stringify(now) === JSON.stringify(before[n]) ? [] : [{ was: before[n], now }]));
    return { answer, changed };
  }

  test("the team leader renames a head: their head row's title alone changes, and the Members Role column reads it", async () => {
    const { answer, changed } = await saveSeatTitle("team leader", EXTRA.head, `  ${RENAMED} `);
    assert.deepEqual(answer, { ok: true });
    assert.deepEqual(
      changed.map(({ was, now }) => [was.id, now]),
      [[HEAD_ROW, { ...changed[0]?.was, title: RENAMED }]],
      "the head row's title, trimmed, and nothing else",
    );
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const roster = await (opening as { data: DashboardData }).data.members();
    const row = roster.scope === "whole-team" ? roster.people.find((p) => p.id === EXTRA.head) : undefined;
    assert.deepEqual([row?.role, row?.roleLabel], ["head", RENAMED]);
  });

  test("a seat-title save changes the seat row's title only: never its type, department, division or full access", async () => {
    for (const [viewer, seat] of [
      ["team leader", "Project Manager"],
      ["team leader", "Chief Engineer"],
      ["operations lead", "team leader"],
    ] as const) {
      const { answer, changed } = await saveSeatTitle(viewer, accountOf(seat).memberId!, RENAMED);
      assert.deepEqual(answer, { ok: true }, `${viewer} on ${seat}`);
      assert.equal(changed.length, 1, `${viewer} on ${seat}: one row`);
      const { was, now } = changed[0];
      assert.deepEqual(now, { ...was, title: RENAMED }, `${viewer} on ${seat}`);
      assert.equal(was.memberId, accountOf(seat).memberId, "their own row");
    }
  });

  test("the team leader's Role starts at their row's stored title, so a full-access details save with it left as shown keeps that title", async () => {
    const CUSTOM = "President of the Team";
    const leaderId = accountOf("team leader").memberId!;
    await seedFixture();
    await changeRows(roles, { memberId: leaderId, type: "president" }, { title: CUSTOM });
    const before = await tableRows(roles);
    signInAs(accountOf("operations lead").userId);
    for (const round of [1, 2]) {
      const opening = await openDashboard();
      assert.equal(opening.kind, "open");
      const roster = await (opening as { data: DashboardData }).data.members();
      const title = roster.scope === "whole-team" ? roster.positions.find((p) => p.id === leaderId)?.title : undefined;
      assert.deepEqual(title, { kind: "seat", value: CUSTOM }, `round ${round}: the Role input starts at the stored title`);
      // The Role left as shown: the value the panel starts at.
      const shown = title?.kind === "seat" ? title.value : "";
      const answer = await answerOf(() =>
        teamActions.saveMemberDetails({ kind: "person", id: leaderId }, null, { title: shown, details: { ...MEMBER_DETAILS, phone: `+39 333 000 000${round}` } }),
      );
      assert.deepEqual(answer, { ok: true }, `round ${round}`);
      assert.deepEqual(await tableRows(roles), before, `round ${round}: every role row, the custom title included, as it was`);
    }
  });

  test("a head, a division lead and a member are refused a seat's title, and write nothing", async () => {
    for (const viewer of ["department head", "division lead", "member"]) {
      for (const personId of [EXTRA.head, accountOf("Chief Engineer").memberId!]) {
        const { answer, writes } = await attempt(accountOf(viewer).userId, () =>
          teamActions.saveMemberDetails({ kind: "person", id: personId }, null, { title: RENAMED, details: MEMBER_DETAILS }),
        );
        assert.ok(isRefusal(answer), `${viewer} on ${personId}: ${JSON.stringify(answer)}`);
        assert.deepEqual(writes, [], viewer);
      }
    }
  });

  test("an empty seat title is refused with the field's error, and writes nothing", async () => {
    for (const title of ["", "   "]) {
      const { answer, writes } = await attempt(accountOf("team leader").userId, () =>
        teamActions.saveMemberDetails({ kind: "person", id: EXTRA.head }, null, { title, details: MEMBER_DETAILS }),
      );
      assert.deepEqual(answer, { ok: false, error: SEAT_TITLE_REQUIRED });
      assert.deepEqual(writes, []);
    }
  });
});

describe("a rename sets a member's first and last name: leads, heads, the team leader and full access, by Edit details' reach (Owner decision, 2026-10-24, issue #668)", () => {
  const NEW_NAME = { firstName: "Giulia", lastName: "Ferraro" };
  /** The first and last name on `memberId`'s users row, as stored. */
  const storedNameOf = async (memberId: number) => {
    const row = (await tableRows(users)).find((u) => u.member === memberId);
    return { firstName: row?.firstName, lastName: row?.lastName };
  };
  /** A Members grant at `level` in `u`, for the plain member viewer. */
  const membersGrant = (u: Unit, level: "view" | "edit"): typeof scopes.$inferInsert => ({
    id: 9_300,
    memberId: accountOf("member").memberId!,
    scope: "division",
    target: "members",
    accessLevel: level,
    divisionId: IDS.division(u),
  });

  /** Renames `personId` as `viewer` through Edit details, on a freshly seeded database: the answer, the writes, and the name stored before and after. */
  async function renameAs(viewer: string, personId: number, divisionId: number | null, name: unknown = NEW_NAME, setup = async () => {}) {
    await seedFixture();
    resetFiles();
    await setup();
    const before = await storedNameOf(personId);
    signInAs(userIdOf(viewer));
    const answer = await answerOf(() =>
      teamActions.saveMemberDetails({ kind: "person", id: personId }, divisionId, { title: "Engineer", details: MEMBER_DETAILS, ...(name as object) }),
    );
    return { answer, writes: await databaseWrites(), before, after: await storedNameOf(personId) };
  }

  test("a division lead renames a member of their own division: the person's users row holds the new names, trimmed", async () => {
    const { answer, after } = await renameAs("division lead", IDS.person("MA"), IDS.division("MA"), { firstName: "  Giulia ", lastName: " Ferraro" });
    assert.deepEqual(answer, { ok: true });
    assert.deepEqual(after, NEW_NAME);
  });

  test("a division lead's rename of someone outside their division is refused and writes nothing", async () => {
    for (const [personId, divisionId] of [
      [IDS.person(DM), IDS.division(DM)],
      [IDS.person("OA"), IDS.division("OA")],
      [IDS.person(DM), IDS.division("MA")],
    ] as const) {
      const { answer, writes, before, after } = await renameAs("division lead", personId, divisionId);
      assert.ok(isRefusal(answer), `${personId}: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, []);
      assert.deepEqual(after, before);
    }
  });

  test("a department head renames their department's people and is refused outside it", async () => {
    for (const u of ["MA", "OA"] as const) {
      const { answer, after } = await renameAs("department head", IDS.person(u), IDS.division(u));
      assert.deepEqual(answer, { ok: true }, u);
      assert.deepEqual(after, NEW_NAME, u);
    }
    const outside = await renameAs("department head", IDS.person(DM), IDS.division(DM));
    assert.ok(isRefusal(outside.answer));
    assert.deepEqual(outside.writes, []);
    assert.deepEqual(outside.after, outside.before);
  });

  test("the team leader and every full-access seat rename anyone on the team, a seat with no division included", async () => {
    for (const viewer of ["team leader", "operations lead", "IT lead", "Project Manager", "Chief Engineer"]) {
      for (const [personId, divisionId] of [
        [IDS.person(DM), IDS.division(DM)],
        [IDS.person("MA"), IDS.division("MA")],
        [EXTRA.head, null],
      ] as const) {
        const { answer, after } = await renameAs(viewer, personId, divisionId);
        assert.deepEqual(answer, { ok: true }, `${viewer} on ${personId}`);
        assert.deepEqual(after, NEW_NAME, `${viewer} on ${personId}`);
      }
    }
  });

  test("a plain member is refused a rename of anyone, and writes nothing", async () => {
    for (const [personId, divisionId] of [
      [IDS.person("MA"), IDS.division("MA")],
      [IDS.person(DM), IDS.division(DM)],
      [EXTRA.head, null],
    ] as const) {
      const { answer, writes, before, after } = await renameAs("member", personId, divisionId);
      assert.ok(isRefusal(answer), `${personId}: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, []);
      assert.deepEqual(after, before);
    }
  });

  test("a member with only a Members grant follows its level: Can edit renames in the granted division alone, Can view renames nobody", async () => {
    const granted = await renameAs("member", IDS.person("MA"), IDS.division("MA"), NEW_NAME, () => addRows(scopes, [membersGrant("MA", "edit")]));
    assert.deepEqual(granted.answer, { ok: true });
    assert.deepEqual(granted.after, NEW_NAME);
    const elsewhere = await renameAs("member", IDS.person(DM), IDS.division(DM), NEW_NAME, () => addRows(scopes, [membersGrant("MA", "edit")]));
    assert.ok(isRefusal(elsewhere.answer));
    assert.deepEqual(elsewhere.writes, []);
    const viewing = await renameAs("member", IDS.person("MA"), IDS.division("MA"), NEW_NAME, () => addRows(scopes, [membersGrant("MA", "view")]));
    assert.ok(isRefusal(viewing.answer));
    assert.deepEqual(viewing.writes, []);
    assert.deepEqual(viewing.after, viewing.before);
  });

  test("nobody renames themselves through Edit details: the self refusal holds for a name change", async () => {
    for (const [viewer, divisionId] of [
      ["division lead", IDS.division("MA")],
      ["department head", null],
      ["team leader", null],
      ["operations lead", null],
    ] as const) {
      const { answer, writes, before, after } = await renameAs(viewer, accountOf(viewer).memberId!, divisionId);
      assert.ok(isRefusal(answer), `${viewer}: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, [], viewer);
      assert.deepEqual(after, before, viewer);
    }
  });

  test("a blank first or last name, one over 100 characters, or only one of the two is refused with the field's error, and writes nothing", async () => {
    for (const [name, error] of [
      [{ firstName: "", lastName: "Ferraro" }, "Enter their first name."],
      [{ firstName: "Giulia", lastName: "   " }, "Enter their last name."],
      [{ firstName: "G".repeat(101), lastName: "Ferraro" }, "Too long."],
      [{ firstName: "Giulia", lastName: "F".repeat(101) }, "Too long."],
      [{ firstName: "Giulia" }, "Enter their last name."],
    ] as const) {
      const { answer, writes, before, after } = await renameAs("team leader", IDS.person(DM), IDS.division(DM), name);
      assert.deepEqual(answer, { ok: false, error }, JSON.stringify(name));
      assert.deepEqual(writes, []);
      assert.deepEqual(after, before);
    }
  });

  test("someone waiting for their NDA is not renamed through Fill details", async () => {
    await seedFixture();
    signInAs(accountOf("team leader").userId);
    const answer = await answerOf(() =>
      teamActions.saveMemberDetails({ kind: "waiting", joinId: IDS.join(DM) }, IDS.division(DM), { title: "", details: MEMBER_DETAILS, ...NEW_NAME }),
    );
    assert.ok(isRefusal(answer), JSON.stringify(answer));
    assert.deepEqual(await databaseWrites(), []);
  });

  test("Edit details starts at the stored names, and after a rename the public Team page shows the new name", async () => {
    const leader = await open("team leader");
    const roster = await leader.members();
    const position = roster.scope === "whole-team" ? roster.positions.find((p) => p.id === IDS.person(DM)) : undefined;
    assert.deepEqual(position?.name, { firstName: "Person", lastName: DM });
    const { answer } = await renameAs("team leader", IDS.person(DM), IDS.division(DM));
    assert.deepEqual(answer, { ok: true });
    const shown = (await databaseTeamRoles()).people.find((p) => p.id === IDS.person(DM));
    assert.equal(shown?.name, "Giulia Ferraro");
  });
});

describe("My profile: leads, heads, the team leader and full access rename themselves; a member's name stays their lead's (Owner decision, 2026-10-24, issue #668)", () => {
  /** The first and last name on the account's users row, as stored. */
  const ownNameOf = async (userId: string) => {
    const row = (await tableRows(users)).find((u) => u.id === userId);
    return { firstName: row?.firstName, lastName: row?.lastName };
  };
  const OWN = { ...DETAILS, firstName: "Marco", lastName: "Bianchi" };

  /** Saves "Your details" as `viewer` on a freshly seeded database: the answer, and their stored name before and after. */
  async function saveOwn(viewer: string, input: unknown) {
    await seedFixture();
    resetFiles();
    const userId = userIdOf(viewer);
    const before = await ownNameOf(userId);
    signInAs(userId);
    const answer = await answerOf(() => actions.saveDetails(input));
    return { answer, before, after: await ownNameOf(userId) };
  }

  test("a division lead, a department head, the team leader and full-access seats save their own first and last name", async () => {
    for (const viewer of ["division lead", "department head", "team leader", "operations lead", "IT lead", "org-wide editor"]) {
      const { answer, after } = await saveOwn(viewer, OWN);
      assert.equal(isRefusal(answer), false, `${viewer}: ${JSON.stringify(answer)}`);
      assert.deepEqual(after, { firstName: "Marco", lastName: "Bianchi" }, viewer);
      const opening = await openDashboard();
      assert.equal(opening.kind, "open");
      assert.equal((await (opening as { data: DashboardData }).data.myProfile())?.name, "Marco Bianchi", `${viewer}: My profile reads the new name`);
    }
  });

  test("My profile offers the name in Your details to those who rename themselves, and keeps it locked for every member", async () => {
    for (const viewer of ["division lead", "department head", "team leader", "Project Manager"]) {
      assert.equal((await (await open(viewer)).myProfile())?.detailsEditor, "lead", viewer);
    }
    for (const viewer of ["member", "member with a Positions grant (Can view) in MA", "member with a Content grant", "member with Approve orders"]) {
      assert.equal((await (await open(viewer)).myProfile())?.detailsEditor, "member", viewer);
    }
  });

  test("a plain member and a member whose only access is a grant send a name change, and their stored name stays", async () => {
    for (const viewer of ["member", "member with a Positions grant (Can view) in MA", "member with an Applications grant (Can edit) in MA and (Can view) in DM"]) {
      const { answer, before, after } = await saveOwn(viewer, OWN);
      assert.equal(isRefusal(answer), false, `${viewer}: the other fields still save`);
      assert.deepEqual(after, before, viewer);
    }
    const granted = await saveOwn("person-dm", OWN);
    assert.deepEqual(granted.after, granted.before, "a member with a Members grant");
  });

  test("a lead's own blank or too-long name is refused and nothing changes", async () => {
    for (const [name, error] of [
      [{ firstName: " ", lastName: "Bianchi" }, "Enter your first name."],
      [{ firstName: "Marco", lastName: "" }, "Enter your last name."],
      [{ firstName: "M".repeat(101), lastName: "Bianchi" }, "Too long."],
    ] as const) {
      const { answer, before, after } = await saveOwn("division lead", { ...DETAILS, ...name });
      assert.deepEqual(answer, { ok: false, error }, JSON.stringify(name));
      assert.deepEqual(after, before);
    }
  });
});

describe("Confirm join is decided by the Applications area, and the whole team lists every division's queue (Owner decision, 2026-10-22, issue #584)", () => {
  /** The unit an accepted applicant joins, by their application. */
  const unitOfJoining = (applicationId: number) => ALL.find((u) => IDS.joining(u) === applicationId);
  /** What the viewer's Members page shows with no select or search: its joining banners and its waiting rows. */
  const shownOf = async (name: string) => {
    const page = membersModelOf(await (await open(name)).members());
    return page === null ? null : shownMembers(page, NO_MEMBERS_FILTER);
  };

  test("the Members banner offers Confirm join exactly where the viewer changes Applications", async () => {
    let offered = 0;
    for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
      for (const { joining } of (await shownOf(name))?.joining ?? []) {
        const u = unitOfJoining(joining.applicationId);
        assert.ok(u !== undefined, `${name}: a joining banner for application ${joining.applicationId}`);
        assert.equal(joining.canConfirm, expect.changes.applications.includes(u), `${name}: Confirm join in ${u}`);
        if (joining.canConfirm) offered++;
      }
    }
    assert.ok(offered > 0, "some banner offers Confirm join, so the check above is not empty");
  });

  test("the banner's Confirm join and the Applications page's accept and refuse the same viewers", async () => {
    for (const { name, expect } of VIEWERS as readonly MatrixRow[]) {
      const userId = accountOf(name).userId;
      const members = await attempt(userId, () => teamActions.confirmJoin(IDS.joining(DM)));
      const applications = await attempt(userId, () => recruitmentActions.moveApplication(IDS.joining(DM), { kind: "confirm-join" }));
      const may = expect.changes.applications.includes(DM);
      assert.equal(!isRefusal(members.answer), may, `${name}: the Members banner's Confirm join: ${JSON.stringify(members.answer)}`);
      assert.equal(!isRefusal(applications.answer), may, `${name}: the Applications page's Confirm join: ${JSON.stringify(applications.answer)}`);
      assert.equal(members.writes.length > 0, may, `${name}: the Members banner's writes`);
    }
  });

  test("every whole-team viewer sees every division's waiting rows, with Confirm NDA, and its joining banners where they read Applications", async () => {
    const full = (VIEWERS as readonly MatrixRow[]).filter((r) => r.expect.wholeTeamMembers);
    assert.ok(full.length >= 5, "the full-access seats are in the matrix");
    for (const { name, expect } of full) {
      const shown = (await shownOf(name))!;
      for (const u of ALL) {
        const waiting = shown.waiting.find((w) => w.waiting.joinId === IDS.join(u));
        assert.ok(waiting !== undefined, `${name}: the waiting row in ${u}`);
        assert.equal(waiting.editable, true, `${name}: Confirm NDA, Cancel add and Fill details in ${u}`);
        const joining = shown.joining.some((j) => j.joining.applicationId === IDS.joining(u));
        assert.equal(joining, expect.reads.applications.includes(u), `${name}: the joining banner in ${u}`);
      }
    }
    // And the writes behind the waiting row take it: Confirm NDA from the whole team.
    const nda = await attempt(accountOf("operations lead").userId, () => teamActions.confirmNda(IDS.join(DM)));
    assert.deepEqual(nda.answer, { ok: true });
  });
});

describe("the Members export gives a file to full access alone (issue #539)", () => {
  async function exported(userId: string | null) {
    await seedFixture();
    resetFiles();
    signInAs(userId);
    const response = await membersExportGET();
    const body = Buffer.from(await response.arrayBuffer());
    return { response, body, writes: (await databaseWrites()).length };
  }

  test("signed out, and every matrix viewer without full access, is refused and gets no file", async () => {
    const signedOut = await exported(null);
    assert.deepEqual([signedOut.response.status, signedOut.writes], [401, 0], "signed out");
    assert.equal(signedOut.response.headers.get("Content-Disposition"), null, "signed out: a file");
    for (const { name, expect } of VIEWERS) {
      if (expect.wholeTeamMembers) continue;
      const { response, body, writes } = await exported(accountOf(name).userId);
      assert.deepEqual([response.status, writes], [403, 0], name);
      assert.equal(response.headers.get("Content-Disposition"), null, `${name}: a file`);
      assert.deepEqual(leaked(body.toString("utf8"), expect), [], `${name}: answered data they do not read`);
    }
  });

  test("every full-access viewer gets the dated .xlsx of the whole team with every field", async () => {
    const full = VIEWERS.filter((r) => r.expect.wholeTeamMembers);
    assert.ok(full.length >= 5, "the full-access seats are in the matrix");
    for (const { name } of full) {
      const data = await open(name);
      const directory = await data.members();
      assert.ok(directory.scope === "whole-team", `${name}: the whole team`);
      const { response, body, writes } = await exported(accountOf(name).userId);
      assert.equal(response.status, 200, name);
      assert.equal(writes, 0, `${name}: the export wrote`);
      assert.equal(response.headers.get("Content-Type"), XLSX_TYPE, name);
      assert.equal(response.headers.get("Content-Disposition"), `attachment; filename="${membersExportFileName(new Date())}"`, name);
      const [header, ...rows] = readSheet(body);
      assert.deepEqual(header, EXPECTED_EXPORT_HEADER, `${name}: the header row`);
      assert.deepEqual(rows.map((r) => r[0]).sort(), directory.people.map((p) => p.name).sort(), `${name}: one row per member`);
      // Each unit's private details, phone and Discord, are in the file.
      const text = rows.flat().join("\n");
      for (const u of ALL) for (const m of MARKERS.members(u).filter((x) => !x.startsWith("join-"))) assert.ok(text.includes(m), `${name}: ${m}`);
    }
  });

  test("a member the page's filters would hide is still in the file", async () => {
    const data = await open("team leader");
    const directory = await data.members();
    assert.ok(directory.scope === "whole-team");
    const person = directory.people.find((p) => p.id === IDS.person(DM))!;
    const filters = [
      { ...NO_TEAM_FILTER, departmentId: IDS.department("MA") },
      { ...NO_TEAM_FILTER, divisionId: IDS.division("MA") },
      { ...NO_TEAM_FILTER, query: "no one is called this" },
    ];
    for (const filter of filters) assert.ok(!filterTeam(directory.people, filter).some((p) => p.id === person.id), `the filter hides ${person.name}`);
    const { body } = await exported(accountOf("team leader").userId);
    const row = readSheet(body).find((r) => r[0] === person.name);
    assert.ok(row !== undefined, `${person.name} is in the file`);
    assert.ok(row.includes(MARKERS.members(DM)[0]), "with their phone");
  });

  test("the file is named by the day it is made, in the team's time zone", () => {
    assert.equal(membersExportFileName(new Date("2026-10-22T09:00:00Z")), "prt-members-2026-10-22.xlsx");
    // 23:30 UTC on the 21st is already the 22nd in Turin.
    assert.equal(membersExportFileName(new Date("2026-10-21T23:30:00Z")), "prt-members-2026-10-22.xlsx");
  });

  test("Mark created fills the PRT email column, and there is no Email alias column (epic #538, issue #563)", async () => {
    const address = "lead.dm@politorocketteam.it";
    await seedFixture();
    resetFiles();
    signInAs(accountOf("operations lead").userId);
    const marked = await answerOf(() => actions.answerAlias(IDS.aliasRequest(DM), { kind: "created", address }));
    assert.ok(!isRefusal(marked), JSON.stringify(marked));
    // Same database, no re-seed: the team leader exports after the alias is saved.
    signInAs(accountOf("team leader").userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const directory = await (opening as { data: DashboardData }).data.members();
    assert.ok(directory.scope === "whole-team", "the team leader reads the whole team");
    const lead = directory.people.find((p) => p.id === IDS.lead(DM));
    assert.ok(lead !== undefined, "the DM lead is on the team");
    const [header, ...rows] = readSheet(Buffer.from(await (await membersExportGET()).arrayBuffer()));
    assert.ok(!header.includes("Email alias"), "no Email alias column");
    const column = header.indexOf("PRT email");
    const cells = new Map(rows.map((r) => [r[0], r[column]]));
    assert.equal(cells.get(lead.name), address, "the DM lead's PRT email is the alias");
    cells.delete(lead.name);
    assert.deepEqual([...cells.values()].filter((v) => v !== ""), [], "every other member's PRT email cell is empty");
  });
});

// View as ---------------------------------------------------------------------

describe("View as: on production only the IT lead seat starts it, on a preview of the shared database and under next dev any account (issues #604, #648)", () => {
  const LIVE: ViewAsSite = "live";
  const PREVIEW = viewAsSiteOf({ NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: PREVIEW_DB });
  const NEXT_DEV = viewAsSiteOf({ NODE_ENV: "development" });
  /** Production, even pointed at the shared preview database. */
  const PRODUCTION = viewAsSiteOf({ NODE_ENV: "production", VERCEL_ENV: "production", DATABASE_URL: PREVIEW_DB });
  const itLead = accountOf("IT lead");
  const member = accountOf("member");
  /** A plain member of MA, the person viewed as. */
  const person = "person-ma";

  /** The fixture, with a Better Auth account for every matrix viewer and the person: `admins` store the admin role, everyone else the plugin's default. */
  async function seedAccounts(admins: readonly string[] = []): Promise<void> {
    await seedFixture();
    // The break-glass admin's account is the fixture's own (issue #646).
    const ids = [...VIEWERS.filter(({ viewer }) => !viewer.breakGlass).map(({ name }) => accountOf(name).userId), person];
    await addRows(
      betterAuthUsers,
      ids.map((id) => ({ id, name: id, email: `${id}@auth.test`, emailVerified: true, role: admins.includes(id) ? "admin" : "user" })),
    );
  }

  const start = (actingAccountId: string, personId = person, viewingAs = false) => ({ actingAccountId, viewingAs, personId });

  test("the test site is exactly where tester sign-in is on, read at each request; anything else reads as production", () => {
    for (const env of GATE_ON) assert.equal(viewAsSiteOf(env), "test", JSON.stringify(env));
    for (const env of GATE_OFF) assert.equal(viewAsSiteOf(env), "live", JSON.stringify(env));
    assert.equal(PREVIEW, "test");
    assert.equal(NEXT_DEV, "test");
    assert.equal(PRODUCTION, "live");
    assert.equal(viewAsSiteOf({ NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: OTHER_DB }), "live", "a preview on another database");
    assert.equal(viewAsSiteOf({ NODE_ENV: "test" }), "live", "the test runner");

    const saved = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV, DATABASE_URL: process.env.DATABASE_URL };
    const env = process.env as Record<string, string | undefined>;
    try {
      Object.assign(env, { NODE_ENV: "production", VERCEL_ENV: "preview", DATABASE_URL: PREVIEW_DB });
      assert.equal(viewAsSiteOf(), "test", "read from this request's environment");
      env.VERCEL_ENV = "production";
      assert.equal(viewAsSiteOf(), "live", "read again, not kept from the last request");
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete env[key];
        else env[key] = value;
      }
    }
  });

  test("on production a member, a department head and a seeded admin tester are refused, and the IT lead seat is allowed", async () => {
    const adminTester = accountOf("non-member").userId;
    await seedAccounts([adminTester]);
    assert.equal(await viewAsRefusal(start(member.userId), PRODUCTION), "not-allowed", "a member");
    assert.equal(await viewAsRefusal(start(accountOf("department head").userId), PRODUCTION), "not-allowed", "a department head");
    assert.equal(await viewAsRefusal(start(adminTester), PRODUCTION), "not-allowed", "a seeded admin tester");
    assert.equal(await viewAsRefusal(start(itLead.userId), PRODUCTION), null, "the IT lead seat");
  });

  test("on production the IT lead and the break-glass admin start View as, and every other matrix viewer is refused, the team leader and a stored admin included", async () => {
    await seedAccounts([member.userId, accountOf("team leader").userId]);
    for (const { name } of VIEWERS) {
      assert.equal(await viewAsRefusal(start(accountOf(name).userId), LIVE), name === "IT lead" || name === "break-glass admin" ? null : "not-allowed", name);
    }
    assert.deepEqual(await databaseWrites(), [], "deciding writes nothing");
  });

  test("after an IT lead hand-over the new seat holder starts View as and the previous one is refused, with no stored flag", async () => {
    await seedAccounts();
    // The hand-over: the IT lead leaves the seat's role, and the member takes a role flagged as the seat.
    await changeRows(roles, { memberId: itLead.memberId }, { leavedAt: "2026-10-20" });
    await addRows(roles, [{ id: 9_000, memberId: member.memberId, title: "IT Lead", startedAt: "2026-10-20", type: "core", fullAccess: "it_lead" }]);
    assert.equal(await viewAsRefusal(start(member.userId), LIVE), null, "the new seat holder");
    assert.equal(await viewAsRefusal(start(itLead.userId), LIVE), "not-allowed", "the previous seat holder");
    // Nothing per person decides it: both still store the plugin's default role.
    const storedRoleOf = async (id: string) => (await tableRows(betterAuthUsers)).find((u) => u.id === id)?.role;
    assert.deepEqual([await storedRoleOf(member.userId), await storedRoleOf(itLead.userId)], ["user", "user"]);
  });

  test("on a preview and under next dev any account starts View as, with no seat and no stored admin role", async () => {
    const adminTester = accountOf("non-member").userId;
    await seedAccounts([adminTester]);
    for (const [label, site] of [["preview", PREVIEW], ["next dev", NEXT_DEV]] as const) {
      for (const { name } of VIEWERS) {
        assert.equal(await viewAsRefusal(start(accountOf(name).userId), site), null, `${label}: ${name}`);
      }
      assert.equal(await viewAsRefusal(start(member.userId), site), null, `${label}: a plain member`);
    }
    assert.equal(await viewAsRefusal(start(member.userId), LIVE), "not-allowed", "the same plain member on production");
  });

  test("nobody views as themselves, as an unknown account, or from inside a View as session; on production nobody views as someone who may use View as", async () => {
    const adminTester = accountOf("non-member").userId;
    await seedAccounts([adminTester]);
    for (const site of [LIVE, PREVIEW]) {
      assert.equal(await viewAsRefusal(start(itLead.userId, itLead.userId), site), "same-person", site);
      assert.equal(await viewAsRefusal(start(itLead.userId, "nobody"), site), "no-such-person", site);
      assert.equal(await viewAsRefusal(start(itLead.userId, person, true), site), "already-viewing-as", site);
    }
    assert.equal(await viewAsRefusal(start(member.userId, person, true), PREVIEW), "already-viewing-as", "a plain member on a preview, from inside View as");
    // On a test site every account may use View as, so who could is no reason to refuse.
    assert.equal(await viewAsRefusal(start(itLead.userId, adminTester), PREVIEW), null, "an admin tester on a preview");
    assert.equal(await viewAsRefusal(start(member.userId, itLead.userId), PREVIEW), null, "the IT lead on a preview");
    // On production an account that holds the IT lead seat may use View as, so nobody views as it. The
    // fixture keeps one active IT lead, so it is a second account of the IT lead's own member.
    const secondAccount = "it-lead-second-account";
    await addRows(users, [{ id: secondAccount, email: `${secondAccount}@team.test`, firstName: "Viewer", lastName: secondAccount, member: itLead.memberId, createdAt: "2025-10-01" }]);
    await addRows(betterAuthUsers, [{ id: secondAccount, name: secondAccount, email: `${secondAccount}@team.test`, emailVerified: true, role: "user" }]);
    assert.equal(await viewAsRefusal(start(itLead.userId, secondAccount), LIVE), "person-may-view-as", "another account holding the IT lead seat on production");
    assert.equal(await viewAsRefusal(start(itLead.userId, secondAccount), PREVIEW), null, "the same account on a preview");
  });

  test("the user menu offers View as to a plain member on a test site and not on production (readViewAsOpening)", async () => {
    await seedAccounts();
    const plainMember = { id: member.userId, name: "Plain member", actingAccountId: null };
    assert.deepEqual(await readViewAsOpening(plainMember, PREVIEW), { actingTitle: ADMIN_TESTER_TITLE }, "a preview");
    assert.deepEqual(await readViewAsOpening(plainMember, NEXT_DEV), { actingTitle: ADMIN_TESTER_TITLE }, "next dev");
    assert.equal(await readViewAsOpening(plainMember, PRODUCTION), null, "production");
    assert.equal(await readViewAsOpening({ ...plainMember, actingAccountId: itLead.userId }, PREVIEW), null, "not from inside a View as session");
    assert.deepEqual(await readViewAsOpening({ id: itLead.userId, name: "IT lead", actingAccountId: null }, PRODUCTION), { actingTitle: "IT lead" }, "the IT lead seat on production");
  });

  test("starting and stopping View as each write one Activity log entry, under the acting account, naming both people", async () => {
    await seedAccounts();
    await recordViewAs({ event: "start", sessionId: "view-as-session", personId: person, actingAccountId: itLead.userId });
    await recordViewAs({ event: "stop", sessionId: "view-as-session", personId: person, actingAccountId: itLead.userId });
    const entries = (await logRowsSinceSeed()).map(({ schemaName, tableName, operation, recordId, newData, changedBy }) => ({ schemaName, tableName, operation, recordId, newData, changedBy }));
    const both = { personId: person, actingAccountId: itLead.userId };
    assert.deepEqual(entries, [
      { schemaName: "better_auth", tableName: "session", operation: "VIEW_AS_START", recordId: "view-as-session", newData: both, changedBy: itLead.userId },
      { schemaName: "better_auth", tableName: "session", operation: "VIEW_AS_STOP", recordId: "view-as-session", newData: both, changedBy: itLead.userId },
    ]);
  });
});

// Writes made while viewing as someone ----------------------------------------
//
// Owner decisions on #597 (2026-10-24): a write made in a View as session
// stores the person viewed as and the acting account, read from the session
// on the server, and every "by" field shows it as "IT lead as <Name
// Surname>". Each test signs in as a View as session of the team leader with
// the IT lead behind it, or as the team leader alone, and reads what the
// write stored, who the audit log would name, and what the page then shows.

describe("a write made while viewing as someone records both people, from the session (issue #605)", () => {
  const itLead = accountOf("IT lead");
  const teamLeader = accountOf("team leader");
  const asTeamLeader = `IT lead as Viewer ${teamLeader.userId}`;
  /** A request body naming an acting account the session does not: the server never reads it. */
  const FORGED = { actingAccountId: "forged-account", impersonatedBy: "forged-account" };

  /** A fresh fixture that keeps its writes, signed in as the team leader: viewed as by the IT lead, or on their own. */
  async function signedIn(viewedAs: boolean): Promise<DashboardData> {
    await seedFixture();
    resetFiles();
    if (viewedAs) viewAs(teamLeader.userId, itLead.userId);
    else signInAs(teamLeader.userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open", "the dashboard opens");
    return (opening as { data: DashboardData }).data;
  }

  const decidedOrder = async () => (await tableRows(orders)).find((o) => o.id === IDS.order(DM))!;

  test("an order approved while viewing as the team leader stores both ids, logs both, and reads as the IT lead as them", async () => {
    await signedIn(true);
    const answer = (await actions.decideOrder(IDS.order(DM), { kind: "approve" })) as { ok: boolean; value?: { answer?: { by: string; byYou: boolean } } };
    assert.ok(answer.ok, JSON.stringify(answer));
    assert.equal((await decidedOrder()).reviewedBy, teamLeader.memberId, "the person viewed as");
    assert.equal((await decidedOrder()).reviewedByActingAccount, itLead.userId, "the acting account");
    assert.deepEqual(await loggedWriters(), [{ userId: teamLeader.userId, actingAccountId: itLead.userId }], "the log names both");
    assert.deepEqual(answer.value?.answer && { by: answer.value.answer.by, byYou: answer.value.answer.byYou }, { by: asTeamLeader, byYou: false });
  });

  test("a grant given and an NDA confirmed while viewing as the team leader store both ids and read as the IT lead as them", async () => {
    const data = await signedIn(true);
    assert.ok(!isRefusal(await actions.saveAccess({ personId: IDS.person(DM), areas: { positions: "edit" } })), "the grant is given");
    const grant = (await tableRows(scopes)).find((s) => s.memberId === IDS.person(DM) && s.target === "positions")!;
    assert.deepEqual({ givenBy: grant.givenBy, acting: grant.givenByActingAccount }, { givenBy: teamLeader.memberId, acting: itLead.userId });
    assert.ok(JSON.stringify(await data.divisionAccess()).includes(asTeamLeader), "Access shows who gave it");

    assert.deepEqual(await teamActions.confirmNda(IDS.join(DM)), { ok: true });
    const joined = (await tableRows(members)).find((m) => m.ndaConfirmedByActingAccount !== null)!;
    assert.deepEqual({ by: joined.ndaConfirmedBy, acting: joined.ndaConfirmedByActingAccount }, { by: teamLeader.memberId, acting: itLead.userId });
    assert.ok(JSON.stringify(await data.members()).includes(asTeamLeader), "Members shows who confirmed the NDA");
    assert.deepEqual(await loggedWriters(), [{ userId: teamLeader.userId, actingAccountId: itLead.userId }], "every write is logged with the acting account");
  });

  test("a request naming another acting account changes nothing that is stored", async () => {
    await signedIn(true);
    assert.ok(!isRefusal(await actions.decideOrder(IDS.order(DM), { kind: "approve", ...FORGED })));
    assert.equal((await decidedOrder()).reviewedByActingAccount, itLead.userId, "in a View as session, the session's acting account");
    assert.deepEqual(await loggedWriters(), [{ userId: teamLeader.userId, actingAccountId: itLead.userId }]);
    assert.ok(!JSON.stringify(await tableRows(orders)).includes(FORGED.actingAccountId), "the forged id is stored nowhere");

    await signedIn(false);
    assert.ok(!isRefusal(await actions.decideOrder(IDS.order(DM), { kind: "approve", actingAccountId: itLead.userId })));
    assert.equal((await decidedOrder()).reviewedByActingAccount, null, "in a plain session, none");
    assert.deepEqual(await loggedWriters(), [{ userId: teamLeader.userId, actingAccountId: null }]);
  });

  test("the Projects edited-by line names the IT lead as the person for an edit made while viewing as them", async () => {
    await signedIn(true);
    // What the audit trigger stores for two project edits: one made while
    // viewing as the team leader, one the team leader made on their own.
    // Each is the newest edit of its project: later than the rows the
    // migrations' own imports logged (drizzle/0037).
    const now = new Date().toISOString();
    const edit = (projectId: number, actingAccountId: string | null) => ({
      schemaName: "public",
      tableName: "project_versions",
      operation: "UPDATE",
      recordId: String(projectId),
      newData: { project_id: projectId },
      changedBy: teamLeader.userId,
      changedByActingAccount: actingAccountId,
      changedAt: now,
    });
    await addRows(logs, [edit(1, itLead.userId), edit(2, null)]);
    const stamps = await readProjectStamps();
    assert.equal(stamps.get(1)?.by, asTeamLeader, "an edit made while viewing as them");
    assert.equal(stamps.get(2)?.by, `Viewer ${teamLeader.userId}`, "an edit made outside View as");
  });

  test("a write made outside View as stores no acting account and reads as before", async () => {
    const data = await signedIn(false);
    const answer = (await actions.decideOrder(IDS.order(DM), { kind: "approve" })) as { ok: boolean; value?: { answer?: { by: string; byYou: boolean } } };
    assert.ok(answer.ok, JSON.stringify(answer));
    assert.deepEqual({ by: (await decidedOrder()).reviewedBy, acting: (await decidedOrder()).reviewedByActingAccount }, { by: teamLeader.memberId, acting: null });
    assert.deepEqual(answer.value?.answer && { by: answer.value.answer.by, byYou: answer.value.answer.byYou }, { by: `Viewer ${teamLeader.userId}`, byYou: true });
    assert.ok(!isRefusal(await actions.saveAccess({ personId: IDS.person(DM), areas: { positions: "edit" } })));
    assert.equal((await tableRows(scopes)).find((s) => s.memberId === IDS.person(DM) && s.target === "positions")?.givenByActingAccount, null);
    assert.ok(!JSON.stringify(await data.divisionAccess()).includes(" as Viewer"), "no grant names an acting seat");
    // Both writes are logged, every log row under the team leader alone.
    const logged = (await logRowsSinceSeed()).map((r) => r.tableName);
    for (const table of ["orders", "scopes"]) assert.ok(logged.includes(table), `the ${table} write is logged: ${logged}`);
    assert.deepEqual(await loggedWriters(), [{ userId: teamLeader.userId, actingAccountId: null }]);
  });
});

// The Projects board ---------------------------------------------------------

describe("moving a project card on the Projects page is not an edit (issue #297, #613)", () => {
  test("projects.setSiteOrder writes the site order on projects and no project_versions row, so no card's edited-by line changes", async () => {
    const data = await open("team leader");
    const items = importedProjects();
    // The migrations import the record's projects, each with its published version (drizzle/0037).
    assert.deepEqual((await tableRows(projects)).map((p) => p.id), items.map((item) => item.id), "the imported projects");
    assert.deepEqual((await tableRows(projectVersions)).map((v) => [v.projectId, v.version]), items.map((item) => [item.id, "published"]));
    // One earlier edit, as the audit trigger logs it, so a card has a line to keep.
    await addRows(logs, [
      {
        schemaName: "public",
        tableName: "project_versions",
        operation: "UPDATE",
        recordId: "1",
        newData: { project_id: 1 },
        changedBy: accountOf("team leader").userId,
        changedAt: "2026-10-20T09:00:00.000Z",
      },
    ]);
    const linesBefore = (await data.projects.board())?.edited;
    assert.ok(linesBefore?.[1], "the edited card has a line before the move");
    const stampsBefore = await readProjectStamps();
    const ids = items.map((item) => item.id).reverse();

    assert.ok((await data.projects.setSiteOrder(ids)).ok, "a site-content editor moves the cards");

    const written = await databaseWrites();
    assert.ok(written.some((w) => w.table === "projects"), `the move writes the site order: ${JSON.stringify(written)}`);
    assert.ok(!written.some((w) => w.table === "project_versions"), `the move writes no project version: ${JSON.stringify(written)}`);
    const order = (await tableRows(projects)).sort((a, b) => Number(a.siteOrder) - Number(b.siteOrder)).map((p) => p.id);
    assert.deepEqual(order, ids, "the cards stand in the new order");
    assert.deepEqual(await readProjectStamps(), stampsBefore, "the audit log holds no new edit");
    assert.deepEqual((await data.projects.board())?.edited, linesBefore, "every card's edited-by line reads as before");
  });
});

describe("Delete project in the project editor (issue #768)", () => {
  const CAVOUR = 1;
  const stored = async () => ({
    projects: (await tableRows(projects)).map((p) => p.id),
    versions: (await tableRows(projectVersions)).map((v) => v.projectId),
  });

  test("a site-content editor deletes a published project: its rows go through the audit log, and no public read or dashboard list shows it", async () => {
    const data = await open("team leader");
    const slug = editorVersion(importedProjects().find((item) => item.id === CAVOUR)!.version).slug;
    assert.ok(publishedPageOf(await publishedProjects(), slug), "Cavour is published before the delete");

    assert.deepEqual(await projectActions.deleteProject(CAVOUR), { ok: true, value: null });

    const after = await stored();
    assert.ok(!after.projects.includes(CAVOUR) && !after.versions.includes(CAVOUR), `the project and its versions are gone: ${JSON.stringify(after)}`);
    assert.deepEqual(await loggedWriters(), [{ userId: accountOf("team leader").userId, actingAccountId: null }], "the delete is logged under its editor");
    // Home and /projects draw publishedProjects(), the footer footerProjects(); /projects/<slug> is not found without a published page.
    assert.ok(!(await publishedProjects()).some((r) => r.slug === slug), "Home and /projects");
    assert.ok(!(await footerProjects()).some((p) => p.slug === slug), "the footer's PROJECTS column");
    assert.equal(publishedPageOf(await publishedProjects(), slug), null, "/projects/<slug>");
    assert.ok(!(await data.projects.board())?.items.some((item) => item.id === CAVOUR), "the dashboard Projects list");
  });

  test("a viewer the site-content gate refuses is answered its refusal, and the project and its versions stay", async () => {
    await open("member");
    const before = await stored();
    assert.ok(before.projects.includes(CAVOUR) && before.versions.includes(CAVOUR));
    assert.deepEqual(await projectActions.deleteProject(CAVOUR), { ok: false, error: SITE_CONTENT_REFUSAL });
    assert.deepEqual(await stored(), before);
  });
});

// The CV and letter links ---------------------------------------------------

describe("the CV and letter routes open a file only where the viewer reads Applications", () => {
  const documentRoute = (u: Unit, kind: string) => () =>
    documentGET(new Request(`https://site.test/dashboard/applications/${IDS.application(u)}/${kind}`), { params: Promise.resolve({ id: String(IDS.application(u)), document: kind }) });
  const legacyRoute = (u: Unit) => () =>
    legacyGET(new NextRequest(`https://site.test/docs/applications/${cvHash(u)}/cv.pdf`), { params: Promise.resolve({ r2key: cvHash(u), filename: "cv.pdf" }) });

  async function status(userId: string | null, run: () => Promise<Response>): Promise<{ status: number; opened: readonly string[]; writes: number }> {
    await seedFixture();
    resetFiles();
    signInAs(userId);
    const response = await run();
    return { status: response.status, opened: fileReads(), writes: (await databaseWrites()).length };
  }

  for (const u of ALL) {
    test(`the CV and letter of an application in ${u}`, async () => {
      for (const route of [documentRoute(u, "cv"), documentRoute(u, "motivation-letter"), legacyRoute(u)]) {
        const signedOut = await status(null, route);
        assert.deepEqual(signedOut, { status: 401, opened: [], writes: 0 }, "signed out");
        for (const { name, expect } of VIEWERS) {
          const answer = await status(accountOf(name).userId, route);
          if (expect.reads.applications.includes(u)) assert.equal(answer.status, 200, name);
          else assert.deepEqual(answer, { status: 403, opened: [], writes: 0 }, `${name}: opened a file in ${u}`);
        }
      }
      // The applicant opens their own file at the old address.
      assert.equal((await status(`applicant-${u.toLowerCase()}`, legacyRoute(u))).status, 200, "the applicant");
    });
  }
});

// Stored role titles (issue #625) -------------------------------------------
//
// A role title is stored and can be renamed. A rename never moves a seat, a
// headship or any access: seats are read from `roles.full_access` and from
// where a role sits, never from its title.

describe("a renamed role title changes no access, no seat and no headship (issue #625)", () => {
  const RENAMED = "Chief of Propulsion";
  /** Retitles every active role the matrix viewer holds, as a rename would store it. */
  const rename = (name: string, title = RENAMED) => changeRows(roles, { memberId: accountOf(name).memberId }, { title });

  /** Signs in as `name` on a freshly seeded database whose rows `before` laid over, and opens their dashboard. */
  async function openAfter(name: string, before: () => Promise<unknown> | void = () => {}): Promise<DashboardData> {
    await seedFixture();
    await before();
    signInAs(accountOf(name).userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open", `${name}: the dashboard opens`);
    return (opening as { data: DashboardData }).data;
  }

  /** Every read the sweep above calls, as one text, with what it leaked. */
  async function readEverything(data: DashboardData, expect: Expect): Promise<{ seen: string; leaks: string[] }> {
    let seen = "";
    const leaks: string[] = [];
    for (const [, call] of readCalls()) {
      const answer = await answerOf(() => call(data));
      leaks.push(...leaked(answer, expect));
      seen += JSON.stringify(answer ?? null).toLowerCase();
    }
    return { seen, leaks };
  }

  const standing = ({ role: _role, ...rest }: DashboardData["viewer"]) => rest;
  const SAVE = { title: "Engineer", details: MEMBER_DETAILS };

  for (const name of ["operations lead", "IT lead", "Project Manager", "Chief Engineer"]) {
    test(`${name}: full access is the same after their title is renamed`, async () => {
      const { expect } = VIEWERS.find((v) => v.name === name)!;
      const before = await openAfter(name);
      const after = await openAfter(name, () => rename(name));
      assert.deepEqual(standing(after.viewer), standing(before.viewer), "the same standing, seat and grants");
      assert.equal(after.viewer.kind, "operations-lead", "full access by the seat");
      assert.equal(after.viewer.role, RENAMED, "the user card reads the stored title");
      const { seen, leaks } = await readEverything(after, expect);
      assert.deepEqual(leaks, [], "no read answers more than before");
      assert.deepEqual(expectedMarkers(expect).filter((m) => !seen.includes(m)), [], "every read still answers what it did");
      // A whole-team change still lands.
      await seedFixture();
      await rename(name);
      signInAs(accountOf(name).userId);
      assert.deepEqual(await teamActions.saveMemberDetails({ kind: "person", id: IDS.person(DM) }, IDS.division(DM), SAVE), { ok: true });
      assert.ok((await databaseWrites()).length > 0);
    });
  }

  test("the Project Manager and the Chief Engineer stay on the seat row of the Team tree, in the same place, after a rename", async () => {
    const seats = async (renamed: boolean) => {
      const data = await openAfter("team leader", async () => {
        if (renamed) {
          await rename("Project Manager", "Programme Lead");
          await rename("Chief Engineer", RENAMED);
        }
      });
      return (await data.teamTree()).board.map((b) => [b.holders[0].id, b.title]);
    };
    const [pm, ce] = [accountOf("Project Manager").memberId, accountOf("Chief Engineer").memberId];
    const before = await seats(false);
    const after = await seats(true);
    assert.deepEqual(
      after.filter(([id]) => id === pm || id === ce),
      [
        [pm, "Programme Lead"],
        [ce, RENAMED],
      ],
    );
    assert.deepEqual(
      after.map(([id]) => id),
      before.map(([id]) => id),
      "every seat keeps its place on the row",
    );
  });

  test("a role in no department and no division, not a head's, an advisor's or the team leader's, sits on the seat row after the flagged seats", async () => {
    const data = await openAfter("team leader", () =>
      addRows(roles, [{ id: 7_000, memberId: IDS.person("MA"), title: "Head of R&D", startedAt: "2020-10-01", type: "core" }]),
    );
    const board = (await data.teamTree()).board.map((b) => [b.holders[0].id, b.title]);
    const [pm, ce] = [accountOf("Project Manager").memberId, accountOf("Chief Engineer").memberId];
    // The flagged seats first, whatever the further seat's start date.
    assert.deepEqual(board.slice(0, 2), [
      [pm, "Project Manager"],
      [ce, "Chief Engineer"],
    ]);
    assert.ok(
      board.slice(2).some(([id, title]) => id === IDS.person("MA") && title === "Head of R&D"),
      JSON.stringify(board),
    );
  });

  test("a renamed head is still their department's head on the roster, the Team tree and every access check, and no grant changes", async () => {
    const name = "department head";
    const head = accountOf(name).memberId!;
    const { expect } = VIEWERS.find((v) => v.name === name)!;
    const before = await openAfter(name);
    const grants = await tableRows(scopes);
    const after = await openAfter(name, () => rename(name, "Chief of Aerodynamics"));
    assert.deepEqual(await tableRows(scopes), grants, "no grant changes");
    assert.deepEqual(standing(after.viewer), standing(before.viewer), "the same standing and grants");
    const { seen, leaks } = await readEverything(after, expect);
    assert.deepEqual(leaks, []);
    assert.deepEqual(expectedMarkers(expect).filter((m) => !seen.includes(m)), []);
    // Their department's change still lands; another department's is still refused.
    await seedFixture();
    await rename(name, "Chief of Aerodynamics");
    signInAs(accountOf(name).userId);
    assert.deepEqual(await teamActions.saveMemberDetails({ kind: "person", id: IDS.person("MA") }, IDS.division("MA"), SAVE), { ok: true });
    assert.ok(isRefusal(await answerOf(() => teamActions.saveMemberDetails({ kind: "person", id: IDS.person(DM) }, IDS.division(DM), SAVE))));
    // The team leader's roster and Team tree read them as Aerodynamics' head, under the stored title:
    // the fixture keeps one active head per department, and it is them.
    const leader = await openAfter("team leader", () => rename(name, "Chief of Aerodynamics"));
    const roster = await leader.members();
    assert.equal(roster.scope, "whole-team");
    const row = roster.scope === "whole-team" ? roster.people.find((p) => p.id === head) : undefined;
    assert.deepEqual([row?.role, row?.roleLabel, row?.departmentIds], ["head", "Chief of Aerodynamics", [IDS.department("MA")]]);
    const aerodynamics = (await leader.teamTree()).departments.find((d) => d.id === IDS.department("MA"));
    assert.deepEqual(aerodynamics?.heads.map((h) => [h.id, h.title]), [[head, "Chief of Aerodynamics"]]);
  });

  test("the Access page's line under a renamed head and a renamed Chief Engineer, and Close department's head label, read the stored title", async () => {
    const [head, ce] = [accountOf("department head").memberId, accountOf("Chief Engineer").memberId];
    const lines = async (titles?: { readonly head: string; readonly ce: string }) => {
      const data = await openAfter("team leader", async () => {
        if (titles !== undefined) {
          await rename("department head", titles.head);
          await rename("Chief Engineer", titles.ce);
        }
      });
      const access = await data.divisionAccess();
      const titleOf = (id: number | null) => {
        const role = access?.roleAccess.find((r) => r.person.id === id);
        return role !== undefined && "title" in role ? role.title : null;
      };
      const aerodynamics = (await data.teamStructure())?.departments.find((d) => d.id === IDS.department("MA"));
      const closing = aerodynamics?.closing.find((p) => p.id === head);
      return { head: titleOf(head), ce: titleOf(ce), close: closing?.standing === "head" ? closing.title : null, department: aerodynamics?.name };
    };
    // The fixture stores the head's title as "Head" and the Chief Engineer's as "Chief Engineer": each reads as stored.
    const seeded = await lines();
    assert.deepEqual([seeded.head, seeded.ce, seeded.close], ["Head", "Chief Engineer", "Head"]);
    const renamed = await lines({ head: "Chief of Aerodynamics", ce: RENAMED });
    assert.deepEqual([renamed.head, renamed.ce, renamed.close], ["Chief of Aerodynamics", RENAMED, "Chief of Aerodynamics"]);
    // A blank title reads the default.
    const blank = await lines({ head: "", ce: "" });
    assert.deepEqual([blank.head, blank.ce, blank.close], [`Head of ${blank.department}`, "Chief Engineer", `Head of ${blank.department}`]);
  });

  test("a department rename rewrites a head title still at the old default and keeps a renamed one", async () => {
    const renameStructures = async (headTitle: string) => {
      await seedFixture();
      await changeRows(roles, { id: 6_000 }, { title: headTitle });
      signInAs(accountOf("team leader").userId);
      const answer = await teamActions.saveDepartment(IDS.department(DM), { name: "Frames", code: "FRM", kind: "technical", head: null });
      assert.deepEqual(answer, { ok: true });
      return (await tableRows(roles)).find((r) => r.id === 6_000)?.title;
    };
    assert.equal(await renameStructures("Head of Structures"), "Head of Frames", "the default follows the new name");
    assert.equal(await renameStructures("Chief of Structures"), "Chief of Structures", "a renamed title is kept");
  });

  test("a new head row gets the default title", async () => {
    await seedFixture();
    signInAs(accountOf("team leader").userId);
    const created = await teamActions.createDepartment({ name: "Avionics", code: "AVI", kind: "technical", heads: [EXTRA.mover] });
    assert.ok(created.ok, JSON.stringify(created));
    const row = (await tableRows(roles)).find((r) => r.memberId === EXTRA.mover && r.type === "head");
    assert.equal(row?.title, "Head of Avionics");
  });

  test("another department's head may head a new department too, and keeps the head seat they hold (issue #837)", async () => {
    await seedFixture();
    signInAs(accountOf("team leader").userId);
    const created = await teamActions.createDepartment({ name: "Avionics", code: "AVI", kind: "technical", heads: [EXTRA.head] });
    assert.ok(created.ok, JSON.stringify(created));
    const heads = (await tableRows(roles)).filter((r) => r.memberId === EXTRA.head && r.type === "head" && r.leavedAt == null);
    assert.deepEqual(heads.map((r) => r.deptId).sort(), [IDS.department(DM), created.ok ? created.value : null].sort(), "Structures' head row stays beside the new one");
  });
});

// The seat row of Edit team tree (issue #627) ---------------------------------
//
// A seat box changes who holds a team-level seat: the holder's seat role ends
// and the successor's starts with the same title and full-access flag. Add
// seat starts one with no flag. The team leader and full access only.

describe("Edit team tree's seat row: Change holder and Add seat (issue #627)", () => {
  const SEAT_VIEWERS = VIEWERS.filter(fullAccess).map((r) => r.name);
  const REFUSED_VIEWERS = ["department head", "division lead", "member"];

  /** Signs in as `who` (a matrix viewer, or a fixture account by its user id) on the database as it stands, and opens their dashboard. */
  async function openAs(who: string): Promise<DashboardData> {
    signInAs(userIdOf(who));
    const opening = await openDashboard();
    assert.equal(opening.kind, "open", `${who}: the dashboard opens`);
    return (opening as { data: DashboardData }).data;
  }
  /** The fixture's mover: in DM and Testing, holding no seat. */
  const MOVER = "mover";

  const active = async (memberId: number | null) => (await tableRows(roles)).filter((r) => r.memberId === memberId && r.leavedAt == null);

  test("Change holder ends the old holder's seat role and gives the successor the same title and full access", async () => {
    const pm = accountOf("Project Manager").memberId;
    await seedFixture();
    const seatId = await seatRowOf("Project Manager");
    const seat = (await tableRows(roles)).find((r) => r.id === seatId)!;
    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.changeSeatHolder(seatId, { to: EXTRA.mover, outcome: "advisor" }), { ok: true });

    assert.ok((await tableRows(roles)).find((r) => r.id === seatId)?.leavedAt != null, "the old seat row ended");
    const taken = (await active(EXTRA.mover)).filter((r) => r.deptId == null && r.divisionId == null);
    assert.deepEqual(
      taken.map((r) => [r.title, r.fullAccess, r.type]),
      [[seat.title, "project_manager", seat.type ?? null]],
      "one seat row, with the seat's title and flag",
    );
    assert.equal((await active(EXTRA.mover)).length, 3, "the successor keeps their two division roles");
    // The old holder becomes an advisor to the team, holding no seat and no flag.
    assert.deepEqual(
      (await active(pm)).map((r) => [r.type, r.deptId ?? null, r.divisionId ?? null, r.fullAccess ?? null]),
      [["advisor", null, null, null]],
    );

    // Access follows the seat: the successor has full access, the old holder has it no more.
    const successor = await openAs(MOVER);
    assert.equal(successor.viewer.kind, "operations-lead", "the successor has full access");
    const former = await openAs("Project Manager");
    assert.notEqual(former.viewer.kind, "operations-lead", "the old holder has full access no more");
    const board = (await (await openAs("team leader")).teamTree()).board.map((b) => [b.holders[0].id, b.title]);
    assert.deepEqual(board[0], [EXTRA.mover, seat.title], "the successor is on the seat row in the seat's place");
    assert.ok(!board.some(([id]) => id === pm), "the old holder holds the seat no more");
  });

  test("Leave the team on Change holder ends every role the old holder holds", async () => {
    const ce = accountOf("Chief Engineer").memberId;
    await seedFixture();
    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.changeSeatHolder(await seatRowOf("Chief Engineer"), { to: EXTRA.mover, outcome: "leave" }), { ok: true });
    assert.deepEqual(await active(ce), [], "no role is left");
    assert.ok((await active(EXTRA.mover)).some((r) => r.fullAccess === "chief_engineer"));
  });

  test("Change holder refuses no outcome and the holder themself, and writes nothing", async () => {
    for (const change of [
      { to: EXTRA.mover, outcome: null },
      { to: accountOf("Project Manager").memberId, outcome: "advisor" },
    ]) {
      const { answer, writes } = await attempt(accountOf("team leader").userId, async () => teamActions.changeSeatHolder(await seatRowOf("Project Manager"), change));
      assert.ok(isRefusal(answer), JSON.stringify(change));
      assert.deepEqual(writes, [], JSON.stringify(change));
    }
  });

  test("Change holder gives the seat to someone who already holds a seat, and they keep it (issue #837)", async () => {
    await seedFixture();
    const seatId = await seatRowOf("Project Manager");
    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.changeSeatHolder(seatId, { to: EXTRA.head, outcome: "advisor" }), { ok: true });
    const held = (await active(EXTRA.head)).map((r) => [r.type, r.deptId ?? null, r.fullAccess ?? null]);
    assert.ok(held.some(([type, deptId]) => type === "head" && deptId === IDS.department(DM)), "Structures' head row stays");
    assert.ok(held.some(([, deptId, flag]) => deptId === null && flag === "project_manager"), "and the seat is theirs");
    assert.equal((await tableRows(roles)).filter((r) => r.fullAccess === "project_manager" && r.leavedAt == null).length, 1, "one active holder of the seat");
  });

  test("Add seat starts a role in no department and no division with no full access, on both tree rows and the public Team page's arc", async () => {
    await seedFixture();
    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.addSeat({ personId: EXTRA.mover, title: "  Safety   Officer " }), { ok: true });
    const added = (await active(EXTRA.mover)).filter((r) => r.deptId == null && r.divisionId == null);
    assert.deepEqual(
      added.map((r) => [r.title, r.fullAccess ?? null, r.type]),
      [["Safety Officer", null, "core"]],
    );
    const leader = await openAs("team leader");
    const tree = (await leader.teamTree()).board.map((b) => [b.holders[0].id, b.title]);
    assert.deepEqual(tree.at(-1), [EXTRA.mover, "Safety Officer"], "after the flagged seats on the Team tree");
    const structure = (await leader.teamStructure())?.board.map((s) => [s.holders[0].id, s.title, s.flag]);
    assert.deepEqual(structure?.at(-1), [EXTRA.mover, "Safety Officer", null], "and on Edit team tree's seat row");
    const arc = teamBuildOf(await databaseTeamRoles()).arc.map((l) => [l.person.id, l.role]);
    assert.deepEqual(arc.at(-1), [EXTRA.mover, "Safety Officer"], "and on the public Team page's arc");
    // A new seat gives no full access of its own.
    assert.notEqual((await openAs(MOVER)).viewer.kind, "operations-lead");
  });

  test("Add seat refuses a blank title and writes nothing", async () => {
    const { answer, writes } = await attempt(accountOf("team leader").userId, () => teamActions.addSeat({ personId: EXTRA.mover, title: "   " }));
    assert.ok(isRefusal(answer));
    assert.deepEqual(writes, []);
  });

  test("Add seat gives a new seat to someone who already holds a seat, and they keep it (issue #837)", async () => {
    await seedFixture();
    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.addSeat({ personId: EXTRA.head, title: "Safety Officer" }), { ok: true });
    const held = (await active(EXTRA.head)).map((r) => [r.type, r.deptId ?? null, r.title]);
    assert.ok(held.some(([type, deptId]) => type === "head" && deptId === IDS.department(DM)), "Structures' head row stays");
    assert.ok(held.some(([type, deptId, title]) => type === "core" && deptId === null && title === "Safety Officer"), "and the new seat is theirs");
  });

  // Remove seat (issue #643): the holder's seat role ends with no successor,
  // and the seat leaves both tree rows and the public Team page; the holder
  // stays on the team, as an advisor to the team when the seat was their only role.

  /** Whether the seat row `roleId` is on the Team tree, Edit team tree's seat row and the public Team page's arc. */
  async function seatShown(roleId: number, holder: number) {
    const leader = await openAs("team leader");
    const tree = (await leader.teamTree()).board.some((b) => b.holders.some((p) => p.id === holder));
    const row = ((await leader.teamStructure())?.board ?? []).some((s) => s.roleId === roleId);
    const arc = teamBuildOf(await databaseTeamRoles()).arc.some((l) => l.person.id === holder);
    return { tree, row, arc };
  }

  test("Remove seat ends the holder's only role, starts no successor's, and keeps them on the team as an advisor with their grants", async () => {
    const pm = accountOf("Project Manager").memberId;
    await seedFixture();
    const seatId = await seatRowOf("Project Manager");
    await addRows(scopes, [{ id: 9_401, memberId: pm, scope: "division", target: "members", accessLevel: "view", divisionId: IDS.division(DM) }]);
    assert.deepEqual(await seatShown(seatId, pm!), { tree: true, row: true, arc: true });

    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.removeSeat(seatId), { ok: true });

    assert.ok((await tableRows(roles)).find((r) => r.id === seatId)?.leavedAt != null, "the seat row ended");
    assert.ok(!(await tableRows(roles)).some((r) => r.leavedAt == null && r.fullAccess === "project_manager"), "no successor holds the seat");
    assert.deepEqual(
      (await active(pm)).map((r) => [r.type, r.deptId ?? null, r.divisionId ?? null, r.fullAccess ?? null]),
      [["advisor", null, null, null]],
      "they stay on the team as an advisor to the team",
    );
    assert.ok((await tableRows(scopes)).some((s) => s.id === 9_401), "their grant is kept");
    assert.ok(!(await tableRows(teamLeaves)).some((l) => l.memberId === pm), "no leave is recorded");
    assert.deepEqual(await seatShown(seatId, pm!), { tree: false, row: false, arc: false }, "the seat is gone from both trees and the Team page");

    const leader = await openAs("team leader");
    const roster = await leader.members();
    assert.ok(roster.scope === "whole-team" && roster.people.some((p) => p.id === pm), "they are on the roster");
    assert.ok(!(await leader.alumni()).rows.some((r) => r.key === `m${pm}`), "they are not on Alumni");
    assert.notEqual((await openAs("Project Manager")).viewer.kind, "operations-lead", "the seat's full access ended with it");
  });

  test("Remove seat on a full-access seat keeps every other role the holder holds and starts no Advisor role", async () => {
    const ce = accountOf("Chief Engineer").memberId;
    await seedFixture();
    await addRows(roles, [{ id: 9_402, memberId: ce, divisionId: IDS.division(DM), title: "Member", startedAt: "2025-10-01", type: "core" }]);
    const seatId = await seatRowOf("Chief Engineer");
    assert.equal((await openAs("Chief Engineer")).viewer.kind, "operations-lead", "the seat gives full access");

    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.removeSeat(seatId), { ok: true });

    assert.deepEqual((await active(ce)).map((r) => r.id), [9_402], "only their division role is left");
    assert.ok(!(await tableRows(roles)).some((r) => r.leavedAt == null && r.fullAccess === "chief_engineer"), "no successor holds the seat");
    assert.notEqual((await openAs("Chief Engineer")).viewer.kind, "operations-lead", "the seat's full access ended with it");
    assert.deepEqual(await seatShown(seatId, ce!), { tree: false, row: false, arc: false });
  });

  test("Remove seat on an added seat keeps the holder's divisions", async () => {
    await seedFixture();
    await addRows(roles, [{ id: 9_403, memberId: EXTRA.mover, title: "Safety Officer", startedAt: "2025-10-01", type: "core" }]);
    signInAs(accountOf("team leader").userId);
    assert.deepEqual(await teamActions.removeSeat(9_403), { ok: true });
    assert.deepEqual((await active(EXTRA.mover)).map((r) => r.id).sort(), [6_001, 6_002]);
    assert.deepEqual(await seatShown(9_403, EXTRA.mover), { tree: false, row: false, arc: false });
  });

  test("Remove seat refuses a seat no longer held and a row that is no team-level seat, and writes nothing", async () => {
    const cases: readonly [string, () => Promise<unknown>][] = [
      [
        "an ended seat",
        async () => {
          const seatId = await seatRowOf("Project Manager");
          await changeRows(roles, { id: seatId }, { leavedAt: "2026-10-01" });
          return teamActions.removeSeat(seatId);
        },
      ],
      ["a division role", () => teamActions.removeSeat(6_001)],
      ["a head's role", () => teamActions.removeSeat(6_000)],
      ["no such row", () => teamActions.removeSeat(999_999)],
    ];
    for (const [what, run] of cases) {
      const { answer, writes } = await attempt(accountOf("team leader").userId, run);
      assert.ok(isRefusal(answer), `${what}: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, [], `${what}: wrote`);
    }
  });

  for (const name of SEAT_VIEWERS) {
    test(`${name} may remove a seat`, async () => {
      const removal = await attempt(accountOf(name).userId, async () => teamActions.removeSeat(await seatRowOf("Chief Engineer")));
      assert.deepEqual(removal.answer, { ok: true }, `${name}: Remove seat`);
      assert.ok(removal.writes.length > 0);
    });
  }

  for (const name of REFUSED_VIEWERS) {
    test(`${name} is refused Remove seat, and writes nothing`, async () => {
      const { answer, writes } = await attempt(accountOf(name).userId, async () => teamActions.removeSeat(await seatRowOf("Project Manager")));
      assert.ok(isRefusal(answer), `${name}: ${JSON.stringify(answer)}`);
      assert.deepEqual(writes, [], `${name}: wrote`);
    });
  }

  for (const name of SEAT_VIEWERS) {
    test(`${name} may change a seat's holder and add a seat`, async () => {
      const change = await attempt(accountOf(name).userId, async () => teamActions.changeSeatHolder(await seatRowOf("Chief Engineer"), { to: EXTRA.mover, outcome: "advisor" }));
      assert.deepEqual(change.answer, { ok: true }, `${name}: Change holder`);
      assert.ok(change.writes.length > 0);
      const add = await attempt(accountOf(name).userId, () => teamActions.addSeat({ personId: EXTRA.mover, title: "Safety Officer" }));
      assert.deepEqual(add.answer, { ok: true }, `${name}: Add seat`);
      assert.ok(add.writes.length > 0);
    });
  }

  for (const name of REFUSED_VIEWERS) {
    test(`${name} is refused both, and writes nothing`, async () => {
      for (const run of [
        async () => teamActions.changeSeatHolder(await seatRowOf("Project Manager"), { to: EXTRA.mover, outcome: "advisor" }),
        () => teamActions.addSeat({ personId: EXTRA.mover, title: "Safety Officer" }),
      ]) {
        const { answer, writes } = await attempt(accountOf(name).userId, run);
        assert.ok(isRefusal(answer), `${name}: ${JSON.stringify(answer)}`);
        assert.deepEqual(writes, [], `${name}: wrote`);
      }
    });
  }

  test("a head sees the same seat row on Edit team tree as the team leader, with no Add seat", async () => {
    await seedFixture();
    const rows = async (name: string) => {
      const structure = await (await openAs(name)).teamStructure();
      return { board: structure?.board.map((s) => [s.roleId, s.holders.map((h) => h.id), s.title]), editable: structure?.departmentsEditable };
    };
    const leader = await rows("team leader");
    const head = await rows("department head");
    assert.deepEqual(head.board, leader.board);
    assert.ok((leader.board?.length ?? 0) >= 2);
    assert.deepEqual([leader.editable, head.editable], [true, false]);
  });
});

// The Activity log (board 101, issue #642) ----------------------------------------

describe("the Activity log reads the stored changes for the viewers its access row admits, and no one else", () => {
  const itLead = accountOf("IT lead");
  const teamLeader = accountOf("team leader");

  async function openAs(userId: string): Promise<DashboardData> {
    signInAs(userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open", "the dashboard opens");
    return (opening as { data: DashboardData }).data;
  }

  test("a write made while viewing as someone reads under both people, beside a View as start and its timeout", async () => {
    await seedFixture();
    resetFiles();
    viewAs(teamLeader.userId, itLead.userId);
    const answer = await actions.decideOrder(IDS.order(DM), { kind: "approve" });
    assert.ok(!isRefusal(answer), JSON.stringify(answer));
    // A start with no stop whose session row is gone, three hours ago: it has timed out since.
    await recordViewAs({ event: "start", sessionId: "gone-session", personId: teamLeader.userId, actingAccountId: itLead.userId });
    await changeRows(logs, { operation: "VIEW_AS_START" }, { changedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() });

    const log = await (await openAs(itLead.userId)).activityLog();
    assert.ok(log !== null, "the IT lead reads it");
    const approved = log.entries.find((e) => e.change.kind === "write" && e.change.area === "orders");
    assert.equal(approved?.who.kind === "as" && approved.who.actingId, itLead.userId, JSON.stringify(approved));
    assert.ok(approved?.change.kind === "write" && approved.change.sentence.startsWith("Approved order"), JSON.stringify(approved));
    const events = log.entries.flatMap((e) => (e.change.kind === "view-as" ? [e.change.event] : []));
    assert.deepEqual(events.sort(), ["start", "timeout"]);

    assert.equal(await (await openAs(teamLeader.userId)).activityLog(), null, "the team leader does not");
  });
});
