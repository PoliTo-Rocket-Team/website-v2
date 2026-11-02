import assert from "node:assert/strict";
import { test } from "node:test";
import { ONE_LEAD_NEEDED } from "./division-edit";
import type { DivisionRoleChange, MemberPosition } from "./division-members";
import { advisingAt, advisorScopes } from "./hand-over";
import {
  ADVISORS_LEAD_NOTHING,
  advisorChange,
  advisorDivisions,
  divisionRowMenu,
  leadStepDown,
  membersRowMenu,
  onlyDivisionReason,
  removalPermission,
  type MemberAction,
  type MenuEntry,
} from "./member-actions";

// The member menus of the Team tree and the Members page (issue #901): both
// are built from one position, so the same person gets the same actions with
// the same reasons in both places.

const OPEN = { allowed: true } as const;
const LEADS_BY_HEAD = { allowed: false, reason: "Leads are changed by the Head of Structures" } as const;

function role(over: Partial<DivisionRoleChange> = {}): DivisionRoleChange {
  return { divisionId: 7, short: "Mission Analysis", department: "Aerodynamics", role: "member", advisor: false, leads: 1, change: OPEN, ...over };
}

function position(over: Partial<MemberPosition> = {}): MemberPosition {
  return {
    name: { firstName: "Marco", lastName: "Bianchi" },
    title: { kind: "division", divisionId: 7, short: "Mission Analysis", value: "CAD Engineer" },
    leads: [],
    roles: [role()],
    moves: [{ kind: "division", divisionId: 7, short: "Mission Analysis", department: "Aerodynamics", role: "member", title: "CAD Engineer" }],
    removals: [{ divisionId: 7, short: "Mission Analysis", removal: { kind: "offered" } }],
    leave: OPEN,
    ...over,
  };
}

const actions = (entries: readonly MenuEntry[]): MemberAction[] => entries.map((e) => e.action);
const entry = (entries: readonly MenuEntry[], action: MemberAction) => entries.find((e) => e.action === action);

test("the Team tree's member menu offers every member action, in order, on the row's division", () => {
  const menu = divisionRowMenu(position(), 7);
  assert.deepEqual(actions(menu), ["change-title", "make-lead", "become-advisor", "edit-details", "move", "remove", "leave"]);
  assert.ok(menu.every((e) => e.permission.allowed), "each is open for an editor who may change the division");
  assert.deepEqual(entry(menu, "remove")?.division, { divisionId: 7, short: "Mission Analysis" });
});

test("the Team tree's menu: Remove from is locked as their only division, never hidden", () => {
  const menu = divisionRowMenu(position({ removals: [{ divisionId: 7, short: "Mission Analysis", removal: { kind: "only-division" } }] }), 7);
  assert.deepEqual(entry(menu, "remove")?.permission, { allowed: false, reason: "Mission Analysis is their only division" });
  assert.match(onlyDivisionReason("Mission Analysis"), /only division/);
});

test("the Team tree's menu: a viewer who may not change the division's leads sees Make lead and Becomes an advisor locked with the reason", () => {
  const menu = divisionRowMenu(position({ roles: [role({ change: LEADS_BY_HEAD })] }), 7);
  assert.deepEqual(entry(menu, "make-lead")?.permission, LEADS_BY_HEAD);
  assert.deepEqual(entry(menu, "become-advisor")?.permission, LEADS_BY_HEAD);
  assert.equal(entry(menu, "change-title")?.permission.allowed, true, "the title is any editor's");
});

test("the Team tree's menu: an advisor is not made a lead or an advisor again; a lead is not made a lead", () => {
  const advisor = divisionRowMenu(position({ roles: [role({ advisor: true })] }), 7);
  assert.deepEqual(entry(advisor, "make-lead")?.permission, { allowed: false, reason: ADVISORS_LEAD_NOTHING });
  assert.deepEqual(entry(advisor, "become-advisor")?.permission, { allowed: false, reason: "Already an advisor in Mission Analysis" });
  const lead = divisionRowMenu(position({ roles: [role({ role: "lead" })] }), 7);
  assert.equal(entry(lead, "make-lead"), undefined);
});

test("the Team tree's menu: Leaves the team carries its reason; Move to… shows only where they may be moved; no role there, no menu", () => {
  const menu = divisionRowMenu(position({ moves: [], leave: { allowed: false, reason: "Only the team leader can do this" } }), 7);
  assert.equal(entry(menu, "move"), undefined);
  assert.deepEqual(entry(menu, "leave")?.permission, { allowed: false, reason: "Only the team leader can do this" });
  assert.deepEqual(divisionRowMenu(position(), 99), []);
});

