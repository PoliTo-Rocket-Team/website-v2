import assert from "node:assert/strict";
import { test } from "node:test";
import { VIEW_AS_SHOWN, viewAsLineOf, viewAsPeopleOf, type ViewAsCandidate, type ViewAsRole } from "./view-as";

// The View as dialog (issue #610) offers only people a start would go ahead
// for: never the acting account, and on the live site never anyone who could
// use View as. On a test site everyone could (issue #648), so everyone but
// the acting account is offered. A row the gate would refuse is a dead end in
// the dialog.

const role = (over: Partial<ViewAsRole>): ViewAsRole => ({
  id: 1,
  type: "core",
  title: "Trajectory Analyst",
  seat: null,
  startedAt: "2024-10-01",
  unitName: "Mission Analysis",
  ...over,
});

function candidate(id: string, over: Partial<ViewAsCandidate> = {}): ViewAsCandidate {
  return { id, name: id, photoUrl: null, roles: [role({})], alumnus: null, breakGlass: false, ...over };
}

const ACTING = "acting";
const itLead = candidate("it-lead", { roles: [role({ seat: "it-lead" })] });
const adminTester = candidate("admin-tester", { roles: [] });
const member = candidate("member");

test("the acting account is never offered, on any site", () => {
  for (const site of ["live", "test"] as const) {
    const ids = viewAsPeopleOf([candidate(ACTING), member], ACTING, site).map((p) => p.id);
    assert.deepEqual(ids, ["member"], site);
  }
});

test("the IT lead seat is not offered on the live site, where it may use View as; on a test site everyone else is offered", () => {
  assert.deepEqual(viewAsPeopleOf([itLead, adminTester, member], ACTING, "live").map((p) => p.id), ["admin-tester", "member"]);
  assert.deepEqual(viewAsPeopleOf([itLead, adminTester, member], ACTING, "test").map((p) => p.id), ["it-lead", "admin-tester", "member"]);
});

test("the break-glass admin is not offered on the live site, where it may use View as; on a test site it is (issue #646)", () => {
  const breakGlass = candidate("break-glass", { roles: [], breakGlass: true });
  assert.deepEqual(viewAsPeopleOf([breakGlass, member], ACTING, "live").map((p) => p.id), ["member"]);
  assert.deepEqual(viewAsPeopleOf([breakGlass, member], ACTING, "test").map((p) => p.id), ["break-glass", "member"]);
});

test("one search shows at most VIEW_AS_SHOWN people, in the order read", () => {
  const many = Array.from({ length: VIEW_AS_SHOWN + 3 }, (_, i) => candidate(`p${i}`));
  assert.deepEqual(
    viewAsPeopleOf(many, ACTING, "live").map((p) => p.id),
    many.slice(0, VIEW_AS_SHOWN).map((c) => c.id),
  );
});

test("the line names the highest role's title with its unit, a seat alone, or the year an alumnus left", () => {
  const memberAndLead = [
    role({ startedAt: "2023-10-01" }),
    role({ type: "lead", title: "Ground Station Lead", unitName: "Ground Station", startedAt: "2024-10-01" }),
  ];
  assert.equal(viewAsLineOf({ roles: memberAndLead, alumnus: null }), "Ground Station Lead · Ground Station");
  assert.equal(viewAsLineOf({ roles: [role({ type: "president", title: "Team Leader", unitName: "Board" })], alumnus: null }), "Team Leader");
  assert.equal(viewAsLineOf({ roles: [], alumnus: { teamTo: 2024 } }), "Alumni · 2024");
  assert.equal(viewAsLineOf({ roles: [], alumnus: null }), "Non-member");
});
