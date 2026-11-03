import { ONE_LEAD_NEEDED, type PeopleChange, type RemovedLeadOutcome } from "./division-edit";
import type { DivisionRoleChange, MemberPosition } from "./division-members";
import { ADVISOR_SCOPES, type AdvisorScope } from "./hand-over";
import type { EditableRole, Permission, Removal } from "./team";
import { andList } from "./team-structure";

// The member actions a ⋯ menu offers (issue #901; Owner decision,
// 2026-11-02): the Members page and the Team tree offer the same actions on
// a member, each open where the viewer may take it and locked with the
// reason where not. Both menus are built here from the one `MemberPosition`
// the server worked out, so the two places cannot drift apart; each action
// saves through the write its place already uses. A member's role and title
// in a division are Edit details' (issue #972; Owner decision, 2026-11-03):
// its role pill picks Member, Lead or Advisor (`roleOptions`), so no menu
// offers Change title, Make lead or Becomes an advisor.

/** Every member action, in the order a menu lists them. */
export const MEMBER_ACTIONS = ["edit-details", "move", "remove", "leave"] as const;
export type MemberAction = (typeof MEMBER_ACTIONS)[number];

/** One ⋯ menu item: the action, the division it acts on (none for Edit details and Leaves the team), and whether it is open. */
export type MenuEntry = {
  readonly action: MemberAction;
  readonly division: Pick<DivisionRoleChange, "divisionId" | "short"> | null;
  readonly permission: Permission;
};

const OPEN: Permission = { allowed: true };

function locked(reason: string): Permission {
  return { allowed: false, reason };
}

/** "Mission Analysis is their only division": why Remove from a division is locked for someone in no other (`mayLeaveDivision`). */
export function onlyDivisionReason(short: string): string {
  return `${short} is their only division`;
}

/**
 * "Remove from <division>" as a menu shows it: open, locked with the reason
 * (their only division, or who changes its leads), or not shown where the
 * division is out of the viewer's reach.
 */
export function removalPermission(removal: Removal, short: string): Permission | null {
  switch (removal.kind) {
    case "offered":
      return OPEN;
    case "only-division":
      return locked(onlyDivisionReason(short));
    case "locked":
      return locked(removal.reason);
    case "not-in-reach":
      return null;
  }
}

/**
 * Whether they may stop leading one division: locked for its only lead, since
 * a division keeps at least one (`planDivisionSave`); open for anyone else.
 * Edit details' Member choice reads it, and so does becoming an advisor.
 */
export function stepDownPermission(role: Pick<DivisionRoleChange, "role" | "leads">): Permission {
  return role.role === "lead" && role.leads < 2 ? locked(ONE_LEAD_NEEDED) : OPEN;
}

/**
 * A lead or member becoming an advisor in one division: locked where the
 * viewer may not change who leads it, and for its only lead
 * (`stepDownPermission`); else open. An advisor there already picks another
 * scope under `roleOptions`' own rule.
 */
export function becomeAdvisorPermission(role: Pick<DivisionRoleChange, "role" | "leads" | "change">): Permission {
  if (!role.change.allowed) return role.change;
  return stepDownPermission(role);
}

/**
 * What saves someone becoming an advisor (`PeopleChange`): a lead steps down
 * with "Stays as an advisor", as Remove in Edit division does; a member
 * becomes one. Either way they advise at `scope`.
 */
export function advisorChange(personId: number, role: Pick<DivisionRoleChange, "role">, scope: AdvisorScope): PeopleChange {
  return role.role === "lead"
    ? { oldLeads: [{ personId, via: "removed", outcome: "advisor", scope }], advisors: [] }
    : { oldLeads: [], advisors: [{ personId, scope }] };
}

/** What a lead switched to member in Edit details saves (issue #901): Edit division's Remove, with the outcome picked; no scope is the division. */
export function leadStepDown(personId: number, outcome: RemovedLeadOutcome, scope: AdvisorScope | null): PeopleChange {
  return { oldLeads: [{ personId, via: "removed", outcome, scope }], advisors: [] };
}

// Edit details' role pill (issue #972, boards 103b and 103c): one per division
// row, picking what they are in that division. Member and Lead, then Advisor at
// the #900 scopes. A pick is staged and Save applies it through the write each
// one already has.

/** What a division row's role pill holds: member, lead, or an advisor at one #900 scope. */
export type RoleChoice = { readonly kind: "member" } | { readonly kind: "lead" } | { readonly kind: "advisor"; readonly scope: AdvisorScope };

/** One item of the role pill's menu: the choice, whether the viewer may pick it, and the line under it. */
export type RoleOption = {
  readonly choice: RoleChoice;
  readonly permission: Permission;
  /** "With Anna Rossi": who else leads the division, under Lead; null for no line. */
  readonly detail: string | null;
};

/** What they are in the division now: an Advisor role there advises the division itself. */
export function roleNow(role: Pick<DivisionRoleChange, "role" | "advisor">): RoleChoice {
  return role.advisor ? { kind: "advisor", scope: "division" } : { kind: role.role };
}

