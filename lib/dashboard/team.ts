import type { positionTypeEnum } from "@/db/schema/public";
import { academicYearStart, shortAcademicYearLabel } from "@/lib/about/academic-year-copy";
import type { DepartmentMembers } from "./department-members";
import type { DivisionMembers } from "./division-members";
import type { WholeTeamMembers } from "./team-members";

// The Team pages of the dashboard (issue #143): Members (boards 46, 46b),
// Alumni (46c) and the Team tree (42, 42b). Both sides of the data
// interface hand these shapes to the pages; the components render them and
// fetch nothing. The tree is built here from the roster alone, so a person
// added to the roster is a node.

/** The two seats beside the team leader (board 54c): the Project Manager and the Chief Engineer. */
export const BOARD_SEATS = ["project-manager", "chief-engineer"] as const;
export type BoardSeat = (typeof BOARD_SEATS)[number];

export const BOARD_SEAT_TITLES: Readonly<Record<BoardSeat, string>> = {
  "project-manager": "Project Manager",
  "chief-engineer": "Chief Engineer",
};

/** The seat a role's title names, in any case and spacing; null for any other title. */
export function boardSeatOf(title: string): BoardSeat | null {
  const key = title.trim().replace(/\s+/g, " ").toLowerCase();
  return BOARD_SEATS.find((seat) => BOARD_SEAT_TITLES[seat].toLowerCase() === key) ?? null;
}

// Divisions per person (issue #229). One person can be in several divisions
// at once, as lead or member, across departments (Owner decision, 2026-10-11),
// so a person's divisions are a list, each with its own role. The list holds
// a division at most once: only `membershipsOf` builds one, and it folds a
// division named twice into one membership.

/** What someone is in one division. */
export type DivisionRole = "lead" | "member";

export type DivisionMembership = {
  readonly divisionId: number;
  readonly role: DivisionRole;
  /** The day it started ("2024-10-01"): the oldest membership decides where the Team tree draws someone. */
  readonly since: string;
};

declare const ONE_EACH: unique symbol;

/** A person's divisions, oldest first, no division twice. Build it with `membershipsOf`. */
export type Memberships = readonly DivisionMembership[] & { readonly [ONE_EACH]: true };

function byAge(a: DivisionMembership, b: DivisionMembership): number {
  return a.since.localeCompare(b.since) || a.divisionId - b.divisionId;
}

/**
 * The memberships, oldest first, with a division named twice folded into one:
 * a lead in either is a lead, and the earlier start date is kept.
 */
export function membershipsOf(list: readonly DivisionMembership[]): Memberships {
  const byDivision = new Map<number, DivisionMembership>();
  for (const m of list) {
    const seen = byDivision.get(m.divisionId);
    byDivision.set(
      m.divisionId,
      seen === undefined
        ? m
        : {
            divisionId: m.divisionId,
            role: seen.role === "lead" || m.role === "lead" ? "lead" : "member",
            since: seen.since < m.since ? seen.since : m.since,
          },
    );
  }
  return [...byDivision.values()].sort(byAge) as unknown as Memberships;
}

export const NO_MEMBERSHIPS: Memberships = membershipsOf([]);

/** Their role in `divisionId`, or null when they are not in it. */
export function roleIn(memberships: Memberships, divisionId: number): DivisionRole | null {
  return memberships.find((m) => m.divisionId === divisionId)?.role ?? null;
}

/**
 * The memberships with `divisionId` set to `role`. Every other division stays
 * as it was: picking someone as lead of one division never moves them out of
 * the others (Owner decision, 2026-10-11). Unchanged when they are not in it.
 */
export function withRoleIn(memberships: Memberships, divisionId: number, role: DivisionRole): Memberships {
  return membershipsOf(memberships.map((m) => (m.divisionId === divisionId ? { ...m, role } : m)));
}

/** The memberships with `divisionId` added as a member from `since`; unchanged when they are already in it. */
export function withJoined(memberships: Memberships, divisionId: number, since: string): Memberships {
  if (roleIn(memberships, divisionId) !== null) return memberships;
  return membershipsOf([...memberships, { divisionId, role: "member", since }]);
}

/** The memberships without `divisionId`: "Remove from <division>" (issue #231). Every other division stays. */
export function withoutDivision(memberships: Memberships, divisionId: number): Memberships {
  return membershipsOf(memberships.filter((m) => m.divisionId !== divisionId));
}

/**
 * A person's first division: their first place on the Team tree, and the one
 * named where a page shows a single division: the oldest one they lead, else their
 * oldest membership. Null when they are in no division.
 */
export function homeDivision(memberships: Memberships): number | null {
  return (memberships.find((m) => m.role === "lead") ?? memberships[0])?.divisionId ?? null;
}

