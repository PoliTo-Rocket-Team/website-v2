import "./access-matrix/install";

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import * as actions from "@/app/dashboard/actions";
import * as teamActions from "@/app/dashboard/team-actions";
import { betterAuthUsers, logs, orders, scopes, users } from "@/db/schema";
import { BREAK_GLASS_SETTING, BREAK_GLASS_SIGN_IN_OPERATION } from "@/lib/break-glass";
import { ADMIN_TESTER_TITLE, BREAK_GLASS_TITLE } from "./acting-account";
import { readActingTitles } from "./database-acting-account";
import { recordBreakGlassSignIn } from "./database-sign-in";
import { viewAsRefusal } from "./database-view-as";
import { readViewAsBanner } from "./database-view-as-banner";
import { readViewAsOpening, searchViewAsPeople } from "./database-view-as-dialog";
import { HAND_OVER_NEEDS_MEMBER } from "./hand-over-request";
import { ONLY_TEAM_LEADER } from "./hand-over";
import { openDashboard } from "./open";
import { isTeamLeader, standingOf, type ViewerStanding } from "./viewer";
import { accountOf, BREAK_GLASS_EMAIL, IDS, seedFixture } from "./access-matrix/fixture";
import { VIEWERS } from "./access-matrix/matrix";
import { signInAs, viewAs } from "./access-matrix/session";
import { addRows, changeRows, loggedWriters, logRowsSinceSeed, tableRows } from "./access-matrix/test-database";

// The break-glass admin on the database side (issue #646): an account whose
// sign-in email the break-glass setting names stands as the team leader with
// no member row, uses View as on the live site, is never viewed as there,
// writes with no member author, and logs each sign-in. The fixture's
// placeholder account sits on the reserved `.test` domain, and the fixture
// points the setting at it (./access-matrix/fixture.ts). The access matrix
// sweeps every page, read and action for the same account
// (./access-matrix-server.test.ts).

const BREAK_GLASS = accountOf(VIEWERS.find((r) => r.viewer.breakGlass)!.name).userId;
const IT_LEAD = accountOf("IT lead").userId;
const PERSON = "person-ma";
const DM = "DM" as const;

/** Signs in as the account and answers the standing its dashboard opens with. */
async function standingAs(userId: string): Promise<ViewerStanding & { readonly role: string }> {
  signInAs(userId);
  const opening = await openDashboard();
  assert.equal(opening.kind, "open", `${userId}: the dashboard opens`);
  const { viewer } = (opening as { data: { viewer: ViewerStanding & { role: string } } }).data;
  return { ...standingOf(viewer), role: viewer.role };
}

/** Runs `body` with the break-glass setting holding `value` (unset for undefined), then puts the fixture's back. */
async function withSetting(value: string | undefined, body: () => Promise<void>): Promise<void> {
  const saved = process.env[BREAK_GLASS_SETTING];
  if (value === undefined) delete process.env[BREAK_GLASS_SETTING];
  else process.env[BREAK_GLASS_SETTING] = value;
  try {
    await body();
  } finally {
    process.env[BREAK_GLASS_SETTING] = saved;
  }
}

/** Better Auth accounts for the IT lead and the person viewed as, beside the fixture's break-glass one. */
async function seedAccounts(): Promise<void> {
  await seedFixture();
  await addRows(
    betterAuthUsers,
    [IT_LEAD, PERSON].map((id) => ({ id, name: id, email: `${id}@auth.test`, emailVerified: true })),
  );
}

