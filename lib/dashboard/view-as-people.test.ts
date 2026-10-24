import assert from "node:assert/strict";
import { test } from "node:test";
import { VIEW_AS_SHOWN, viewAsLineOf, viewAsPeopleOf, type ViewAsCandidate, type ViewAsRole } from "./view-as";

// The View as dialog (issue #610) offers only people a start would go ahead
// for: never the acting account, never anyone who could use View as on this
// site. A row the gate would refuse is a dead end in the dialog.

const role = (over: Partial<ViewAsRole>): ViewAsRole => ({ type: "core", seat: null, startedAt: "2024-10-01", unitName: "Mission Analysis", ...over });

function candidate(id: string, over: Partial<ViewAsCandidate> = {}): ViewAsCandidate {
  return { id, name: id, photoUrl: null, storedRole: "user", roles: [role({})], alumnus: null, ...over };
}

const ACTING = "acting";
const itLead = candidate("it-lead", { roles: [role({ seat: "it-lead" })] });
const adminTester = candidate("admin-tester", { storedRole: "admin", roles: [] });
const member = candidate("member");

test("the acting account and the IT lead seat are never offered, on any site", () => {
  for (const site of ["live", "test"] as const) {
    const ids = viewAsPeopleOf([candidate(ACTING), itLead, member], ACTING, site).map((p) => p.id);
    assert.deepEqual(ids, ["member"], site);
  }
});

test("an admin tester is offered on the live site, where they cannot use View as, and not on a test site", () => {
  assert.deepEqual(viewAsPeopleOf([adminTester], ACTING, "live").map((p) => p.id), ["admin-tester"]);
  assert.deepEqual(viewAsPeopleOf([adminTester], ACTING, "test"), []);
});

test("one search shows at most VIEW_AS_SHOWN people, in the order read", () => {
  const many = Array.from({ length: VIEW_AS_SHOWN + 3 }, (_, i) => candidate(`p${i}`));
  assert.deepEqual(
    viewAsPeopleOf(many, ACTING, "live").map((p) => p.id),
    many.slice(0, VIEW_AS_SHOWN).map((c) => c.id),
  );
});

test("the line names the highest role with its unit, a seat alone, or the year an alumnus left", () => {
  const memberAndLead = [role({ startedAt: "2023-10-01" }), role({ type: "lead", unitName: "Ground Station", startedAt: "2024-10-01" })];
  assert.equal(viewAsLineOf({ roles: memberAndLead, alumnus: null }), "Division lead · Ground Station");
  assert.equal(viewAsLineOf({ roles: [role({ type: "president", unitName: "Board" })], alumnus: null }), "Team leader");
  assert.equal(viewAsLineOf({ roles: [], alumnus: { teamTo: 2024 } }), "Alumni · 2024");
  assert.equal(viewAsLineOf({ roles: [], alumnus: null }), "Non-member");
});