/** The memberships with the home division (`homeDivision`) first, the rest oldest first. */
export function homeFirst(memberships: Memberships): readonly DivisionMembership[] {
  const home = homeDivision(memberships);
  return [...memberships].sort((a, b) => Number(b.divisionId === home) - Number(a.divisionId === home));
}

/**
 * The role types the `roles` table holds (`position_type`). An `advisor` role
 * (issue #253) is what someone holds after handing over a role and staying in
 * the team: it leads nothing and heads nothing, so it counts as neither.
 */
export type RoleType = (typeof positionTypeEnum.enumValues)[number] | null;

/**
 * What a role of `type` makes its holder in the division it is in: a lead or
 * head role leads it, any other role is a member of it. `standingIn` in
 * ./viewer.ts reads a viewer's division roles by this same rule.
 */
export function divisionRoleOf(type: RoleType): DivisionRole {
  return type === "lead" || type === "head" ? "lead" : "member";
}

/** One active `roles` row, as both data sources read it. */
export type RoleHeld = {
  readonly type: RoleType;
  /** The division it is in; null for a role in no division. */
  readonly divisionId: number | null;
  /** `started_at`: "2024-10-01". */
  readonly since: string;
};

/** The membership one active role gives (`divisionRoleOf`); null for a role in no division. */
export function membershipOfRole(role: RoleHeld): DivisionMembership | null {
  return role.divisionId === null ? null : { divisionId: role.divisionId, role: divisionRoleOf(role.type), since: role.since };
}

/**
 * Whether the row is a lead or member role in its division: the only rows a
 * division write ends or changes. A seat kept on a division row (the team
 * leader's or a head's role) stays the seat through every division write, since
 * a seat holder keeps that role beside any division role (Owner decision,
 * 2026-10-11, on #232). For a row in a division this is exactly
 * `roleBeyondDivisions(row) === null`: a board seat is never kept on one.
 */
export function isDivisionRole(role: Pick<RoleHeld, "type" | "divisionId">): boolean {
  return role.divisionId !== null && role.type !== "president" && role.type !== "head";
}

/** A person's memberships from their active roles, each division once (`membershipOfRole`, `membershipsOf`). */
export function membershipsOfRoles(roles: readonly RoleHeld[]): Memberships {
  return membershipsOf(roles.flatMap((r) => membershipOfRole(r) ?? []));
}

/**
 * Where someone sits on the team, which also says what they lead. A seat (the
 * team leader, a board seat, a head) is where they are drawn; its
 * `memberships` are the divisions they are in beside it, since anyone on the
 * team can be picked to lead a division (Owner decision, 2026-10-11, on #232).
 */
export type Placement =
  | { readonly role: "team-leader"; readonly memberships: Memberships }
  | { readonly role: "board"; readonly seat: BoardSeat; readonly memberships: Memberships }
  | { readonly role: "head"; readonly departmentId: number; readonly memberships: Memberships }
  /** In one or more divisions; none yet when they were added to the roster and not placed. */
  | { readonly role: "divisions"; readonly memberships: Memberships };

/** How the Members page and the tree name someone's place: a division lead when they lead any division. */
export type TeamRole = "team-leader" | "board" | "head" | "division-lead" | "member";

export function teamRoleOf(placement: Placement): TeamRole {
  if (placement.role !== "divisions") return placement.role;
  return placement.memberships.some((m) => m.role === "lead") ? "division-lead" : "member";
}

/** A placement in divisions, from its memberships. */
export function inDivisions(list: readonly DivisionMembership[]): Placement {
  return { role: "divisions", memberships: membershipsOf(list) };
}

/** Every division someone is in, a seat's beside it included. */
export function membershipsIn(placement: Placement): Memberships {
  return placement.memberships;
}

/**
 * Which slide of the Team page's departments carousel a department's head
 * sits on (issue #325, ADR 0015): "Technical Departments", heads with their
 * division leads under them, or "Operations", the head beside their
 * divisions' leads. Set on New department and Edit department.
 */
export const DEPARTMENT_KINDS = ["technical", "operations"] as const;
export type DepartmentKind = (typeof DEPARTMENT_KINDS)[number];

export type OrgDepartment = {
  readonly id: number;
  readonly name: string;
  /** The short code Edit department shows: "AE" (issue #251). Null where none is set. */
  readonly code?: string | null;
  readonly kind: DepartmentKind;
};
export type OrgDivision = {
  readonly id: number;
  readonly name: string;
  readonly departmentId: number;
  /** The short code the Members page shows on a chip: "MA". Null where none is set. */
  readonly code?: string | null;
};

/** The departments and divisions that are open now, in display order. */
export type OrgChart = {
  readonly departments: readonly OrgDepartment[];
  readonly divisions: readonly OrgDivision[];
};

