import assert from "node:assert/strict";
import { test } from "node:test";
import { ONE_LEAD_NEEDED } from "./division-edit";
import type { DivisionRoleChange, MemberPosition } from "./division-members";
import { advisingAt, advisorScopes } from "./hand-over";
import {
  advisorChange,
  advisorRoleSave,
  divisionRowMenu,
  leadStepDown,
  membersRowMenu,
  onlyDivisionReason,
  removalPermission,
  roleLabel,
  roleNow,
  roleOptions,
  sameRole,
  stepDownPermission,
  type MemberAction,
  type MenuEntry,
  type RoleChoice,
  type RoleOption,
} from "./member-actions";

// The member menus of the Team tree and the Members page (issue #901): both
// are built from one position, so the same person gets the same actions with
// the same reasons in both places. Edit details' role pill (issue #972) picks
// what they are in each division, by the rules the server checks.

const OPEN = { allowed: true } as const;
const LEADS_BY_HEAD = { allowed: false, reason: "Leads are changed by the Head of Structures" } as const;

function role(over: Partial<DivisionRoleChange> = {}): DivisionRoleChange {
  return { divisionId: 7, short: "Mission Analysis", department: "Aerodynamics", role: "member", advisor: false, leads: 1, otherLeads: [], change: OPEN, ...over };
}

function position(over: Partial<MemberPosition> = {}): MemberPosition {
  return {
    name: { firstName: "Marco", lastName: "Bianchi" },
    title: { kind: "division", divisionId: 7, short: "Mission Analysis", value: "CAD Engineer" },
    leads: [],
    roles: [role()],
    seats: [],
    advising: [],
    moves: [{ kind: "division", divisionId: 7, short: "Mission Analysis", department: "Aerodynamics", role: "member", title: "CAD Engineer" }],
    removals: [{ divisionId: 7, short: "Mission Analysis", removal: { kind: "offered" } }],
    leave: OPEN,
    ...over,
  };
}

const actions = (entries: readonly MenuEntry[]): MemberAction[] => entries.map((e) => e.action);
const entry = (entries: readonly MenuEntry[], action: MemberAction) => entries.find((e) => e.action === action);

test("the Team tree's member menu offers Edit details, Move to…, Remove and Leaves the team, in order, on the row's division", () => {
  const menu = divisionRowMenu(position(), 7);
  assert.deepEqual(actions(menu), ["edit-details", "move", "remove", "leave"]);
  assert.ok(menu.every((e) => e.permission.allowed), "each is open for an editor who may change the division");
  assert.deepEqual(entry(menu, "remove")?.division, { divisionId: 7, short: "Mission Analysis" });
});

test("the Team tree's menu: Remove from is locked as their only division, never hidden", () => {
  const menu = divisionRowMenu(position({ removals: [{ divisionId: 7, short: "Mission Analysis", removal: { kind: "only-division" } }] }), 7);
  assert.deepEqual(entry(menu, "remove")?.permission, { allowed: false, reason: "Mission Analysis is their only division" });
  assert.match(onlyDivisionReason("Mission Analysis"), /only division/);
});

test("the Team tree's menu: Leaves the team carries its reason; Move to… shows only where they may be moved; no role there, no menu", () => {
  const menu = divisionRowMenu(position({ moves: [], leave: { allowed: false, reason: "Only the team leader can do this" } }), 7);
  assert.equal(entry(menu, "move"), undefined);
  assert.deepEqual(entry(menu, "leave")?.permission, { allowed: false, reason: "Only the team leader can do this" });
  assert.deepEqual(divisionRowMenu(position(), 99), []);
});

test("the Members page's menu offers each removal and Leaves the team, with the Team tree's reasons", () => {
  const two = position({
    roles: [role(), role({ divisionId: 8, short: "Structures", role: "lead", leads: 2 })],
    removals: [
      { divisionId: 7, short: "Mission Analysis", removal: { kind: "offered" } },
      { divisionId: 8, short: "Structures", removal: { kind: "locked", reason: "Leads are changed by the Head of Structures" } },
      { divisionId: 9, short: "Testing", removal: { kind: "not-in-reach" } },
    ],
  });
  const menu = membersRowMenu(two);
  assert.deepEqual(actions(menu), ["remove", "remove", "leave"]);
  assert.deepEqual(menu[1]?.permission, LEADS_BY_HEAD);
  const only = membersRowMenu(position({ removals: [{ divisionId: 7, short: "Mission Analysis", removal: { kind: "only-division" } }] }));
  assert.deepEqual(entry(only, "remove")?.permission, { allowed: false, reason: "Mission Analysis is their only division" });
});

const ADVISOR_CHOICES: RoleChoice[] = [
  { kind: "advisor", scope: "division" },
  { kind: "advisor", scope: "department" },
  { kind: "advisor", scope: "team" },
];
const permissionOf = (options: readonly RoleOption[], choice: RoleChoice) => options.find((o) => sameRole(o.choice, choice))?.permission;

