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
import { divisions, members, roles, scopes } from "@/db/schema";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { DashboardRefused, type DashboardData } from "./data";
import { areaLevelsOf, canChangePerson, checkRemoveGrant, grantablePeople, heldIn, holdsAny, placeKey, placesOf, removalOf, type AccessPage } from "./division-access";
import { membersExportFileName, XLSX_TYPE } from "./members-export";
import { filterTeam, NO_TEAM_FILTER } from "./team-members";
import { membersModelOf, NO_MEMBERS_FILTER, shownMembers } from "./members-view";
import { readSheet } from "./access-matrix/xlsx";
import { openDashboard } from "./open";
import { canEditOrder, type OrdersPage } from "./orders";
import type { TeamSideOverview } from "./overview";
import type { TeamStructure } from "./team-structure";
import { applicationsModelOf } from "./applications-view";
import { positionsModelOf } from "./positions-view";
import type { ApplicationsPage, PositionsPage } from "./recruitment";
import { insertRows, keepWrites, recordedWrites, rowsIn, updateRows } from "./access-matrix/fake-db";
import type { OwnAlias } from "./alias-setup";
import { isOffTeam } from "./viewer";
import { fileReads, resetFiles } from "./access-matrix/fakes/files";
import { ownPublicStoreHost } from "./access-matrix/fakes/public-store";
import { accountOf, cvHash, EXTRA, IDS, MARKERS, seedFixture } from "./access-matrix/fixture";
import { ALL, ORG, VIEWERS, type Expect, type MatrixRow, type Unit } from "./access-matrix/matrix";
import { signInAs } from "./access-matrix/session";

// The server side of the dashboard access matrix (issue #477): every loader
// the data interface hands the pages, every server action under
// app/dashboard and both CV and letter routes, called for real as every
// matrix viewer and signed out. They run against an in-memory database
// (./access-matrix/fake-db.ts) seeded with the matrix's org and a unit's
// worth of private data in each division (./access-matrix/fixture.ts); only
// the database client, the session, Next's cache and headers and the file
// stores are swapped (./access-matrix/install.ts). Each unit's data carries
// markers, so an answer is checked for what it holds, not for the rule its
// code asks; a write is checked by the rows it would change.