/** One person on this year's team, as both sides of the data interface read them. */
export type RosterEntry = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly placement: Placement;
  /** The title under their name on the public Team page, when one is set. */
  readonly pageTitle: string | null;
  /** The year they joined the team. */
  readonly joined: number;
  /** "Aerospace Eng." */
  readonly program: string | null;
  /** "MSc · year 1" */
  readonly study: string | null;
  /** What they can reach beyond their own pages: "Applications · view". */
  readonly access: readonly string[];
};

/**
 * Someone's first division (`homeDivision`); null for someone not placed, and
 * for a seat or a head, whose first place on the tree is that seat whatever
 * division they also lead.
 */
export function homeDivisionOf(placement: Placement): number | null {
  return placement.role === "divisions" ? homeDivision(placement.memberships) : null;
}

/** Every division someone leads, the home one first (issue #185); none for a seat, a head or a member. */
export function ledDivisionsOf(placement: Placement): number[] {
  return homeFirst(membershipsIn(placement))
    .filter((m) => m.role === "lead")
    .map((m) => m.divisionId);
}

/**
 * The oldest division someone leads; null when they lead none. The dummy
 * Orders page, scoped to one led division, reads it.
 */
export function ledDivisionOf(placement: Placement): number | null {
  return membershipsIn(placement).find((m) => m.role === "lead")?.divisionId ?? null;
}

/** Whether someone is in `divisionId`, as lead or member. */
export function isIn(placement: Placement, divisionId: number): boolean {
  return roleIn(membershipsIn(placement), divisionId) !== null;
}

/** The department a head heads, or the one their home division is in. */
export function departmentIdOf(placement: Placement, org: OrgChart): number | null {
  if (placement.role === "head") return placement.departmentId;
  const divisionId = homeDivisionOf(placement);
  return org.divisions.find((d) => d.id === divisionId)?.departmentId ?? null;
}

/** The placement with their role in `divisionId` set; their seat, other divisions untouched, and anyone not in it unchanged. */
export function placedWithRoleIn(placement: Placement, divisionId: number, role: DivisionRole): Placement {
  return { ...placement, memberships: withRoleIn(placement.memberships, divisionId, role) };
}

export function isLead(role: TeamRole): boolean {
  return role !== "member";
}

/** The roles a drawer can set: a lead or member of the person's own division. */
export type EditableRole = "division-lead" | "member";

/** The division role a drawer's choice sets. */
export const DIVISION_ROLE_OF: Readonly<Record<EditableRole, DivisionRole>> = { "division-lead": "lead", member: "member" };

/**
 * What the member drawer saves (board 46b). `role` is null for a person whose
 * role the drawer does not set (the team leader, a head, someone in no
 * division): their placement stays and only the title changes.
 */
export type MemberEdit = {
  readonly role: EditableRole | null;
  readonly pageTitle: string | null;
};

// Members (boards 46 and 46b)

export type MemberRow = {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: TeamRole;
  /** The pill: "Head of Operations", "Division Lead", "Member". */
  readonly roleLabel: string;
  /** "Operations", or null for the team leader and anyone not yet placed. */
  readonly department: string | null;
  /** The line under the department; null when there is none. */
  readonly division: string | null;
  readonly joined: number;
  readonly program: string | null;
  readonly study: string | null;
  readonly pageTitle: string | null;
  readonly access: readonly string[];
  /** The viewer's own row: the drawer shows it but offers no changes. */
  readonly self: boolean;
};

/**
 * What the Team page panel (board 46b) changes for one person, seen from the
 * whole team: the title the Team page shows under their name, and whether
 * they lead their home division. `role` is null where the panel does not set
 * it (the team leader, a board seat, a head, someone in no division); then
 * only the title changes (`MemberEdit`).
 */
export type TeamPageEdit = {
  readonly id: number;
  readonly pageTitle: string | null;
  readonly role: EditableRole | null;
};

export function teamPageEditOf(entry: RosterEntry, org: OrgChart): TeamPageEdit {
  const role = teamRoleOf(entry.placement);
  const home = homeDivisionOf(entry.placement);
  const placed = org.divisions.some((d) => d.id === home);
  return {
    id: entry.id,
    pageTitle: entry.pageTitle,
    role: role === "division-lead" ? "division-lead" : role === "member" && placed ? "member" : null,
  };
}

/**
 * Someone accepted for one of the division's positions who is not on the
 * team yet (board 59): the lead confirms they join once the signed NDA is in.
 */
export type Joining = {
  /** The accepted application: what Confirm join acts on. */
  readonly applicationId: number;
  readonly name: string;
  /** The position they were accepted for: "Mission Analyst". */
  readonly position: string;
  /** "The signed NDA arrived" is ticked on the application: Confirm join waits for it. */
  readonly ndaArrived: boolean;
};