test("the role pill offers Member, Lead, then Advisor at this division, its department and the whole team; a member may take each", () => {
  const options = roleOptions(role());
  assert.deepEqual(
    options.map((o) => o.choice),
    [{ kind: "member" }, { kind: "lead" }, ...ADVISOR_CHOICES],
  );
  assert.ok(options.every((o) => o.permission.allowed));
  assert.deepEqual(roleNow(role()), { kind: "member" });
  assert.deepEqual(
    options.map((o) => roleLabel(o.choice)),
    ["Member", "Lead", "Advisor · this division", "Advisor · its department", "Advisor · whole team"],
  );
});

test("the role pill's Lead names the division's other leads, and nothing when there are none", () => {
  const lead = (r: DivisionRoleChange) => roleOptions(r).find((o) => o.choice.kind === "lead")?.detail;
  assert.equal(lead(role({ otherLeads: ["Anna Rossi", "Luca Neri"] })), "Leads beside Anna Rossi and Luca Neri");
  assert.equal(lead(role()), null);
});

test("the role pill's advisor scopes name the unit each advises: the division, its department, nothing for the whole team", () => {
  const r = role();
  for (const advisor of [false, true]) {
    const options = roleOptions({ ...r, advisor });
    assert.deepEqual(
      ADVISOR_CHOICES.map((c) => options.find((o) => sameRole(o.choice, c))?.detail),
      [r.short, r.department, null],
    );
  }
});

test("the role pill: a division's only lead may not become a member or an advisor (ONE_LEAD_NEEDED); with another lead they may", () => {
  const sole = roleOptions(role({ role: "lead", leads: 1 }));
  const locked = { allowed: false, reason: ONE_LEAD_NEEDED };
  assert.deepEqual(permissionOf(sole, { kind: "member" }), locked);
  for (const choice of ADVISOR_CHOICES) assert.deepEqual(permissionOf(sole, choice), locked);
  assert.deepEqual(permissionOf(sole, { kind: "lead" }), OPEN, "what they are now stays open");

  const shared = roleOptions(role({ role: "lead", leads: 2, otherLeads: ["Anna Rossi"] }));
  assert.ok(shared.every((o) => o.permission.allowed));
});

test("the role pill: where the viewer may not change who leads the division, every other choice carries that reason", () => {
  const options = roleOptions(role({ change: LEADS_BY_HEAD }));
  assert.deepEqual(permissionOf(options, { kind: "member" }), OPEN);
  for (const choice of [{ kind: "lead" } as const, ...ADVISOR_CHOICES]) assert.deepEqual(permissionOf(options, choice), LEADS_BY_HEAD);
});

test("the role pill: an advisor shows Advisor · this division and may become a member or a lead again, or advise at another scope", () => {
  const advisor = role({ advisor: true, otherLeads: ["Anna Rossi"] });
  assert.deepEqual(roleNow(advisor), { kind: "advisor", scope: "division" });
  const options = roleOptions(advisor);
  assert.ok(options.every((o) => o.permission.allowed));
  assert.equal(options.find((o) => o.choice.kind === "lead")?.detail, "Leads beside Anna Rossi");
  // Only the viewer's reach locks them, as for anyone else's row.
  const unreached = roleOptions(role({ advisor: true, change: LEADS_BY_HEAD }));
  assert.deepEqual(permissionOf(unreached, { kind: "advisor", scope: "division" }), OPEN, "what they are now stays open");
  for (const choice of [{ kind: "member" } as const, { kind: "lead" } as const, ...ADVISOR_CHOICES.filter((c) => !sameRole(c, { kind: "advisor", scope: "division" }))]) {
    assert.deepEqual(permissionOf(unreached, choice), LEADS_BY_HEAD);
  }
});

test("an advisor's pick saves through the writes each choice has: the lead or member switch, or Edit division's people change", () => {
  assert.deepEqual(advisorRoleSave(5, { kind: "member" }), { kind: "role", role: "member" });
  assert.deepEqual(advisorRoleSave(5, { kind: "lead" }), { kind: "role", role: "division-lead" });
  assert.deepEqual(advisorRoleSave(5, { kind: "advisor", scope: "team" }), { kind: "advise", change: { oldLeads: [], advisors: [{ personId: 5, scope: "team" }] } });
  assert.equal(advisorRoleSave(5, { kind: "advisor", scope: "division" }), null, "what they are now saves nothing");
});

test("stepping down to member is locked for a division's only lead, with the server's reason, and open while another lead stays", () => {
  assert.deepEqual(stepDownPermission(role({ role: "lead", leads: 1 })), { allowed: false, reason: ONE_LEAD_NEEDED });
  assert.deepEqual(stepDownPermission(role({ role: "lead", leads: 2 })), OPEN);
  assert.deepEqual(stepDownPermission(role({ role: "member", leads: 1 })), OPEN, "a member is a member already");
});

test("a removal out of the viewer's reach shows nowhere", () => {
  assert.equal(removalPermission({ kind: "not-in-reach" }, "Testing"), null);
  assert.deepEqual(removalPermission({ kind: "offered" }, "Testing"), OPEN);
});

test("the Advisor pick saves as Edit division's save: a member as a new advisor, a lead as Remove with Stays as an advisor", () => {
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