/** Signs in as the matrix viewer and opens their dashboard on a freshly seeded database. */
async function open(name: string): Promise<DashboardData> {
  seedFixture();
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

/** A read the data interface hands a page: its path on the interface, and the arguments it is called with (each unit's, where it takes one). */
type Read = { readonly path: string; readonly args?: readonly (readonly unknown[])[] };

const READS: readonly Read[] = [
  { path: "navCounts" },
  { path: "hasShownApplications" },
  { path: "overview" },
  { path: "myAlumni" },
  { path: "members", args: [[null], ...ALL.map((u) => [IDS.division(u)])] },
  { path: "findForAdd", args: ALL.map((u) => [IDS.division(u), "person"]) },
  { path: "findPeople", args: [["person"]] },
  { path: "alumni" },
  { path: "teamTree" },
  { path: "teamStructure" },
  { path: "recruitment" },
  { path: "positions" },
  { path: "applications" },
  { path: "applicationDocument", args: ALL.flatMap((u) => [[IDS.application(u), "cv"], [IDS.application(u), "motivation-letter"]]) },
  { path: "divisionAccess" },
  { path: "orders" },
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
  { path: "myAlias" },
];

/** Calls the method at `path` on the data interface. */
function callPath(data: DashboardData, path: string, args: readonly unknown[]): Promise<unknown> {
  const parts = path.split(".");
  const owner = parts.slice(0, -1).reduce<Record<string, unknown>>((o, p) => o[p] as Record<string, unknown>, data as unknown as Record<string, unknown>);
  return (owner[parts[parts.length - 1]] as (...a: readonly unknown[]) => Promise<unknown>)(...args);
}

/** Every read, once per argument list, by a name that says which. */
const readCalls = (): [string, (data: DashboardData) => Promise<unknown>][] =>
  READS.flatMap(({ path, args = [[]] }) => args.map((a): [string, (data: DashboardData) => Promise<unknown>] => [`${path}(${a.join(", ")})`, (d) => callPath(d, path, a)]));

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
      const board = overview as TeamSideOverview;
      if (board.shape === "personal") {
        // A member's own page: an Applications grant adds one counts-only line and no attention row (issue #480).
        const line = board.access.find((s) => s.area === "applications");
        if (reads.length === 0) assert.equal(line, undefined, `${name}: an Applications line`);
        else assert.equal(line?.area === "applications" && line.fresh, reads.length, `${name}: new applications on the Applications line`);
        assert.equal(board.attention.some((a) => a.kind === "applications"), false, `${name}: a new-application row`);
        return;
      }
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
  ["setApproveOrders", { args: [{ personId: IDS.person("DM"), holds: true }], may: (r) => r.name === "team leader", proves: "write" }],
  ["teamAdvisors.save", { args: ["save-draft", []], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["outreach.posts.save", { args: [null, "save-draft", neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["outreach.posts.saveUnfinished", { args: [null, neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["outreach.posts.reorder", { args: [() => true, []], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.save", { args: [null, "save-draft", neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.saveUnfinished", { args: [null, neverAsked], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.remove", { args: [1], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.unpublish", { args: [1], may: (r) => r.expect.siteContent, proves: "gate" }],
  ["projects.reorder", { args: [() => true, []], may: (r) => r.expect.siteContent, proves: "gate" }],
  // The dashboard no longer sets the project order (issue #506); the stored write stays behind the gate.
  ["projects.setSiteOrder", { args: [[]], may: (r) => r.expect.siteContent, proves: "gate" }],
]);

describe("the data interface opens only for a resolved account, and every method on it is called here", () => {
  test("signed out, or holding a session that resolves to no account, nothing opens", async () => {
    seedFixture();
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
      assert.deepEqual(recordedWrites(), [], `${name}: a read wrote`);
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
  seedFixture();
  resetFiles();
  signInAs(userId);
  const answer = await answerOf(run);
  return { answer, writes: recordedWrites() };
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
const giveAlias = (memberId: number) => updateRows(members, { memberId }, { prtEmail: aliasOf(memberId) });
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
const HOST = ownPublicStoreHost();

const ACTION_CASES: readonly ActionCase[] = [
  // Positions and Applications.
  { action: "recruitment-actions.setPositionOpen", run: () => recruitmentActions.setPositionOpen(IDS.position(DM), false), may: changesDM("positions"), control: by("team leader") },
  { action: "recruitment-actions.editPosition", run: () => recruitmentActions.editPosition(IDS.position(DM), POSITION), may: changesDM("positions"), control: by("team leader") },
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
  { action: "project-actions.uploadProjectPhoto", run: () => projectActions.uploadProjectPhoto(form({ photo: PHOTO() })), may: siteContent, control: by("team leader") },
  { action: "project-actions.discardProjectPhoto", run: () => projectActions.discardProjectPhoto(`https://${HOST}/project-photos/x.jpg`), may: siteContent, control: by("team leader") },
  { action: "project-actions.uploadProjectBackground", run: () => projectActions.uploadProjectBackground(form({ background: PHOTO() })), may: siteContent, control: by("team leader") },

  // The viewer's own pages: only their own rows.
  { action: "actions.saveLinkedin", run: () => actions.saveLinkedin("https://www.linkedin.com/in/someone"), may: reaches("my-profile"), control: by("member") },
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
  // Email aliases (epic #538), for someone in DM: a lead, a head or the team leader who may manage them asks or cancels;
  // only the team leader, the operations lead and the IT lead answer.
  { action: "actions.requestAlias", run: () => actions.requestAlias(IDS.person(DM)), may: (r) => r.expect.aliases.requests.includes(DM), control: by("team leader") },
  {
    action: "actions.cancelAliasRequest",
    run: () => actions.cancelAliasRequest(IDS.aliasRequest(DM)),
    may: (r) => r.expect.aliases.requests.includes(DM),
    control: by("team leader"),
  },
  { action: "actions.answerAlias", run: () => actions.answerAlias(IDS.aliasRequest(DM), { kind: "decline" }), may: (r) => r.expect.aliases.answers, control: by("IT lead") },
  // "I've set it up" (issue #542): DM's lead has an alias and stores it; no matrix viewer has one of their own,
  // so each is refused, and nobody's press reaches the lead's record.
  { action: "actions.confirmAliasSetUp", run: () => (giveAlias(IDS.lead(DM)), actions.confirmAliasSetUp()), may: nobody, control: by("lead-dm") },
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
      const rows = overview === "refused" ? [] : (overview as TeamSideOverview).attention.filter((a) => a.kind === "alias-request");
      assert.equal(rows.length, expect.aliases.answers ? ALL.length : 0, `${name}: one Overview row per open request`);
      const aliases = (await data.memberAliases(ALL.map((u) => IDS.person(u)))) as Record<number, { kind: string; requestable?: boolean }>;
      const requestable = ALL.filter((u) => aliases[IDS.person(u)]?.requestable === true);
      assert.deepEqual(requestable, expect.pages.includes("members") ? expect.aliases.requests : [], `${name}: Request alias`);
      assert.deepEqual(recordedWrites(), [], `${name}: a read wrote`);
    });
  }

  test("a second request for a member with one open is refused by the server, and writes nothing", async () => {
    const { answer, writes } = await attempt(accountOf("team leader").userId, () => actions.requestAlias(IDS.lead(DM)));
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
    assert.ok(board.shape === "personal", `${name}: ${board.shape}`);
    assert.deepEqual(board.access, [{ area: "approve-orders", href: "/dashboard/orders", waiting: ALL.length }]);
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
      seedFixture();
      resetFiles();
      keepWrites();
      if (memberId !== null) giveAlias(memberId);
      giveAlias(IDS.lead(DM));
      signInAs(userId);
      const opening = await openDashboard();
      assert.equal(opening.kind, "open");
      const data = (opening as { data: DashboardData }).data;
      const own = await data.myAlias();
      assert.deepEqual(own, onTeam ? ({ address: aliasOf(memberId!), setUp: false } satisfies OwnAlias) : null, `${name}: the card`);
      assert.ok(!JSON.stringify(own).includes(aliasOf(IDS.lead(DM))), `${name}: read someone else's alias`);

      const answer = await answerOf(() => actions.confirmAliasSetUp());
      const setUp = rowsIn(members).filter((r) => r.emailAliasSetUpAt !== null).map((r) => r.memberId);
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
    seedFixture();
    resetFiles();
    // Someone in the led division who holds a grant in DM, at a level the lead holds there.
    insertRows(scopes, [{ id: 9_000, memberId: IDS.person("MA"), scope: "division", target: "positions", accessLevel: "view", divisionId: IDS.division(DM) }]);
    signInAs(accountOf(LEAD).userId);
    await answerOf(() => actions.removeAllAccess(IDS.person("MA")));
    assert.deepEqual(recordedWrites(), [], "a grant outside the led division was touched");
  });
});

// Grants to leads and heads -------------------------------------------------

describe("leads and heads hold grants beyond their role, and their role access stays locked (issue #591)", () => {
  // A plain division lead and a plain department head, with no scope rows, as real leads start in production.
  const LEAD = IDS.lead("MA");
  const HEAD = EXTRA.head;
  const FULL = "operations lead";
  const scopeRowsOf = (memberId: number) => rowsIn(scopes).filter((r) => r.memberId === memberId);

  /** A fresh database that keeps its writes, with `rows` added to it. */
  function seedKeeping(rows: readonly Record<string, unknown>[] = []): void {
    seedFixture();
    resetFiles();
    keepWrites();
    if (rows.length > 0) insertRows(scopes, rows);
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
    seedKeeping();
    signInAs(accountOf(FULL).userId);
    const toLead = await actions.saveAccess({ personId: LEAD, where: "team", areas: { content: "edit", orders: "edit" } });
    assert.ok(!isRefusal(toLead), `to the lead: ${JSON.stringify(toLead)}`);
    const toHead = await actions.saveAccess({ personId: HEAD, where: "team", areas: { content: "edit" } });
    assert.ok(!isRefusal(toHead), `to the head: ${JSON.stringify(toHead)}`);

    assert.deepEqual(scopeRowsOf(LEAD).map((r) => `${r.scope} ${r.target} ${r.accessLevel}`).sort(), ["team orders edit", "website content edit"]);
    assert.deepEqual(scopeRowsOf(HEAD).map((r) => `${r.scope} ${r.target} ${r.accessLevel}`), ["website content edit"]);
    const page = await pageAs(FULL);
    const listed = (id: number) => page.grants.filter((g) => g.person.id === id).map((g) => `${placeKey(g.place)} ${g.target} ${g.level}`).sort();
    assert.deepEqual(listed(LEAD), ["team content edit", "team orders edit"]);
    assert.deepEqual(listed(HEAD), ["team content edit"]);
    // Beside the role row, which stays as it was.
    assert.deepEqual(page.roleAccess.filter((r) => r.person.id === LEAD).map((r) => placeKey(r.place)), [IDS.division("MA")]);
    assert.deepEqual(page.roleAccess.filter((r) => r.person.id === HEAD).map((r) => placeKey(r.place)), [`department-${IDS.department(DM)}`]);
  });

  test("the single-grant Remove and Remove all access take a lead's and a head's grants away, and leave their role alone", async () => {
    seedKeeping([
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
    assert.deepEqual(scopeRowsOf(LEAD).map((r) => r.id), [9_101]);
    const all = await actions.removeAllAccess(HEAD);
    assert.ok(!isRefusal(all), JSON.stringify(all));
    assert.deepEqual(scopeRowsOf(HEAD), []);
    assert.ok(!recordedWrites().some((w) => w.table === "roles"), "a role was touched");
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
      seedKeeping([STRAY]);
      signInAs(accountOf(name).userId);
      const answer = await answerOf(run);
      assert.ok(isRefusal(answer), `${name}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(recordedWrites(), [], `${name}: wrote`);
    }
    // The stray row the role already gives is no grant on the page, and Remove all leaves it.
    seedKeeping([STRAY]);
    const page = await pageAs(FULL);
    assert.equal(page.grants.some((g) => g.person.id === LEAD), false);
    assert.ok(!isRefusal(await actions.removeAllAccess(LEAD)));
    assert.deepEqual(recordedWrites(), []);
  });

  test("full-access seats stay locked: none is offered in Give access, and no Save to one is accepted", async () => {
    seedKeeping();
    const page = await pageAs("team leader");
    const seats = page.people.filter((p) => p.role.kind === "full");
    assert.ok(seats.some((p) => p.id === accountOf(FULL).memberId), "the operations lead is on the page");
    assert.deepEqual(grantablePeople(page).filter((p) => p.role.kind === "full"), []);
    for (const save of [
      { personId: accountOf(FULL).memberId, where: "team", areas: { content: "edit" } },
      { personId: accountOf(FULL).memberId, where: "team", areas: {}, approveOrders: true },
    ]) {
      seedKeeping();
      signInAs(accountOf("team leader").userId);
      const answer = await answerOf(() => actions.saveAccess(save));
      assert.ok(isRefusal(answer), `${JSON.stringify(save)}: ${JSON.stringify(answer)}`);
      assert.deepEqual(recordedWrites(), []);
    }
  });

  test("Give access lists the leads and heads in reach, never the viewer", async () => {
    seedKeeping();
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
    seedKeeping();
    const page = await pageAs("division lead");
    assert.equal(page.unit.kind, "division");
    if (page.unit.kind !== "division") return;
    assert.deepEqual(
      page.unit.divisions.map((d) => [d.division.id, d.held]),
      [[IDS.division("MA"), ["positions", "applications", "members"].map((target) => ({ target, level: "edit" }))]],
    );
    assert.ok(holdsAny(page.unit), "Your access and Give access show");
    assert.ok(grantablePeople(page).some((p) => p.id === IDS.person("MA")), "Give access lists the member of Mission Analysis");
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
    ];
    for (const [name, save] of cases) {
      seedKeeping();
      signInAs(accountOf(name).userId);
      const answer = await answerOf(() => actions.saveAccess(save as Parameters<typeof actions.saveAccess>[0]));
      assert.ok(isRefusal(answer), `${name} ${JSON.stringify(save)}: not refused: ${JSON.stringify(answer)}`);
      assert.deepEqual(recordedWrites(), [], `${name}: wrote`);
    }
    // Within the limits it lands: a head gives a lead of their department Orders, the team leader gives Approve orders.
    seedKeeping();
    signInAs(accountOf("department head").userId);
    assert.ok(!isRefusal(await actions.saveAccess({ personId: IDS.lead("OA"), where: IDS.division("OA"), areas: { orders: "view" } })));
    signInAs(accountOf("team leader").userId);
    assert.ok(!isRefusal(await actions.saveAccess({ personId: LEAD, where: "team", areas: {}, approveOrders: true })));
    assert.deepEqual(scopeRowsOf(LEAD).map((r) => r.target), ["approve_orders"]);
  });
});

// A lead's Orders, by role ----------------------------------------------------

describe("a division lead with no scope row edits their own division's orders by role (issue #590)", () => {
  const LEAD = "division lead";
  const MA: Unit = "MA";
  const orderFor = (u: Unit) => form({ ...ORDER, division: String(IDS.division(u)) });
  /** Signs in as the matrix's plain lead of MA, on a freshly seeded database with these scope rows added. */
  async function openLead(extra: readonly (typeof scopes.$inferInsert)[] = []): Promise<DashboardData> {
    seedFixture();
    resetFiles();
    insertRows(scopes, extra);
    signInAs(accountOf(LEAD).userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    return (opening as { data: DashboardData }).data;
  }
  const viewRow = (): typeof scopes.$inferInsert => ({ id: 9_100, memberId: accountOf(LEAD).memberId!, scope: "team", target: "orders", accessLevel: "view" });

  test("the lead holds no scope row: the matrix seeds none for them", async () => {
    await openLead();
    assert.deepEqual(rowsIn(scopes).filter((r) => r.memberId === accountOf(LEAD).memberId), []);
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
      return { answer, writes: recordedWrites() };
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

// A lead's own division, in the Team tree ------------------------------------

describe("a division lead with no scope row edits their own division in the Team tree (issue #594)", () => {
  const LEAD = "division lead";
  const MA: Unit = "MA";
  const OA: Unit = "OA";
  const self = () => accountOf(LEAD).memberId!;
  type Extra = { readonly scopes?: readonly (typeof scopes.$inferInsert)[]; readonly roles?: readonly (typeof roles.$inferInsert)[] };
  /** Seeds the database with `extra` added, keeps what each write leaves behind, signs in as the matrix's plain lead of MA and runs `run`. */
  async function asLead(run: (data: DashboardData) => Promise<unknown>, extra: Extra = {}) {
    seedFixture();
    resetFiles();
    insertRows(scopes, extra.scopes ?? []);
    insertRows(roles, extra.roles ?? []);
    keepWrites();
    signInAs(accountOf(LEAD).userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const answer = await answerOf(() => run((opening as { data: DashboardData }).data));
    return { answer, writes: recordedWrites() };
  }
  const save = (u: Unit, change: { name?: string; code?: string; newLeads?: number[]; oldLeads?: unknown[] } = {}) => {
    const division = rowsIn(divisions).find((d) => d.id === IDS.division(u))!;
    return { name: String(division.name), code: String(division.code), newLeads: [], oldLeads: [], members: [], emails: [], ...change };
  };
  /** The type of each open role `memberId` holds in the unit's division. */
  const rolesIn = (memberId: number, u: Unit) =>
    rowsIn(roles)
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
    assert.deepEqual(rowsIn(scopes).filter((r) => r.memberId === self()), []);
  });

  test("Edit division saves a new name and a new code on the led division", async () => {
    await writes("rename and recode MA", () => teamActions.saveDivision(IDS.division(MA), save(MA, { name: "Flight Analysis", code: "FLA" })));
    const division = rowsIn(divisions).find((d) => d.id === IDS.division(MA))!;
    assert.deepEqual([division.name, division.code], ["Flight Analysis Division", "FLA"]);
  });

  test("Edit division adds a lead, replaces a lead and removes a lead on the led division", async () => {
    await writes("add MA's member as a lead", () => teamActions.saveDivision(IDS.division(MA), save(MA, { newLeads: [IDS.person(MA)] })));
    assert.deepEqual(rolesIn(IDS.person(MA), MA), ["lead"]);

    await writes("add someone from DM as a lead", () => teamActions.saveDivision(IDS.division(MA), save(MA, { newLeads: [EXTRA.mover] })));
    assert.deepEqual(rolesIn(EXTRA.mover, MA), ["lead"]);

    const replaced = { personId: IDS.lead(MA), via: "replaced", outcome: "advisor" };
    await writes("replace MA's other lead", () => teamActions.saveDivision(IDS.division(MA), save(MA, { newLeads: [EXTRA.mover], oldLeads: [replaced] })));
    assert.deepEqual([rolesIn(EXTRA.mover, MA), rolesIn(IDS.lead(MA), MA)], [["lead"], ["advisor"]], "the replaced lead becomes an advisor in MA");

    const removed = { personId: IDS.lead(MA), via: "removed", outcome: "member" };
    await writes("remove MA's other lead", () => teamActions.saveDivision(IDS.division(MA), save(MA, { oldLeads: [removed] })));
    assert.deepEqual(rolesIn(IDS.lead(MA), MA), ["core"], "the removed lead stays as a member");
  });

  test("every rule of Edit division still holds for the lead's save", async () => {
    const out = (personId: number, outcome: string) => ({ personId, via: "removed", outcome });
    // Every lead of MA as seeded: the matrix's leads of it, MA's own lead among them.
    seedFixture();
    const every = rowsIn(roles)
      .filter((r) => r.type === "lead" && r.divisionId === IDS.division(MA) && r.leavedAt === null)
      .map((r) => out(Number(r.memberId), "member"));
    assert.ok(every.length >= 2);
    assert.equal(await refuses("remove every lead", () => teamActions.saveDivision(IDS.division(MA), save(MA, { oldLeads: every }))), "A division needs at least one lead.");
    const leaves = await refuses("take MA's other lead out of their only division", () =>
      teamActions.saveDivision(IDS.division(MA), save(MA, { oldLeads: [out(IDS.lead(MA), "leave-division")] })),
    );
    assert.match(leaves, /only division/);
    const alsoInDM = { roles: [extraRole(9_300, IDS.lead(MA), "DM", "core")] };
    await refuses("move MA's other lead, who is also in DM, to alumni", () => teamActions.saveDivision(IDS.division(MA), save(MA, { oldLeads: [out(IDS.lead(MA), "leave-team")] })), alsoInDM);
    await writes("move MA's other lead, in MA alone, to alumni", () => teamActions.saveDivision(IDS.division(MA), save(MA, { oldLeads: [out(IDS.lead(MA), "leave-team")] })));
    assert.equal(await refuses("take OA's code", () => teamActions.saveDivision(IDS.division(MA), save(MA, { code: "OPT" }))), "Optimization already uses OPT.");
    await refuses("replace a lead with no new lead", () =>
      teamActions.saveDivision(IDS.division(MA), save(MA, { oldLeads: [{ personId: IDS.lead(MA), via: "replaced", outcome: "advisor" }] })),
    );
  });

  test("the drawer's member actions add someone from the team, invite an email and remove a member in the led division", async () => {
    await writes("add OA's member to MA", () => teamActions.addMember({ kind: "member", divisionId: IDS.division(MA), personId: IDS.person(OA), title: "Member" }));
    assert.deepEqual(rolesIn(IDS.person(OA), MA), ["core"]);
    await writes("invite an email to MA", () =>
      teamActions.addMember({ kind: "email", divisionId: IDS.division(MA), email: "new@mail.test", firstName: "New", lastName: "Person", title: "Member", details: MEMBER_DETAILS }),
    );
    const moverInMA = { roles: [extraRole(9_301, EXTRA.mover, MA, "core")] };
    await writes("remove a member of MA", () => teamActions.removeFromDivision(EXTRA.mover, IDS.division(MA)), moverInMA);
    assert.deepEqual(rolesIn(EXTRA.mover, MA), []);
  });

  test("on a division they do not lead, every one of those is refused and writes nothing", async () => {
    for (const u of [OA, DM]) {
      await refuses(`rename ${u}`, () => teamActions.saveDivision(IDS.division(u), save(u, { name: "Renamed", code: "REN" })));
      await refuses(`add a lead to ${u}`, () => teamActions.saveDivision(IDS.division(u), save(u, { newLeads: [IDS.person(u)] })));
      await refuses(`remove ${u}'s lead`, () => teamActions.saveDivision(IDS.division(u), save(u, { newLeads: [IDS.person(u)], oldLeads: [{ personId: IDS.lead(u), via: "removed", outcome: "member" }] })));
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
    await refuses("rename DM", () => teamActions.saveDivision(IDS.division(DM), save(DM, { name: "Renamed", code: "REN" })), grant);
    await refuses("add a lead to DM", () => teamActions.saveDivision(IDS.division(DM), save(DM, { newLeads: [EXTRA.mover] })), grant);
    const leadAlsoInOA = { scopes: [membersGrant(DM)], roles: [extraRole(9_303, IDS.lead(DM), OA, "core")] };
    await refuses("take DM's lead out of DM", () => teamActions.removeFromDivision(IDS.lead(DM), IDS.division(DM)), leadAlsoInOA);
  });

  test("a lead of two divisions edits both, and the Team tree gives each a pencil", async () => {
    const leadsOA = { roles: [extraRole(9_304, self(), OA, "lead")] };
    await writes("rename MA", () => teamActions.saveDivision(IDS.division(MA), save(MA, { name: "Flight Analysis", code: "FLA" })), leadsOA);
    await writes("rename OA", () => teamActions.saveDivision(IDS.division(OA), save(OA, { name: "Shape Work", code: "SHW" })), leadsOA);
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

  test("full access saves the details of a seat with no division from the whole team, and never their seat's title", async () => {
    for (const name of ["operations lead", "team leader"]) {
      const { answer, writes } = await attempt(accountOf(name).userId, () => teamActions.saveMemberDetails({ kind: "person", id: EXTRA.head }, null, SAVE));
      assert.deepEqual(answer, { ok: true }, name);
      assert.ok(writes.length > 0, `${name}: wrote nothing`);
      assert.ok(!tables(writes).some((t) => t.endsWith(" roles")), `${name}: touched a role: ${tables(writes)}`);
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

describe("Confirm join is decided by the Applications area, and the whole team lists every division's queue (Owner decision, 2026-10-22, issue #584)", () => {
  /** The unit an accepted applicant joins, by their application. */
  const unitOfJoining = (applicationId: number) => ALL.find((u) => IDS.joining(u) === applicationId);
  /** What the viewer's Members page shows with no select or search: its joining banners and its waiting rows. */
  const shownOf = async (name: string) => {
    const page = membersModelOf(await (await open(name)).members(null));
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
    seedFixture();
    resetFiles();
    signInAs(userId);
    const response = await membersExportGET();
    const body = Buffer.from(await response.arrayBuffer());
    return { response, body, writes: recordedWrites().length };
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
      const directory = await data.members(null);
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
    const directory = await data.members(null);
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
    seedFixture();
    resetFiles();
    keepWrites();
    signInAs(accountOf("operations lead").userId);
    const marked = await answerOf(() => actions.answerAlias(IDS.aliasRequest(DM), { kind: "created", address }));
    assert.ok(!isRefusal(marked), JSON.stringify(marked));
    // Same database, no re-seed: the team leader exports after the alias is saved.
    signInAs(accountOf("team leader").userId);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const directory = await (opening as { data: DashboardData }).data.members(null);
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

// The CV and letter links ---------------------------------------------------

describe("the CV and letter routes open a file only where the viewer reads Applications", () => {
  const documentRoute = (u: Unit, kind: string) => () =>
    documentGET(new Request(`https://site.test/dashboard/applications/${IDS.application(u)}/${kind}`), { params: Promise.resolve({ id: String(IDS.application(u)), document: kind }) });
  const legacyRoute = (u: Unit) => () =>
    legacyGET(new NextRequest(`https://site.test/docs/applications/${cvHash(u)}/cv.pdf`), { params: Promise.resolve({ r2key: cvHash(u), filename: "cv.pdf" }) });

  async function status(userId: string | null, run: () => Promise<Response>): Promise<{ status: number; opened: readonly string[]; writes: number }> {
    seedFixture();
    resetFiles();
    signInAs(userId);
    const response = await run();
    return { status: response.status, opened: fileReads(), writes: recordedWrites().length };
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