/**
 * Who a viewer's Members page lists: the whole team with every member field
 * for each full-access seat, the team leader, the operations lead and the IT
 * lead alike (boards 73 to 73c, issues #252 and #418); one division for a
 * division lead, with every division they are in and what the lead may do to
 * each (boards 61e to 61h2, issue #231); every division of the department for
 * its head (boards 69 to 69c, issue #235); and nothing for anyone else. On
 * the whole team, `teamPageEdits` holds what the Team page panel changes for
 * each person: every full-access seat has that panel, the team leader
 * included (Owner decision, 2026-10-19, issue #444).
 */
export type MemberDirectory =
  | ({ readonly scope: "whole-team"; readonly teamPageEdits: readonly TeamPageEdit[] } & WholeTeamMembers)
  | ({ readonly scope: "division" } & DivisionMembers)
  | ({ readonly scope: "department" } & DepartmentMembers)
  | { readonly scope: "none" };

/** A viewer with no division to list. */
export const NO_MEMBERS: MemberDirectory = { scope: "none" };

function roleLabelOf(placement: Placement, role: TeamRole, org: OrgChart): string {
  if (placement.role === "board") return BOARD_SEAT_TITLES[placement.seat];
  if (placement.role === "head") {
    const department = org.departments.find((d) => d.id === placement.departmentId);
    return department ? `Head of ${department.name}` : "Head";
  }
  return role === "team-leader" ? "Team Leader" : role === "division-lead" ? "Division Lead" : "Member";
}

/**
 * The person's row. Seen from one division (`divisionId`), the row is their
 * place in that division. Seen from the whole team it names their home
 * division (`homeDivision`), as the Members page lists one division per
 * person until #231 lists them all.
 */
export function memberRowOf(entry: RosterEntry, org: OrgChart, selfId: number | null = null, divisionId: number | null = null): MemberRow {
  const memberships = membershipsIn(entry.placement);
  const inDivision = divisionId === null ? null : roleIn(memberships, divisionId);
  const shownDivision = inDivision === null ? homeDivisionOf(entry.placement) : divisionId;
  const role: TeamRole = inDivision === null ? teamRoleOf(entry.placement) : inDivision === "lead" ? "division-lead" : "member";
  const departmentId =
    entry.placement.role === "head" ? entry.placement.departmentId : (org.divisions.find((d) => d.id === shownDivision)?.departmentId ?? null);
  return {
    id: entry.id,
    name: entry.name,
    email: entry.email,
    role,
    roleLabel: roleLabelOf(entry.placement, role, org),
    department: org.departments.find((d) => d.id === departmentId)?.name ?? null,
    division: org.divisions.find((d) => d.id === shownDivision)?.name ?? null,
    joined: entry.joined,
    program: entry.program,
    study: entry.study,
    pageTitle: entry.pageTitle,
    access: entry.access,
    self: entry.id === selfId,
  };
}

// Who may change whom on the Members page (issue #231, boards 61e to 61h2)

/**
 * Who acts on the Members page, by what they lead. The team leader reaches
 * the whole team; the operations lead does too, as Move to alumni already let
 * them (#201). A head reaches their departments, a division lead their
 * divisions.
 */
export type TeamActor =
  | { readonly kind: "team" }
  | { readonly kind: "head"; readonly departmentIds: readonly number[] }
  | { readonly kind: "lead"; readonly divisionIds: readonly number[] };

/** Whether an action is open to the actor; when it is not, the reason the menu shows beside the lock. */
export type Permission = { readonly allowed: true } | { readonly allowed: false; readonly reason: string };

const ALLOWED: Permission = { allowed: true };

function denied(reason: string): Permission {
  return { allowed: false, reason };
}

function departmentOfDivision(org: OrgChart, divisionId: number): OrgDepartment | null {
  const departmentId = org.divisions.find((d) => d.id === divisionId)?.departmentId;
  return org.departments.find((d) => d.id === departmentId) ?? null;
}

/** "the Head of Aerodynamics" when every division is in one department, else "the team leader". */
function whoReachesAll(memberships: Memberships, org: OrgChart): string {
  const departments = new Set(memberships.map((m) => departmentOfDivision(org, m.divisionId)?.id ?? null));
  const [only] = [...departments];
  const department = departments.size === 1 && only !== null ? org.departments.find((d) => d.id === only) : undefined;
  return department ? `the Head of ${department.name}` : "the team leader";
}

function divisionName(org: OrgChart, divisionId: number): string {
  return divisionLabel(org.divisions.find((d) => d.id === divisionId)?.name ?? "another division");
}

/**
 * A role beyond every division's reach: the team leader, a board seat, a
 * department head (wherever its row is kept), an Advisor role kept on a
 * department or on the team, any other role kept on a department, or any
 * other role kept on the team. "Leaves the team" ends
 * these too, and no division lead or department head reaches them.
 */
