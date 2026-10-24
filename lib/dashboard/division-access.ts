import { z } from "zod";
import { checkApproveOrdersChange, type ApproveOrdersChange } from "./orders";
import { boardFlagOf } from "./team";
import type { FullAccessSeat } from "./viewer";

// The Access page (boards 60, 60b, 60c and 60m for a division lead, issues
// #145 and #213; boards 65, 65b and 65m for a department head, issue #230;
// the same page across the whole team for full access, issue #238):
// what the viewer may do in their unit, who holds access there with their
// role, who the viewer shared it with, and the Give access and Edit access
// rules. Each person holds each area at one level or not at all, in each
// place: one division, a whole department, or (from full access, issue #247)
// the whole team. A viewer shares only what they hold, never more than they
// hold it, and only inside their own unit: a lead who can view Members cannot
// give anyone edit on Members, and a head gives nothing outside their
// department. Access that comes with a role is shown locked and never changes
// here. The team leader's page adds "Approve orders" (boards 71 and 71b,
// issue #247). Content (issue #504) is given across the whole team at Can
// edit only, by full access or by someone who holds Content. Alumni has no
// area of its own: the Alumni page is site content under Content (Owner
// decision, 2026-10-22, issue #589).

/** The areas a lead or head shares inside their unit: the `scopes.target` values of a division or department grant. */
export const UNIT_TARGETS = ["positions", "applications", "members", "orders"] as const;
export type UnitTarget = (typeof UNIT_TARGETS)[number];

/**
 * Every area the Access page gives, in board 71b's order: the unit areas and
 * Content (Owner decision, 2026-10-21, issue #504), which opens the Projects,
 * Outreach, Partners, Alumni, FAQ and Team page editors (Owner decision,
 * 2026-10-22, issue #589). Content has no unit: it is given across the whole
 * team or not at all.
 */
export const ACCESS_TARGETS = ["positions", "applications", "members", "content", "orders"] as const;
export type AccessTarget = (typeof ACCESS_TARGETS)[number];

export const ACCESS_TARGET_LABELS: Readonly<Record<AccessTarget, string>> = {
  positions: "Positions",
  applications: "Applications",
  members: "Members",
  content: "Content",
  orders: "Orders",
};

/** The areas given across the whole team only, never in a department or a division. */
export const TEAM_ONLY_TARGETS = ["content"] as const satisfies readonly AccessTarget[];

