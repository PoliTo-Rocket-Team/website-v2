import "./access-matrix/install-real-session";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, test } from "node:test";
import type { Transaction } from "@electric-sql/pglite";
import { DRIZZLE_MAPPED_TYPES } from "@/db/seed/connection";
import { SEED_MODULES } from "@/db/seed/registry";
import { scopes } from "@/db/schema";
import { BASE, Jar, TEST_ENV } from "@/lib/dev-tester-fixture";
import { ADMIN_TESTERS, seatOf, type Seat } from "@/lib/seeded-accounts";
import { canReach, DASHBOARD_PAGES, sidebarFor, userMenuPageFor } from "./access";
import { sendRequestWith } from "./access-matrix/fakes/request-headers";
import { restore, tableRows, testDb } from "./access-matrix/test-database";
import type { DashboardData } from "./data";
import { overviewOfSections } from "./overview";

// View as shows a person exactly the dashboard their own session shows
// (issue #653, Owner decision on the issue, 2026-10-24). The database is the
// migrated in-memory Postgres of ./access-matrix/test-database.ts (issue
// #649), loaded with the whole seed (db/seed/registry.ts), so every seat is a
// normal seeded person. For each kind of seat, two sessions are built the
// real way: one through the tester sign-in route, and one by an account that
// signs in the same way and then makes the real View as call
// (`/admin/impersonate-user`, lib/view-as-plugin.ts). Only the request is
// swapped (./access-matrix/install-real-session.ts): it carries the cookies
// Better Auth set, and the app's own lib/current-user.ts reads them. Each
// session's whole dashboard model is then read through the data interface the
// pages read (lib/dashboard/open.ts): the viewer, the sidebar, the pages it
// reaches, every page's rows and the actions each page offers. The two must be
// equal; only the View as banner and the write attribution may differ.

/** The kinds of seat the issue names, each the seat a check signs in as, with what is done to it first. */
type SeatCase = {
  readonly kind: string;
  readonly seat: Seat;
  /** How the direct session names the person to the tester sign-in. */
  readonly signIn: string;
  /** Run before both sessions open, as the team leader's own session: the way a check gives a grant. */
  readonly grant?: { readonly area: "members" | "positions" | "applications" | "content" | "orders" };
};

const member = seatOf("member");

const SEAT_CASES: readonly SeatCase[] = [
  { kind: "member", seat: member, signIn: `tester=${member.key}` },
  // A member with one grant: given through the Access page, as a check gives one (docs/seed-cases.md, "Test seats").
  { kind: "member with one grant (Members, given on the Access page)", seat: member, signIn: `member=${member.memberId}`, grant: { area: "members" } },
  { kind: "member with one grant (Approve orders)", seat: seatOf("approve-orders"), signIn: "tester=approve-orders" },
  { kind: "lead", seat: seatOf("division-lead"), signIn: "tester=stefano.motta" },
  { kind: "head", seat: seatOf("department-head"), signIn: "tester=department-head" },
  { kind: "full-access seat (operations lead)", seat: seatOf("operations-lead"), signIn: "tester=operations-lead" },
  { kind: "full-access seat (IT lead)", seat: seatOf("it-lead"), signIn: "tester=it-lead" },
  { kind: "team leader", seat: seatOf("team-leader"), signIn: "tester=team-leader" },
  { kind: "alumni", seat: seatOf("alumni"), signIn: "tester=alumni" },
  { kind: "applicant", seat: seatOf("non-member"), signIn: "tester=non-member" },
];

/** The accounts that view as each seat: an admin tester, with no team role, and the IT lead, who holds full access. */
const ACTING = [ADMIN_TESTERS[0], seatOf("it-lead")] as const;

// The app, loaded once the environment is set: lib/auth.ts reads it when it loads.
let app: {
  readonly getAuth: typeof import("@/lib/auth").getAuth;
  readonly openDashboard: typeof import("./open").openDashboard;
  readonly getCurrentUser: typeof import("@/lib/current-user").getCurrentUser;
  readonly readViewAsBanner: typeof import("./database-view-as-banner").readViewAsBanner;
  readonly actions: typeof import("@/app/dashboard/actions");
  readonly membersModelOf: typeof import("./members-view").membersModelOf;
  readonly positionsModelOf: typeof import("./positions-view").positionsModelOf;
  readonly applicationsModelOf: typeof import("./applications-view").applicationsModelOf;
  readonly DashboardRefused: typeof import("./data").DashboardRefused;
};