export type RoleBeyondDivisions =
  | { readonly kind: "team-leader" }
  | { readonly kind: "board"; readonly seat: BoardSeat }
  /** Null department when the row names none on the chart (`headDepartmentOf`). */
  | { readonly kind: "head"; readonly departmentId: number | null }
  | { readonly kind: "department"; readonly departmentId: number }
  /** An Advisor role (issue #253) kept on a department (a former head's) or on the whole team (null: a former team leader's). */
  | { readonly kind: "advisor"; readonly departmentId: number | null }
  | { readonly kind: "team"; readonly title: string };

/** One active `roles` row with where it sits, as both data sources read it. */
export type RoleSeat = RoleHeld & {
  /** The department it is kept on; null for a role in a division or on the whole team. */
  readonly departmentId: number | null;
  readonly title: string;
};

/**
 * The department a `head` role heads: the one its row names, else the
 * department of the division its row is kept on. The actor reader, the roster
 * placement and "Leaves the team" all read a head by this one rule.
 */
export function headDepartmentOf(role: Pick<RoleSeat, "departmentId" | "divisionId">, org: OrgChart): number | null {
  return role.departmentId ?? org.divisions.find((d) => d.id === role.divisionId)?.departmentId ?? null;
}

/**
 * The role as one beyond every division's reach, in the order the roster
 * places someone: the team leader, a board seat (a titled role in no
 * department or division), a department head wherever its row is kept
 * (`headDepartmentOf`), then any other role in no division. Null for any other
 * role in a division.
 */
export function roleBeyondDivisions(role: RoleSeat, org: OrgChart): RoleBeyondDivisions | null {
  if (role.type === "president") return { kind: "team-leader" };
  const seat = role.departmentId === null && role.divisionId === null ? boardSeatOf(role.title) : null;
  if (seat !== null) return { kind: "board", seat };
  if (role.type === "head") return { kind: "head", departmentId: headDepartmentOf(role, org) };
  if (role.divisionId !== null) return null;
  if (role.type === "advisor") return { kind: "advisor", departmentId: role.departmentId };
  if (role.departmentId !== null) return { kind: "department", departmentId: role.departmentId };
  return { kind: "team", title: role.title.trim() };
}

/** Everything "Leaves the team" ends: every division someone is in, and every role they hold in no division. */
export type TeamStanding = {
  readonly memberships: Memberships;
  readonly beyond: readonly RoleBeyondDivisions[];
};

/**
 * Someone's standing from all their active roles: their division roles as
 * memberships (`isDivisionRole`) and every seat beyond them
 * (`roleBeyondDivisions`). A seat kept on a division row is the seat, never a
 * membership, as the roster reads it.
 */
export function standingOfRoles(roles: readonly RoleSeat[], org: OrgChart): TeamStanding {
  return { memberships: membershipsOfRoles(roles.filter(isDivisionRole)), beyond: roles.flatMap((r) => roleBeyondDivisions(r, org) ?? []) };
}

/**
 * Whether someone may leave one division and keep their place on the team:
 * when they are in another division, or hold a seat (Owner decision,
 * 2026-10-11, on #232). Nobody is on the team with neither.
 */
export function mayLeaveDivision(standing: TeamStanding, divisionId: number): boolean {
  return standing.beyond.length > 0 || standing.memberships.some((m) => m.divisionId !== divisionId);
}

/** Someone's standing from where they sit on the roster: their seat, if any, and every division they are in. */
export function standingOfPlacement(placement: Placement): TeamStanding {
  const { memberships } = placement;
  switch (placement.role) {
    case "team-leader":
      return { memberships, beyond: [{ kind: "team-leader" }] };
    case "board":
      return { memberships, beyond: [{ kind: "board", seat: placement.seat }] };
    case "head":
      return { memberships, beyond: [{ kind: "head", departmentId: placement.departmentId }] };
    case "divisions":
      return { memberships, beyond: [] };
  }
}

/** "Team Leader", "Project Manager", "Head of Aerodynamics": the role as a title names it. */
export function beyondTitle(role: RoleBeyondDivisions, org: OrgChart): string {
  switch (role.kind) {
    case "team-leader":
      return "Team Leader";
    case "head": {
      const name = org.departments.find((d) => d.id === role.departmentId)?.name;
      return name ? `Head of ${name}` : "Head";
    }
    case "department":
      return org.departments.find((d) => d.id === role.departmentId)?.name ?? "Department";
    case "advisor":
      return "Advisor";
    default:
      return beyondLabel(role, org);
  }
}

