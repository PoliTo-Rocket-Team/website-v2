import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { BREAK_GLASS_SETTING, breakGlassEmailsOf, breakGlassSignInOf, isBreakGlassEmail, readBreakGlassEmails } from "./break-glass";
import { mayUseViewAs, viewAsRefusalOf, type ViewAsAccount } from "./dashboard/view-as";

// The break-glass setting (issue #646): which sign-in emails it allows, read
// from one environment variable, and what the View as rules make of it. Every
// value here is a placeholder on the reserved `.test` domain.

const ADMIN = "break-glass@team.test";
const OTHER = "second-admin@team.test";

describe("the break-glass setting", () => {
  test("allows each comma-separated entry, trimmed and lower-cased", () => {
    assert.deepEqual([...breakGlassEmailsOf(` ${ADMIN.toUpperCase()} ,${OTHER}`)], [ADMIN, OTHER]);
  });

  test("allows none when unset, empty or blank, and drops blank entries", () => {
    assert.equal(breakGlassEmailsOf(undefined).size, 0);
    assert.equal(breakGlassEmailsOf("").size, 0);
    assert.equal(breakGlassEmailsOf("  ,  , ").size, 0);
    assert.deepEqual([...breakGlassEmailsOf(`,${ADMIN},,`)], [ADMIN]);
  });

  test("is read from the one environment variable at the time of the call", () => {
    assert.deepEqual([...readBreakGlassEmails({ [BREAK_GLASS_SETTING]: ADMIN })], [ADMIN]);
    assert.equal(readBreakGlassEmails({}).size, 0);
    assert.equal(readBreakGlassEmails({ OTHER_SETTING: ADMIN }).size, 0);
  });

  test("matches an allowed email exactly, whatever its case or spaces", () => {
    const allowed = breakGlassEmailsOf(ADMIN);
    assert.equal(isBreakGlassEmail(ADMIN, allowed), true);
    assert.equal(isBreakGlassEmail(` Break-Glass@Team.TEST `, allowed), true);
  });

  test("matches no sub-string, near match or longer address of an allowed email", () => {
    const allowed = breakGlassEmailsOf(ADMIN);
    for (const email of ["glass@team.test", "break-glass@team.tes", "break-glass@team.test.example", "xbreak-glass@team.test", "break-glass@team-test", "break_glass@team.test", "", null, undefined]) {
      assert.equal(isBreakGlassEmail(email, allowed), false, String(email));
    }
  });

  test("matches nobody when nothing is allowed", () => {
    assert.equal(isBreakGlassEmail(ADMIN, breakGlassEmailsOf(undefined)), false);
    assert.equal(isBreakGlassEmail("", breakGlassEmailsOf("")), false);
  });
});

describe("a break-glass sign-in", () => {
  const allowed = breakGlassEmailsOf(ADMIN);
  const session = { id: "session-1", userId: "user-1", impersonatedBy: null };

  test("is the session and account of an allowed email", () => {
    assert.deepEqual(breakGlassSignInOf(session, ADMIN, allowed), { sessionId: "session-1", userId: "user-1" });
  });

  test("is nothing for any other account, or with no email", () => {
    assert.equal(breakGlassSignInOf(session, "member@team.test", allowed), null);
    assert.equal(breakGlassSignInOf(session, null, allowed), null);
    assert.equal(breakGlassSignInOf(session, ADMIN, breakGlassEmailsOf(undefined)), null);
  });

  test("is nothing for a View as session, which is no sign-in of the person it is for", () => {
    assert.equal(breakGlassSignInOf({ ...session, impersonatedBy: "acting" }, ADMIN, allowed), null);
  });
});

describe("View as and the break-glass admin", () => {
  const breakGlass: ViewAsAccount = { activeRoles: [], breakGlass: true };
  const itLead: ViewAsAccount = { activeRoles: [{ fullAccess: "it-lead" }], breakGlass: false };
  const teamLeader: ViewAsAccount = { activeRoles: [{ fullAccess: null }], breakGlass: false };
  const member: ViewAsAccount = { activeRoles: [{ fullAccess: null }], breakGlass: false };
  const start = (acting: ViewAsAccount, person: ViewAsAccount) => ({ actingAccountId: "acting", acting, viewingAs: false, personId: "person", person });

  test("on the live site the break-glass admin and the IT lead may use View as, and nobody else", () => {
    assert.equal(mayUseViewAs(breakGlass, "live"), true);
    assert.equal(mayUseViewAs(itLead, "live"), true);
    assert.equal(mayUseViewAs(teamLeader, "live"), false);
    assert.equal(mayUseViewAs(member, "live"), false);
  });

  test("on the live site the break-glass admin views as a member, and nobody views as it", () => {
    assert.equal(viewAsRefusalOf(start(breakGlass, member), "live"), null);
    assert.equal(viewAsRefusalOf(start(itLead, breakGlass), "live"), "person-may-view-as");
    assert.equal(viewAsRefusalOf(start(breakGlass, itLead), "live"), "person-may-view-as");
  });

  test("on a test site the rules are as before: anyone views as anyone", () => {
    assert.equal(viewAsRefusalOf(start(member, breakGlass), "test"), null);
    assert.equal(viewAsRefusalOf(start(breakGlass, member), "test"), null);
  });
});