test("the Members page's menu offers Becomes an advisor, each removal and Leaves the team, with the Team tree's reasons", () => {
  const two = position({
    roles: [role(), role({ divisionId: 8, short: "Structures", role: "lead", leads: 2 })],
    removals: [
      { divisionId: 7, short: "Mission Analysis", removal: { kind: "offered" } },
      { divisionId: 8, short: "Structures", removal: { kind: "locked", reason: "Leads are changed by the Head of Structures" } },
      { divisionId: 9, short: "Testing", removal: { kind: "not-in-reach" } },
    ],
  });
  const menu = membersRowMenu(two);
  assert.deepEqual(actions(menu), ["become-advisor", "remove", "remove", "leave"]);
  assert.equal(entry(menu, "become-advisor")?.permission.allowed, true);
  assert.deepEqual(menu[2]?.permission, LEADS_BY_HEAD);
  assert.deepEqual(advisorDivisions(two).map((r) => r.divisionId), [7, 8], "it asks which division when several offer it");

  const only = membersRowMenu(position({ removals: [{ divisionId: 7, short: "Mission Analysis", removal: { kind: "only-division" } }] }));
  assert.deepEqual(entry(only, "remove")?.permission, { allowed: false, reason: "Mission Analysis is their only division" });
  const locked = membersRowMenu(position({ roles: [role({ change: LEADS_BY_HEAD })] }));
  assert.deepEqual(entry(locked, "become-advisor")?.permission, LEADS_BY_HEAD);
  assert.equal(entry(membersRowMenu(position({ roles: [] })), "become-advisor"), undefined, "no reached division, nothing to advise from");
});

test("Becomes an advisor is locked for a division's only lead in both menus, and open while another lead stays", () => {
  const sole = position({ roles: [role({ role: "lead", leads: 1 })] });
  const locked = { allowed: false, reason: ONE_LEAD_NEEDED };
  assert.deepEqual(entry(divisionRowMenu(sole, 7), "become-advisor")?.permission, locked);
  assert.deepEqual(entry(membersRowMenu(sole), "become-advisor")?.permission, locked);
  assert.deepEqual(advisorDivisions(sole), [], "the Members page offers no division to advise from");

  const shared = position({ roles: [role({ role: "lead", leads: 2 })] });
  assert.deepEqual(entry(divisionRowMenu(shared, 7), "become-advisor")?.permission, OPEN);
  assert.deepEqual(entry(membersRowMenu(shared), "become-advisor")?.permission, OPEN);

  const elsewhere = position({ roles: [role({ role: "lead", leads: 1 }), role({ divisionId: 8, short: "Structures" })] });
  assert.deepEqual(advisorDivisions(elsewhere).map((r) => r.divisionId), [8], "the pick leaves out the division they alone lead");
});

test("a removal out of the viewer's reach shows nowhere", () => {
  assert.equal(removalPermission({ kind: "not-in-reach" }, "Testing"), null);
  assert.deepEqual(removalPermission({ kind: "offered" }, "Testing"), OPEN);
});

test("Becomes an advisor saves as Edit division's save: a member as a new advisor, a lead as Remove with Stays as an advisor", () => {
  assert.deepEqual(advisorChange(5, { role: "member" }, "department"), { oldLeads: [], advisors: [{ personId: 5, scope: "department" }] });
  assert.deepEqual(advisorChange(5, { role: "lead" }, "team"), { oldLeads: [{ personId: 5, via: "removed", outcome: "advisor", scope: "team" }], advisors: [] });
  assert.deepEqual(leadStepDown(5, "leave-division", null), { oldLeads: [{ personId: 5, via: "removed", outcome: "leave-division", scope: null }], advisors: [] });
});

test("a division member advises where a lead may: the division, its department or the whole team (the #900 scopes)", () => {
  assert.deepEqual(advisorScopes({ kind: "member" }), advisorScopes({ kind: "lead" }));
  const member = { kind: "member", divisionId: 7, departmentId: 2 } as const;
  assert.deepEqual(advisingAt(member, null), { ok: true, value: { kind: "advisor", place: { kind: "division", divisionId: 7 }, access: "ends" } });
  assert.deepEqual(advisingAt(member, "department"), { ok: true, value: { kind: "advisor", place: { kind: "department", departmentId: 2 }, access: "ends" } });
  assert.deepEqual(advisingAt(member, "team"), { ok: true, value: { kind: "advisor", place: { kind: "team" }, access: "ends" } });
});