/** "the team leader", "Project Manager", "Head of Aerodynamics", "in Aerodynamics": what the lock reason says they also are. */
function beyondLabel(role: RoleBeyondDivisions, org: OrgChart): string {
  switch (role.kind) {
    case "team-leader":
      return "the team leader";
    case "board":
      return BOARD_SEAT_TITLES[role.seat];
    case "head": {
      const name = org.departments.find((d) => d.id === role.departmentId)?.name;
      return name ? `Head of ${name}` : "a department head";
    }
    case "department": {
      const name = org.departments.find((d) => d.id === role.departmentId)?.name;
      return name ? `in ${name}` : "in a department";
    }
    case "advisor": {
      const name = org.departments.find((d) => d.id === role.departmentId)?.name;
      return name ? `an advisor in ${name}` : "an advisor to the team";
    }
    case "team":
      return role.title === "" ? "on the board" : role.title;
  }
}

/**
 * "Leaves the team" (Owner decision, 2026-10-11): a division lead may use it
 * only when the person is in no division outside the lead's own; a department
 * head only when all the person's divisions are in the head's department; the
 * team leader always. A role beyond every division (team leader, board seat,
 * department head wherever its row is kept, any other department or team
 * role) is outside every lead's and head's reach, so only the team leader (or
 * the operations lead) can move someone who holds one (#231, review rounds 1
 * and 2). Otherwise the
 * reason names what stops it and who can do it instead. The menu shows this
 * and the server checks it on every request.
 */
export function mayLeaveTeam(actor: TeamActor, standing: TeamStanding, org: OrgChart): Permission {
  if (actor.kind === "team") return ALLOWED;
  const [beyond] = standing.beyond;
  if (beyond !== undefined) return denied(`Also ${beyondLabel(beyond, org)}, so only the team leader can do this`);
  const person = standing.memberships;
  if (person.length === 0) return denied("Only the team leader can do this");
  const outside = person.find((m) =>
    actor.kind === "lead"
      ? !actor.divisionIds.includes(m.divisionId)
      : !actor.departmentIds.includes(departmentOfDivision(org, m.divisionId)?.id ?? -1),
  );
  if (outside === undefined) return ALLOWED;
  const who = actor.kind === "lead" ? whoReachesAll(person, org) : "the team leader";
  return denied(`Also in ${divisionName(org, outside.divisionId)}, so only ${who} can do this`);
}

/**
 * "Remove from <division>" on a row (Owner decision, 2026-10-11): it ends
 * only that division's role. It is not offered for someone whose only
 * division it is and who holds no seat (nobody is on the team with neither:
 * they can only leave it, `mayLeaveDivision`), and a division lead cannot take
 * a lead out, since only the head changes a division's leads.
 */
export type Removal =
  | { readonly kind: "offered" }
  | { readonly kind: "only-division" }
  | { readonly kind: "locked"; readonly reason: string }
  | { readonly kind: "not-in-reach" };

export function removalFrom(actor: TeamActor, person: TeamStanding, divisionId: number, org: OrgChart): Removal {
  const role = roleIn(person.memberships, divisionId);
  if (role === null || !reachesDivision(actor, divisionId, org)) return { kind: "not-in-reach" };
  if (!mayLeaveDivision(person, divisionId)) return { kind: "only-division" };
  if (role === "lead") {
    const change = mayChangeDivision(actor, divisionId, org);
    if (!change.allowed) return { kind: "locked", reason: change.reason };
  }
  return { kind: "offered" };
}

/** Whether the actor's Members page reaches the division: theirs as lead, their department's as head, any as the team. */
export function reachesDivision(actor: TeamActor, divisionId: number, org: OrgChart): boolean {
  if (actor.kind === "team") return true;
  if (actor.kind === "lead") return actor.divisionIds.includes(divisionId);
  return actor.departmentIds.includes(departmentOfDivision(org, divisionId)?.id ?? -1);
}

/** The line under a lead's Members header: "Leads are changed by the Head of Aerodynamics". */
export function leadsChangedBy(divisionId: number, org: OrgChart): string {
  const department = departmentOfDivision(org, divisionId);
  return `Leads are changed by ${department ? `the Head of ${department.name}` : "the team leader"}`;
}

/**
 * Renaming a division, changing its code or changing its leads (Owner
 * decision, 2026-10-11): only the head of its department, or the team. A
 * division lead never can, even of their own division; the reason is the
 * line their page shows.
 */
export function mayChangeDivision(actor: TeamActor, divisionId: number, org: OrgChart): Permission {
  if (actor.kind === "lead") return denied(leadsChangedBy(divisionId, org));
  return reachesDivision(actor, divisionId, org) ? ALLOWED : denied("Only the team leader can do this");
}

// Promoted notices and Move to alumni (boards 59e and 59d)