export function sameRole(a: RoleChoice, b: RoleChoice): boolean {
  return a.kind === b.kind && (a.kind !== "advisor" || (b.kind === "advisor" && a.scope === b.scope));
}

/** "Member", "Lead", "Advisor · this division": the role pill's own words. */
export function roleLabel(choice: RoleChoice): string {
  switch (choice.kind) {
    case "member":
      return "Member";
    case "lead":
      return "Lead";
    case "advisor":
      return `Advisor · ${ADVISOR_SCOPE_LABELS[choice.scope].toLowerCase()}`;
  }
}

/** The advisor scopes as the role pill's menu lists them (board 103c). */
export const ADVISOR_SCOPE_LABELS: Readonly<Record<AdvisorScope, string>> = {
  division: "This division",
  department: "Its department",
  team: "Whole team",
};

/**
 * Every item of one division row's role pill (board 103c), each open or
 * locked with its reason by the rules the server checks: what they are now is
 * always open; where the viewer may not change who leads the division, every
 * other choice carries that reason; a lead may become a member or an advisor
 * only while another lead stays (`ONE_LEAD_NEEDED`). An advisor there may
 * become a member or a lead again, or advise at another scope (issue #972;
 * Owner decision, 2026-11-03): no rule but the viewer's reach locks those.
 * Lead names the division's other leads.
 */
export function roleOptions(role: DivisionRoleChange): readonly RoleOption[] {
  const now = roleNow(role);
  const others = role.otherLeads.length > 0 ? `With ${andList(role.otherLeads)}` : null;
  const option = (choice: RoleChoice, permission: Permission, detail: string | null = null): RoleOption => ({
    choice,
    permission: sameRole(choice, now) ? OPEN : permission,
    detail,
  });
  if (role.advisor) {
    const advisors = ADVISOR_SCOPES.map((scope) => option({ kind: "advisor", scope }, role.change));
    return [option({ kind: "member" }, role.change), option({ kind: "lead" }, role.change, others), ...advisors];
  }
  const advisors = ADVISOR_SCOPES.map((scope) => option({ kind: "advisor", scope }, becomeAdvisorPermission(role)));
  const change = (permission: Permission) => (role.change.allowed ? permission : role.change);
  return [option({ kind: "member" }, change(stepDownPermission(role))), option({ kind: "lead" }, change(OPEN), others), ...advisors];
}

/**
 * What Save writes for an advisor's role pill pick in one division (issue
 * #972), through the writes each choice already has: Member or Lead is the
 * lead or member switch (`saveMember`, which ends their Advisor role there
 * and starts the new one); another scope is Edit division's people change
 * (`changeDivisionPeople`), which moves their Advisor role there. Null for
 * what they are now: nothing to save.
 */
export type AdvisorRoleSave =
  | { readonly kind: "role"; readonly role: EditableRole }
  | { readonly kind: "advise"; readonly change: PeopleChange };

export function advisorRoleSave(personId: number, choice: RoleChoice): AdvisorRoleSave | null {
  switch (choice.kind) {
    case "member":
      return { kind: "role", role: "member" };
    case "lead":
      return { kind: "role", role: "division-lead" };
    case "advisor":
      return choice.scope === "division" ? null : { kind: "advise", change: advisorChange(personId, { role: "member" }, choice.scope) };
  }
}

/**
 * A member row's ⋯ menu in the Team tree's division and department drawers
 * (issue #901, narrowed by #972): Edit details, Move to…, Remove from the
 * division and Leaves the team, for their role in `divisionId`. Empty when
 * the viewer reaches no role of theirs there.
 */
export function divisionRowMenu(position: MemberPosition, divisionId: number): readonly MenuEntry[] {
  const role = position.roles.find((r) => r.divisionId === divisionId);
  if (role === undefined) return [];
  const division = { divisionId, short: role.short };
  const removal = position.removals.find((r) => r.divisionId === divisionId);
  const removing = removal === undefined ? null : removalPermission(removal.removal, role.short);
  const moves = position.moves.some((m) => m.kind === "division" && m.divisionId === divisionId);
  return [
    { action: "edit-details", division: null, permission: OPEN },
    ...(moves ? [{ action: "move" as const, division, permission: OPEN }] : []),
    ...(removing === null ? [] : [{ action: "remove" as const, division, permission: removing }]),
    { action: "leave", division: null, permission: position.leave },
  ];
}

/**
 * A Members page row's ⋯ menu (issue #901, narrowed by #972): Remove from
 * each division the viewer reaches, and Leaves the team. The row opens Edit
 * details, which holds Move to… and the role in each division.
 */
export function membersRowMenu(position: MemberPosition): readonly MenuEntry[] {
  const removals = position.removals.flatMap((r): MenuEntry[] => {
    const permission = removalPermission(r.removal, r.short);
    return permission === null ? [] : [{ action: "remove", division: { divisionId: r.divisionId, short: r.short }, permission }];
  });
  return [...removals, { action: "leave", division: null, permission: position.leave }];
}