describe("the break-glass setting decides the standing at sign-in (readIdentity)", () => {
  test("the account it names stands as the team leader, with no member row, and its card names no account", async () => {
    await seedFixture();
    const [row] = (await tableRows(users)).filter((u) => u.id === BREAK_GLASS);
    assert.equal(row?.member, null, "no member row");
    const standing = await standingAs(BREAK_GLASS);
    assert.equal(standing.kind, "operations-lead");
    assert.equal(standing.kind === "operations-lead" && standing.seat, "team-leader");
    assert.ok(isTeamLeader(standing));
    assert.equal(standing.role, BREAK_GLASS_TITLE);
  });

  test("unset, empty or blank, it names nobody, and the same account is a non-member", async () => {
    await seedFixture();
    for (const value of [undefined, "", " , "]) {
      await withSetting(value, async () => {
        assert.equal((await standingAs(BREAK_GLASS)).kind, "non-member", JSON.stringify(value));
      });
    }
  });

  test("it is matched trimmed and case-insensitive", async () => {
    await seedFixture();
    await withSetting(` ${BREAK_GLASS_EMAIL.toUpperCase()} , other-admin@team.test`, async () => {
      assert.ok(isTeamLeader(await standingAs(BREAK_GLASS)));
    });
  });

  test("an account whose sign-in email is a sub-string or a near match of the named one gains nothing", async () => {
    for (const email of ["glass-admin@team.test", "break-glass-admin@team.tes", "break-glass-admin@team.test.example", "xbreak-glass-admin@team.test"]) {
      await seedFixture();
      await changeRows(betterAuthUsers, { id: BREAK_GLASS }, { email });
      assert.equal((await standingAs(BREAK_GLASS)).kind, "non-member", email);
    }
  });

  test("the setting is matched against the sign-in email, not the profile's: a member whose profile email is the named one keeps their own standing", async () => {
    await seedFixture();
    const member = accountOf("member").userId;
    await changeRows(users, { id: BREAK_GLASS }, { email: "moved@team.test" });
    await changeRows(users, { id: member }, { email: BREAK_GLASS_EMAIL });
    assert.equal((await standingAs(member)).kind, "member");
  });

  test("a member, a department head and the IT lead keep exactly their standing", async () => {
    await seedFixture();
    assert.deepEqual(await standingAs(accountOf("member").userId), { kind: "member", grantedAreas: [], siteContent: false, approveOrders: false, role: "Member" });
    assert.deepEqual(await standingAs(accountOf("department head").userId), { kind: "department-head", siteContent: false, approveOrders: false, role: "Head" });
    const itLead = await standingAs(IT_LEAD);
    assert.equal(itLead.kind === "operations-lead" && itLead.seat, "it-lead");
    assert.equal(isTeamLeader(itLead), false);
  });
});

describe("View as and the break-glass admin", () => {
  const start = (actingAccountId: string, personId: string) => ({ actingAccountId, viewingAs: false, personId });

  test("on the live site it starts View as, and nobody views as it; on a test site the rules are as before", async () => {
    await seedAccounts();
    assert.equal(await viewAsRefusal(start(BREAK_GLASS, PERSON), "live"), null, "it views as a member");
    assert.equal(await viewAsRefusal(start(IT_LEAD, BREAK_GLASS), "live"), "person-may-view-as", "the IT lead views as it");
    assert.equal(await viewAsRefusal(start(BREAK_GLASS, IT_LEAD), "live"), "person-may-view-as", "it views as the IT lead");
    assert.equal(await viewAsRefusal(start(IT_LEAD, BREAK_GLASS), "test"), null, "a test site");
    await withSetting(undefined, async () => {
      assert.equal(await viewAsRefusal(start(BREAK_GLASS, PERSON), "live"), "not-allowed", "with the setting unset");
    });
  });

  test("the View as dialog opens for it on the live site, and never lists it there", async () => {
    await seedAccounts();
    assert.deepEqual(await readViewAsOpening({ id: BREAK_GLASS, name: "Admin", actingAccountId: null }, "live"), { actingTitle: BREAK_GLASS_TITLE });
    const listed = async (site: "live" | "test") => {
      const search = await searchViewAsPeople({ id: IT_LEAD, name: "IT lead", actingAccountId: null }, "", site);
      assert.equal(search.kind, "people");
      return search.kind === "people" ? search.people.map((p) => p.id) : [];
    };
    assert.equal((await listed("live")).includes(BREAK_GLASS), false, "the live site");
    assert.equal((await listed("test")).includes(BREAK_GLASS), true, "a test site");
  });

  test("its View as writes show as Admin on the live site, naming no account; the IT lead and test-site titles are unchanged", async () => {
    await seedAccounts();
    const titles = await readActingTitles([BREAK_GLASS, IT_LEAD], "live");
    assert.equal(titles.get(BREAK_GLASS), BREAK_GLASS_TITLE);
    assert.notEqual(titles.get(BREAK_GLASS), ADMIN_TESTER_TITLE);
    assert.equal(titles.get(IT_LEAD), "IT lead");
    assert.equal((await readActingTitles([BREAK_GLASS], "test")).get(BREAK_GLASS), ADMIN_TESTER_TITLE);
    const banner = await readViewAsBanner({ id: PERSON, name: PERSON, actingAccountId: BREAK_GLASS }, { name: "Person MA", role: "Member" }, "live");
    assert.equal(banner?.actingTitle, BREAK_GLASS_TITLE);
  });

  test("a write it makes while viewing as someone records both accounts", async () => {
    await seedAccounts();
    viewAs(PERSON, BREAK_GLASS);
    assert.equal((await actions.saveLinkedin("https://www.linkedin.com/in/person-ma")).ok, true);
    assert.deepEqual(await loggedWriters(), [{ userId: PERSON, actingAccountId: BREAK_GLASS }]);
  });
});