/**
 * How a stored "promoted" notice (#188) says the person was promoted: beside
 * the lead, or taking the division over. Promote itself is gone (#551); the
 * notices it wrote can still be read.
 */
export const PROMOTE_MODES = ["together", "hand-over"] as const;
export type PromoteMode = (typeof PROMOTE_MODES)[number];

export function isPromoteMode(value: unknown): value is PromoteMode {
  return typeof value === "string" && (PROMOTE_MODES as readonly string[]).includes(value);
}

/** Why someone left, as the Move to alumni confirm offers it (board 59d). Optional. */
export const LEAVE_REASONS = ["graduated", "studying-abroad", "no-time", "other"] as const;
export type LeaveReason = (typeof LEAVE_REASONS)[number];

export const LEAVE_REASON_LABELS: Readonly<Record<LeaveReason, string>> = {
  graduated: "Graduated",
  "studying-abroad": "Studying abroad",
  "no-time": "No time left",
  other: "Other",
};

/**
 * Moving someone to alumni (board 59d): the years they were on the team, and
 * why they left when the lead says. Their roles end and their access goes;
 * their account stays, so they can still sign in and apply again.
 */
export type Departure = {
  readonly from: number;
  readonly to: number;
  readonly reason: LeaveReason | null;
};

/** The earliest year a Move to alumni accepts. */
export const FIRST_SEASON = 2010;

/** "2024 – 2026" for the years field. */
export function yearsLabel(from: number, to: number): string {
  return from === to ? String(from) : `${from} – ${to}`;
}

/** The years field as the lead typed it: "2024 – 2026", "2024-2026", or one year. */
export function parseYears(text: string): { from: number; to: number } | null {
  const match = /^\s*(\d{4})\s*(?:[-–—]\s*(\d{4}))?\s*$/.exec(text);
  if (!match) return null;
  const from = Number(match[1]);
  return { from, to: match[2] === undefined ? from : Number(match[2]) };
}

/**
 * Checks a Move to alumni request: years in order, none after this year and
 * none before the team's first season; a reason from the list or none. Runs
 * in the browser and again on the server.
 */
export function checkDeparture(
  input: { years: string; reason: string | null },
  thisYear: number,
): { ok: true; value: Departure } | { ok: false; error: string } {
  const years = parseYears(input.years);
  if (years === null) return { ok: false, error: "Write the years like 2024 – 2026." };
  if (years.from > years.to) return { ok: false, error: "The first year comes before the last." };
  if (years.from < FIRST_SEASON || years.to > thisYear) {
    return { ok: false, error: `Use years from ${FIRST_SEASON} to ${thisYear}.` };
  }
  const reason = input.reason === null || input.reason === "" ? null : input.reason;
  if (reason !== null && !(LEAVE_REASONS as readonly string[]).includes(reason)) {
    return { ok: false, error: "Choose a reason from the list." };
  }
  return { ok: true, value: { from: years.from, to: years.to, reason: reason as LeaveReason | null } };
}

/** A name or email holds every word of the query, in any case. */
export function matchesQuery(fields: readonly string[], query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = fields.join(" ").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/** The team year a date falls in, on Turin's clock: a year runs from 1 October, so 9 Oct 2026 gives "2026–27". */
export function seasonAt(date: Date): string {
  return shortAcademicYearLabel(academicYearStart(date));
}

// Paging (boards 46 and 46c)

/** Every paged dashboard list shows 12 rows a page (Owner decision, 2026-10-21). */
export const PAGE_SIZE = 12;

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function pageOf<T>(rows: readonly T[], page: number, size = PAGE_SIZE): T[] {
  const last = pageCount(rows.length, size);
  const current = Math.min(Math.max(1, page), last);
  return rows.slice((current - 1) * size, current * size);
}

/**
 * The page numbers a pager shows: the first three, the current one and its
 * neighbours, and the last, with null for each gap ("1 2 3 … 12").
 */
export function pagerItems(current: number, last: number): (number | null)[] {
  const keep = new Set([1, 2, 3, current - 1, current, current + 1, last]);
  const pages = [...keep].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? [null, p] : [p]));
}

// Team tree (boards 54c and 54c-m)

/**
 * One place a person is drawn on the tree. Someone in several divisions is
 * drawn in each of them, like anyone else there (Owner decision, 2026-10-19,
 * on #398), so one person can be several of these.
 */
export type TreePerson = {
  readonly id: number;
  readonly name: string;
  /** The viewer: marked "YOU" and on the highlighted path. */
  readonly self: boolean;
  /**
   * Whether this is their first place: their seat, else the division they
   * are first in by `homeDivision` (their highest role, then their earliest
   * division). "Find someone", "Show me" and the viewer's path go only here.
   */
  readonly first: boolean;
};