before(async () => {
  // A test site: `next dev` off Vercel, where tester sign-in is on and any account may use View as (issue #648).
  Object.assign(process.env, TEST_ENV, { NODE_ENV: "development" });
  delete process.env.VERCEL_ENV;
  const [auth, open, currentUser, banner, actions, members, positions, applications, data] = await Promise.all([
    import("@/lib/auth"),
    import("./open"),
    import("@/lib/current-user"),
    import("./database-view-as-banner"),
    import("@/app/dashboard/actions"),
    import("./members-view"),
    import("./positions-view"),
    import("./applications-view"),
    import("./data"),
  ]);
  app = {
    getAuth: auth.getAuth,
    openDashboard: open.openDashboard,
    getCurrentUser: currentUser.getCurrentUser,
    readViewAsBanner: banner.readViewAsBanner,
    actions,
    membersModelOf: members.membersModelOf,
    positionsModelOf: positions.positionsModelOf,
    applicationsModelOf: applications.applicationsModelOf,
    DashboardRefused: data.DashboardRefused,
  };
});

// The seed, as `pnpm db:seed` runs it, on the test database ----------------

// The seed sends values drizzle already mapped, as db/seed/connection.ts does for postgres-js.
const AS_SENT = Object.fromEntries(DRIZZLE_MAPPED_TYPES.map((type) => [type, (value: unknown) => String(value)]));
type SeedTxOn = { unsafe(sql: string, params?: unknown[]): Promise<unknown> };

/** Every seed module's reset, last first, then every module's rows, in one transaction (lib/seed/runner.ts). */
async function seedEverything(): Promise<void> {
  await testDb.$client.transaction(async (tx: Transaction) => {
    const seedTx: SeedTxOn = { unsafe: (sql, params = []) => tx.query(sql, params, { serializers: AS_SENT }) };
    const modules = SEED_MODULES as unknown as readonly { reset(tx: SeedTxOn): Promise<void>; insert(tx: SeedTxOn): Promise<void> }[];
    for (const module of [...modules].reverse()) await module.reset(seedTx);
    for (const module of modules) await module.insert(seedTx);
  });
}

const seeded = () => restore("seeded", seedEverything);

// Sessions, the real way --------------------------------------------------

async function call(path: string, init: { readonly jar?: Jar; readonly body?: unknown } = {}): Promise<Response> {
  const headers = init.jar?.headers() ?? new Headers();
  if (init.body !== undefined) headers.set("content-type", "application/json");
  const request = new Request(BASE + path, init.body === undefined ? { headers } : { method: "POST", headers, body: JSON.stringify(init.body) });
  return app.getAuth().handler(request);
}

/** A browser signed in through the tester sign-in route, named as `query` names them. */
async function testerSession(query: string): Promise<Jar> {
  const jar = new Jar();
  const response = await call(`/dev-tester/sign-in?${query}`);
  assert.equal(response.status, 302, `the tester sign-in for ${query}: ${await response.clone().text()}`);
  jar.take(response);
  return jar;
}

/** The acting account's browser after the real View as call: its session is now the person's. */
async function viewAsSession(acting: { readonly key: string }, personId: string): Promise<Jar> {
  const jar = await testerSession(`tester=${acting.key}`);
  const response = await call("/admin/impersonate-user", { jar, body: { userId: personId } });
  assert.equal(response.status, 200, `${acting.key} views as ${personId}: ${await response.clone().text()}`);
  jar.take(response);
  return jar;
}

// The whole dashboard model of a session ----------------------------------

/**
 * A read's answer as plain data: what the page is handed, with any stream or
 * file named by its kind. The clock reading a page is handed (`now`) is the
 * moment of the read, so it is named, not compared: the two sessions read a
 * few milliseconds apart.
 */
function plain(answer: unknown): unknown {
  return JSON.parse(
    JSON.stringify(answer ?? null, (key, value: unknown) => {
      if (key === "now") return "[the moment of the read]";
      if (typeof value === "function") return "[function]";
      if (value instanceof ReadableStream || value instanceof Blob || value instanceof Uint8Array) return `[${value.constructor.name}]`;
      return value;
    }),
  );
}

/** A read's answer, or "refused" when it threw DashboardRefused. */
async function answerOf(read: () => Promise<unknown>): Promise<unknown> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof app.DashboardRefused) return "refused";
    throw error;
  }
}

/** Every open division, every member and two applications of the seed: the arguments the pages pass. */
async function seedUnits() {
  const { divisions, members, applications } = await import("@/db/schema");
  const [divs, mems, apps] = await Promise.all([tableRows(divisions), tableRows(members), tableRows(applications)]);
  return {
    divisionIds: divs.filter((d) => d.closedAt == null).map((d) => d.id as number),
    memberIds: mems.map((m) => m.memberId as number),
    applicationIds: apps.slice(0, 2).map((a) => a.id as number),
  };
}