describe("team-leader writes that name a member author, made with no member row (issue #646)", () => {
  test("an access grant is stored with no member author, and the audit trail names the account", async () => {
    await seedFixture();
    signInAs(BREAK_GLASS);
    const saved = await actions.saveAccess({ personId: IDS.person(DM), areas: { positions: "edit" } });
    assert.equal(saved.ok, true, JSON.stringify(saved));
    const grant = (await tableRows(scopes)).find((s) => s.memberId === IDS.person(DM) && s.target === "positions");
    assert.equal(grant?.givenBy, null);
    assert.deepEqual(await loggedWriters(), [{ userId: BREAK_GLASS, actingAccountId: null }]);
  });

  test("an order decision is stored with no member reviewer, and the audit trail names the account", async () => {
    await seedFixture();
    signInAs(BREAK_GLASS);
    const decided = await actions.decideOrder(IDS.order(DM), { kind: "approve" });
    assert.equal(decided.ok, true, JSON.stringify(decided));
    const order = (await tableRows(orders)).find((o) => o.id === IDS.order(DM));
    assert.deepEqual([order?.status, order?.reviewedBy], ["accepted", null]);
    assert.deepEqual(await loggedWriters(), [{ userId: BREAK_GLASS, actingAccountId: null }]);
  });

  test("Approve orders is given with no member author", async () => {
    await seedFixture();
    signInAs(BREAK_GLASS);
    const opening = await openDashboard();
    assert.equal(opening.kind, "open");
    const { data } = opening as { data: { setApproveOrders: (input: unknown) => Promise<{ ok: boolean }> } };
    assert.equal((await data.setApproveOrders({ personId: IDS.person(DM), holds: true })).ok, true);
  });

  test("a hand-over answer and the team leader's own hand-over refuse with a plain message, and write nothing", async () => {
    await seedFixture();
    signInAs(BREAK_GLASS);
    assert.deepEqual(await actions.answerHandOver(IDS.handOver(DM), "confirm"), { ok: false, error: HAND_OVER_NEEDS_MEMBER });
    assert.deepEqual(await teamActions.handOverTeamLeader({ to: IDS.person(DM), outcome: "leave" }), { ok: false, error: ONLY_TEAM_LEADER });
    assert.deepEqual(await loggedWriters(), []);
  });
});

describe("each break-glass sign-in writes one audit entry (recordBreakGlassSignIn)", () => {
  test("naming the account and the session, beside the row changes the audit trigger writes", async () => {
    await seedFixture();
    await recordBreakGlassSignIn({ sessionId: "session-1", userId: BREAK_GLASS });
    const entries = (await logRowsSinceSeed()).filter((r) => r.operation === BREAK_GLASS_SIGN_IN_OPERATION);
    assert.equal(entries.length, 1);
    assert.deepEqual(
      { schema: entries[0].schemaName, table: entries[0].tableName, record: entries[0].recordId, by: entries[0].changedBy, data: entries[0].newData },
      { schema: "better_auth", table: "session", record: "session-1", by: BREAK_GLASS, data: { userId: BREAK_GLASS } },
    );
    assert.ok((await tableRows(logs)).some((r) => r.id === entries[0].id), "in the same log the row changes go to");
  });
});
