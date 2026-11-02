import type { PeopleChange, RemovedLeadOutcome } from "./division-edit";
import type { DivisionRoleChange, MemberPosition } from "./division-members";
import type { AdvisorScope, SteppedDownKind } from "./hand-over";
import type { Permission, Removal } from "./team";

// The member actions a ⋯ menu offers (issue #901; Owner decision,
// 2026-11-02): the Members page and the Team tree offer the same actions on
// a member, each open where the viewer may take it and locked with the
// reason where not. Both menus are built here from the one `MemberPosition`
// the server worked out, so the two places cannot drift apart; each action
// saves through the write its place already uses.

/** Every member action, in the order a menu lists them. */
export const MEMBER_ACTIONS = ["change-title", "make-lead", "become-advisor", "edit-details", "move", "remove", "leave"] as const;
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

export const ADVISORS_LEAD_NOTHING = "An advisor leads nothing";

/** Make lead in one division: not shown for someone who leads it already; open where the viewer may change who leads it. */
export function makeLeadPermission(role: DivisionRoleChange): Permission | null {
  if (role.role === "lead") return null;
  return role.advisor ? locked(ADVISORS_LEAD_NOTHING) : role.change;
}

/** Becomes an advisor in one division: locked for someone who advises there already, else open where the viewer may change who leads it. */
export function becomeAdvisorPermission(role: DivisionRoleChange): Permission {
  return role.advisor ? locked(`Already an advisor in ${role.short}`) : role.change;
}

/** What the person steps down from when they become an advisor in a division: their lead role, or their member role. */
export function advisorStep(role: Pick<DivisionRoleChange, "role">): SteppedDownKind {
  return { kind: role.role === "lead" ? "lead" : "member" };
}

/** The divisions Becomes an advisor may start from: each one where it is open (`becomeAdvisorPermission`). */
export function advisorDivisions(position: Pick<MemberPosition, "roles">): readonly DivisionRoleChange[] {
  return position.roles.filter((r) => becomeAdvisorPermission(r).allowed);
}

/**
 * What Becomes an advisor saves (`PeopleChange`): a lead steps down with
 * "Stays as an advisor", as Remove in Edit division does; a member becomes
 * one. Either way they advise at `scope`.
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

/**
 * A member row's ⋯ menu in the Team tree's division and department drawers
 * (issue #901): Change title, Make lead, Becomes an advisor, Edit details,
 * Move to…, Remove from the division and Leaves the team, for their role in
 * `divisionId`. Empty when the viewer reaches no role of theirs there.
 */
export function divisionRowMenu(position: MemberPosition, divisionId: number): readonly MenuEntry[] {
  const role = position.roles.find((r) => r.divisionId === divisionId);
  if (role === undefined) return [];
  const division = { divisionId, short: role.short };
  const lead = makeLeadPermission(role);
  const removal = position.removals.find((r) => r.divisionId === divisionId);
  const removing = removal === undefined ? null : removalPermission(removal.removal, role.short);
  const moves = position.moves.some((m) => m.kind === "division" && m.divisionId === divisionId);
  return [
    { action: "change-title", division, permission: OPEN },
    ...(lead === null ? [] : [{ action: "make-lead" as const, division, permission: lead }]),
    { action: "become-advisor", division, permission: becomeAdvisorPermission(role) },
    { action: "edit-details", division: null, permission: OPEN },
    ...(moves ? [{ action: "move" as const, division, permission: OPEN }] : []),
    ...(removing === null ? [] : [{ action: "remove" as const, division, permission: removing }]),
    { action: "leave", division: null, permission: position.leave },
  ];
}

/**
 * A Members page row's ⋯ menu (issue #901): Becomes an advisor, Remove from
 * each division the viewer reaches, and Leaves the team. Change title, Make
 * lead and Move to… are Edit details' there, which the row opens. Becomes an
 * advisor is open when one division offers it, and asks which when several do;
 * otherwise it is locked with the first division's reason.
 */
export function membersRowMenu(position: MemberPosition): readonly MenuEntry[] {
  const [first] = position.roles;
  const advisor: MenuEntry[] =
    first === undefined
      ? []
      : [{ action: "become-advisor", division: null, permission: advisorDivisions(position).length > 0 ? OPEN : becomeAdvisorPermission(first) }];
  const removals = position.removals.flatMap((r): MenuEntry[] => {
    const permission = removalPermission(r.removal, r.short);
    return permission === null ? [] : [{ action: "remove", division: { divisionId: r.divisionId, short: r.short }, permission }];
  });
  return [...advisor, ...removals, { action: "leave", division: null, permission: position.leave }];
}