/** Every read the data interface hands the pages, with the arguments the pages pass it. */
function readsOf(units: Awaited<ReturnType<typeof seedUnits>>): readonly (readonly [string, (data: DashboardData) => Promise<unknown>])[] {
  return [
    ["navCounts", (d) => d.navCounts()],
    ["hasShownApplications", (d) => d.hasShownApplications()],
    ["overview", (d) => d.overview()],
    // The Overview page reads its sections apart (#397); joined, they are one answer to compare.
    ["overviewSections", (d) => overviewOfSections(d.overviewSections())],
    ["myAlumni", (d) => d.myAlumni()],
    ["members(null)", (d) => d.members(null)],
    ...units.divisionIds.map((id): readonly [string, (data: DashboardData) => Promise<unknown>] => [`members(${id})`, (d) => d.members(id)]),
    ...units.divisionIds.map((id): readonly [string, (data: DashboardData) => Promise<unknown>] => [`findForAdd(${id})`, (d) => d.findForAdd(id, "a")]),
    ["findPeople", (d) => d.findPeople("a")],
    ["alumni", (d) => d.alumni()],
    ["teamTree", (d) => d.teamTree()],
    ["teamStructure", (d) => d.teamStructure()],
    ["recruitment", (d) => d.recruitment()],
    ["positions", (d) => d.positions()],
    ["applications", (d) => d.applications()],
    ...units.applicationIds.flatMap((id) =>
      (["cv", "motivation-letter"] as const).map((doc): readonly [string, (data: DashboardData) => Promise<unknown>] => [`applicationDocument(${id}, ${doc})`, (d) => d.applicationDocument(id, doc)]),
    ),
    ["divisionAccess", (d) => d.divisionAccess()],
    ["orders", (d) => d.orders()],
    ["partners.list", (d) => d.partners.list()],
    ["faqs.list", (d) => d.faqs.list()],
    ["teamPage.open", (d) => d.teamPage.open()],
    ["teamAdvisors.list", (d) => d.teamAdvisors.list()],
    ["outreach.posts.list", (d) => d.outreach.posts.list()],
    ["outreach.tags", (d) => d.outreach.tags()],
    ["outreach.featured", (d) => d.outreach.featured()],
    ["projects.list", (d) => d.projects.list()],
    ["projects.board", (d) => d.projects.board()],
    ["myProfile", (d) => d.myProfile()],
    ["myAccount", (d) => d.myAccount()],
    ["myApplications", (d) => d.myApplications()],
    ["memberAliases", (d) => d.memberAliases(units.memberIds)],
    ["myAlias", (d) => d.myAlias()],
  ];
}

/** What a session's dashboard shows: the model compared across the two sessions, and the banner beside it. */
type Seen = { readonly model: unknown; readonly banner: unknown };

async function seenBy(jar: Jar, units: Awaited<ReturnType<typeof seedUnits>>): Promise<Seen> {
  sendRequestWith(jar.headers());
  const opening = await app.openDashboard();
  assert.equal(opening.kind, "open", "the dashboard opens");
  const data = (opening as { data: DashboardData }).data;
  const { viewer } = data;
  const reads: Record<string, unknown> = {};
  for (const [name, read] of readsOf(units)) reads[name] = plain(await answerOf(() => read(data)));
  const counts = (await data.navCounts()) ?? {};
  const shown = await data.hasShownApplications();
  const members = await answerOf(() => data.members(null));
  const positions = await answerOf(() => data.positions());
  const applications = await answerOf(() => data.applications());
  const model = {
    viewer: plain(viewer),
    sidebar: plain(sidebarFor(viewer, { counts, hasShownApplications: shown })),
    userMenu: plain(userMenuPageFor(viewer.kind)),
    pages: DASHBOARD_PAGES.filter((page) => canReach(viewer, page.key)).map((page) => page.key),
    reads,
    // What each list page offers, built from its rows as the page builds it.
    offers: plain({
      members: members === "refused" || members === null ? members : app.membersModelOf(members as Parameters<typeof app.membersModelOf>[0]),
      positions: positions === "refused" || positions === null ? positions : app.positionsModelOf(positions as Parameters<typeof app.positionsModelOf>[0]),
      applications: applications === "refused" || applications === null ? applications : app.applicationsModelOf(applications as Parameters<typeof app.applicationsModelOf>[0]),
    }),
  };
  const banner = plain(await app.readViewAsBanner(await app.getCurrentUser(), { name: viewer.name, role: viewer.role }));
  return { model, banner };
}

/** The keys down to the first place two models differ, to name in a failure; null when they are equal. */
function firstDifference(a: unknown, b: unknown, path: readonly string[] = []): readonly string[] | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return path;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const found = firstDifference((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], [...path, key]);
    if (found !== null) return found;
  }
  return path;
}

/** The value at the keys `firstDifference` names. */
function valueAt(model: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((value, key) => (value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), model);
}

// Grants, given the way a check gives one ------------------------------------