/** `scopes.access_level`: the two levels. */
export const ACCESS_LEVELS = ["view", "edit"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/**
 * The levels an area is given at: both on every area but Content, which is
 * edit-only (issue #504). A drawer shows no level toggle for an area with
 * one level, and the server refuses any other.
 */
export function levelsOf(target: AccessTarget): readonly AccessLevel[] {
  return target === "content" ? ["edit"] : ACCESS_LEVELS;
}

export const ACCESS_LEVEL_LABELS: Readonly<Record<AccessLevel, string>> = {
  view: "Can view",
  edit: "Can edit",
};

/** The level on a phone card under "Your access" (board 60m): "View", "Edit". */
export const ACCESS_LEVEL_SHORT_LABELS: Readonly<Record<AccessLevel, string>> = {
  view: "View",
  edit: "Edit",
};

/** What Can view and Can edit open, as the drawers say it (boards 60b and 60c). */
export const ACCESS_LEVELS_EXPLAINED =
  "Can view lets them see an area. Can edit also lets them change it: edit positions, move and decide applications, update members, or request orders.";

/** The level held on each area; an area left out is not held. */
export type AreaLevels = Readonly<Partial<Record<AccessTarget, AccessLevel>>>;

export type AccessDivision = {
  readonly id: number;
  /** "Mission Analysis Division" */
  readonly name: string;
};

export type AccessDepartment = {
  readonly id: number;
  /** "Aerodynamics" */
  readonly name: string;
};

/** "Mission Analysis Division" reads "Mission Analysis" in a table cell. */
export function shortUnitName(name: string): string {
  return name.replace(/\s+Division$/, "");
}

/** "Aerodynamics" reads "Aerodynamics Department". */
export function departmentName(department: AccessDepartment): string {
  return /\bDepartment$/.test(department.name) ? department.name : `${department.name} Department`;
}

/** A department with its open divisions, in the order its tabs show them. */
export type AccessDepartmentUnit = {
  readonly department: AccessDepartment;
  readonly divisions: readonly AccessDivision[];
};

/** One division a lead's Access page covers, and what the lead holds in it ("Your access" on board 60). */
export type LedDivision = {
  readonly division: AccessDivision;
  readonly held: readonly HeldAccess[];
};

/**
 * The unit an Access page is about: every division a lead leads, never none
 * (issue #185: one list, as board 71's team page is), a head's department
 * with its open divisions, or, with full access (issue #238), the whole team:
 * every open department with its open divisions, by name. A lead or head who
 * holds a Content grant (`content`, issue #504) also gives Content across the
 * whole team; full access always does.
 */
export type AccessUnit =
  | { readonly kind: "division"; readonly divisions: readonly [LedDivision, ...LedDivision[]]; readonly content?: true }
  | ({ readonly kind: "department"; readonly content?: true } & AccessDepartmentUnit)
  | { readonly kind: "team"; readonly departments: readonly AccessDepartmentUnit[] };

/**
 * Where a grant applies: one division, a whole department (a `scopes` row
 * with only `dept_id` set), or, given from full access, the whole team (a
 * `team` row in no unit, issue #247), every department and any added later.
 */
export type AccessPlace =
  | { readonly kind: "division"; readonly division: AccessDivision }
  | { readonly kind: "department"; readonly department: AccessDepartment }
  | { readonly kind: "team" };

/** The whole team as a place. */
export const WHOLE_TEAM_PLACE = { kind: "team" } as const satisfies AccessPlace;

/** The areas a place offers: every area across the whole team, the unit areas in a department or a division. */
export function targetsAt(place: AccessPlace): readonly AccessTarget[] {
  return place.kind === "team" ? ACCESS_TARGETS : UNIT_TARGETS;
}

function departmentPlaces(unit: AccessDepartmentUnit): AccessPlace[] {
  return [
    { kind: "department", department: unit.department },
    ...unit.divisions.map((division): AccessPlace => ({ kind: "division", division })),
  ];
}

/**
 * The places a viewer gives access in: each division they lead; or their whole
 * department, then each of its divisions; or, from full access, the whole
 * team, then each department in turn, whole and then each of its divisions
 * (board 71b). A lead or head who holds Content has the whole team last,
 * where they give Content alone (issue #504).
 */
export function placesOf(unit: AccessUnit): AccessPlace[] {
  switch (unit.kind) {
    case "division":
      return [...unit.divisions.map(({ division }): AccessPlace => ({ kind: "division", division })), ...contentPlace(unit)];
    case "department":
      return [...departmentPlaces(unit), ...contentPlace(unit)];
    case "team":
      return [WHOLE_TEAM_PLACE, ...unit.departments.flatMap(departmentPlaces)];
  }
}

function contentPlace(unit: { readonly content?: true }): AccessPlace[] {
  return unit.content === true ? [WHOLE_TEAM_PLACE] : [];
}

/** The place Give access starts on: the lead's first division, the head's whole department, the whole team from full access. */
export function homePlace(unit: AccessUnit): AccessPlace {
  return placesOf(unit)[0];
}

/** The department a place is in on a team page (issue #238); null when the unit is not the team or holds no such place. */
export function departmentOfPlace(unit: AccessUnit, place: AccessPlace): AccessDepartment | null {
  if (unit.kind !== "team" || place.kind === "team") return null;
  const found = unit.departments.find((d) =>
    place.kind === "department" ? d.department.id === place.department.id : d.divisions.some((v) => v.id === place.division.id),
  );
  return found?.department ?? null;
}

/** What the drawers send for a place: "team", "department-<id>", or the division's id. */
export type PlaceKey = "team" | `department-${number}` | number;

export function placeKey(place: AccessPlace): PlaceKey {
  switch (place.kind) {
    case "team":
      return "team";
    case "department":
      return `department-${place.department.id}`;
    case "division":
      return place.division.id;
  }
}

export function samePlace(a: AccessPlace, b: AccessPlace): boolean {
  return placeKey(a) === placeKey(b);
}

/** "Mission Analysis Division", "Aerodynamics Department, all divisions" or "Whole team" under an area in a drawer. */
export function placeLine(place: AccessPlace): string {
  switch (place.kind) {
    case "team":
      return "Whole team";
    case "department":
      return `${departmentName(place.department)}, all divisions`;
    case "division":
      return place.division.name;
  }
}

/** The unit as "Your access" names it (boards 60 and 65): every division a lead leads; on a team page, "the whole team". */
export function unitLine(unit: AccessUnit): string {
  switch (unit.kind) {
    case "team":
      return "the whole team";
    case "division":
      return unit.divisions.length === 1 ? unit.divisions[0].division.name : unit.divisions.map((d) => shortUnitName(d.division.name)).join(", ");
    case "department":
      return placeLine(homePlace(unit));
  }
}

/** One area the viewer holds in their unit (a chip under "Your access"). */
export type HeldAccess = {
  readonly target: AccessTarget;
  readonly level: AccessLevel;
};

/** A head's role holds every unit area at Can edit across their department (board 65). */
export const ROLE_HELD_ACCESS: readonly HeldAccess[] = UNIT_TARGETS.map((target) => ({ target, level: "edit" }));

/**
 * The areas a division lead's role gives in each division they lead, at Can
 * edit: the "Whole division · Can edit" role row (#596 finding 2). Orders is
 * among them, since the role edits the division's orders (#590, #632).
 */
export const LEAD_ROLE_TARGETS = ["positions", "applications", "members", "orders"] as const satisfies readonly UnitTarget[];

/** What a lead's role holds in each division they lead (`LEAD_ROLE_TARGETS`). */
export const LEAD_ROLE_HELD_ACCESS: readonly HeldAccess[] = LEAD_ROLE_TARGETS.map((target) => ({ target, level: "edit" }));

/** Both sets of areas together, each area once at the higher of its levels, in `ACCESS_TARGETS` order. */
export function mergeHeld(a: readonly HeldAccess[], b: readonly HeldAccess[]): HeldAccess[] {
  return ACCESS_TARGETS.flatMap((target) => {
    const level = heldLevel([...a, ...b], target);
    return level === null ? [] : [{ target, level }];
  });
}

/** Full access holds every area at Can edit across the team (issue #238), Content (#504) included. */
export const FULL_HELD_ACCESS: readonly HeldAccess[] = ACCESS_TARGETS.map((target) => ({ target, level: "edit" }));

/** A Content grant: Content at Can edit across the whole team (issue #504). */
export const CONTENT_HELD_ACCESS: readonly HeldAccess[] = [{ target: "content", level: "edit" }];

/**
 * What the viewer holds in one place of their unit: every area at Can edit
 * from full access, a head's role areas across their department, or what a
 * lead holds in that one division; across the whole team, a lead's or head's
 * Content grant; nothing in a place outside the unit.
 */
export function heldIn(unit: AccessUnit, place: AccessPlace): readonly HeldAccess[] {
  if (unit.kind === "team") return FULL_HELD_ACCESS;
  if (place.kind === "team") return unit.content === true ? CONTENT_HELD_ACCESS : [];
  if (unit.kind === "department") return ROLE_HELD_ACCESS;
  return place.kind === "division" ? (unit.divisions.find((d) => d.division.id === place.division.id)?.held ?? []) : [];
}

/** One line of "Your access": where it holds, and the areas held there. */
export type HeldLine = {
  /** "Mission Analysis Division", "Mission Analysis, Optimization and Analysis", "Aerodynamics Department, all divisions", "the whole team" */
  readonly where: string;
  readonly held: readonly HeldAccess[];
};

/**
 * "Your access", line by line: one for a head's or a team page; on a lead's
 * page one per set of areas, naming every division that holds that set, so a
 * lead who holds the same in each division reads one line (issue #185).
 * Divisions where the lead holds nothing are left out. A lead's or head's
 * Content grant is a last line of its own, across the whole team.
 */
export function heldLines(unit: AccessUnit): HeldLine[] {
  if (unit.kind === "team") return [{ where: unitLine(unit), held: heldIn(unit, homePlace(unit)) }];
  const content = unit.content === true ? [{ where: unitLine({ kind: "team", departments: [] }), held: CONTENT_HELD_ACCESS }] : [];
  if (unit.kind === "department") return [{ where: unitLine(unit), held: heldIn(unit, homePlace(unit)) }, ...content];
  const keyOf = (held: readonly HeldAccess[]) => ACCESS_TARGETS.map((t) => heldLevel(held, t) ?? "-").join(",");
  const groups = new Map<string, LedDivision[]>();
  for (const led of unit.divisions) {
    if (led.held.length === 0) continue;
    groups.set(keyOf(led.held), [...(groups.get(keyOf(led.held)) ?? []), led]);
  }
  const divisionLines = [...groups.values()].map(([first, ...rest]) => ({
    where: unitLine({ kind: "division", divisions: [first, ...rest] }),
    held: first.held,
  }));
  return [...divisionLines, ...content];
}

/** Whether the viewer holds anything to give in some place of their unit: Give access and "Your access" show only then. */
export function holdsAny(unit: AccessUnit): boolean {
  return placesOf(unit).some((place) => heldIn(unit, place).length > 0);
}

/** Whether `held` is every area at Can edit: "Your access" then reads "Every area · Can edit" (board 71). */
export function holdsEveryArea(held: readonly HeldAccess[]): boolean {
  return ACCESS_TARGETS.every((target) => heldLevel(held, target) === "edit");
}

/** A lead or head of the unit, whose access comes with the role, or anyone else in it. */
export const PERSON_STANDINGS = ["lead", "member"] as const;
export type PersonStanding = (typeof PERSON_STANDINGS)[number];

export const PERSON_STANDING_LABELS: Readonly<Record<PersonStanding, string>> = {
  lead: "Lead",
  member: "Member",
};

/**
 * What a person's role gives them on an Access page, which no grant adds to
 * and nothing on the page changes (issue #591): nothing for a member; a
 * division lead's `LEAD_ROLE_TARGETS` in each division of the unit they lead;
 * a head's every unit area across their department and each of its
 * divisions; every area across the team for a full-access seat. Every other
 * area, in every other place, is a grant like anyone's.
 */
export type PersonRole =
  | { readonly kind: "member" }
  | { readonly kind: "lead"; readonly divisions: readonly [AccessDivision, ...AccessDivision[]] }
  /** `title`: the head role's stored title (`headTitleOf`), written under the name (issue #625). */
  | { readonly kind: "head"; readonly department: AccessDepartmentUnit; readonly title: string }
  /** `title`: the seat's line under the name (`seatLine`, issue #625). */
  | { readonly kind: "full"; readonly seat: FullAccessSeat; readonly title: string };

export const NO_ROLE = { kind: "member" } as const satisfies PersonRole;

export type AccessPerson = {
  readonly id: number;
  readonly name: string;
  /** Their stored photo, wherever the page names them (issue #656); null for the PRT mark. */
  readonly photoUrl: string | null;
  /** What their role gives them here (`roleCovers`). */
  readonly role: PersonRole;
  /** The division they are in; null for someone placed in none, such as another head. */
  readonly division: AccessDivision | null;
};

/** "Lead" for anyone whose role gives access here, else "Member". */
export function standingOf(person: AccessPerson): PersonStanding {
  return person.role.kind === "member" ? "member" : "lead";
}

/** Whether the person's role already gives `target` in `place`: that area there is locked, never a grant (issue #591). */
export function roleCovers(person: AccessPerson, place: AccessPlace, target: AccessTarget): boolean {
  const role = person.role;
  switch (role.kind) {
    case "member":
      return false;
    case "full":
      return true;
    case "lead":
      return place.kind === "division" && role.divisions.some((d) => d.id === place.division.id) && (LEAD_ROLE_TARGETS as readonly AccessTarget[]).includes(target);
    case "head":
      if (!(UNIT_TARGETS as readonly AccessTarget[]).includes(target)) return false;
      if (place.kind === "department") return place.department.id === role.department.department.id;
      return place.kind === "division" && role.department.divisions.some((d) => d.id === place.division.id);
  }
}

/**
 * The access a person's role gives, as the page's locked "With the role"
 * rows: one per division a lead leads, a head's whole department, a
 * full-access seat's whole team; none for a member.
 */
export function roleAccessOf(person: AccessPerson): RoleAccess[] {
  const role = person.role;
  switch (role.kind) {
    case "member":
      return [];
    case "full":
      return [{ person, place: WHOLE_TEAM_PLACE, seat: role.seat, title: role.title }];
    case "head":
      return [{ person, place: { kind: "department", department: role.department.department }, title: role.title }];
    case "lead":
      return role.divisions.map((division) => ({ person, place: { kind: "division", division } }));
  }
}

/** One stored grant: one person, one area, one level, in one place, and who gave it. */
export type AccessGrant = {
  readonly id: number;
  readonly person: AccessPerson;
  readonly place: AccessPlace;
  readonly target: AccessTarget;
  readonly level: AccessLevel;
  /** "You" when the viewer gave it, else the giver's name; null when nobody is on record. */
  readonly givenBy: string | null;
  /** ISO date; null when no date is on record. */
  readonly givenOn: string | null;
};

/**
 * Access that comes with a role, shown "With the role" and locked: a lead's
 * or co-lead's whole division, a head's whole department (boards 60 and 65),
 * or, on a team page, a full-access seat's whole team (board 71, issue #247).
 * It is no grant, so nothing on the page changes it. A head's and a seat's row
 * carry the `title` the page writes under the name (issue #625): a head's is
 * their head role's stored title (`headTitleOf`), a seat's is `seatLine`'s.
 */
export type RoleAccess =
  | { readonly person: AccessPerson; readonly place: Extract<AccessPlace, { kind: "division" }> }
  | { readonly person: AccessPerson; readonly place: Extract<AccessPlace, { kind: "department" }>; readonly title: string }
  | { readonly person: AccessPerson; readonly place: { readonly kind: "team" }; readonly seat: FullAccessSeat; readonly title: string };

/**
 * The division a role row stands in: the one the role leads, else the
 * person's own. A lead of two divisions has a role row in each, and each
 * names and files under its own division, never the person's primary one (issue #185).
 */
export function roleDivision(role: RoleAccess): AccessDivision | null {
  return role.place.kind === "division" ? role.place.division : role.person.division;
}

/** The seat under a full-access person's name (board 71): "Operations lead", "IT lead". */
export const SEAT_LABELS: Readonly<Record<FullAccessSeat, string>> = {
  "team-leader": "Team leader",
  "operations-lead": "Operations lead",
  "it-lead": "IT lead",
  "project-manager": "Project Manager",
  "chief-engineer": "Chief Engineer",
};

/**
 * The line under a full-access person's name: a team-level seat's (the
 * Project Manager's, the Chief Engineer's) role title as stored on its
 * flagged row, the seat's name for a blank one; any other seat's name
 * (`SEAT_LABELS`), as that seat is not its row's title (issue #625).
 */
export function seatLine(seat: FullAccessSeat, storedTitle: string): string {
  const stored = storedTitle.trim();
  const teamLevel = seat !== "team-leader" && boardFlagOf(seat) !== null;
  return teamLevel && stored !== "" ? stored : SEAT_LABELS[seat];
}

/**
 * Only the team leader gives or removes "Approve orders" (issue #233): the
 * checkbox renders for them alone (board 71b), and the server refuses it from
 * anyone else (`checkApproveOrdersChange`, ./orders.ts).
 */
export function canGiveApproveOrders(seat: FullAccessSeat | null): boolean {
  return seat === "team-leader";
}

/** Someone the team leader gave "Approve orders", with who gave it and when. */
export type ApproveOrdersHolder = {
  readonly person: AccessPerson;
  /** "You" when the viewer gave it, else the giver's name; null when nobody is on record. */
  readonly givenBy: string | null;
  /** ISO date; null when no date is on record. */
  readonly givenOn: string | null;
};

/** "Approve orders" on an Access page (boards 71 and 71b). */
export type ApproveOrdersAccess = {
  /** Whether the viewer gives and removes it (`canGiveApproveOrders`). */
  readonly canGive: boolean;
  /** Whether the viewer decides orders: "Your access" carries the chip. */
  readonly yours: boolean;
  /** Who holds it; listed on a team page only. */
  readonly holders: readonly ApproveOrdersHolder[];
};

/** A lead's or head's page: "Approve orders" is not theirs to see or give. */
export const NO_APPROVE_ORDERS: ApproveOrdersAccess = { canGive: false, yours: false, holders: [] };

export type AccessPage = {
  /** The unit, and with it what the viewer holds in each of its places (`heldIn`). */
  readonly unit: AccessUnit;
  /** The other leads of the unit, never the viewer (issue #230). */
  readonly roleAccess: readonly RoleAccess[];
  /** Every stored grant in the unit, a lead's or head's included (issue #591); never an area their role gives (`roleCovers`), which is in `roleAccess`. */
  readonly grants: readonly AccessGrant[];
  /** The people in the unit: everyone but the viewer. Give access lists those it can give something (`grantablePeople`). */
  readonly people: readonly AccessPerson[];
  /** "Approve orders": who holds it, and whether the viewer gives it (board 71). */
  readonly approveOrders: ApproveOrdersAccess;
};

/** One row of the table (boards 60 and 71): a person, "Approve orders" when they hold it, their areas in the order given, and the latest giver. */
export type PersonAccess = {
  readonly person: AccessPerson;
  readonly approveOrders: boolean;
  readonly grants: readonly AccessGrant[];
  readonly givenBy: string | null;
  readonly givenOn: string | null;
};

/**
 * The grants and the "Approve orders" holders grouped one row per person,
 * people in the order they first appear, holders first. A row's giver is
 * whoever gave its newest grant, else "Approve orders".
 */
export function accessByPerson(grants: readonly AccessGrant[], holders: readonly ApproveOrdersHolder[] = []): PersonAccess[] {
  const order: number[] = [];
  const byPerson = new Map<number, AccessGrant[]>();
  const add = (id: number) => {
    if (!byPerson.has(id)) {
      order.push(id);
      byPerson.set(id, []);
    }
  };
  for (const holder of holders) add(holder.person.id);
  for (const grant of grants) {
    add(grant.person.id);
    byPerson.get(grant.person.id)!.push(grant);
  }
  return order.map((id) => {
    const mine = [...byPerson.get(id)!].sort((a, b) => a.id - b.id);
    const holder = holders.find((h) => h.person.id === id);
    const latest = mine[mine.length - 1] ?? holder!;
    return { person: latest.person, approveOrders: holder !== undefined, grants: mine, givenBy: latest.givenBy, givenOn: latest.givenOn };
  });
}

/** What a person holds now in one place, area by area. */
export function areaLevelsOf(grants: readonly AccessGrant[], personId: number, place: AccessPlace): AreaLevels {
  const levels: Partial<Record<AccessTarget, AccessLevel>> = {};
  for (const g of grants) {
    if (g.person.id === personId && samePlace(g.place, place)) levels[g.target] = levels[g.target] === "edit" ? "edit" : g.level;
  }
  return levels;
}

/** Whether the person holds "Approve orders" now. */
export function holdsApproveOrders(access: Pick<AccessPage, "approveOrders">, personId: number): boolean {
  return access.approveOrders.holders.some((h) => h.person.id === personId);
}

/** The places a person holds any grant in, in the order of `placesOf`. */
export function placesHeldBy(unit: AccessUnit, grants: readonly AccessGrant[], personId: number): AccessPlace[] {
  return placesOf(unit).filter((place) => grants.some((g) => g.person.id === personId && samePlace(g.place, place)));
}

/** The highest level the viewer holds on an area, or null. */
export function heldLevel(held: readonly HeldAccess[], target: AccessTarget): AccessLevel | null {
  const levels = held.filter((h) => h.target === target).map((h) => h.level);
  if (levels.includes("edit")) return "edit";
  return levels.includes("view") ? "view" : null;
}

/** Whether the viewer holds `target` at `level` or above. */
function reaches(held: readonly HeldAccess[], target: AccessTarget, level: AccessLevel): boolean {
  const have = heldLevel(held, target);
  return have !== null && (level === "view" || have === "edit");
}

/**
 * What the viewer may do with one area of one person's access in one place,
 * in a drawer: nothing when the person's role already gives it there
 * (`roleCovers`), the viewer does not hold the area, or the person holds it
 * above the viewer; else tick or untick it, up to `highest`.
 */
export type AreaRule = { readonly changeable: false } | { readonly changeable: true; readonly highest: AccessLevel };

export function areaRule(held: readonly HeldAccess[], person: AccessPerson, place: AccessPlace, target: AccessTarget, current: AccessLevel | null): AreaRule {
  const highest = heldLevel(held, target);
  if (roleCovers(person, place, target) || highest === null) return { changeable: false };
  if (current !== null && !reaches(held, target, current)) return { changeable: false };
  return { changeable: true, highest };
}

/** Whether the viewer may change anything of this person's access in one place. */
export function canChangePerson(held: readonly HeldAccess[], person: AccessPerson, place: AccessPlace, current: AreaLevels): boolean {
  return ACCESS_TARGETS.some((t) => areaRule(held, person, place, t, current[t] ?? null).changeable);
}

/**
 * The areas a drawer lists for a person in one place: those the place offers
 * that the viewer holds, and any other the person holds there, which shows
 * locked; never one the person's role already gives there. With no person
 * chosen yet, every area the place offers that the viewer holds.
 */
export function shownAreas(held: readonly HeldAccess[], person: AccessPerson | undefined, place: AccessPlace, current: AreaLevels): AccessTarget[] {
  return targetsAt(place).filter(
    (t) => (person === undefined || !roleCovers(person, place, t)) && (heldLevel(held, t) !== null || current[t] !== undefined),
  );
}

/**
 * The places a drawer offers for a person: on a lead's page their division
 * there (issue #185) and, for a lead who holds Content, the whole team (issue
 * #504); every place of the unit on a head's or a team page.
 */
export function placesFor(unit: AccessUnit, person: AccessPerson): AccessPlace[] {
  if (unit.kind !== "division") return placesOf(unit);
  const division = person.division ?? unit.divisions[0].division;
  return [{ kind: "division", division }, ...contentPlace(unit)];
}

/**
 * The people Give access lists (issue #591): everyone in the unit but the
 * viewer, leads and heads included, to whom the viewer can give some area in
 * some place. A full-access seat, whose role holds every area, is listed
 * only to the team leader, who can give them "Approve orders" (issue #635);
 * a co-lead whose role already holds all the viewer could give is never listed.
 */
export function grantablePeople(access: Pick<AccessPage, "unit" | "people" | "approveOrders">): AccessPerson[] {
  return access.people.filter((person) =>
    (person.role.kind === "full" && access.approveOrders.canGive) ||
    placesFor(access.unit, person).some((place) => {
      const held = heldIn(access.unit, place);
      return targetsAt(place).some((t) => heldLevel(held, t) !== null && !roleCovers(person, place, t));
    }),
  );
}

/** One change to one area of a person's access. */
export type AccessChange =
  | { readonly kind: "add"; readonly target: AccessTarget; readonly to: AccessLevel }
  | { readonly kind: "change"; readonly target: AccessTarget; readonly from: AccessLevel; readonly to: AccessLevel }
  | { readonly kind: "remove"; readonly target: AccessTarget; readonly from: AccessLevel };

/** The changes that take a person from `current` to `next`, area by area. */
export function accessChanges(current: AreaLevels, next: AreaLevels): AccessChange[] {
  // Every area, so a stray grant outside the whole team is still taken away.
  return ACCESS_TARGETS.flatMap((target): AccessChange[] => {
    const from = current[target];
    const to = next[target];
    if (from === to) return [];
    if (from === undefined) return to === undefined ? [] : [{ kind: "add", target, to }];
    if (to === undefined) return [{ kind: "remove", target, from }];
    return [{ kind: "change", target, from, to }];
  });
}

/**
 * The viewer's delegation limit on one change: the area is theirs to touch,
 * at both ends, offered in the place, and never one the person's role
 * already gives there (`roleCovers`, issue #591).
 */
function allowed(held: readonly HeldAccess[], person: AccessPerson, place: AccessPlace, change: AccessChange): boolean {
  if (roleCovers(person, place, change.target)) return false;
  if (change.kind !== "remove" && !targetsAt(place).includes(change.target)) return false;
  const from = change.kind === "add" ? null : change.from;
  const to = change.kind === "remove" ? null : change.to;
  return (from === null || reaches(held, change.target, from)) && (to === null || reaches(held, change.target, to));
}

/**
 * What the Give access and Edit access drawers send: the person's areas in
 * one place as they should be, and, from the team leader, whether they hold
 * "Approve orders" (board 71b). On a lead's page the place is always the
 * person's division (issue #185), so `where` may be left out there.
 */
export type SaveAccess = {
  readonly personId: number;
  readonly where?: PlaceKey;
  readonly areas: AreaLevels;
  readonly approveOrders?: boolean;
};

/**
 * A checked write: the person, the place, the changes to make there, each
 * within the viewer's limit, and the "Approve orders" change, if any.
 */
export type AccessWrite = {
  readonly personId: number;
  readonly place: AccessPlace;
  readonly changes: readonly AccessChange[];
  readonly approveOrders: ApproveOrdersChange | null;
};

const level = z.enum(ACCESS_LEVELS).optional();
const placeKeySchema = z.union([z.literal("team"), z.string().regex(/^department-[1-9]\d*$/), z.number().int().positive()]);
const saveAccessSchema = z.object({
  personId: z.number().int().positive(),
  where: placeKeySchema.optional(),
  areas: z.strictObject({ positions: level, applications: level, members: level, content: level, orders: level }),
  approveOrders: z.boolean().optional(),
});

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

type AccessFacts = Pick<AccessPage, "unit" | "people" | "grants" | "approveOrders">;

function outsideUnit(unit: AccessUnit): string {
  switch (unit.kind) {
    case "division":
      return unit.divisions.length === 1 ? "You can give access only to people in your division." : "You can give access only to people in your divisions.";
    case "department":
      return "You can give access only to people in your department.";
    case "team":
      return "You can give access only to people on the team.";
  }
}

function checkChanges(access: AccessFacts, personId: number, place: AccessPlace, next: AreaLevels): Checked<Omit<AccessWrite, "approveOrders">> {
  const person = access.people.find((p) => p.id === personId);
  if (person === undefined) return { ok: false, error: outsideUnit(access.unit) };
  for (const target of TEAM_ONLY_TARGETS) {
    if (next[target] !== undefined && place.kind !== "team") return { ok: false, error: `${ACCESS_TARGET_LABELS[target]} access is given to the whole team only.` };
  }
  for (const target of ACCESS_TARGETS) {
    const level = next[target];
    if (level !== undefined && !levelsOf(target).includes(level)) return { ok: false, error: `${ACCESS_TARGET_LABELS[target]} access is given at Can edit only.` };
  }
  const changes = accessChanges(areaLevelsOf(access.grants, personId, place), next);
  const held = heldIn(access.unit, place);
  if (!changes.every((c) => allowed(held, person, place, c))) {
    return { ok: false, error: "You can only give or change access you have, up to your own level." };
  }
  return { ok: true, value: { personId, place, changes } };
}

/**
 * The "Approve orders" change a save asks for, checked by the one rule
 * (`checkApproveOrdersChange`): null when it asks none or leaves it as it is.
 */
function checkApproveOrders(access: AccessFacts, personId: number, holds: boolean | undefined): Checked<ApproveOrdersChange | null> {
  if (holds === undefined || holds === holdsApproveOrders(access, personId)) return { ok: true, value: null };
  return checkApproveOrdersChange(
    {
      byTeamLeader: access.approveOrders.canGive,
      team: access.people.map((p) => p.id),
      // The team leader is the viewer, never one of `people`.
      teamLeaders: [],
      holders: access.approveOrders.holders.map((h) => h.person.id),
    },
    { personId, holds },
  );
}

/**
 * Checks a Give access or Edit access Save from the browser against what the
 * viewer holds, who is in their unit, and where they may give access: on a
 * lead's page the division of the person they edit, only one the lead leads,
 * up to what the lead holds there (issue #185); their department or one of its
 * divisions; or, from full access, the whole team, a department or a division
 * (board 71b). The person's areas
 * in that place become exactly `areas`; every add, level change and removal
 * that takes must be within the viewer's own level, Content goes only to the
 * whole team, only at Can edit and only from someone who
 * holds it (full access, or a Content grant: `heldIn`), and access a
 * person's role gives is never touched (`roleCovers`). A full-access seat
 * takes no area, since their role holds every area, but the team leader gives
 * and removes their "Approve orders" (`checkFullAccessSave`). "Approve orders" changes
 * only from the team leader. The Activity log is no area, so it is never
 * given. Every rule runs on the server: the drawer's own limits are a
 * convenience, not the check.
 */
export function checkSaveAccess(access: AccessFacts, input: unknown): Checked<AccessWrite> {
  const parsed = saveAccessSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the form." };
  const { personId, where } = parsed.data;
  const areas: Partial<Record<AccessTarget, AccessLevel>> = {};
  for (const target of ACCESS_TARGETS) {
    const chosen = parsed.data.areas[target];
    if (chosen !== undefined) areas[target] = chosen;
  }
  if (access.people.find((p) => p.id === personId)?.role.kind === "full") return checkFullAccessSave(access, personId, areas, parsed.data.approveOrders);
  const place = placeOfSave(access, personId, where);
  if (place === undefined) return { ok: false, error: `You can give access only inside your ${access.unit.kind}.` };
  if (!inPersonDivision(access, personId, place)) return { ok: false, error: "You can give access only in the division of the person you edit." };
  const approve = checkApproveOrders(access, personId, parsed.data.approveOrders);
  if (!approve.ok) return approve;
  const approves = parsed.data.approveOrders ?? holdsApproveOrders(access, personId);
  if (Object.keys(areas).length === 0 && !approves) return { ok: false, error: "Choose at least one area." };
  const checked = checkChanges(access, personId, place, areas);
  return checked.ok ? { ok: true, value: { ...checked.value, approveOrders: approve.value } } : checked;
}

/**
 * A Save for a full-access seat (issue #635): their role holds every area, so
 * it carries no area, and its one change is "Approve orders", given or
 * removed by the team leader alone (`checkApproveOrders`). The write touches
 * no area, so its place is the unit's home place.
 */
function checkFullAccessSave(access: AccessFacts, personId: number, areas: AreaLevels, holds: boolean | undefined): Checked<AccessWrite> {
  if (Object.keys(areas).length > 0 || holds === undefined) return { ok: false, error: "Full access already holds every area." };
  const approve = checkApproveOrders(access, personId, holds);
  if (!approve.ok) return approve;
  if (approve.value === null) return { ok: false, error: holds ? "They already hold Approve orders." : "They do not hold Approve orders." };
  return { ok: true, value: { personId, place: homePlace(access.unit), changes: [], approveOrders: approve.value } };
}

/** The place a Save names: `where` in the unit; left out, the person's division on a lead's page, else the unit's first place. */
function placeOfSave(access: AccessFacts, personId: number, where: string | number | undefined): AccessPlace | undefined {
  if (where !== undefined) return placesOf(access.unit).find((p) => placeKey(p) === where);
  const division = access.unit.kind === "division" ? access.people.find((p) => p.id === personId)?.division : null;
  return division ? { kind: "division", division } : homePlace(access.unit);
}

/**
 * On a lead's page, whether the place is the division the person is in there
 * (issue #185), or the whole team, where a lead holding Content gives Content
 * alone (issue #504); every place passes on a head's or a team page. Someone
 * outside the unit passes here and is refused by `checkChanges`.
 */
function inPersonDivision(access: AccessFacts, personId: number, place: AccessPlace): boolean {
  if (access.unit.kind !== "division" || place.kind === "team") return true;
  const person = access.people.find((p) => p.id === personId);
  return person === undefined || (place.kind === "division" && person.division?.id === place.division.id);
}

/**
 * Checks Remove all access: every area the person holds, in every place of
 * the unit, goes, each within the viewer's limit, and "Approve orders" with
 * them, which only the team leader removes.
 */
export function checkRemoveAllAccess(access: AccessFacts, personId: unknown): Checked<readonly AccessWrite[]> {
  if (typeof personId !== "number" || !Number.isSafeInteger(personId)) return { ok: false, error: "Unknown person." };
  if (!access.people.some((p) => p.id === personId)) return { ok: false, error: outsideUnit(access.unit) };
  const approve = checkApproveOrders(access, personId, false);
  if (!approve.ok) return approve;
  const writes: AccessWrite[] = [];
  for (const place of placesHeldBy(access.unit, access.grants, personId)) {
    const checked = checkChanges(access, personId, place, {});
    if (!checked.ok) return checked;
    writes.push({ ...checked.value, approveOrders: null });
  }
  if (approve.value !== null) writes.push({ personId, place: homePlace(access.unit), changes: [], approveOrders: approve.value });
  return { ok: true, value: writes };
}

/** What Remove on one "Current access" row in Edit access sends (issue #483): one area of one person, in one place. */
export type RemoveGrant = {
  readonly personId: number;
  readonly where: PlaceKey;
  readonly target: AccessTarget;
};

const removeGrantSchema = z.object({
  personId: z.number().int().positive(),
  where: placeKeySchema,
  target: z.enum(ACCESS_TARGETS),
});

/** The removal of one grant, as its row's Remove sends it. */
export function removalOf(grant: AccessGrant): RemoveGrant {
  return { personId: grant.person.id, where: placeKey(grant.place), target: grant.target };
}

/**
 * Checks Remove on one grant (issue #483): the person is in the viewer's unit,
 * the area there is no access their role gives (issue #591), the place is in the unit (on a lead's page, the person's own
 * division), the person holds the area there, and the viewer reaches it at
 * the level the person holds it. The person's other areas there, and every
 * other place, stay as they are: the write is that one removal. The drawer
 * shows Remove only where this passes, and the server runs it again.
 */
export function checkRemoveGrant(access: AccessFacts, input: unknown): Checked<AccessWrite> {
  const parsed = removeGrantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Unknown access." };
  const { personId, where, target } = parsed.data;
  if (!access.people.some((p) => p.id === personId)) return { ok: false, error: outsideUnit(access.unit) };
  const place = placesOf(access.unit).find((p) => placeKey(p) === where);
  if (place === undefined) return { ok: false, error: `You can remove access only inside your ${access.unit.kind}.` };
  if (!inPersonDivision(access, personId, place)) return { ok: false, error: "You can remove access only in the division of the person you edit." };
  const current = areaLevelsOf(access.grants, personId, place);
  if (current[target] === undefined) return { ok: false, error: "They do not hold this access there." };
  const next: Partial<Record<AccessTarget, AccessLevel>> = { ...current };
  delete next[target];
  const checked = checkChanges(access, personId, place, next);
  if (!checked.ok) return { ok: false, error: "You can only remove access you have, up to your own level." };
  return { ok: true, value: { ...checked.value, approveOrders: null } };
}

/** A grant as the `scopes` table stores it (issue #247). */
export type GrantRow = {
  readonly scope: "division" | "department" | "team" | "website";
  /** The area; on a `website` row, `content` for Content (issue #504). */
  readonly target: UnitTarget | "content";
  readonly deptId: number | null;
  readonly divisionId: number | null;
};

/**
 * The `scopes` row one area in one place is stored as. Content is a `website`
 * row on `content` in no unit (issue #504), read by `holdsContentGrant`
 * (./viewer.ts). The old Alumni `website` rows on `all` are no area here and
 * nothing reads them (issue #589). A whole-team
 * area is a `team` row in no unit; a department's has only `dept_id`; a
 * division's only `division_id`.
 */
export function grantRowOf(place: AccessPlace, target: AccessTarget): GrantRow {
  if (target === "content") return { scope: "website", target: "content", deptId: null, divisionId: null };
  switch (place.kind) {
    case "team":
      return { scope: "team", target, deptId: null, divisionId: null };
    case "department":
      return { scope: "department", target, deptId: place.department.id, divisionId: null };
    case "division":
      return { scope: "division", target, deptId: null, divisionId: place.division.id };
  }
}