export type TreeDivision = {
  readonly id: number;
  readonly name: string;
  /** Its lead; when several lead it, one whose first place it is, and the others are listed with the members. */
  readonly lead: TreePerson | null;
  /** Everyone else in it, by name, whatever other divisions or seat they hold. */
  readonly members: readonly TreePerson[];
  /** Everyone in it, lead included. */
  readonly size: number;
};

export type TreeDepartment = {
  readonly id: number;
  readonly name: string;
  readonly head: TreePerson | null;
  readonly divisions: readonly TreeDivision[];
  /** Everyone in it, head included. */
  readonly size: number;
};

/** Someone in a board seat, under the team leader and over the heads. */
export type TreeBoardMember = { readonly seat: BoardSeat; readonly person: TreePerson };

export type TeamTree = {
  /** "2026–27" */
  readonly season: string;
  readonly leader: TreePerson | null;
  /** The Project Manager, then the Chief Engineer: whoever holds each seat. */
  readonly board: readonly TreeBoardMember[];
  readonly departments: readonly TreeDepartment[];
  /** Everyone on the roster. */
  readonly size: number;
  /** The viewer's place, for the highlighted path; null when they are not in a division or department. */
  readonly path: { readonly departmentId: number; readonly divisionId: number | null } | null;
};

/**
 * The tree of this year's roster as `selfId` sees it. Departments and
 * divisions with nobody in them are left out. Each division lists everyone in
 * it, so someone in several divisions is drawn in each (Owner decision,
 * 2026-10-19, on #398); their first place is their seat, else their home
 * division (`homeDivision`).
 */
export function buildTeamTree(
  roster: readonly RosterEntry[],
  org: OrgChart,
  season: string,
  selfId: number | null,
): TeamTree {
  const visible = new Set(org.divisions.map((d) => d.id));
  // The home rule over the divisions still open: a closed home division is not drawn.
  // A seat or a head is first at that seat: null here.
  const firstDivision = (entry: RosterEntry): number | null =>
    entry.placement.role !== "divisions"
      ? null
      : homeDivision(membershipsOf(entry.placement.memberships.filter((m) => visible.has(m.divisionId))));
  /** Them as drawn in `divisionId`, or at their seat for null. */
  const node = (entry: RosterEntry, divisionId: number | null): TreePerson => ({
    id: entry.id,
    name: entry.name,
    self: entry.id === selfId,
    first: firstDivision(entry) === divisionId,
  });
  const byName = (a: RosterEntry, b: RosterEntry) => a.name.localeCompare(b.name);

  const departments = org.departments.flatMap((department): TreeDepartment[] => {
    const head = roster.find((e) => e.placement.role === "head" && e.placement.departmentId === department.id);
    const divisions = org.divisions
      .filter((d) => d.departmentId === department.id)
      .flatMap((division): TreeDivision[] => {
        const inDivision = roster.filter((e) => isIn(e.placement, division.id));
        if (inDivision.length === 0) return [];
        const leads = inDivision.filter((e) => roleIn(membershipsIn(e.placement), division.id) === "lead");
        const lead = leads.find((e) => firstDivision(e) === division.id) ?? leads[0];
        const members = inDivision.filter((e) => e !== lead).sort(byName);
        return [
          {
            id: division.id,
            name: division.name,
            lead: lead ? node(lead, division.id) : null,
            members: members.map((e) => node(e, division.id)),
            size: inDivision.length,
          },
        ];
      });
    // Someone in two of its divisions counts once, and its head once, also when they lead one of them.
    const people = new Set(roster.filter((e) => e !== head && divisions.some((d) => isIn(e.placement, d.id))).map((e) => e.id));
    const size = (head ? 1 : 0) + people.size;
    return size === 0 ? [] : [{ id: department.id, name: department.name, head: head ? node(head, null) : null, divisions, size }];
  });

  const leader = roster.find((e) => e.placement.role === "team-leader");
  const board = BOARD_SEATS.flatMap((seat): TreeBoardMember[] => {
    const holder = roster.find((e) => e.placement.role === "board" && e.placement.seat === seat);
    return holder ? [{ seat, person: node(holder, null) }] : [];
  });
  const me = roster.find((e) => e.id === selfId);
  const myDivision = me ? firstDivision(me) : null;
  const myDepartment =
    me?.placement.role === "head" ? me.placement.departmentId : (org.divisions.find((d) => d.id === myDivision)?.departmentId ?? null);
  return {
    season,
    leader: leader ? node(leader, null) : null,
    board,
    departments,
    size: roster.length,
    path: myDepartment !== null ? { departmentId: myDepartment, divisionId: myDivision } : null,
  };
}

/** A division as the tree names it: "Mission Analysis Division" reads "Mission Analysis" (board 54c). */
export function divisionLabel(name: string): string {
  return name.replace(/\s+Division$/i, "");
}
