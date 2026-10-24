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
import { members, roles, scopes } from "@/db/schema";
import { SITE_CONTENT_REFUSAL } from "@/lib/content/gate";
import { DashboardRefused, type DashboardData } from "./data";
import { placeKey, placesOf, type AccessPage } from "./division-access";
import { membersExportFileName, XLSX_TYPE } from "./members-export";
import { filterTeam, NO_TEAM_FILTER } from "./team-members";
import { membersModelOf, NO_MEMBERS_FILTER, shownMembers } from "./members-view";
import { readSheet } from "./access-matrix/xlsx";
import { openDashboard } from "./open";
import type { TeamSideOverview } from "./overview";
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
const decidesOrders = (r: MatrixRow) => r.name === "team leader" || r.name === "member with Approve orders";
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

  // The Alumni page.
  { action: "team-actions.setAlumnusShown", run: () => teamActions.setAlumnusShown(ALUMNUS, false), may: reaches("alumni"), control: by("team leader") },
  { action: "team-actions.fixAlumnus", run: () => teamActions.fixAlumnus(ALUMNUS, { shown: true, name: "Alum", founder: null, roles: [] }), may: reaches("alumni"), control: by("team leader") },
  { action: "team-actions.setAlumnusPhoto", run: () => teamActions.setAlumnusPhoto(ALUMNUS, form({ photo: PHOTO() })), may: reaches("alumni"), control: by("team leader") },
  {
    action: "team-actions.addAdvisor",
    run: () => teamActions.addAdvisor({ group: "Advisors", name: "Ada Advisor", role: "Advisor", from: 2022, to: 2023 }, null),
    may: reaches("alumni"),
    control: by("team leader"),
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

  test("a head edits their department's people only, and a division lead never changes who leads", async () => {
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
    assert.ok(isRefusal(lead.answer));
    assert.deepEqual(lead.writes, []);
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

// Stored role titles (issue #625) -------------------------------------------
//
// A role title is stored and can be renamed. A rename never moves a seat, a
// headship or any access: seats are read from `roles.full_access` and from
// where a role sits, never from its title.

describe("a renamed role title changes no access, no seat and no headship (issue #625)", () => {
  const RENAMED = "Chief of Propulsion";
  /** Retitles every active role the matrix viewer holds, as a rename would store it. */
  const rename = (name: string, title = RENAMED) => updateRows(roles, { memberId: accountOf(name).memberId }, { title });

  /** Signs in as `name` on a freshly seeded database whose rows `before` laid over, and opens their dashboard. */
  async function openAfter(name: string, before: () => void = () => {}): Promise<DashboardData> {
    seedFixture();
    before();
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
      seedFixture();
      rename(name);
      signInAs(accountOf(name).userId);
      assert.deepEqual(await teamActions.saveMemberDetails({ kind: "person", id: IDS.person(DM) }, IDS.division(DM), SAVE), { ok: true });
      assert.ok(recordedWrites().length > 0);
    });
  }

  test("the Project Manager and the Chief Engineer stay on the seat row of the Team tree, in the same place, after a rename", async () => {
    const seats = async (renamed: boolean) => {
      const data = await openAfter("team leader", () => {
        if (renamed) {
          rename("Project Manager", "Programme Lead");
          rename("Chief Engineer", RENAMED);
        }
      });
      return (await data.teamTree()).board.map((b) => [b.person.id, b.title]);
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
      insertRows(roles, [{ id: 7_000, memberId: IDS.person("MA"), title: "Head of R&D", startedAt: "2020-10-01", type: "core" }]),
    );
    const board = (await data.teamTree()).board.map((b) => [b.person.id, b.title]);
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
    const grants = rowsIn(scopes);
    const after = await openAfter(name, () => rename(name, "Chief of Aerodynamics"));
    assert.deepEqual(rowsIn(scopes), grants, "no grant changes");
    assert.deepEqual(standing(after.viewer), standing(before.viewer), "the same standing and grants");
    const { seen, leaks } = await readEverything(after, expect);
    assert.deepEqual(leaks, []);
    assert.deepEqual(expectedMarkers(expect).filter((m) => !seen.includes(m)), []);
    // Their department's change still lands; another department's is still refused.
    seedFixture();
    rename(name, "Chief of Aerodynamics");
    signInAs(accountOf(name).userId);
    assert.deepEqual(await teamActions.saveMemberDetails({ kind: "person", id: IDS.person("MA") }, IDS.division("MA"), SAVE), { ok: true });
    assert.ok(isRefusal(await answerOf(() => teamActions.saveMemberDetails({ kind: "person", id: IDS.person(DM) }, IDS.division(DM), SAVE))));
    // The team leader's roster and Team tree read them as Aerodynamics' head, under the stored title.
    const leader = await openAfter("team leader", () => rename(name, "Chief of Aerodynamics"));
    const roster = await leader.members(null);
    assert.equal(roster.scope, "whole-team");
    const row = roster.scope === "whole-team" ? roster.people.find((p) => p.id === head) : undefined;
    assert.deepEqual([row?.role, row?.roleLabel, row?.departmentIds], ["head", "Chief of Aerodynamics", [IDS.department("MA")]]);
    const aerodynamics = (await leader.teamTree()).departments.find((d) => d.id === IDS.department("MA"));
    assert.deepEqual([aerodynamics?.head?.id, aerodynamics?.head?.title], [head, "Chief of Aerodynamics"]);
  });

  test("a department rename rewrites a head title still at the old default and keeps a renamed one", async () => {
    const renameStructures = async (headTitle: string) => {
      seedFixture();
      updateRows(roles, { id: 6_000 }, { title: headTitle });
      keepWrites();
      signInAs(accountOf("team leader").userId);
      const answer = await teamActions.saveDepartment(IDS.department(DM), { name: "Frames", code: "FRM", kind: "technical", head: null });
      assert.deepEqual(answer, { ok: true });
      return rowsIn(roles).find((r) => r.id === 6_000)?.title;
    };
    assert.equal(await renameStructures("Head of Structures"), "Head of Frames", "the default follows the new name");
    assert.equal(await renameStructures("Chief of Structures"), "Chief of Structures", "a renamed title is kept");
  });

  test("a new head row gets the default title", async () => {
    seedFixture();
    keepWrites();
    signInAs(accountOf("team leader").userId);
    const created = await teamActions.createDepartment({ name: "Avionics", code: "AVI", kind: "technical", heads: [EXTRA.mover] });
    assert.ok(created.ok, JSON.stringify(created));
    const row = rowsIn(roles).find((r) => r.memberId === EXTRA.mover && r.type === "head");
    assert.equal(row?.title, "Head of Avionics");
  });
});