/** Gives the person one grant across the whole team on the Access page, as the team leader's own session. */
async function giveGrant(person: Seat, area: NonNullable<SeatCase["grant"]>["area"]): Promise<void> {
  sendRequestWith((await testerSession("tester=team-leader")).headers());
  const saved = await app.actions.saveAccess({ personId: person.memberId, where: "team", areas: { [area]: "edit" } });
  assert.ok(saved.ok, `the team leader gives ${person.key} ${area}: ${JSON.stringify(saved)}`);
}

/** Removes that grant on the Access page, as the team leader's own session. */
async function removeGrant(person: Seat, area: NonNullable<SeatCase["grant"]>["area"]): Promise<void> {
  sendRequestWith((await testerSession("tester=team-leader")).headers());
  const removed = await app.actions.removeGrant({ personId: person.memberId, where: "team", target: area });
  assert.ok(removed.ok, `the team leader removes ${person.key}'s ${area}: ${JSON.stringify(removed)}`);
}

// The tests -----------------------------------------------------------------

test("the model reads every read the access matrix suite calls, so no page is left out of the comparison", () => {
  // ./access-matrix-server.test.ts proves its READS list holds every read on the data interface.
  const source = readFileSync(new URL("./access-matrix-server.test.ts", import.meta.url), "utf8");
  const start = source.indexOf("const READS");
  const matrixReads = [...source.slice(start, source.indexOf("];", start)).matchAll(/path: "([^"]+)"/g)].map(([, path]) => path);
  assert.ok(matrixReads.length > 20, "the matrix suite's reads are found");
  const ours = new Set(readsOf({ divisionIds: [1], memberIds: [1], applicationIds: [1] }).map(([name]) => name.replace(/\(.*$/, "")));
  assert.deepEqual(matrixReads.filter((path) => !ours.has(path)), []);
});

describe("View as shows each kind of seat the dashboard their own session shows (issue #653)", () => {
  for (const c of SEAT_CASES) {
    for (const acting of ACTING.filter((a) => a.id !== c.seat.id)) {
      test(`${c.kind}, viewed as by ${acting.key}`, async () => {
        await seeded();
        const units = await seedUnits();
        if (c.grant !== undefined) await giveGrant(c.seat, c.grant.area);

        const direct = await seenBy(await testerSession(c.signIn), units);
        const viewing = await seenBy(await viewAsSession(acting, c.seat.id), units);

        assert.equal((direct.model as { viewer: { name: string } }).viewer.name, c.seat.name, `${c.kind}: the direct session is the seat's own`);
        // Named at the first path that differs, with both values there: a diff of the whole model is too large to read.
        const differs = firstDifference(viewing.model, direct.model);
        if (differs !== null) {
          const at = (model: unknown) => JSON.stringify(valueAt(model, differs))?.slice(0, 400);
          assert.fail(`${c.kind}: View as differs from a direct session at ${["model", ...differs].join(" › ")}\n  View as: ${at(viewing.model)}\n  direct:  ${at(direct.model)}`);
        }
        assert.deepEqual(viewing.model, direct.model);
        // The banner is the one thing the page shows that may differ: none on a direct session, the person's name on View as.
        assert.equal(direct.banner, null, `${c.kind}: a direct session shows no View as banner`);
        assert.equal((viewing.banner as { name?: string } | null)?.name, c.seat.name, `${c.kind}: the View as banner names the person`);

        if (c.grant !== undefined) {
          await removeGrant(c.seat, c.grant.area);
          assert.deepEqual(
            (await tableRows(scopes)).filter((s) => s.memberId === c.seat.memberId),
            [],
            `${c.kind}: the grant is gone again, so the seat is clean`,
          );
        }
      });
    }
  }
});

describe("a write made while viewing as someone differs from their own only in its attribution (issue #653)", () => {
  test("the team leader's grant, given in their own session and by an admin tester viewing as them", async () => {
    const leader = seatOf("team-leader");
    const admin = ADMIN_TESTERS[0];
    const save = { personId: member.memberId, where: "team", areas: { members: "edit" } } as const;
    const written = async (jar: Jar) => {
      sendRequestWith(jar.headers());
      const saved = await app.actions.saveAccess(save);
      assert.ok(saved.ok, JSON.stringify(saved));
      return (await tableRows(scopes)).filter((s) => s.memberId === member.memberId);
    };

    await seeded();
    const own = await written(await testerSession(`tester=${leader.key}`));
    await seeded();
    const viewingAs = await written(await viewAsSession(admin, leader.id));

    const unattributed = (rows: readonly Record<string, unknown>[]) => rows.map(({ givenByActingAccount: _, ...row }) => row);
    assert.deepEqual(unattributed(viewingAs), unattributed(own), "the same grant, by the same person");
    assert.deepEqual(own.map((r) => r.givenByActingAccount ?? null), [null], "their own session names no acting account");
    assert.deepEqual(viewingAs.map((r) => r.givenByActingAccount), [admin.id], "View as names the account behind it");
  });
});
